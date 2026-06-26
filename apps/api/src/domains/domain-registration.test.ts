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

describe("domain registration", () => {
  const suffix = Date.now().toString(36);
  const primaryEmail = `domain-primary-${suffix}@example.com`;
  const secondaryEmail = `domain-secondary-${suffix}@example.com`;
  const password = "StrongPass123";

  let app: INestApplication;
  let baseUrl = "";
  let primaryUserId = "";
  let secondaryUserId = "";
  let primaryStoreId = "";
  let secondaryStoreId = "";
  let primaryToken = "";
  let secondaryToken = "";

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
        fullName: "Primary Owner",
        storeName: "Primary Store",
        storeSlug: `primary-${suffix}`
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
        fullName: "Secondary Owner",
        storeName: "Secondary Store",
        storeSlug: `secondary-${suffix}`
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
      await prisma.store.delete({
        where: { id: primaryStoreId }
      });
    }

    if (secondaryStoreId) {
      await prisma.store.delete({
        where: { id: secondaryStoreId }
      });
    }

    if (primaryUserId) {
      await prisma.user.delete({
        where: { id: primaryUserId }
      });
    }

    if (secondaryUserId) {
      await prisma.user.delete({
        where: { id: secondaryUserId }
      });
    }

    await app.close();
  });

  it("creates a custom domain normalized to the official www host", async () => {
    const response = await requestJson<{
      domain: {
        host: string;
        storeId: string;
        status: string;
        dnsTargetValue: string | null;
      };
    }>({
      method: "POST",
      path: "/domains",
      headers: {
        authorization: `Bearer ${primaryToken}`
      },
      body: {
        storeId: primaryStoreId,
        host: "HTTPS://WWW.PrimaryBrand.com/"
      }
    });

    assert.equal(response.statusCode, 201);
    assert.equal(response.body.domain.host, "www.primarybrand.com");
    assert.equal(response.body.domain.storeId, primaryStoreId);
    assert.equal(response.body.domain.status, "AWAITING_DNS");
    assert.match(response.body.domain.dnsTargetValue ?? "", /\.lvh\.me$/);
  });

  it("returns the registered custom domain for the store", async () => {
    const response = await requestJson<{
      domain: {
        id: string;
        host: string;
        storeId: string;
        status: string;
        dnsTargetValue: string | null;
      } | null;
    }>({
      path: `/domains/${primaryStoreId}`,
      headers: {
        authorization: `Bearer ${primaryToken}`
      }
    });

    assert.equal(response.statusCode, 200);
    assert.equal(response.body.domain?.host, "www.primarybrand.com");
    assert.equal(response.body.domain?.storeId, primaryStoreId);
    assert.equal(response.body.domain?.status, "VERIFYING");
    assert.match(response.body.domain?.dnsTargetValue ?? "", /\.lvh\.me$/);
  });

  it("rejects apex domains when the host does not use www", async () => {
    const response = await requestJson<{
      message: string;
      code: string;
    }>({
      method: "POST",
      path: "/domains",
      headers: {
        authorization: `Bearer ${secondaryToken}`
      },
      body: {
        storeId: secondaryStoreId,
        host: "secondarybrand.com"
      }
    });

    assert.equal(response.statusCode, 400);
    assert.equal(response.body.code, "DOMAIN_HOST_WWW_REQUIRED");
  });

  it("rejects a custom domain host that is already in use", async () => {
    const response = await requestJson<{
      message: string;
      code: string;
      host: string;
    }>({
      method: "POST",
      path: "/domains",
      headers: {
        authorization: `Bearer ${secondaryToken}`
      },
      body: {
        storeId: secondaryStoreId,
        host: "www.primarybrand.com"
      }
    });

    assert.equal(response.statusCode, 409);
    assert.equal(response.body.code, "DOMAIN_HOST_ALREADY_IN_USE");
    assert.equal(response.body.host, "www.primarybrand.com");
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
