import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException
} from "@nestjs/common";
import { createHmac, timingSafeEqual } from "node:crypto";
import { ConfigService } from "@nestjs/config";
import {
  OrderStatus,
  PaymentProvider,
  PaymentStatus,
  PaymentTransactionKind,
  PaymentTransactionStatus,
  PaymentWebhookStatus,
  StatusTransitionEntityType
} from "@prisma/client";
import { AuditRepository } from "../audit/audit.repository";
import { PublicStorefrontContext } from "../auth/auth.types";
import { CartRepository } from "../cart/cart.repository";
import { canTransitionOrderStatus } from "../orders/order-status.rules";
import { OrdersRepository } from "../orders/orders.repository";
import { PaymentsRepository } from "./payments.repository";
import { createPaymentWebhookQueue } from "./payments.queue";
import { StripeConnectPaymentGatewayAdapter } from "./stripe-connect.adapter";
import { CreateOrderPaymentIntentInput } from "./payments.schemas";

@Injectable()
export class PaymentsService {
  constructor(
    private readonly configService: ConfigService,
    private readonly auditRepository: AuditRepository,
    private readonly paymentsRepository: PaymentsRepository,
    private readonly ordersRepository: OrdersRepository,
    private readonly cartRepository: CartRepository,
    private readonly stripeConnectAdapter: StripeConnectPaymentGatewayAdapter
  ) {}

  getBoundary() {
    return this.paymentsRepository.getBoundary();
  }

  async createOrderPaymentIntent(
    publicStore: PublicStorefrontContext,
    orderId: string,
    input: CreateOrderPaymentIntentInput
  ) {
    const order = await this.ordersRepository.getOrderByIdAndStore(orderId, publicStore.storeId);

    if (!order) {
      throw new NotFoundException({
        message: "Order not found",
        code: "ORDER_NOT_FOUND",
        orderId
      });
    }

    if (!this.isOrderPayable(order.status)) {
      throw new BadRequestException({
        message: "Order is not in a payable state",
        code: "ORDER_NOT_PAYABLE",
        orderId,
        status: order.status
      });
    }

    const normalizedEmail = input.customerEmail.trim().toLowerCase();
    if (order.customerEmail.trim().toLowerCase() !== normalizedEmail) {
      throw new BadRequestException({
        message: "Customer email does not match the order",
        code: "ORDER_CUSTOMER_EMAIL_MISMATCH",
        orderId
      });
    }

    if (input.sessionId && order.cart?.sessionId && order.cart.sessionId !== input.sessionId.trim()) {
      throw new BadRequestException({
        message: "Session does not match the order cart",
        code: "ORDER_SESSION_MISMATCH",
        orderId
      });
    }

    const provider = PaymentProvider.STRIPE_CONNECT;
    let payment = order.payment;

    if (!payment) {
      payment = await this.paymentsRepository.createPayment({
        storeId: publicStore.storeId,
        cartId: order.cartId!,
        customerId: order.customerId,
        provider,
        status: PaymentStatus.CREATED,
        currencyCode: order.currencyCode,
        amountCents: order.totalCents,
        attemptCount: 0,
        metadata: JSON.stringify({
          orderId: order.id,
          source: "checkout"
        })
      });

      await this.ordersRepository.updateOrder(order.id, {
        paymentId: payment.id
      });
    }

    const intent = await this.stripeConnectAdapter.createPaymentIntent({
      provider,
      storeId: publicStore.storeId,
      orderId: order.id,
      paymentId: payment.id,
      amountCents: order.totalCents,
      currencyCode: order.currencyCode,
      customerEmail: order.customerEmail,
      customerFullName: order.customerFullName,
      metadata: {
        orderStatus: order.status
      }
    });

    const nextAttemptCount = payment.attemptCount + 1;

    const updatedPayment = await this.transitionPaymentStatus({
      paymentId: payment.id,
      storeId: publicStore.storeId,
      toStatus: PaymentStatus.PENDING,
      source: "checkout.payment_intent",
      reason: "Payment intent created for checkout",
      metadata: {
        orderId: order.id,
        attemptCount: nextAttemptCount,
        providerPaymentId: intent.providerPaymentId
      },
      attemptCount: nextAttemptCount,
      externalPaymentId: intent.providerPaymentId,
      externalReference: intent.externalReference,
      providerPayload: JSON.stringify(intent.rawPayload)
    });

    await this.paymentsRepository.createPaymentTransaction({
      paymentId: payment.id,
      storeId: publicStore.storeId,
      provider,
      kind: PaymentTransactionKind.INTENT,
      status: PaymentTransactionStatus.SUCCEEDED,
      idempotencyKey: `${payment.id}:intent:${nextAttemptCount}`,
      externalTransactionId: intent.providerPaymentId,
      requestPayload: JSON.stringify({
        amountCents: order.totalCents,
        currencyCode: order.currencyCode,
        customerEmail: order.customerEmail
      }),
      responsePayload: JSON.stringify(intent.rawPayload),
      occurredAt: new Date()
    });

    await this.transitionOrderStatus({
      orderId: order.id,
      storeId: publicStore.storeId,
      toStatus: OrderStatus.WAITING_PAYMENT,
      source: "checkout.payment_intent",
      reason: "Customer started payment",
      metadata: {
        paymentId: payment.id,
        providerPaymentId: intent.providerPaymentId
      },
      paymentId: payment.id
    });

    const refreshedOrder = await this.ordersRepository.getOrderByIdAndStore(order.id, publicStore.storeId);

    return {
      store: publicStore,
      order: refreshedOrder,
      payment: updatedPayment,
      intent: {
        provider: intent.provider,
        providerPaymentId: intent.providerPaymentId,
        externalReference: intent.externalReference,
        clientSecret: intent.clientSecret,
        checkoutUrl: intent.checkoutUrl,
        status: intent.status
      }
    };
  }

  async receiveStripeWebhook(input: {
    body: unknown;
    rawBody?: Buffer;
    signature?: string;
    userAgent?: string;
    sourceIp?: string;
    headers?: Record<string, string | string[] | undefined>;
  }) {
    const secret = this.configService.get<string>("STRIPE_WEBHOOK_SECRET");

    if (!secret) {
      throw new ForbiddenException({
        message: "Stripe webhook secret is not configured",
        code: "STRIPE_WEBHOOK_SECRET_MISSING"
      });
    }

    if (!input.signature) {
      throw new ForbiddenException({
        message: "Stripe signature is required",
        code: "STRIPE_SIGNATURE_MISSING"
      });
    }

    const payloadBuffer = input.rawBody ?? Buffer.from(JSON.stringify(input.body ?? {}), "utf8");
    this.assertStripeSignature(secret, payloadBuffer, input.signature);

    const event = this.parseStripeWebhookBody(input.body);
    const existingEvent = await this.paymentsRepository.findPaymentWebhookEvent(
      PaymentProvider.STRIPE_CONNECT,
      event.id
    );

    if (existingEvent) {
      return {
        received: true,
        duplicate: true,
        event: existingEvent
      };
    }

    const persistedEvent = await this.paymentsRepository.createPaymentWebhookEvent({
      provider: PaymentProvider.STRIPE_CONNECT,
      externalEventId: event.id,
      eventType: event.type,
      paymentId: this.readMetadataValue(event.data.object, "paymentId"),
      orderId: this.readMetadataValue(event.data.object, "orderId"),
      storeId: this.readMetadataValue(event.data.object, "storeId"),
      idempotencyKey: this.extractIdempotencyKey(event),
      signature: input.signature,
      requestHeaders: JSON.stringify(input.headers ?? {}),
      payload: payloadBuffer.toString("utf8"),
      userAgent: input.userAgent ?? null,
      sourceIp: input.sourceIp ?? null,
      livemode: event.livemode
    });

    const queued = await this.enqueuePaymentWebhookEvent(persistedEvent.id);

    return {
      received: true,
      duplicate: false,
      queued,
      event: persistedEvent
    };
  }

  async enqueuePaymentWebhookEvent(webhookEventId: string) {
    const queue = createPaymentWebhookQueue();

    try {
      const job = await queue.add(
        "process-payment-webhook",
        {
          webhookEventId
        },
        {
          jobId: webhookEventId
        }
      );

      return {
        queued: true,
        jobId: job.id ?? webhookEventId
      };
    } finally {
      await queue.close();
    }
  }

  async processPaymentWebhookJob(webhookEventId: string) {
    const webhookEvent = await this.paymentsRepository.findPaymentWebhookEventById(webhookEventId);

    if (!webhookEvent) {
      throw new NotFoundException({
        message: "Payment webhook event not found",
        code: "PAYMENT_WEBHOOK_EVENT_NOT_FOUND",
        webhookEventId
      });
    }

    if (webhookEvent.status === PaymentWebhookStatus.PROCESSED) {
      return {
        processed: false,
        skipped: true,
        reason: "already_processed",
        webhookEventId
      };
    }

    await this.paymentsRepository.updatePaymentWebhookEvent(webhookEvent.id, {
      status: PaymentWebhookStatus.PROCESSING,
      failureMessage: null
    });

    try {
      const payload = this.parsePersistedWebhookPayload(webhookEvent.payload);
      const nextState = this.resolvePaymentWebhookState(payload);

      if (!webhookEvent.paymentId || !webhookEvent.orderId || !webhookEvent.storeId) {
        throw new BadRequestException({
          message: "Webhook metadata is incomplete for processing",
          code: "PAYMENT_WEBHOOK_METADATA_INCOMPLETE",
          webhookEventId
        });
      }

      const webhookTransactionIdempotencyKey = `${webhookEvent.externalEventId}:webhook`;
      const existingWebhookTransaction = await this.paymentsRepository.findPaymentTransactionByIdempotencyKey(
        webhookEvent.paymentId,
        webhookTransactionIdempotencyKey
      );

      if (existingWebhookTransaction) {
        await this.paymentsRepository.updatePaymentWebhookEvent(webhookEvent.id, {
          status: PaymentWebhookStatus.PROCESSED,
          processedAt: new Date(),
          failureMessage: null
        });

        return {
          processed: false,
          skipped: true,
          reason: "transaction_already_recorded",
          webhookEventId
        };
      }

      await this.transitionPaymentStatus({
        paymentId: webhookEvent.paymentId,
        storeId: webhookEvent.storeId,
        toStatus: nextState.paymentStatus,
        source: `payments.webhook:${payload.type}`,
        reason: "Webhook processed",
        metadata: {
          webhookEventId: webhookEvent.id,
          externalEventId: webhookEvent.externalEventId,
          eventType: payload.type
        },
        failureCode: nextState.failureCode,
        failureMessage: nextState.failureMessage,
        paidAt: nextState.paymentStatus === PaymentStatus.APPROVED ? new Date() : undefined
      });

      await this.transitionOrderStatus({
        orderId: webhookEvent.orderId,
        storeId: webhookEvent.storeId,
        toStatus: nextState.orderStatus,
        source: `payments.webhook:${payload.type}`,
        reason: "Payment webhook propagated to order",
        metadata: {
          webhookEventId: webhookEvent.id,
          paymentId: webhookEvent.paymentId,
          paymentStatus: nextState.paymentStatus
        }
      });

      await this.paymentsRepository.createPaymentTransaction({
        paymentId: webhookEvent.paymentId,
        storeId: webhookEvent.storeId,
        provider: webhookEvent.provider,
        kind: PaymentTransactionKind.WEBHOOK,
        status: nextState.transactionStatus,
        idempotencyKey: webhookTransactionIdempotencyKey,
        externalTransactionId: this.readString(payload.data.object, "id") ?? webhookEvent.externalEventId,
        requestPayload: webhookEvent.payload,
        responsePayload: JSON.stringify({
          eventType: payload.type,
          mappedPaymentStatus: nextState.paymentStatus,
          mappedOrderStatus: nextState.orderStatus
        }),
        errorCode: nextState.failureCode,
        errorMessage: nextState.failureMessage,
        occurredAt: new Date()
      });

      await this.paymentsRepository.updatePaymentWebhookEvent(webhookEvent.id, {
        status: PaymentWebhookStatus.PROCESSED,
        processedAt: new Date(),
        failureMessage: null
      });

      return {
        processed: true,
        skipped: false,
        webhookEventId
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown webhook processing error";

      await this.paymentsRepository.updatePaymentWebhookEvent(webhookEvent.id, {
        status: PaymentWebhookStatus.FAILED,
        processedAt: new Date(),
        failureMessage: message
      });

      throw error;
    }
  }

  private isOrderPayable(status: string) {
    return status === "CREATED" || status === "WAITING_PAYMENT" || status === "PAYMENT_FAILED";
  }

  async transitionPaymentStatus(input: {
    paymentId: string;
    storeId?: string | null;
    toStatus: PaymentStatus;
    source: string;
    reason?: string | null;
    metadata?: Record<string, unknown> | null;
    attemptCount?: number;
    externalPaymentId?: string | null;
    externalReference?: string | null;
    providerPayload?: string | null;
    failureCode?: string | null;
    failureMessage?: string | null;
    expiresAt?: Date | null;
    paidAt?: Date | null;
  }) {
    const payment = await this.paymentsRepository.getPaymentById(input.paymentId);

    if (!payment) {
      throw new NotFoundException({
        message: "Payment not found",
        code: "PAYMENT_NOT_FOUND",
        paymentId: input.paymentId
      });
    }

    if (input.storeId && payment.storeId !== input.storeId) {
      throw new ForbiddenException({
        message: "Payment does not belong to the informed store",
        code: "PAYMENT_STORE_MISMATCH",
        paymentId: input.paymentId,
        storeId: input.storeId
      });
    }

    const fromStatus = payment.status;
    const allowed = this.canTransitionPaymentStatus(fromStatus, input.toStatus);

    if (!allowed) {
      await this.auditRepository.createStatusTransitionAudit({
        entityType: StatusTransitionEntityType.PAYMENT,
        entityId: payment.id,
        storeId: payment.storeId,
        fromStatus,
        toStatus: input.toStatus,
        allowed: false,
        reason: input.reason ?? "Invalid payment status transition",
        source: input.source,
        metadata: this.serializeTransitionMetadata(input.metadata)
      });

      throw new BadRequestException({
        message: "Payment status transition is not allowed",
        code: "PAYMENT_STATUS_TRANSITION_INVALID",
        paymentId: payment.id,
        fromStatus,
        toStatus: input.toStatus
      });
    }

    const updatedPayment = await this.paymentsRepository.updatePayment(payment.id, {
      status: input.toStatus,
      attemptCount: input.attemptCount,
      externalPaymentId: input.externalPaymentId,
      externalReference: input.externalReference,
      providerPayload: input.providerPayload,
      failureCode: input.failureCode,
      failureMessage: input.failureMessage,
      expiresAt: input.expiresAt,
      paidAt: input.paidAt
    });

    await this.auditRepository.createStatusTransitionAudit({
      entityType: StatusTransitionEntityType.PAYMENT,
      entityId: payment.id,
      storeId: payment.storeId,
      fromStatus,
      toStatus: input.toStatus,
      allowed: true,
      reason: input.reason ?? null,
      source: input.source,
      metadata: this.serializeTransitionMetadata(input.metadata)
    });

    return updatedPayment;
  }

  async transitionOrderStatus(input: {
    orderId: string;
    storeId?: string | null;
    toStatus: OrderStatus;
    source: string;
    reason?: string | null;
    metadata?: Record<string, unknown> | null;
    paymentId?: string | null;
  }) {
    const order = await this.ordersRepository.getOrderById(input.orderId);

    if (!order) {
      throw new NotFoundException({
        message: "Order not found",
        code: "ORDER_NOT_FOUND",
        orderId: input.orderId
      });
    }

    if (input.storeId && order.storeId !== input.storeId) {
      throw new ForbiddenException({
        message: "Order does not belong to the informed store",
        code: "ORDER_STORE_MISMATCH",
        orderId: input.orderId,
        storeId: input.storeId
      });
    }

    const fromStatus = order.status;
    const allowed = this.canTransitionOrderStatus(fromStatus, input.toStatus);

    if (!allowed) {
      await this.auditRepository.createStatusTransitionAudit({
        entityType: StatusTransitionEntityType.ORDER,
        entityId: order.id,
        storeId: order.storeId,
        fromStatus,
        toStatus: input.toStatus,
        allowed: false,
        reason: input.reason ?? "Invalid order status transition",
        source: input.source,
        metadata: this.serializeTransitionMetadata(input.metadata)
      });

      throw new BadRequestException({
        message: "Order status transition is not allowed",
        code: "ORDER_STATUS_TRANSITION_INVALID",
        orderId: order.id,
        fromStatus,
        toStatus: input.toStatus
      });
    }

    const updatedOrder = await this.ordersRepository.updateOrder(order.id, {
      paymentId: input.paymentId,
      status: input.toStatus,
      statusUpdatedAt: new Date()
    });

    await this.auditRepository.createStatusTransitionAudit({
      entityType: StatusTransitionEntityType.ORDER,
      entityId: order.id,
      storeId: order.storeId,
      fromStatus,
      toStatus: input.toStatus,
      allowed: true,
      reason: input.reason ?? null,
      source: input.source,
      metadata: this.serializeTransitionMetadata(input.metadata)
    });

    return updatedOrder;
  }

  private assertStripeSignature(secret: string, payload: Buffer, signatureHeader: string) {
    const signatureParts = signatureHeader.split(",");
    const timestamp = signatureParts
      .find((part) => part.startsWith("t="))
      ?.slice(2)
      .trim();
    const providedSignature = signatureParts
      .find((part) => part.startsWith("v1="))
      ?.slice(3)
      .trim();

    if (!timestamp || !providedSignature) {
      throw new ForbiddenException({
        message: "Stripe signature header is malformed",
        code: "STRIPE_SIGNATURE_INVALID"
      });
    }

    const signedPayload = `${timestamp}.${payload.toString("utf8")}`;
    const expectedSignature = createHmac("sha256", secret).update(signedPayload).digest("hex");
    const providedBuffer = Buffer.from(providedSignature, "hex");
    const expectedBuffer = Buffer.from(expectedSignature, "hex");

    if (
      providedBuffer.length !== expectedBuffer.length ||
      !timingSafeEqual(providedBuffer, expectedBuffer)
    ) {
      throw new ForbiddenException({
        message: "Stripe signature validation failed",
        code: "STRIPE_SIGNATURE_INVALID"
      });
    }
  }

  private parseStripeWebhookBody(body: unknown) {
    if (!body || typeof body !== "object") {
      throw new BadRequestException({
        message: "Webhook body must be a valid JSON object",
        code: "STRIPE_WEBHOOK_BODY_INVALID"
      });
    }

    const event = body as {
      id?: unknown;
      type?: unknown;
      livemode?: unknown;
      request?: { idempotency_key?: unknown } | null;
      data?: { object?: Record<string, unknown> } | null;
    };

    if (typeof event.id !== "string" || event.id.trim().length === 0) {
      throw new BadRequestException({
        message: "Webhook event id is required",
        code: "STRIPE_WEBHOOK_EVENT_ID_REQUIRED"
      });
    }

    if (typeof event.type !== "string" || event.type.trim().length === 0) {
      throw new BadRequestException({
        message: "Webhook event type is required",
        code: "STRIPE_WEBHOOK_EVENT_TYPE_REQUIRED"
      });
    }

    return {
      id: event.id,
      type: event.type,
      livemode: typeof event.livemode === "boolean" ? event.livemode : null,
      request: event.request ?? null,
      data: {
        object:
          event.data?.object && typeof event.data.object === "object"
            ? event.data.object
            : {}
      }
    };
  }

  private readMetadataValue(object: Record<string, unknown>, key: string) {
    const metadata =
      object.metadata && typeof object.metadata === "object"
        ? (object.metadata as Record<string, unknown>)
        : null;
    const value = metadata?.[key];
    return typeof value === "string" && value.trim().length > 0 ? value : null;
  }

  private extractIdempotencyKey(event: { request: { idempotency_key?: unknown } | null }) {
    const value = event.request?.idempotency_key;
    return typeof value === "string" && value.trim().length > 0 ? value : null;
  }

  private parsePersistedWebhookPayload(payload: string) {
    const parsed = JSON.parse(payload) as {
      type?: unknown;
      data?: { object?: Record<string, unknown> } | null;
    };

    if (typeof parsed.type !== "string") {
      throw new BadRequestException({
        message: "Persisted webhook payload is missing the event type",
        code: "PAYMENT_WEBHOOK_PAYLOAD_INVALID"
      });
    }

    return {
      type: parsed.type,
      data: {
        object:
          parsed.data?.object && typeof parsed.data.object === "object"
            ? parsed.data.object
            : {}
      }
    };
  }

  private resolvePaymentWebhookState(payload: {
    type: string;
    data: { object: Record<string, unknown> };
  }) {
    if (payload.type === "payment_intent.succeeded") {
      return {
        paymentStatus: PaymentStatus.APPROVED,
        orderStatus: OrderStatus.PAYMENT_APPROVED,
        transactionStatus: PaymentTransactionStatus.SUCCEEDED,
        failureCode: null,
        failureMessage: null
      };
    }

    if (payload.type === "payment_intent.payment_failed") {
      return {
        paymentStatus: PaymentStatus.FAILED,
        orderStatus: OrderStatus.PAYMENT_FAILED,
        transactionStatus: PaymentTransactionStatus.FAILED,
        failureCode: this.readString(payload.data.object, "last_payment_error.code"),
        failureMessage:
          this.readString(payload.data.object, "last_payment_error.message") ?? "Payment failed"
      };
    }

    if (payload.type === "payment_intent.canceled") {
      const cancellationReason = this.readString(payload.data.object, "cancellation_reason");
      const isExpired = cancellationReason === "abandoned";

      return {
        paymentStatus: isExpired ? PaymentStatus.EXPIRED : PaymentStatus.CANCELED,
        orderStatus: OrderStatus.PAYMENT_FAILED,
        transactionStatus: PaymentTransactionStatus.CANCELED,
        failureCode: cancellationReason,
        failureMessage: isExpired ? "Payment expired before completion" : "Payment was canceled"
      };
    }

    if (payload.type === "charge.refunded") {
      return {
        paymentStatus: PaymentStatus.REFUNDED,
        orderStatus: OrderStatus.REFUNDED,
        transactionStatus: PaymentTransactionStatus.SUCCEEDED,
        failureCode: null,
        failureMessage: null
      };
    }

    throw new BadRequestException({
      message: "Webhook event type is not supported for processing",
      code: "PAYMENT_WEBHOOK_EVENT_UNSUPPORTED",
      eventType: payload.type
    });
  }

  private readString(object: Record<string, unknown>, path: string) {
    const value = path.split(".").reduce<unknown>((current, key) => {
      if (!current || typeof current !== "object") {
        return undefined;
      }

      return (current as Record<string, unknown>)[key];
    }, object);

    return typeof value === "string" && value.trim().length > 0 ? value : null;
  }

  private canTransitionPaymentStatus(fromStatus: PaymentStatus, toStatus: PaymentStatus) {
    if (fromStatus === toStatus) {
      return true;
    }

    const transitions: Record<PaymentStatus, PaymentStatus[]> = {
      CREATED: [PaymentStatus.PENDING, PaymentStatus.CANCELED, PaymentStatus.EXPIRED, PaymentStatus.FAILED],
      PENDING: [
        PaymentStatus.AUTHORIZED,
        PaymentStatus.APPROVED,
        PaymentStatus.FAILED,
        PaymentStatus.CANCELED,
        PaymentStatus.EXPIRED
      ],
      AUTHORIZED: [PaymentStatus.APPROVED, PaymentStatus.CANCELED, PaymentStatus.REFUNDED],
      APPROVED: [PaymentStatus.REFUNDED],
      FAILED: [PaymentStatus.PENDING, PaymentStatus.CANCELED, PaymentStatus.EXPIRED],
      CANCELED: [PaymentStatus.PENDING],
      EXPIRED: [PaymentStatus.PENDING],
      REFUNDED: []
    };

    return transitions[fromStatus].includes(toStatus);
  }

  private canTransitionOrderStatus(fromStatus: OrderStatus, toStatus: OrderStatus) {
    return canTransitionOrderStatus(fromStatus, toStatus);
  }

  private serializeTransitionMetadata(metadata?: Record<string, unknown> | null) {
    return metadata ? JSON.stringify(metadata) : null;
  }
}
