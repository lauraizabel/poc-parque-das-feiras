import assert from "node:assert/strict";
import * as http from "node:http";
import { AddressInfo } from "node:net";
import { after, before, describe, it } from "node:test";
import { INestApplication } from "@nestjs/common";
import { Test } from "@nestjs/testing";
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

describe("cart api", () => {
  const suffix = Date.now().toString(36);
  const primaryEmail = `cart-api-primary-${suffix}@example.com`;
  const secondaryEmail = `cart-api-secondary-${suffix}@example.com`;
  const password = "StrongPass123";
  const primaryStoreSlug = `cart-api-primary-${suffix}`;
  const sessionId = `session-${suffix}`;

  let app: INestApplication;
  let baseUrl = "";
  let primaryUserId = "";
  let secondaryUserId = "";
  let primaryStoreId = "";
  let secondaryStoreId = "";
  let primaryToken = "";
  let secondaryToken = "";
  let activeProductId = "";
  let inactiveProductId = "";
  let foreignProductId = "";

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

    const primaryRegistration = await requestJson<{
      user: { id: string };
      store: { id: string };
      tokens: { accessToken: string };
    }>({
      method: "POST",
      path: "/auth/register-merchant",
      body: {
        email: primaryEmail,
        password,
        fullName: "Primary Cart Owner",
        storeName: "Primary Cart Store",
        storeSlug: primaryStoreSlug
      }
    });

    const secondaryRegistration = await requestJson<{
      user: { id: string };
      store: { id: string };
      tokens: { accessToken: string };
    }>({
      method: "POST",
      path: "/auth/register-merchant",
      body: {
        email: secondaryEmail,
        password,
        fullName: "Secondary Cart Owner",
        storeName: "Secondary Cart Store",
        storeSlug: `cart-api-secondary-${suffix}`
      }
    });

    primaryUserId = primaryRegistration.body.user.id;
    secondaryUserId = secondaryRegistration.body.user.id;
    primaryStoreId = primaryRegistration.body.store.id;
    secondaryStoreId = secondaryRegistration.body.store.id;
    primaryToken = primaryRegistration.body.tokens.accessToken;
    secondaryToken = secondaryRegistration.body.tokens.accessToken;

    const activeProductResponse = await requestJson<{
      product: { id: string };
    }>({
      method: "POST",
      path: "/catalog/products",
      headers: {
        authorization: `Bearer ${primaryToken}`
      },
      body: {
        storeId: primaryStoreId,
        name: "Moedor Premium",
        slug: "moedor-premium",
        priceCents: 14990,
        stockQuantity: 5,
        status: "ACTIVE"
      }
    });
    activeProductId = activeProductResponse.body.product.id;

    const inactiveProductResponse = await requestJson<{
      product: { id: string };
    }>({
      method: "POST",
      path: "/catalog/products",
      headers: {
        authorization: `Bearer ${primaryToken}`
      },
      body: {
        storeId: primaryStoreId,
        name: "Produto Inativo",
        slug: "produto-inativo",
        priceCents: 8990,
        stockQuantity: 3,
        status: "INACTIVE"
      }
    });
    inactiveProductId = inactiveProductResponse.body.product.id;

    const foreignProductResponse = await requestJson<{
      product: { id: string };
    }>({
      method: "POST",
      path: "/catalog/products",
      headers: {
        authorization: `Bearer ${secondaryToken}`
      },
      body: {
        storeId: secondaryStoreId,
        name: "Produto Estrangeiro",
        slug: "produto-estrangeiro",
        priceCents: 12990,
        stockQuantity: 4,
        status: "ACTIVE"
      }
    });
    foreignProductId = foreignProductResponse.body.product.id;
  });

  after(async () => {
    if (primaryStoreId) {
      await prisma.store.delete({ where: { id: primaryStoreId } });
    }

    if (secondaryStoreId) {
      await prisma.store.delete({ where: { id: secondaryStoreId } });
    }

    if (primaryUserId) {
      await prisma.user.delete({ where: { id: primaryUserId } });
    }

    if (secondaryUserId) {
      await prisma.user.delete({ where: { id: secondaryUserId } });
    }

    await app.close();
  });

  it("creates, updates, removes and clears a cart for the resolved host", async () => {
    const createResponse = await requestJson<{
      cart: { id: string; summary: { itemCount: number; subtotalCents: number } };
    }>({
      method: "POST",
      path: "/cart/public/current",
      headers: {
        host: `${primaryStoreSlug}.lvh.me`
      },
      body: {
        sessionId
      }
    });

    assert.equal(createResponse.statusCode, 201);
    assert.equal(createResponse.body.cart.summary.itemCount, 0);

    const addResponse = await requestJson<{
      cart: {
        items: Array<{ id: string; quantity: number; unitPriceCents: number; productId: string }>;
        summary: { itemCount: number; subtotalCents: number };
      };
    }>({
      method: "POST",
      path: "/cart/public/current/items",
      headers: {
        host: `${primaryStoreSlug}.lvh.me`
      },
      body: {
        sessionId,
        productId: activeProductId,
        quantity: 2
      }
    });

    assert.equal(addResponse.statusCode, 201);
    assert.equal(addResponse.body.cart.items.length, 1);
    assert.equal(addResponse.body.cart.items[0]?.quantity, 2);
    assert.equal(addResponse.body.cart.items[0]?.unitPriceCents, 14990);
    assert.equal(addResponse.body.cart.summary.itemCount, 2);
    assert.equal(addResponse.body.cart.summary.subtotalCents, 29980);

    const cartItemId = addResponse.body.cart.items[0]!.id;

    await prisma.product.update({
      where: {
        id: activeProductId
      },
      data: {
        priceCents: 19990
      }
    });

    const updateResponse = await requestJson<{
      cart: { items: Array<{ quantity: number; unitPriceCents: number }>; summary: { subtotalCents: number } };
    }>({
      method: "PATCH",
      path: `/cart/public/current/items/${cartItemId}`,
      headers: {
        host: `${primaryStoreSlug}.lvh.me`
      },
      body: {
        sessionId,
        quantity: 3
      }
    });

    assert.equal(updateResponse.statusCode, 200);
    assert.equal(updateResponse.body.cart.items[0]?.quantity, 3);
    assert.equal(updateResponse.body.cart.items[0]?.unitPriceCents, 14990);
    assert.equal(updateResponse.body.cart.summary.subtotalCents, 44970);

    const removeResponse = await requestJson<{
      cart: { items: Array<unknown>; summary: { itemCount: number; subtotalCents: number } };
    }>({
      method: "DELETE",
      path: `/cart/public/current/items/${cartItemId}`,
      headers: {
        host: `${primaryStoreSlug}.lvh.me`
      },
      body: {
        sessionId
      }
    });

    assert.equal(removeResponse.statusCode, 200);
    assert.equal(removeResponse.body.cart.items.length, 0);
    assert.equal(removeResponse.body.cart.summary.itemCount, 0);

    await requestJson({
      method: "POST",
      path: "/cart/public/current/items",
      headers: {
        host: `${primaryStoreSlug}.lvh.me`
      },
      body: {
        sessionId,
        productId: activeProductId,
        quantity: 1
      }
    });

    const clearResponse = await requestJson<{
      cart: { items: Array<unknown>; summary: { itemCount: number } };
    }>({
      method: "POST",
      path: "/cart/public/current/clear",
      headers: {
        host: `${primaryStoreSlug}.lvh.me`
      },
      body: {
        sessionId
      }
    });

    assert.equal(clearResponse.statusCode, 201);
    assert.equal(clearResponse.body.cart.items.length, 0);
    assert.equal(clearResponse.body.cart.summary.itemCount, 0);
  });

  it("rejects products from another store, inactive products and insufficient stock", async () => {
    const foreignResponse = await requestJson<{
      message: string;
      code: string;
    }>({
      method: "POST",
      path: "/cart/public/current/items",
      headers: {
        host: `${primaryStoreSlug}.lvh.me`
      },
      body: {
        sessionId: `${sessionId}-foreign`,
        productId: foreignProductId,
        quantity: 1
      }
    });

    assert.equal(foreignResponse.statusCode, 404);
    assert.equal(foreignResponse.body.code, "PRODUCT_NOT_FOUND");
    assert.match(foreignResponse.body.message, /Product not found/i);

    const inactiveResponse = await requestJson<{
      message: string;
      code: string;
      status: string;
    }>({
      method: "POST",
      path: "/cart/public/current/items",
      headers: {
        host: `${primaryStoreSlug}.lvh.me`
      },
      body: {
        sessionId: `${sessionId}-inactive`,
        productId: inactiveProductId,
        quantity: 1
      }
    });

    assert.equal(inactiveResponse.statusCode, 400);
    assert.equal(inactiveResponse.body.code, "PRODUCT_NOT_AVAILABLE");
    assert.equal(inactiveResponse.body.status, "INACTIVE");
    assert.match(inactiveResponse.body.message, /not available/i);

    const stockResponse = await requestJson<{
      message: string;
      code: string;
      quantity: number;
      stockQuantity: number;
    }>({
      method: "POST",
      path: "/cart/public/current/items",
      headers: {
        host: `${primaryStoreSlug}.lvh.me`
      },
      body: {
        sessionId: `${sessionId}-stock`,
        productId: activeProductId,
        quantity: 99
      }
    });

    assert.equal(stockResponse.statusCode, 400);
    assert.equal(stockResponse.body.code, "INSUFFICIENT_STOCK");
    assert.equal(stockResponse.body.quantity, 99);
    assert.match(stockResponse.body.message, /Insufficient stock/i);
  });

  it("rejects a stale quantity update when stock changes between cart operations", async () => {
    const createResponse = await requestJson<{
      cart: {
        items: Array<{ id: string; quantity: number }>;
      };
    }>({
      method: "POST",
      path: "/cart/public/current/items",
      headers: {
        host: `${primaryStoreSlug}.lvh.me`
      },
      body: {
        sessionId: `${sessionId}-concurrency`,
        productId: activeProductId,
        quantity: 2
      }
    });

    assert.equal(createResponse.statusCode, 201);
    assert.equal(createResponse.body.cart.items[0]?.quantity, 2);

    const cartItemId = createResponse.body.cart.items[0]!.id;

    await prisma.product.update({
      where: {
        id: activeProductId
      },
      data: {
        stockQuantity: 1
      }
    });

    const staleUpdateResponse = await requestJson<{
      message: string;
      code: string;
      quantity: number;
      stockQuantity: number;
    }>({
      method: "PATCH",
      path: `/cart/public/current/items/${cartItemId}`,
      headers: {
        host: `${primaryStoreSlug}.lvh.me`
      },
      body: {
        sessionId: `${sessionId}-concurrency`,
        quantity: 2
      }
    });

    assert.equal(staleUpdateResponse.statusCode, 400);
    assert.equal(staleUpdateResponse.body.code, "INSUFFICIENT_STOCK");
    assert.equal(staleUpdateResponse.body.quantity, 2);
    assert.equal(staleUpdateResponse.body.stockQuantity, 1);
    assert.match(staleUpdateResponse.body.message, /Insufficient stock/i);

    const preservedCartResponse = await requestJson<{
      cart: {
        items: Array<{ id: string; quantity: number }>;
        summary: { itemCount: number };
      } | null;
    }>({
      method: "GET",
      path: "/cart/public/context",
      headers: {
        host: `${primaryStoreSlug}.lvh.me`
      },
      body: {
        sessionId: `${sessionId}-concurrency`
      }
    });

    assert.equal(preservedCartResponse.statusCode, 200);
    assert.equal(preservedCartResponse.body.cart?.items[0]?.id, cartItemId);
    assert.equal(preservedCartResponse.body.cart?.items[0]?.quantity, 2);
    assert.equal(preservedCartResponse.body.cart?.summary.itemCount, 2);

    await prisma.product.update({
      where: {
        id: activeProductId
      },
      data: {
        stockQuantity: 5
      }
    });
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
