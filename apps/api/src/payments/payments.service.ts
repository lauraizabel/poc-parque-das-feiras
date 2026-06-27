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
  PaymentWebhookStatus
} from "@prisma/client";
import { PublicStorefrontContext } from "../auth/auth.types";
import { CartRepository } from "../cart/cart.repository";
import { OrdersRepository } from "../orders/orders.repository";
import { PaymentsRepository } from "./payments.repository";
import { createPaymentWebhookQueue } from "./payments.queue";
import { StripeConnectPaymentGatewayAdapter } from "./stripe-connect.adapter";
import { CreateOrderPaymentIntentInput } from "./payments.schemas";

@Injectable()
export class PaymentsService {
  constructor(
    private readonly configService: ConfigService,
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

    const updatedPayment = await this.paymentsRepository.updatePayment(payment.id, {
      status: PaymentStatus.PENDING,
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

    await this.ordersRepository.updateOrder(order.id, {
      paymentId: payment.id,
      status: order.status === "PAYMENT_FAILED" ? "WAITING_PAYMENT" : "WAITING_PAYMENT",
      statusUpdatedAt: new Date()
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

      await this.paymentsRepository.updatePayment(webhookEvent.paymentId, {
        status: nextState.paymentStatus,
        failureCode: nextState.failureCode,
        failureMessage: nextState.failureMessage,
        paidAt: nextState.paymentStatus === PaymentStatus.APPROVED ? new Date() : undefined
      });

      await this.ordersRepository.updateOrder(webhookEvent.orderId, {
        status: nextState.orderStatus,
        statusUpdatedAt: new Date()
      });

      await this.paymentsRepository.createPaymentTransaction({
        paymentId: webhookEvent.paymentId,
        storeId: webhookEvent.storeId,
        provider: webhookEvent.provider,
        kind: PaymentTransactionKind.WEBHOOK,
        status: nextState.transactionStatus,
        idempotencyKey: `${webhookEvent.externalEventId}:webhook`,
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
}
