import {
  BadRequestException,
  Injectable,
  NotFoundException
} from "@nestjs/common";
import { PaymentProvider, PaymentStatus, PaymentTransactionKind, PaymentTransactionStatus } from "@prisma/client";
import { PublicStorefrontContext } from "../auth/auth.types";
import { CartRepository } from "../cart/cart.repository";
import { OrdersRepository } from "../orders/orders.repository";
import { PaymentsRepository } from "./payments.repository";
import { StripeConnectPaymentGatewayAdapter } from "./stripe-connect.adapter";
import { CreateOrderPaymentIntentInput } from "./payments.schemas";

@Injectable()
export class PaymentsService {
  constructor(
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

  private isOrderPayable(status: string) {
    return status === "CREATED" || status === "WAITING_PAYMENT" || status === "PAYMENT_FAILED";
  }
}
