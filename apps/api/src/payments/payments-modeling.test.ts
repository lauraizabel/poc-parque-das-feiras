import assert from "node:assert/strict";
import { after, before, describe, it } from "node:test";
import {
  PaymentProvider,
  PaymentStatus,
  PaymentTransactionKind,
  PaymentTransactionStatus,
  PlatformRole,
  ProductStatus
} from "@prisma/client";
import { prisma } from "@acme/database";
import { CartRepository } from "../cart/cart.repository";
import { PaymentsRepository } from "./payments.repository";

describe("payments modeling", () => {
  const suffix = Date.now().toString(36);
  const ownerEmail = `payments-owner-${suffix}@example.com`;
  const sessionId = `payments-session-${suffix}`;
  const paymentsRepository = new PaymentsRepository();
  const cartRepository = new CartRepository();

  let userId = "";
  let storeId = "";
  let productId = "";
  let cartId = "";

  before(async () => {
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
        name: "Payments Modeling Store",
        slug: `payments-modeling-${suffix}`,
        defaultSubdomain: `payments-modeling-${suffix}`,
        ownerId: user.id
      }
    });
    storeId = store.id;

    const product = await prisma.product.create({
      data: {
        storeId: store.id,
        name: "Kit Degustacao",
        slug: "kit-degustacao",
        priceCents: 10990,
        currencyCode: "BRL",
        stockQuantity: 6,
        status: ProductStatus.ACTIVE
      }
    });
    productId = product.id;

    const cart = await cartRepository.createCart({
      storeId: store.id,
      sessionId,
      customerEmail: `guest-${suffix}@example.com`,
      currencyCode: "BRL"
    });
    cartId = cart.id;

    await cartRepository.addCartItem({
      cartId: cart.id,
      storeId: store.id,
      productId,
      quantity: 2,
      productName: "Kit Degustacao",
      productSlug: "kit-degustacao",
      unitPriceCents: 10990,
      currencyCode: "BRL"
    });
  });

  after(async () => {
    if (storeId) {
      await prisma.store.delete({ where: { id: storeId } });
    }

    if (userId) {
      await prisma.user.delete({ where: { id: userId } });
    }
  });

  it("stores customer, payment and transaction attempts with raw payloads", async () => {
    const customer = await paymentsRepository.createCustomer({
      storeId,
      email: `customer-${suffix}@example.com`,
      fullName: "Customer Modeling",
      phoneNumber: "+55 81 99999-0000",
      documentNumber: "12345678900",
      notes: "Primeira compra"
    });

    const payment = await paymentsRepository.createPayment({
      storeId,
      cartId,
      customerId: customer.id,
      provider: PaymentProvider.STRIPE_CONNECT,
      status: PaymentStatus.PENDING,
      amountCents: 21980,
      attemptCount: 1,
      externalReference: `checkout-${suffix}`,
      providerPayload: JSON.stringify({ intent: "pi_123" }),
      metadata: JSON.stringify({ source: "storefront" })
    });

    await paymentsRepository.createPaymentTransaction({
      paymentId: payment.id,
      storeId,
      provider: PaymentProvider.STRIPE_CONNECT,
      kind: PaymentTransactionKind.INTENT,
      status: PaymentTransactionStatus.SUCCEEDED,
      idempotencyKey: `intent-${suffix}`,
      externalTransactionId: "pi_123",
      requestPayload: JSON.stringify({ amount: 21980 }),
      responsePayload: JSON.stringify({ status: "requires_payment_method" }),
      occurredAt: new Date()
    });

    await paymentsRepository.createPaymentTransaction({
      paymentId: payment.id,
      storeId,
      provider: PaymentProvider.STRIPE_CONNECT,
      kind: PaymentTransactionKind.AUTHORIZATION,
      status: PaymentTransactionStatus.FAILED,
      idempotencyKey: `auth-${suffix}`,
      externalTransactionId: "ch_456",
      requestPayload: JSON.stringify({ capture_method: "manual" }),
      responsePayload: JSON.stringify({ decline_code: "insufficient_funds" }),
      errorCode: "insufficient_funds",
      errorMessage: "Card was declined",
      occurredAt: new Date()
    });

    await paymentsRepository.updatePayment(payment.id, {
      status: PaymentStatus.FAILED,
      attemptCount: 2,
      failureCode: "insufficient_funds",
      failureMessage: "Card was declined"
    });

    const storedPayment = await paymentsRepository.getPaymentById(payment.id);

    assert.ok(storedPayment);
    assert.equal(storedPayment.storeId, storeId);
    assert.equal(storedPayment.customer?.email, `customer-${suffix}@example.com`);
    assert.equal(storedPayment.cart.id, cartId);
    assert.equal(storedPayment.cart.items.length, 1);
    assert.equal(storedPayment.amountCents, 21980);
    assert.equal(storedPayment.status, PaymentStatus.FAILED);
    assert.equal(storedPayment.attemptCount, 2);
    assert.match(storedPayment.providerPayload ?? "", /pi_123/);
    assert.equal(storedPayment.transactions.length, 2);
    assert.equal(storedPayment.transactions[0]?.kind, PaymentTransactionKind.INTENT);
    assert.equal(storedPayment.transactions[0]?.status, PaymentTransactionStatus.SUCCEEDED);
    assert.equal(storedPayment.transactions[1]?.kind, PaymentTransactionKind.AUTHORIZATION);
    assert.equal(storedPayment.transactions[1]?.status, PaymentTransactionStatus.FAILED);
    assert.equal(storedPayment.transactions[1]?.errorCode, "insufficient_funds");
  });
});
