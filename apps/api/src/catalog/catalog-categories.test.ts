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

describe("catalog categories", () => {
  const suffix = Date.now().toString(36);
  const primaryEmail = `catalog-primary-${suffix}@example.com`;
  const secondaryEmail = `catalog-secondary-${suffix}@example.com`;
  const password = "StrongPass123";

  let app: INestApplication;
  let baseUrl = "";
  let primaryUserId = "";
  let secondaryUserId = "";
  let primaryStoreId = "";
  let secondaryStoreId = "";
  let primaryToken = "";
  let secondaryToken = "";
  let primaryCategoryId = "";

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
        fullName: "Primary Catalog Owner",
        storeName: "Primary Catalog Store",
        storeSlug: `catalog-primary-${suffix}`
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
        fullName: "Secondary Catalog Owner",
        storeName: "Secondary Catalog Store",
        storeSlug: `catalog-secondary-${suffix}`
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

  it("creates a category with normalized slug for the store", async () => {
    const response = await requestJson<{
      category: {
        id: string;
        storeId: string;
        name: string;
        slug: string;
        status: string;
        sortOrder: number;
      };
    }>({
      method: "POST",
      path: "/catalog/categories",
      headers: {
        authorization: `Bearer ${primaryToken}`
      },
      body: {
        storeId: primaryStoreId,
        name: "Ofertas de Verao",
        slug: "Ofertas de Verao",
        sortOrder: 2
      }
    });

    assert.equal(response.statusCode, 201);
    primaryCategoryId = response.body.category.id;
    assert.equal(response.body.category.storeId, primaryStoreId);
    assert.equal(response.body.category.slug, "ofertas-de-verao");
    assert.equal(response.body.category.status, "ACTIVE");
  });

  it("lists only categories from the requested store ordered by sortOrder", async () => {
    await requestJson({
      method: "POST",
      path: "/catalog/categories",
      headers: {
        authorization: `Bearer ${primaryToken}`
      },
      body: {
        storeId: primaryStoreId,
        name: "Lançamentos",
        slug: "lancamentos",
        sortOrder: 1
      }
    });

    await requestJson({
      method: "POST",
      path: "/catalog/categories",
      headers: {
        authorization: `Bearer ${secondaryToken}`
      },
      body: {
        storeId: secondaryStoreId,
        name: "Privada",
        slug: "privada",
        sortOrder: 0
      }
    });

    const response = await requestJson<{
      categories: Array<{
        name: string;
        storeId: string;
        sortOrder: number;
      }>;
    }>({
      path: `/catalog/${primaryStoreId}/categories`,
      headers: {
        authorization: `Bearer ${primaryToken}`
      }
    });

    assert.equal(response.statusCode, 200);
    assert.equal(response.body.categories.length, 2);
    assert.deepEqual(
      response.body.categories.map((category) => ({
        name: category.name,
        storeId: category.storeId,
        sortOrder: category.sortOrder
      })),
      [
        {
          name: "Lançamentos",
          storeId: primaryStoreId,
          sortOrder: 1
        },
        {
          name: "Ofertas de Verao",
          storeId: primaryStoreId,
          sortOrder: 2
        }
      ]
    );
  });

  it("updates category fields and keeps slug unique within the store", async () => {
    const response = await requestJson<{
      category: {
        id: string;
        name: string;
        slug: string;
        description: string | null;
        sortOrder: number;
      };
    }>({
      method: "PATCH",
      path: `/catalog/categories/${primaryCategoryId}`,
      headers: {
        authorization: `Bearer ${primaryToken}`
      },
      body: {
        storeId: primaryStoreId,
        name: "Ofertas Atualizadas",
        slug: "ofertas-atualizadas",
        description: "Campanhas sazonais",
        sortOrder: 5
      }
    });

    assert.equal(response.statusCode, 200);
    assert.equal(response.body.category.slug, "ofertas-atualizadas");
    assert.equal(response.body.category.sortOrder, 5);
    assert.equal(response.body.category.description, "Campanhas sazonais");
  });

  it("deactivates a category for the correct store only", async () => {
    const response = await requestJson<{
      category: {
        status: string;
      };
    }>({
      method: "POST",
      path: `/catalog/${primaryStoreId}/categories/${primaryCategoryId}/deactivate`,
      headers: {
        authorization: `Bearer ${primaryToken}`
      }
    });

    assert.equal(response.statusCode, 201);
    assert.equal(response.body.category.status, "INACTIVE");
  });

  it("rejects cross-store access to a category from another merchant", async () => {
    const response = await requestJson<{
      message: string;
      code: string;
    }>({
      method: "PATCH",
      path: `/catalog/categories/${primaryCategoryId}`,
      headers: {
        authorization: `Bearer ${secondaryToken}`
      },
      body: {
        storeId: secondaryStoreId,
        name: "Intrusão"
      }
    });

    assert.equal(response.statusCode, 404);
    assert.equal(response.body.code, "CATEGORY_NOT_FOUND");
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
