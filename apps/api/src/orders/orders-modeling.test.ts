import assert from "node:assert/strict";
import { after, before, describe, it } from "node:test";
import {
  OrderStatus,
  PaymentProvider,
  PaymentStatus,
  PlatformRole,
  ProductStatus
} from "@prisma/client";
import { prisma } from "@acme/database";
import { CartRepository } from "../cart/cart.repository";
import { OrdersRepository } from "./orders.repository";
import { PaymentsRepository } from "../payments/payments.repository";

describe("orders modeling", () => {
  const suffix = Date.now().toString(36);
  const ownerEmail = `orders-owner-${suffix}@example.com`;
  const ordersRepository = new OrdersRepository();
  const cartRepository = new CartRepository();
  const paymentsRepository = new PaymentsRepository();

  let userId = "";
  let storeId = "";
  let productId = "";
  let customerId = "";
  let cartId = "";
  let paymentId = "";

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
        name: "Orders Modeling Store",
        slug: `orders-modeling-${suffix}`,
        defaultSubdomain: `orders-modeling-${suffix}`,
        ownerId: user.id
      }
    });
    storeId = store.id;

    const product = await prisma.product.create({
      data: {
        storeId: store.id,
        name: "Prensa Francesa",
        slug: "prensa-francesa",
        sku: "PF-001",
        priceCents: 18990,
        compareAtCents: 20990,
        currencyCode: "BRL",
        stockQuantity: 5,
        status: ProductStatus.ACTIVE
      }
    });
    productId = product.id;

    const cart = await cartRepository.createCart({
      storeId: store.id,
      sessionId: `orders-session-${suffix}`,
      customerEmail: `order-customer-${suffix}@example.com`,
      currencyCode: "BRL"
    });
    cartId = cart.id;

    await cartRepository.addCartItem({
      cartId,
      storeId,
      productId,
      quantity: 2,
      productName: "Prensa Francesa",
      productSlug: "prensa-francesa",
      unitPriceCents: 18990,
      compareAtCents: 20990,
      currencyCode: "BRL"
    });

    const customer = await paymentsRepository.createCustomer({
      storeId,
      email: `order-customer-${suffix}@example.com`,
      fullName: "Order Customer",
      phoneNumber: "+55 81 98888-0000"
    });
    customerId = customer.id;

    const payment = await paymentsRepository.createPayment({
      storeId,
      cartId,
      customerId,
      provider: PaymentProvider.STRIPE_CONNECT,
      status: PaymentStatus.CREATED,
      amountCents: 39980
    });
    paymentId = payment.id;
  });

  after(async () => {
    if (storeId) {
      await prisma.store.delete({ where: { id: storeId } });
    }

    if (userId) {
      await prisma.user.delete({ where: { id: userId } });
    }
  });

  it("stores order snapshots separately from payment state", async () => {
    const order = await ordersRepository.createOrder({
      storeId,
      cartId,
      customerId,
      paymentId,
      status: OrderStatus.WAITING_PAYMENT,
      currencyCode: "BRL",
      subtotalCents: 37980,
      shippingCents: 3000,
      discountCents: 1000,
      totalCents: 39980,
      customerEmail: `order-customer-${suffix}@example.com`,
      customerFullName: "Order Customer",
      customerPhoneNumber: "+55 81 98888-0000",
      shippingRecipientName: "Order Customer",
      shippingPhoneNumber: "+55 81 98888-0000",
      shippingPostalCode: "50000-000",
      shippingState: "PE",
      shippingCity: "Recife",
      shippingDistrict: "Boa Viagem",
      shippingStreet: "Rua das Flores",
      shippingNumber: "123",
      shippingComplement: "Apto 45",
      billingRecipientName: "Order Customer",
      billingPhoneNumber: "+55 81 98888-0000",
      billingPostalCode: "50000-000",
      billingState: "PE",
      billingCity: "Recife",
      billingDistrict: "Boa Viagem",
      billingStreet: "Rua das Flores",
      billingNumber: "123",
      billingComplement: "Apto 45",
      notes: "Entregar em horario comercial"
    });

    await ordersRepository.addOrderItem({
      orderId: order.id,
      storeId,
      productId,
      productName: "Prensa Francesa",
      productSlug: "prensa-francesa",
      quantity: 2,
      unitPriceCents: 18990,
      compareAtCents: 20990,
      totalCents: 37980,
      currencyCode: "BRL",
      sku: "PF-001"
    });

    await prisma.payment.update({
      where: {
        id: paymentId
      },
      data: {
        status: PaymentStatus.FAILED
      }
    });

    const storedOrder = await ordersRepository.getOrderById(order.id);

    assert.ok(storedOrder);
    assert.equal(storedOrder.storeId, storeId);
    assert.equal(storedOrder.status, OrderStatus.WAITING_PAYMENT);
    assert.equal(storedOrder.payment?.status, PaymentStatus.FAILED);
    assert.equal(storedOrder.customerEmail, `order-customer-${suffix}@example.com`);
    assert.equal(storedOrder.shippingCity, "Recife");
    assert.equal(storedOrder.totalCents, 39980);
    assert.equal(storedOrder.items.length, 1);
    assert.equal(storedOrder.items[0]?.productName, "Prensa Francesa");
    assert.equal(storedOrder.items[0]?.unitPriceCents, 18990);
    assert.equal(storedOrder.items[0]?.totalCents, 37980);
    assert.equal(storedOrder.cart?.items.length, 1);
  });
});
