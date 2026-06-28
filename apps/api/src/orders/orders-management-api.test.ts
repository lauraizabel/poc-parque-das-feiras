import assert from "node:assert/strict";
import * as http from "node:http";
import { AddressInfo } from "node:net";
import { after, before, describe, it } from "node:test";
import { INestApplication } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import {
  OrderStatus,
  PaymentProvider,
  PaymentStatus,
  StatusTransitionEntityType
} from "@prisma/client";
import { prisma } from "@acme/database";
import { AppModule } from "../app.module";

type JsonResponse<T> = {
  statusCode: number;
  body: T;
};

type RequestOptions = {
  method?: string;
  path: string;
  headers?: Record<string, string>;
  body?: unknown;
};

describe("orders management api", () => {
  const suffix = Date.now().toString(36);
  const merchantEmail = `orders-mgmt-merchant-${suffix}@example.com`;
  const secondaryEmail = `orders-mgmt-secondary-${suffix}@example.com`;
  const password = "StrongPass123";
  const storeSlug = `orders-mgmt-store-${suffix}`;
  const sessionId = `orders-mgmt-session-${suffix}`;

  let app: INestApplication;
  let baseUrl = "";
  let userId = "";
  let secondaryUserId = "";
  let storeId = "";
  let token = "";
  let secondaryToken = "";
  let productId = "";
  let shippingMethodId = "";
  let orderId = "";

  before(async () => {
    const testingModule = await Test.createTestingModule({
      imports: [AppModule]
    }).compile();

    app = testingModule.createNestApplication();
    app.enableCors({
      origin: true,
      credentials: true
    });

    await app.listen(0);

    const server = app.getHttpServer() as http.Server;
    const address = server.address() as AddressInfo;
    baseUrl = `http://127.0.0.1:${address.port}`;

    const registration = await requestJson<{
      user: { id: string };
      store: { id: string };
      tokens: { accessToken: string };
    }>({
      method: "POST",
      path: "/auth/register-merchant",
      body: {
        email: merchantEmail,
        password,
        fullName: "Orders Mgmt Merchant",
        storeName: "Orders Mgmt Store",
        storeSlug
      }
    });

    userId = registration.body.user.id;
    storeId = registration.body.store.id;
    token = registration.body.tokens.accessToken;

    const secondaryRegistration = await requestJson<{
      user: { id: string };
      tokens: { accessToken: string };
    }>({
      method: "POST",
      path: "/auth/register",
      body: {
        email: secondaryEmail,
        password,
        fullName: "Orders Mgmt Secondary"
      }
    });
    secondaryUserId = secondaryRegistration.body.user.id;
    secondaryToken = secondaryRegistration.body.tokens.accessToken;

    const productResponse = await requestJson<{
      product: { id: string };
    }>({
      method: "POST",
      path: "/catalog/products",
      headers: {
        authorization: `Bearer ${token}`
      },
      body: {
        storeId,
        name: "Panela de Ferro",
        slug: "panela-de-ferro",
        sku: "PF-001",
        priceCents: 22990,
        stockQuantity: 6,
        status: "ACTIVE"
      }
    });
    productId = productResponse.body.product.id;

    const shippingMethodResponse = await requestJson<{
      shippingMethod: { id: string };
    }>({
      method: "POST",
      path: "/shipping/methods",
      headers: {
        authorization: `Bearer ${token}`
      },
      body: {
        storeId,
        name: "Transportadora Express",
        type: "FIXED_PRICE",
        priceCents: 2900,
        estimatedDaysMin: 2,
        estimatedDaysMax: 4,
        minimumOrderCents: 0,
        maximumOrderCents: 100000,
        sortOrder: 1,
        isDefault: true
      }
    });
    shippingMethodId = shippingMethodResponse.body.shippingMethod.id;

    const orderContext = await createApprovedOrder("base", "Cliente Operacao");
    orderId = orderContext.orderId;
  });

  after(async () => {
    if (storeId) {
      await prisma.store.delete({ where: { id: storeId } });
    }

    if (secondaryUserId) {
      await prisma.user.delete({ where: { id: secondaryUserId } });
    }

    if (userId) {
      await prisma.user.delete({ where: { id: userId } });
    }

    await app.close();
  });

  it("lists store orders for authorized operators", async () => {
    const response = await requestJson<{
      orders: Array<{
        id: string;
        status: string;
        allowedActions: string[];
        itemCount: number;
        payment: { status: string } | null;
      }>;
    }>({
      method: "GET",
      path: `/orders/${storeId}/management`,
      headers: {
        authorization: `Bearer ${token}`
      }
    });

    assert.equal(response.statusCode, 200);
    assert.equal(response.body.orders.length, 1);
    assert.equal(response.body.orders[0]?.id, orderId);
    assert.equal(response.body.orders[0]?.status, "PAYMENT_APPROVED");
    assert.equal(response.body.orders[0]?.itemCount, 1);
    assert.equal(response.body.orders[0]?.payment?.status, "APPROVED");
    assert.deepEqual(response.body.orders[0]?.allowedActions, ["PROCESSING", "CANCELED"]);
  });

  it("rejects operators that do not belong to the store", async () => {
    const response = await requestJson<{
      code: string;
    }>({
      method: "GET",
      path: `/orders/${storeId}/management`,
      headers: {
        authorization: `Bearer ${secondaryToken}`
      }
    });

    assert.equal(response.statusCode, 403);
    assert.equal(response.body.code, "AUTH_STORE_MEMBERSHIP_REQUIRED");
  });

  it("updates operational statuses with shipment side effects and audit trail", async () => {
    const processingResponse = await requestJson<{
      order: { status: string; shipment: { status: string } | null };
    }>({
      method: "PATCH",
      path: `/orders/${storeId}/${orderId}/status`,
      headers: {
        authorization: `Bearer ${token}`
      },
      body: {
        storeId,
        status: "PROCESSING",
        reason: "Separando pedido para expedicao",
        notes: "Caixa reforcada"
      }
    });

    assert.equal(processingResponse.statusCode, 200);
    assert.equal(processingResponse.body.order.status, "PROCESSING");
    assert.equal(processingResponse.body.order.shipment?.status, "READY_TO_SHIP");

    const shippedResponse = await requestJson<{
      order: {
        status: string;
        shippedAt: string | null;
        shipment: {
          status: string;
          carrierName: string | null;
          serviceName: string | null;
          trackingCode: string | null;
          trackingUrl: string | null;
        } | null;
      };
    }>({
      method: "PATCH",
      path: `/orders/${storeId}/${orderId}/status`,
      headers: {
        authorization: `Bearer ${token}`
      },
      body: {
        storeId,
        status: "SHIPPED",
        reason: "Coleta concluida",
        carrierName: "Correios",
        serviceName: "PAC",
        trackingCode: "AA123456789BR",
        trackingUrl: "https://rastreamento.example.com/AA123456789BR"
      }
    });

    assert.equal(shippedResponse.statusCode, 200);
    assert.equal(shippedResponse.body.order.status, "SHIPPED");
    assert.ok(shippedResponse.body.order.shippedAt);
    assert.equal(shippedResponse.body.order.shipment?.status, "SHIPPED");
    assert.equal(shippedResponse.body.order.shipment?.carrierName, "Correios");
    assert.equal(shippedResponse.body.order.shipment?.serviceName, "PAC");
    assert.equal(shippedResponse.body.order.shipment?.trackingCode, "AA123456789BR");

    const deliveredResponse = await requestJson<{
      order: {
        status: string;
        deliveredAt: string | null;
        allowedActions: string[];
        shipment: { status: string } | null;
      };
    }>({
      method: "PATCH",
      path: `/orders/${storeId}/${orderId}/status`,
      headers: {
        authorization: `Bearer ${token}`
      },
      body: {
        storeId,
        status: "DELIVERED",
        reason: "Entrega confirmada"
      }
    });

    assert.equal(deliveredResponse.statusCode, 200);
    assert.equal(deliveredResponse.body.order.status, "DELIVERED");
    assert.ok(deliveredResponse.body.order.deliveredAt);
    assert.equal(deliveredResponse.body.order.shipment?.status, "DELIVERED");
    assert.deepEqual(deliveredResponse.body.order.allowedActions, []);

    const invalidResponse = await requestJson<{
      code: string;
    }>({
      method: "PATCH",
      path: `/orders/${storeId}/${orderId}/status`,
      headers: {
        authorization: `Bearer ${token}`
      },
      body: {
        storeId,
        status: "CANCELED",
        reason: "Tentativa invalida apos entrega"
      }
    });

    assert.equal(invalidResponse.statusCode, 400);
    assert.equal(invalidResponse.body.code, "ORDER_STATUS_TRANSITION_INVALID");

    const allowedAudits = await prisma.statusTransitionAudit.findMany({
      where: {
        entityType: StatusTransitionEntityType.ORDER,
        entityId: orderId,
        allowed: true,
        source: "dashboard.orders"
      },
      orderBy: {
        createdAt: "asc"
      }
    });
    assert.equal(allowedAudits.length, 3);
    assert.equal(allowedAudits[0]?.toStatus, "PROCESSING");
    assert.equal(allowedAudits[1]?.toStatus, "SHIPPED");
    assert.equal(allowedAudits[2]?.toStatus, "DELIVERED");

    const deniedAudit = await prisma.statusTransitionAudit.findFirst({
      where: {
        entityType: StatusTransitionEntityType.ORDER,
        entityId: orderId,
        allowed: false,
        source: "dashboard.orders"
      }
    });
    assert.equal(deniedAudit?.toStatus, "CANCELED");
  });

  it("allows canceling an approved order before shipment and mirrors the shipment state", async () => {
    const cancellationContext = await createApprovedOrder("canceled", "Cliente Cancelamento");

    const response = await requestJson<{
      order: {
        status: string;
        canceledAt: string | null;
        allowedActions: string[];
        shipment: {
          status: string;
          carrierName: string | null;
          trackingCode: string | null;
        } | null;
      };
    }>({
      method: "PATCH",
      path: `/orders/${storeId}/${cancellationContext.orderId}/status`,
      headers: {
        authorization: `Bearer ${token}`
      },
      body: {
        storeId,
        status: "CANCELED",
        reason: "Cliente desistiu antes da expedicao",
        notes: "Cancelamento confirmado no suporte"
      }
    });

    assert.equal(response.statusCode, 200);
    assert.equal(response.body.order.status, "CANCELED");
    assert.ok(response.body.order.canceledAt);
    assert.equal(response.body.order.shipment?.status, "CANCELED");
    assert.equal(response.body.order.shipment?.carrierName, null);
    assert.equal(response.body.order.shipment?.trackingCode, null);
    assert.deepEqual(response.body.order.allowedActions, []);

    const canceledOrder = await prisma.order.findUnique({
      where: { id: cancellationContext.orderId },
      include: {
        shipment: true
      }
    });
    assert.equal(canceledOrder?.status, OrderStatus.CANCELED);
    assert.ok(canceledOrder?.canceledAt);
    assert.equal(canceledOrder?.shipment?.status, "CANCELED");

    const restockedProduct = await prisma.product.findUnique({
      where: { id: productId }
    });
    assert.equal(restockedProduct?.stockQuantity, 6);
    assert.equal(restockedProduct?.status, "ACTIVE");

    const cancellationAudit = await prisma.statusTransitionAudit.findFirst({
      where: {
        entityType: StatusTransitionEntityType.ORDER,
        entityId: cancellationContext.orderId,
        allowed: true,
        toStatus: "CANCELED",
        source: "dashboard.orders"
      }
    });
    assert.equal(cancellationAudit?.fromStatus, "PAYMENT_APPROVED");
  });

  async function createApprovedOrder(label: string, customerName: string) {
    const checkoutSessionId = `${sessionId}-${label}`;
    const checkoutCustomerEmail = `orders-mgmt-customer-${label}-${suffix}@example.com`;

    await requestJson({
      method: "POST",
      path: "/cart/public/current/items",
      headers: {
        "x-forwarded-host": `${storeSlug}.lvh.me`
      },
      body: {
        sessionId: checkoutSessionId,
        customerEmail: checkoutCustomerEmail,
        productId,
        quantity: 1
      }
    });

    const orderResponse = await requestJson<{
      order: { id: string };
    }>({
      method: "POST",
      path: "/checkout/public/current/order",
      headers: {
        "x-forwarded-host": `${storeSlug}.lvh.me`
      },
      body: {
        sessionId: checkoutSessionId,
        customerEmail: checkoutCustomerEmail,
        customerFullName: customerName,
        customerPhoneNumber: "+55 81 99999-2222",
        shippingMethodId,
        shippingRecipientName: customerName,
        shippingPhoneNumber: "+55 81 99999-2222",
        shippingPostalCode: "50000-000",
        shippingState: "PE",
        shippingCity: "Recife",
        shippingDistrict: "Boa Vista",
        shippingStreet: "Rua da Guia",
        shippingNumber: "77"
      }
    });

    const createdOrderId = orderResponse.body.order.id;
    const order = await prisma.order.findUniqueOrThrow({
      where: { id: createdOrderId }
    });

    const payment = await prisma.payment.create({
      data: {
        storeId,
        cartId: order.cartId!,
        provider: PaymentProvider.STRIPE_CONNECT,
        status: PaymentStatus.APPROVED,
        currencyCode: "BRL",
        amountCents: order.totalCents,
        paidAt: new Date("2026-06-27T12:00:00.000Z")
      }
    });

    await prisma.order.update({
      where: { id: createdOrderId },
      data: {
        paymentId: payment.id,
        status: OrderStatus.PAYMENT_APPROVED,
        approvedAt: new Date("2026-06-27T12:00:00.000Z"),
        statusUpdatedAt: new Date("2026-06-27T12:00:00.000Z")
      }
    });

    return {
      orderId: createdOrderId,
      customerEmail: checkoutCustomerEmail
    };
  }

  async function requestJson<T>(options: RequestOptions): Promise<JsonResponse<T>> {
    const response = await fetch(`${baseUrl}${options.path}`, {
      method: options.method ?? "GET",
      headers: {
        "content-type": "application/json",
        ...(options.headers ?? {})
      },
      body: options.body === undefined ? undefined : JSON.stringify(options.body)
    });

    return {
      statusCode: response.status,
      body: (await response.json()) as T
    };
  }
});
