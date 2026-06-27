import assert from "node:assert/strict";
import { after, before, describe, it } from "node:test";
import { INestApplication } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import {
  OrderStatus,
  PaymentProvider,
  PaymentStatus,
  PlatformRole,
  ProductStatus,
  StatusTransitionEntityType
} from "@prisma/client";
import { prisma } from "@acme/database";
import { CartRepository } from "../cart/cart.repository";
import { OrdersRepository } from "../orders/orders.repository";
import { AppModule } from "../app.module";
import { PaymentsRepository } from "./payments.repository";
import { PaymentsService } from "./payments.service";

describe("payments state machine", () => {
  const suffix = Date.now().toString(36);
  const ownerEmail = `payments-state-machine-${suffix}@example.com`;
  const cartRepository = new CartRepository();
  const ordersRepository = new OrdersRepository();
  const paymentsRepository = new PaymentsRepository();

  let app: INestApplication;
  let paymentsService: PaymentsService;
  let userId = "";
  let storeId = "";
  let productId = "";
  let customerId = "";

  before(async () => {
    const testingModule = await Test.createTestingModule({
      imports: [AppModule]
    }).compile();

    app = testingModule.createNestApplication();
    await app.init();
    paymentsService = app.get(PaymentsService);

    const user = await prisma.user.create({
      data: {
        email: ownerEmail,
        passwordHash: "test-password-hash",
        platformRole: PlatformRole.CUSTOMER
      }
    });
    userId = user.id;

    const store = await prisma.store.create({
      data: {
        name: "Payments State Machine Store",
        slug: `payments-state-machine-${suffix}`,
        defaultSubdomain: `payments-state-machine-${suffix}`,
        ownerId: user.id
      }
    });
    storeId = store.id;

    const product = await prisma.product.create({
      data: {
        storeId,
        name: "Coador V60",
        slug: "coador-v60",
        sku: "CV60-001",
        priceCents: 7990,
        currencyCode: "BRL",
        stockQuantity: 50,
        status: ProductStatus.ACTIVE
      }
    });
    productId = product.id;

    const customer = await paymentsRepository.createCustomer({
      storeId,
      email: `buyer-${suffix}@example.com`,
      fullName: "Buyer State Machine"
    });
    customerId = customer.id;
  });

  after(async () => {
    await app.close();

    if (storeId) {
      await prisma.store.delete({ where: { id: storeId } });
    }

    if (userId) {
      await prisma.user.delete({ where: { id: userId } });
    }
  });

  it("allows valid retry transitions and records allowed audits", async () => {
    const checkout = await createPaymentOrderPair("retry", PaymentStatus.FAILED, OrderStatus.PAYMENT_FAILED);

    await paymentsService.transitionPaymentStatus({
      paymentId: checkout.paymentId,
      storeId,
      toStatus: PaymentStatus.PENDING,
      source: "test.retry",
      reason: "Retrying payment after failure"
    });

    await paymentsService.transitionOrderStatus({
      orderId: checkout.orderId,
      storeId,
      toStatus: OrderStatus.WAITING_PAYMENT,
      source: "test.retry",
      reason: "Customer can try payment again"
    });

    const payment = await prisma.payment.findUnique({ where: { id: checkout.paymentId } });
    const order = await prisma.order.findUnique({ where: { id: checkout.orderId } });
    const audits = await prisma.statusTransitionAudit.findMany({
      where: {
        entityId: {
          in: [checkout.paymentId, checkout.orderId]
        }
      },
      orderBy: {
        createdAt: "asc"
      }
    });

    assert.equal(payment?.status, PaymentStatus.PENDING);
    assert.equal(order?.status, OrderStatus.WAITING_PAYMENT);
    assert.equal(audits.length, 2);
    assert.equal(audits[0]?.allowed, true);
    assert.equal(audits[0]?.entityType, StatusTransitionEntityType.PAYMENT);
    assert.equal(audits[1]?.allowed, true);
    assert.equal(audits[1]?.entityType, StatusTransitionEntityType.ORDER);
  });

  it("blocks invalid payment transitions and audits the attempt", async () => {
    const checkout = await createPaymentOrderPair("invalid-payment", PaymentStatus.APPROVED, OrderStatus.PAYMENT_APPROVED);

    await assert.rejects(
      () =>
        paymentsService.transitionPaymentStatus({
          paymentId: checkout.paymentId,
          storeId,
          toStatus: PaymentStatus.PENDING,
          source: "test.invalid-payment",
          reason: "Should not reopen an approved payment"
        }),
      (error: unknown) => {
        assert.equal((error as { response?: { code?: string } }).response?.code, "PAYMENT_STATUS_TRANSITION_INVALID");
        return true;
      }
    );

    const payment = await prisma.payment.findUnique({ where: { id: checkout.paymentId } });
    const audit = await prisma.statusTransitionAudit.findFirst({
      where: {
        entityType: StatusTransitionEntityType.PAYMENT,
        entityId: checkout.paymentId,
        allowed: false
      },
      orderBy: {
        createdAt: "desc"
      }
    });

    assert.equal(payment?.status, PaymentStatus.APPROVED);
    assert.ok(audit);
    assert.equal(audit?.fromStatus, PaymentStatus.APPROVED);
    assert.equal(audit?.toStatus, PaymentStatus.PENDING);
  });

  it("blocks invalid order transitions and audits the attempt", async () => {
    const checkout = await createPaymentOrderPair("invalid-order", PaymentStatus.APPROVED, OrderStatus.DELIVERED);

    await assert.rejects(
      () =>
        paymentsService.transitionOrderStatus({
          orderId: checkout.orderId,
          storeId,
          toStatus: OrderStatus.WAITING_PAYMENT,
          source: "test.invalid-order",
          reason: "Delivered orders cannot go back to waiting payment"
        }),
      (error: unknown) => {
        assert.equal((error as { response?: { code?: string } }).response?.code, "ORDER_STATUS_TRANSITION_INVALID");
        return true;
      }
    );

    const order = await prisma.order.findUnique({ where: { id: checkout.orderId } });
    const audit = await prisma.statusTransitionAudit.findFirst({
      where: {
        entityType: StatusTransitionEntityType.ORDER,
        entityId: checkout.orderId,
        allowed: false
      },
      orderBy: {
        createdAt: "desc"
      }
    });

    assert.equal(order?.status, OrderStatus.DELIVERED);
    assert.ok(audit);
    assert.equal(audit?.fromStatus, OrderStatus.DELIVERED);
    assert.equal(audit?.toStatus, OrderStatus.WAITING_PAYMENT);
  });

  async function createPaymentOrderPair(
    label: string,
    paymentStatus: PaymentStatus,
    orderStatus: OrderStatus
  ) {
    const cart = await cartRepository.createCart({
      storeId,
      sessionId: `payments-state-machine-${label}-${suffix}`,
      customerEmail: `buyer-${label}-${suffix}@example.com`,
      currencyCode: "BRL"
    });

    await cartRepository.addCartItem({
      cartId: cart.id,
      storeId,
      productId,
      quantity: 1,
      productName: "Coador V60",
      productSlug: "coador-v60",
      unitPriceCents: 7990,
      currencyCode: "BRL"
    });

    const payment = await paymentsRepository.createPayment({
      storeId,
      cartId: cart.id,
      customerId,
      provider: PaymentProvider.STRIPE_CONNECT,
      status: paymentStatus,
      amountCents: 7990,
      paidAt: paymentStatus === PaymentStatus.APPROVED ? new Date() : null,
      failureCode: paymentStatus === PaymentStatus.FAILED ? "card_declined" : null,
      failureMessage: paymentStatus === PaymentStatus.FAILED ? "Card declined" : null
    });

    const order = await ordersRepository.createOrder({
      storeId,
      cartId: cart.id,
      customerId,
      paymentId: payment.id,
      status: orderStatus,
      currencyCode: "BRL",
      subtotalCents: 7990,
      totalCents: 7990,
      customerEmail: `buyer-${label}-${suffix}@example.com`,
      customerFullName: "Buyer State Machine"
    });

    return {
      paymentId: payment.id,
      orderId: order.id
    };
  }
});
