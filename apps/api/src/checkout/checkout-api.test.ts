import assert from "node:assert/strict";
import * as http from "node:http";
import { AddressInfo } from "node:net";
import { after, before, describe, it } from "node:test";
import { INestApplication } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import { CartStatus } from "@prisma/client";
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

describe("checkout api", () => {
  const suffix = Date.now().toString(36);
  const merchantEmail = `checkout-merchant-${suffix}@example.com`;
  const password = "StrongPass123";
  const storeSlug = `checkout-store-${suffix}`;
  const sessionId = `checkout-session-${suffix}`;

  let app: INestApplication;
  let baseUrl = "";
  let userId = "";
  let storeId = "";
  let token = "";
  let productId = "";
  let shippingMethodId = "";
  let emptySessionId = `empty-${suffix}`;

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
        fullName: "Checkout Merchant",
        storeName: "Checkout Store",
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
        name: "Bule Inox",
        slug: "bule-inox",
        sku: "BI-001",
        priceCents: 12990,
        stockQuantity: 3,
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
        name: "PAC Econômico",
        type: "FIXED_PRICE",
        priceCents: 1500,
        estimatedDaysMin: 3,
        estimatedDaysMax: 6,
        minimumOrderCents: 0,
        maximumOrderCents: 30000,
        sortOrder: 1,
        isDefault: true
      }
    });
    shippingMethodId = shippingMethodResponse.body.shippingMethod.id;

    await requestJson({
      method: "POST",
      path: "/cart/public/current/items",
      headers: {
        host: `${storeSlug}.lvh.me`
      },
      body: {
        sessionId,
        customerEmail: `customer-${suffix}@example.com`,
        productId,
        quantity: 2
      }
    });

    await requestJson({
      method: "POST",
      path: "/cart/public/current",
      headers: {
        host: `${storeSlug}.lvh.me`
      },
      body: {
        sessionId: emptySessionId,
        customerEmail: `empty-${suffix}@example.com`
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

  it("creates an order from the current cart, snapshots items and converts the cart", async () => {
    const response = await requestJson<{
      order: {
        id: string;
        storeId: string;
        shippingMethodId: string | null;
        status: string;
        subtotalCents: number;
        shippingCents: number;
        totalCents: number;
        customerEmail: string;
        items: Array<{ productId: string | null; quantity: number; unitPriceCents: number }>;
      };
    }>({
      method: "POST",
      path: "/checkout/public/current/order",
      headers: {
        host: `${storeSlug}.lvh.me`
      },
      body: {
        sessionId,
        customerEmail: `customer-${suffix}@example.com`,
        customerFullName: "Order Customer",
        customerPhoneNumber: "+55 81 99999-1111",
        shippingRecipientName: "Order Customer",
        shippingPhoneNumber: "+55 81 99999-1111",
        shippingPostalCode: "50000-000",
        shippingState: "PE",
        shippingCity: "Recife",
        shippingDistrict: "Boa Vista",
        shippingStreet: "Rua do Sol",
        shippingNumber: "100",
        shippingComplement: "Casa",
        shippingMethodId,
        discountCents: 500
      }
    });

    assert.equal(response.statusCode, 201);
    assert.equal(response.body.order.storeId, storeId);
    assert.equal(response.body.order.shippingMethodId, shippingMethodId);
    assert.equal(response.body.order.status, "CREATED");
    assert.equal(response.body.order.subtotalCents, 25980);
    assert.equal(response.body.order.shippingCents, 1500);
    assert.equal(response.body.order.totalCents, 26980);
    assert.equal(response.body.order.customerEmail, `customer-${suffix}@example.com`);
    assert.equal(response.body.order.items.length, 1);
    assert.equal(response.body.order.items[0]?.productId, productId);
    assert.equal(response.body.order.items[0]?.quantity, 2);
    assert.equal(response.body.order.items[0]?.unitPriceCents, 12990);

    const product = await prisma.product.findUnique({ where: { id: productId } });
    assert.equal(product?.stockQuantity, 1);
    assert.equal(product?.status, "ACTIVE");

    const convertedCart = await prisma.cart.findFirst({
      where: {
        storeId,
        sessionId
      }
    });
    assert.equal(convertedCart?.status, CartStatus.CONVERTED);

    const shipment = await prisma.shipment.findFirst({
      where: {
        orderId: response.body.order.id
      }
    });
    assert.equal(shipment?.shippingMethodId, shippingMethodId);
    assert.equal(shipment?.priceCents, 1500);
  });

  it("calculates valid shipping options and total estimates before creating the order", async () => {
    const quoteSessionId = `quote-${suffix}`;

    await requestJson({
      method: "POST",
      path: "/cart/public/current/items",
      headers: {
        host: `${storeSlug}.lvh.me`
      },
      body: {
        sessionId: quoteSessionId,
        customerEmail: `quote-${suffix}@example.com`,
        productId,
        quantity: 1
      }
    });

    const response = await requestJson<{
      cart: { subtotalCents: number };
      shippingOptions: Array<{
        id: string;
        priceCents: number;
        totalCents: number;
        isDefault: boolean;
      }>;
    }>({
      method: "POST",
      path: "/checkout/public/current/shipping-options",
      headers: {
        host: `${storeSlug}.lvh.me`
      },
      body: {
        sessionId: quoteSessionId,
        customerEmail: `quote-${suffix}@example.com`,
        shippingPostalCode: "50000-000",
        shippingState: "PE",
        shippingCity: "Recife",
        shippingDistrict: "Boa Vista"
      }
    });

    assert.equal(response.statusCode, 201);
    assert.equal(response.body.cart.subtotalCents, 12990);
    assert.equal(response.body.shippingOptions.length, 1);
    assert.equal(response.body.shippingOptions[0]?.id, shippingMethodId);
    assert.equal(response.body.shippingOptions[0]?.priceCents, 1500);
    assert.equal(response.body.shippingOptions[0]?.totalCents, 14490);
    assert.equal(response.body.shippingOptions[0]?.isDefault, true);
  });

  it("rejects empty carts and carts with insufficient stock at conversion time", async () => {
    const emptyResponse = await requestJson<{
      code: string;
    }>({
      method: "POST",
      path: "/checkout/public/current/order",
      headers: {
        host: `${storeSlug}.lvh.me`
      },
      body: {
        sessionId: emptySessionId,
        customerEmail: `empty-${suffix}@example.com`,
        customerFullName: "Empty Customer",
        shippingRecipientName: "Empty Customer",
        shippingPostalCode: "50000-000",
        shippingState: "PE",
        shippingCity: "Recife",
        shippingDistrict: "Boa Vista",
        shippingStreet: "Rua do Sol",
        shippingNumber: "100",
        shippingMethodId
      }
    });

    assert.equal(emptyResponse.statusCode, 400);
    assert.equal(emptyResponse.body.code, "CART_EMPTY");

    const invalidShippingSessionId = `invalid-shipping-${suffix}`;

    await requestJson({
      method: "POST",
      path: "/cart/public/current/items",
      headers: {
        host: `${storeSlug}.lvh.me`
      },
      body: {
        sessionId: invalidShippingSessionId,
        customerEmail: `invalid-shipping-${suffix}@example.com`,
        productId,
        quantity: 1
      }
    });

    const invalidShippingResponse = await requestJson<{
      code: string;
    }>({
      method: "POST",
      path: "/checkout/public/current/order",
      headers: {
        host: `${storeSlug}.lvh.me`
      },
      body: {
        sessionId: invalidShippingSessionId,
        customerEmail: `invalid-shipping-${suffix}@example.com`,
        customerFullName: "Order Customer",
        shippingRecipientName: "Order Customer",
        shippingPostalCode: "50000-000",
        shippingState: "PE",
        shippingCity: "Recife",
        shippingDistrict: "Boa Vista",
        shippingStreet: "Rua do Sol",
        shippingNumber: "100",
        shippingMethodId: "shipping-method-inexistente"
      }
    });

    assert.equal(invalidShippingResponse.statusCode, 400);
    assert.equal(invalidShippingResponse.body.code, "SHIPPING_METHOD_UNAVAILABLE");

    const stockSessionId = `stock-${suffix}`;

    await requestJson({
      method: "POST",
      path: "/cart/public/current/items",
      headers: {
        host: `${storeSlug}.lvh.me`
      },
      body: {
        sessionId: stockSessionId,
        customerEmail: `stock-${suffix}@example.com`,
        productId,
        quantity: 1
      }
    });

    await prisma.product.update({
      where: { id: productId },
      data: {
        stockQuantity: 0,
        status: "OUT_OF_STOCK"
      }
    });

    const stockResponse = await requestJson<{
      code: string;
      status?: string;
    }>({
      method: "POST",
      path: "/checkout/public/current/order",
      headers: {
        host: `${storeSlug}.lvh.me`
      },
      body: {
        sessionId: stockSessionId,
        customerEmail: `stock-${suffix}@example.com`,
        customerFullName: "Stock Customer",
        shippingRecipientName: "Stock Customer",
        shippingPostalCode: "50000-000",
        shippingState: "PE",
        shippingCity: "Recife",
        shippingDistrict: "Boa Vista",
        shippingStreet: "Rua do Sol",
        shippingNumber: "100",
        shippingMethodId
      }
    });

    assert.equal(stockResponse.statusCode, 400);
    assert.equal(stockResponse.body.code, "PRODUCT_NOT_AVAILABLE");
  });

  async function requestJson<T>(options: RequestOptions): Promise<JsonResponse<T>> {
    const payload = options.body ? JSON.stringify(options.body) : undefined;

    return new Promise((resolve, reject) => {
      const request = http.request(
        `${baseUrl}${options.path}`,
        {
          method: options.method ?? "GET",
          headers: {
            "content-type": "application/json",
            ...(payload ? { "content-length": Buffer.byteLength(payload).toString() } : {}),
            ...(options.headers ?? {})
          }
        },
        (response) => {
          const chunks: Buffer[] = [];

          response.on("data", (chunk: Buffer) => {
            chunks.push(chunk);
          });

          response.on("end", () => {
            const rawBody = Buffer.concat(chunks).toString("utf8");
            const body = rawBody.length > 0 ? (JSON.parse(rawBody) as T) : ({} as T);

            resolve({
              statusCode: response.statusCode ?? 0,
              body
            });
          });
        }
      );

      request.on("error", reject);

      if (payload) {
        request.write(payload);
      }

      request.end();
    });
  }
});
