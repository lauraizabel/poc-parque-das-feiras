import assert from "node:assert/strict";
import * as http from "node:http";
import { AddressInfo } from "node:net";
import { after, before, describe, it } from "node:test";
import { INestApplication } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import {
  PlatformRole,
  StoreMemberRole,
  DomainStatus,
  StoreDomainType
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

describe("tenant resolution", () => {
  const suffix = Date.now().toString(36);
  const primaryEmail = `tenant-primary-${suffix}@example.com`;
  const secondaryEmail = `tenant-secondary-${suffix}@example.com`;
  const primarySlug = `tenant-primary-${suffix}`;
  const secondarySlug = `tenant-secondary-${suffix}`;
  const primarySubdomainHost = `${primarySlug}.lvh.me`;
  const primaryCustomHost = `www.${primarySlug}.com`;

  let app: INestApplication;
  let baseUrl = "";
  let primaryStoreId = "";
  let secondaryStoreId = "";
  let primaryUserId = "";
  let secondaryUserId = "";

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

    const primaryUser = await prisma.user.create({
      data: {
        email: primaryEmail,
        passwordHash: "test-password-hash",
        platformRole: PlatformRole.CUSTOMER
      }
    });
    primaryUserId = primaryUser.id;

    const secondaryUser = await prisma.user.create({
      data: {
        email: secondaryEmail,
        passwordHash: "test-password-hash",
        platformRole: PlatformRole.CUSTOMER
      }
    });
    secondaryUserId = secondaryUser.id;

    const primaryStore = await prisma.store.create({
      data: {
        name: "Tenant Primary",
        slug: primarySlug,
        defaultSubdomain: primarySlug,
        ownerId: primaryUser.id
      }
    });
    primaryStoreId = primaryStore.id;

    const secondaryStore = await prisma.store.create({
      data: {
        name: "Tenant Secondary",
        slug: secondarySlug,
        defaultSubdomain: secondarySlug,
        ownerId: secondaryUser.id
      }
    });
    secondaryStoreId = secondaryStore.id;

    await prisma.storeMember.createMany({
      data: [
        {
          userId: primaryUser.id,
          storeId: primaryStore.id,
          role: StoreMemberRole.STORE_OWNER
        },
        {
          userId: secondaryUser.id,
          storeId: secondaryStore.id,
          role: StoreMemberRole.STORE_OWNER
        }
      ]
    });

    await prisma.storeDomain.create({
      data: {
        host: primaryCustomHost,
        type: StoreDomainType.CUSTOM_DOMAIN,
        status: DomainStatus.ACTIVE,
        activatedAt: new Date(),
        storeId: primaryStore.id
      }
    });
  });

  after(async () => {
    if (primaryStoreId) {
      await prisma.store.delete({
        where: {
          id: primaryStoreId
        }
      });
    }

    if (secondaryStoreId) {
      await prisma.store.delete({
        where: {
          id: secondaryStoreId
        }
      });
    }

    if (primaryUserId) {
      await prisma.user.delete({
        where: {
          id: primaryUserId
        }
      });
    }

    if (secondaryUserId) {
      await prisma.user.delete({
        where: {
          id: secondaryUserId
        }
      });
    }

    await app.close();
  });

  it("resolves a storefront by default subdomain host", async () => {
    const response = await requestJson<{
      kind: string;
      matchedHost: string;
      storeId: string;
      storeSlug: string;
      source: string;
    }>({
      path: "/domains/resolve",
      headers: {
        host: primarySubdomainHost
      }
    });

    assert.equal(response.statusCode, 200);
    assert.deepEqual(response.body, {
      kind: "storefront-store",
      matchedHost: primarySubdomainHost,
      storeId: primaryStoreId,
      storeSlug: primarySlug,
      source: "subdomain"
    });
  });

  it("resolves a storefront by verified custom domain host", async () => {
    const response = await requestJson<{
      kind: string;
      matchedHost: string;
      storeId: string;
      storeSlug: string;
      source: string;
    }>({
      path: "/domains/resolve",
      headers: {
        host: primaryCustomHost
      }
    });

    assert.equal(response.statusCode, 200);
    assert.deepEqual(response.body, {
      kind: "storefront-store",
      matchedHost: primaryCustomHost,
      storeId: primaryStoreId,
      storeSlug: primarySlug,
      source: "custom-domain"
    });
  });

  it("blocks public storefront access when the host does not resolve a store", async () => {
    const response = await requestJson<{
      message: string;
      code: string;
      resolution: {
        kind: string;
        matchedHost: string;
      };
    }>({
      path: "/catalog/public/context",
      headers: {
        host: "localhost:3002"
      }
    });

    assert.equal(response.statusCode, 404);
    assert.equal(response.body.code, "STOREFRONT_HOST_NOT_RESOLVED");
    assert.equal(response.body.resolution.kind, "dashboard");
  });

  it("blocks cross-tenant access when request storeId conflicts with the resolved host", async () => {
    const response = await requestJson<{
      message: string;
      code: string;
      resolvedStoreId: string;
      conflictingStoreId: string;
    }>({
      path: "/catalog/public/context",
      headers: {
        host: primarySubdomainHost,
        "x-store-id": secondaryStoreId
      }
    });

    assert.equal(response.statusCode, 403);
    assert.deepEqual(response.body, {
      message: "Provided storeId does not match the resolved storefront host",
      code: "STOREFRONT_STORE_CONTEXT_CONFLICT",
      resolvedStoreId: primaryStoreId,
      conflictingStoreId: secondaryStoreId
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
