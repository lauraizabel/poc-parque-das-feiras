import assert from "node:assert/strict";
import { after, before, describe, it } from "node:test";
import {
  OrderStatus,
  PlatformRole,
  ProductStatus,
  ShipmentStatus,
  ShippingMethodStatus,
  ShippingMethodType
} from "@prisma/client";
import { prisma } from "@acme/database";
import { CartRepository } from "../cart/cart.repository";
import { OrdersRepository } from "../orders/orders.repository";
import { ShippingRepository } from "./shipping.repository";

describe("shipping modeling", () => {
  const suffix = Date.now().toString(36);
  const ownerEmail = `shipping-modeling-${suffix}@example.com`;
  const cartRepository = new CartRepository();
  const ordersRepository = new OrdersRepository();
  const shippingRepository = new ShippingRepository();

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
        name: "Shipping Modeling Store",
        slug: `shipping-modeling-${suffix}`,
        defaultSubdomain: `shipping-modeling-${suffix}`,
        ownerId: user.id
      }
    });
    storeId = store.id;

    const product = await prisma.product.create({
      data: {
        storeId,
        name: "Dripper Glass",
        slug: "dripper-glass",
        priceCents: 9990,
        currencyCode: "BRL",
        stockQuantity: 10,
        status: ProductStatus.ACTIVE
      }
    });
    productId = product.id;

    const cart = await cartRepository.createCart({
      storeId,
      sessionId: `shipping-modeling-session-${suffix}`,
      customerEmail: `buyer-${suffix}@example.com`,
      currencyCode: "BRL"
    });
    cartId = cart.id;

    await cartRepository.addCartItem({
      cartId,
      storeId,
      productId,
      quantity: 1,
      productName: "Dripper Glass",
      productSlug: "dripper-glass",
      unitPriceCents: 9990,
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

  it("stores shipping methods with simple pricing bands and shipment snapshots", async () => {
    const shippingMethod = await shippingRepository.createShippingMethod({
      storeId,
      name: "SEDEX Fixo",
      description: "Entrega expressa com preço fixo",
      type: ShippingMethodType.FIXED_PRICE,
      status: ShippingMethodStatus.ACTIVE,
      priceCents: 1990,
      estimatedDaysMin: 1,
      estimatedDaysMax: 2,
      minimumOrderCents: 0,
      maximumOrderCents: 50000,
      sortOrder: 1,
      isDefault: true
    });

    const order = await ordersRepository.createOrder({
      storeId,
      cartId,
      shippingMethodId: shippingMethod.id,
      status: OrderStatus.CREATED,
      currencyCode: "BRL",
      subtotalCents: 9990,
      shippingCents: 1990,
      totalCents: 11980,
      customerEmail: `buyer-${suffix}@example.com`,
      customerFullName: "Buyer Shipping",
      shippingRecipientName: "Buyer Shipping",
      shippingPostalCode: "50000-000",
      shippingState: "PE",
      shippingCity: "Recife",
      shippingDistrict: "Boa Viagem",
      shippingStreet: "Rua do Porto",
      shippingNumber: "50",
      billingRecipientName: "Buyer Shipping",
      billingPostalCode: "50000-000",
      billingState: "PE",
      billingCity: "Recife",
      billingDistrict: "Boa Viagem",
      billingStreet: "Rua do Porto",
      billingNumber: "50"
    });

    const shipment = await shippingRepository.createShipment({
      orderId: order.id,
      storeId,
      shippingMethodId: shippingMethod.id,
      status: ShipmentStatus.PENDING,
      shippingMethodName: shippingMethod.name,
      carrierName: "Correios",
      serviceName: "SEDEX",
      priceCents: shippingMethod.priceCents,
      estimatedDaysMin: shippingMethod.estimatedDaysMin,
      estimatedDaysMax: shippingMethod.estimatedDaysMax,
      notes: "Postar no próximo dia útil"
    });

    const storedShipment = await shippingRepository.getShipmentByOrder(order.id, storeId);

    assert.ok(storedShipment);
    assert.equal(storedShipment.shippingMethodId, shippingMethod.id);
    assert.equal(storedShipment.shippingMethodName, "SEDEX Fixo");
    assert.equal(storedShipment.carrierName, "Correios");
    assert.equal(storedShipment.serviceName, "SEDEX");
    assert.equal(storedShipment.priceCents, 1990);
    assert.equal(storedShipment.estimatedDaysMin, 1);
    assert.equal(storedShipment.estimatedDaysMax, 2);
    assert.equal(storedShipment.status, ShipmentStatus.PENDING);
    assert.equal(storedShipment.order.shippingMethodId, shippingMethod.id);
    assert.equal(storedShipment.shippingMethod?.minimumOrderCents, 0);
    assert.equal(storedShipment.shippingMethod?.maximumOrderCents, 50000);
    assert.equal(shipment.storeId, storeId);
  });
});
