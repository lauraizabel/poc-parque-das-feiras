import assert from "node:assert/strict";
import * as http from "node:http";
import { AddressInfo } from "node:net";
import { after, before, describe, it } from "node:test";
import { INestApplication } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import { OrderStatus, PaymentStatus, ShipmentStatus } from "@prisma/client";
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

describe("orders public api", () => {
  const suffix = Date.now().toString(36);
  const merchantEmail = `orders-public-merchant-${suffix}@example.com`;
  const password = "StrongPass123";
  const storeSlug = `orders-public-store-${suffix}`;
  const sessionId = `orders-public-session-${suffix}`;
  const customerEmail = `orders-public-customer-${suffix}@example.com`;

  let app: INestApplication;
  let baseUrl = "";
  let userId = "";
  let storeId = "";
  let token = "";
  let productId = "";
  let shippingMethodId = "";
  let orderId = "";
  let publicToken = "";

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
        fullName: "Orders Public Merchant",
        storeName: "Orders Public Store",
        storeSlug
      }
    });

    userId = registration.body.user.id;
    storeId = registration.body.store.id;
    token = registration.body.tokens.accessToken;

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
        name: "Garrafa Termica",
        slug: "garrafa-termica",
        sku: "GT-001",
        priceCents: 18990,
        stockQuantity: 5,
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
        name: "SEDEX",
        type: "FIXED_PRICE",
        priceCents: 2200,
        estimatedDaysMin: 1,
        estimatedDaysMax: 3,
        minimumOrderCents: 0,
        maximumOrderCents: 50000,
        sortOrder: 1,
        isDefault: true
      }
    });
    shippingMethodId = shippingMethodResponse.body.shippingMethod.id;

    await requestJson({
      method: "POST",
      path: "/cart/public/current/items",
      headers: {
        "x-forwarded-host": `${storeSlug}.lvh.me`
      },
      body: {
        sessionId,
        customerEmail,
        productId,
        quantity: 1
      }
    });

    const orderResponse = await requestJson<{
      customerAccess: { orderId: string; token: string };
      order: { id: string };
    }>({
      method: "POST",
      path: "/checkout/public/current/order",
      headers: {
        "x-forwarded-host": `${storeSlug}.lvh.me`
      },
      body: {
        sessionId,
        customerEmail,
        customerFullName: "Cliente Pedido",
        customerPhoneNumber: "+55 81 99999-0000",
        shippingMethodId,
        shippingRecipientName: "Cliente Pedido",
        shippingPhoneNumber: "+55 81 99999-0000",
        shippingPostalCode: "50000-000",
        shippingState: "PE",
        shippingCity: "Recife",
        shippingDistrict: "Boa Vista",
        shippingStreet: "Rua da Aurora",
        shippingNumber: "321",
        shippingComplement: "Apto 12"
      }
    });

    assert.equal(orderResponse.statusCode, 201, JSON.stringify(orderResponse.body));
    orderId = orderResponse.body.order.id;
    publicToken = orderResponse.body.customerAccess.token;

    await prisma.payment.create({
      data: {
        storeId,
        cartId: (await prisma.order.findUniqueOrThrow({ where: { id: orderId } })).cartId!,
        provider: "STRIPE_CONNECT",
        status: PaymentStatus.APPROVED,
        currencyCode: "BRL",
        amountCents: 21190,
        paidAt: new Date("2026-06-27T10:00:00.000Z")
      }
    }).then(async (payment) => {
      await prisma.order.update({
        where: { id: orderId },
        data: {
          paymentId: payment.id,
          status: OrderStatus.SHIPPED,
          approvedAt: new Date("2026-06-27T10:00:00.000Z"),
          shippedAt: new Date("2026-06-27T14:00:00.000Z")
        }
      });
    });

    await prisma.shipment.updateMany({
      where: { orderId },
      data: {
        status: ShipmentStatus.SHIPPED,
        carrierName: "Correios",
        serviceName: "SEDEX",
        trackingCode: "BR123456789",
        trackingUrl: "https://rastreamento.example.com/BR123456789"
      }
    });
  });

  after(async () => {
    if (storeId) {
      await prisma.store.delete({ where: { id: storeId } });
    }

    if (userId) {
      await prisma.user.delete({ where: { id: userId } });
    }

    await app.close();
  });

  it("returns a public order summary for the customer access token", async () => {
    const response = await requestJson<{
      order: {
        id: string;
        status: string;
        customerEmail: string;
        payment: { status: string; amountCents: number; paidAt: string | null } | null;
        shipment: {
          status: string;
          carrierName: string | null;
          serviceName: string | null;
          trackingCode: string | null;
        } | null;
        shippingMethod: { id: string; name: string; type: string } | null;
        items: Array<{ productName: string; quantity: number; totalCents: number }>;
        shippingAddress: {
          city: string | null;
          state: string | null;
          street: string | null;
          number: string | null;
        };
      };
    }>({
      method: "GET",
      path: `/orders/public/${orderId}?token=${publicToken}`,
      headers: {
        "x-forwarded-host": `${storeSlug}.lvh.me`
      }
    });

    assert.equal(response.statusCode, 200);
    assert.equal(response.body.order.id, orderId);
    assert.equal(response.body.order.status, "SHIPPED");
    assert.equal(response.body.order.customerEmail, customerEmail);
    assert.equal(response.body.order.payment?.status, "APPROVED");
    assert.equal(response.body.order.payment?.amountCents, 21190);
    assert.equal(response.body.order.shipment?.status, "SHIPPED");
    assert.equal(response.body.order.shipment?.carrierName, "Correios");
    assert.equal(response.body.order.shipment?.serviceName, "SEDEX");
    assert.equal(response.body.order.shipment?.trackingCode, "BR123456789");
    assert.equal(response.body.order.shippingMethod?.id, shippingMethodId);
    assert.equal(response.body.order.items.length, 1);
    assert.equal(response.body.order.items[0]?.productName, "Garrafa Termica");
    assert.equal(response.body.order.items[0]?.quantity, 1);
    assert.equal(response.body.order.shippingAddress.city, "Recife");
    assert.equal(response.body.order.shippingAddress.state, "PE");
    assert.equal(response.body.order.shippingAddress.street, "Rua da Aurora");
    assert.equal(response.body.order.shippingAddress.number, "321");
  });

  it("rejects requests without a token", async () => {
    const response = await requestJson<{
      code: string;
      message: string;
    }>({
      method: "GET",
      path: `/orders/public/${orderId}`,
      headers: {
        "x-forwarded-host": `${storeSlug}.lvh.me`
      }
    });

    assert.equal(response.statusCode, 403);
    assert.equal(response.body.code, "ORDER_ACCESS_TOKEN_REQUIRED");
  });

  it("returns not found for an invalid token", async () => {
    const response = await requestJson<{
      code: string;
      message: string;
    }>({
      method: "GET",
      path: `/orders/public/${orderId}?token=invalid-token`,
      headers: {
        "x-forwarded-host": `${storeSlug}.lvh.me`
      }
    });

    assert.equal(response.statusCode, 404);
    assert.equal(response.body.code, "ORDER_PUBLIC_NOT_FOUND");
  });

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
