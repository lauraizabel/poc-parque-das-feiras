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

describe("shipping api", () => {
  const suffix = Date.now().toString(36);
  const primaryEmail = `shipping-primary-${suffix}@example.com`;
  const secondaryEmail = `shipping-secondary-${suffix}@example.com`;
  const password = "StrongPass123";

  let app: INestApplication;
  let baseUrl = "";
  let primaryUserId = "";
  let secondaryUserId = "";
  let primaryStoreId = "";
  let secondaryStoreId = "";
  let primaryToken = "";
  let secondaryToken = "";
  let shippingMethodId = "";

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
        fullName: "Primary Shipping Owner",
        storeName: "Primary Shipping Store",
        storeSlug: `shipping-primary-${suffix}`
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
        fullName: "Secondary Shipping Owner",
        storeName: "Secondary Shipping Store",
        storeSlug: `shipping-secondary-${suffix}`
      }
    });

    primaryUserId = primaryRegistration.body.user.id;
    primaryStoreId = primaryRegistration.body.store.id;
    primaryToken = primaryRegistration.body.tokens.accessToken;

    secondaryUserId = secondaryRegistration.body.user.id;
    secondaryStoreId = secondaryRegistration.body.store.id;
    secondaryToken = secondaryRegistration.body.tokens.accessToken;
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

  it("creates a fixed-price shipping method with estimated delivery days", async () => {
    const response = await requestJson<{
      shippingMethod: {
        id: string;
        storeId: string;
        name: string;
        type: string;
        priceCents: number;
        estimatedDaysMin: number | null;
        estimatedDaysMax: number | null;
        minimumOrderCents: number | null;
        maximumOrderCents: number | null;
      };
    }>({
      method: "POST",
      path: "/shipping/methods",
      headers: {
        authorization: `Bearer ${primaryToken}`
      },
      body: {
        storeId: primaryStoreId,
        name: "PAC Econômico",
        type: "FIXED_PRICE",
        description: "Frete econômico nacional",
        priceCents: 1490,
        estimatedDaysMin: 3,
        estimatedDaysMax: 6,
        minimumOrderCents: 0,
        maximumOrderCents: 30000,
        sortOrder: 2,
        isDefault: true
      }
    });

    assert.equal(response.statusCode, 201);
    shippingMethodId = response.body.shippingMethod.id;
    assert.equal(response.body.shippingMethod.storeId, primaryStoreId);
    assert.equal(response.body.shippingMethod.type, "FIXED_PRICE");
    assert.equal(response.body.shippingMethod.priceCents, 1490);
    assert.equal(response.body.shippingMethod.estimatedDaysMin, 3);
    assert.equal(response.body.shippingMethod.estimatedDaysMax, 6);
  });

  it("lists only shipping methods from the requested store ordered by sortOrder", async () => {
    await requestJson({
      method: "POST",
      path: "/shipping/methods",
      headers: {
        authorization: `Bearer ${primaryToken}`
      },
      body: {
        storeId: primaryStoreId,
        name: "Retirada na Loja",
        type: "LOCAL_PICKUP",
        priceCents: 0,
        estimatedDaysMin: 0,
        estimatedDaysMax: 0,
        sortOrder: 0
      }
    });

    await requestJson({
      method: "POST",
      path: "/shipping/methods",
      headers: {
        authorization: `Bearer ${secondaryToken}`
      },
      body: {
        storeId: secondaryStoreId,
        name: "Privado",
        type: "FIXED_PRICE",
        priceCents: 2990,
        estimatedDaysMin: 5,
        estimatedDaysMax: 8,
        sortOrder: 0
      }
    });

    const response = await requestJson<{
      shippingMethods: Array<{
        storeId: string;
        name: string;
        sortOrder: number;
      }>;
    }>({
      path: `/shipping/${primaryStoreId}/methods`,
      headers: {
        authorization: `Bearer ${primaryToken}`
      }
    });

    assert.equal(response.statusCode, 200);
    assert.equal(response.body.shippingMethods.length, 2);
    assert.deepEqual(
      response.body.shippingMethods.map((method) => ({
        storeId: method.storeId,
        name: method.name,
        sortOrder: method.sortOrder
      })),
      [
        {
          storeId: primaryStoreId,
          name: "Retirada na Loja",
          sortOrder: 0
        },
        {
          storeId: primaryStoreId,
          name: "PAC Econômico",
          sortOrder: 2
        }
      ]
    );
  });

  it("updates shipping method configuration and rejects cross-store access", async () => {
    const updateResponse = await requestJson<{
      shippingMethod: {
        id: string;
        status: string;
        priceCents: number;
        maximumOrderCents: number | null;
      };
    }>({
      method: "PATCH",
      path: `/shipping/methods/${shippingMethodId}`,
      headers: {
        authorization: `Bearer ${primaryToken}`
      },
      body: {
        storeId: primaryStoreId,
        status: "INACTIVE",
        priceCents: 1990,
        maximumOrderCents: 40000
      }
    });

    assert.equal(updateResponse.statusCode, 200);
    assert.equal(updateResponse.body.shippingMethod.status, "INACTIVE");
    assert.equal(updateResponse.body.shippingMethod.priceCents, 1990);
    assert.equal(updateResponse.body.shippingMethod.maximumOrderCents, 40000);

    const forbiddenResponse = await requestJson<{
      message: string;
      code: string;
    }>({
      method: "PATCH",
      path: `/shipping/methods/${shippingMethodId}`,
      headers: {
        authorization: `Bearer ${secondaryToken}`
      },
      body: {
        storeId: secondaryStoreId,
        status: "ACTIVE"
      }
    });

    assert.equal(forbiddenResponse.statusCode, 404);
    assert.equal(forbiddenResponse.body.code, "SHIPPING_METHOD_NOT_FOUND");
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
