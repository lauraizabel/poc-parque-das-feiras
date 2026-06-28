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

describe("catalog storefront", () => {
  const suffix = Date.now().toString(36);
  const primaryEmail = `storefront-primary-${suffix}@example.com`;
  const secondaryEmail = `storefront-secondary-${suffix}@example.com`;
  const password = "StrongPass123";
  const primaryStoreSlug = `vitrine-a-${suffix}`;
  const secondaryStoreSlug = `vitrine-b-${suffix}`;
  const primaryHost = `${primaryStoreSlug}.lvh.me`;
  const secondaryHost = `${secondaryStoreSlug}.lvh.me`;

  let app: INestApplication;
  let baseUrl = "";
  let primaryUserId = "";
  let secondaryUserId = "";
  let primaryStoreId = "";
  let secondaryStoreId = "";
  let primaryToken = "";
  let secondaryToken = "";
  let primaryCategoryId = "";
  let secondaryCategoryId = "";
  let primaryProductId = "";
  let secondaryProductId = "";

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
        fullName: "Primary Storefront Merchant",
        storeName: "Loja Aurora",
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
        fullName: "Secondary Storefront Merchant",
        storeName: "Loja Brisa",
        storeSlug: secondaryStoreSlug
      }
    });

    primaryUserId = primaryRegistration.body.user.id;
    primaryStoreId = primaryRegistration.body.store.id;
    primaryToken = primaryRegistration.body.tokens.accessToken;

    secondaryUserId = secondaryRegistration.body.user.id;
    secondaryStoreId = secondaryRegistration.body.store.id;
    secondaryToken = secondaryRegistration.body.tokens.accessToken;

    const primaryCategory = await requestJson<{
      category: { id: string };
    }>({
      method: "POST",
      path: "/catalog/categories",
      headers: {
        authorization: `Bearer ${primaryToken}`
      },
      body: {
        storeId: primaryStoreId,
        name: "Linha Aurora",
        slug: "linha-aurora"
      }
    });
    primaryCategoryId = primaryCategory.body.category.id;

    const secondaryCategory = await requestJson<{
      category: { id: string };
    }>({
      method: "POST",
      path: "/catalog/categories",
      headers: {
        authorization: `Bearer ${secondaryToken}`
      },
      body: {
        storeId: secondaryStoreId,
        name: "Linha Brisa",
        slug: "linha-brisa"
      }
    });
    secondaryCategoryId = secondaryCategory.body.category.id;

    const primaryProduct = await requestJson<{
      product: { id: string };
    }>({
      method: "POST",
      path: "/catalog/products",
      headers: {
        authorization: `Bearer ${primaryToken}`
      },
      body: {
        storeId: primaryStoreId,
        categoryId: primaryCategoryId,
        name: "Cafe Aurora",
        slug: "cafe-aurora",
        priceCents: 2590,
        stockQuantity: 6,
        status: "ACTIVE",
        isFeatured: true
      }
    });
    primaryProductId = primaryProduct.body.product.id;

    const secondaryProduct = await requestJson<{
      product: { id: string };
    }>({
      method: "POST",
      path: "/catalog/products",
      headers: {
        authorization: `Bearer ${secondaryToken}`
      },
      body: {
        storeId: secondaryStoreId,
        categoryId: secondaryCategoryId,
        name: "Cha Brisa",
        slug: "cha-brisa",
        priceCents: 1990,
        stockQuantity: 4,
        status: "ACTIVE"
      }
    });
    secondaryProductId = secondaryProduct.body.product.id;

    await requestJson({
      method: "PATCH",
      path: `/stores/${primaryStoreId}/theme`,
      headers: {
        authorization: `Bearer ${primaryToken}`
      },
      body: {
        primaryColor: "#0d7a64",
        accentColor: "#084c40",
        surfaceColor: "#f2f8f6",
        heroTitle: "Aurora por assinatura",
        heroSubtitle: "A vitrine principal da Aurora usa a identidade configurada no painel.",
        announcementText: "Entrega expressa para todo o Nordeste",
        logoUrl: "https://cdn.example.com/aurora-logo.png",
        bannerUrl: "https://cdn.example.com/aurora-banner.jpg"
      }
    });

    await requestJson({
      method: "PATCH",
      path: `/stores/${secondaryStoreId}/theme`,
      headers: {
        authorization: `Bearer ${secondaryToken}`
      },
      body: {
        primaryColor: "#7a3a0d",
        accentColor: "#4c2208",
        surfaceColor: "#fbf4ee",
        heroTitle: "Brisa natural",
        heroSubtitle: "Uma segunda loja deve renderizar outra identidade no mesmo app.",
        announcementText: "Novos blends toda semana"
      }
    });
  });

  after(async () => {
    if (primaryStoreId) {
      await prisma.store.delete({ where: { id: primaryStoreId } }).catch(() => null);
    }

    if (secondaryStoreId) {
      await prisma.store.delete({ where: { id: secondaryStoreId } }).catch(() => null);
    }

    if (primaryUserId) {
      await prisma.user.delete({ where: { id: primaryUserId } }).catch(() => null);
    }

    if (secondaryUserId) {
      await prisma.user.delete({ where: { id: secondaryUserId } }).catch(() => null);
    }

    await app.close();
  });

  it("changes the public storefront payload when the host resolves a different tenant", async () => {
    const primaryHome = await requestJson<{
      store: {
        id: string;
        slug: string;
        name: string;
        matchedHost: string;
        theme: {
          primaryColor: string;
          heroTitle: string | null;
          announcementText: string | null;
          logoUrl: string | null;
        } | null;
      };
      categories: Array<{ slug: string }>;
      products: Array<{ id: string; slug: string }>;
    }>({
      path: "/catalog/public/home",
      headers: {
        host: primaryHost,
        "x-forwarded-host": primaryHost
      }
    });

    const secondaryHome = await requestJson<{
      store: {
        id: string;
        slug: string;
        name: string;
        matchedHost: string;
        theme: {
          primaryColor: string;
          heroTitle: string | null;
          announcementText: string | null;
          logoUrl: string | null;
        } | null;
      };
      categories: Array<{ slug: string }>;
      products: Array<{ id: string; slug: string }>;
    }>({
      path: "/catalog/public/home",
      headers: {
        host: secondaryHost,
        "x-forwarded-host": secondaryHost
      }
    });

    assert.equal(primaryHome.statusCode, 200);
    assert.equal(primaryHome.body.store.id, primaryStoreId);
    assert.equal(primaryHome.body.store.slug, primaryStoreSlug);
    assert.equal(primaryHome.body.store.matchedHost, primaryHost);
    assert.equal(primaryHome.body.store.theme?.primaryColor, "#0d7a64");
    assert.equal(primaryHome.body.store.theme?.heroTitle, "Aurora por assinatura");
    assert.equal(
      primaryHome.body.store.theme?.announcementText,
      "Entrega expressa para todo o Nordeste"
    );
    assert.equal(
      primaryHome.body.store.theme?.logoUrl,
      "https://cdn.example.com/aurora-logo.png"
    );
    assert.deepEqual(primaryHome.body.categories.map((category) => category.slug), [
      "linha-aurora"
    ]);
    assert.deepEqual(primaryHome.body.products.map((product) => product.slug), ["cafe-aurora"]);

    assert.equal(secondaryHome.statusCode, 200);
    assert.equal(secondaryHome.body.store.id, secondaryStoreId);
    assert.equal(secondaryHome.body.store.slug, secondaryStoreSlug);
    assert.equal(secondaryHome.body.store.matchedHost, secondaryHost);
    assert.equal(secondaryHome.body.store.theme?.primaryColor, "#7a3a0d");
    assert.equal(secondaryHome.body.store.theme?.heroTitle, "Brisa natural");
    assert.equal(secondaryHome.body.store.theme?.announcementText, "Novos blends toda semana");
    assert.equal(secondaryHome.body.store.theme?.logoUrl, null);
    assert.deepEqual(secondaryHome.body.categories.map((category) => category.slug), [
      "linha-brisa"
    ]);
    assert.deepEqual(secondaryHome.body.products.map((product) => product.slug), ["cha-brisa"]);
  });

  it("keeps draft, inactive and foreign-tenant products out of the public storefront", async () => {
    await requestJson({
      method: "POST",
      path: "/catalog/products",
      headers: {
        authorization: `Bearer ${primaryToken}`
      },
      body: {
        storeId: primaryStoreId,
        categoryId: primaryCategoryId,
        name: "Cafe Rascunho",
        slug: "cafe-rascunho",
        priceCents: 1490,
        stockQuantity: 3,
        status: "DRAFT"
      }
    });

    await requestJson({
      method: "POST",
      path: "/catalog/products",
      headers: {
        authorization: `Bearer ${primaryToken}`
      },
      body: {
        storeId: primaryStoreId,
        categoryId: primaryCategoryId,
        name: "Cafe Inativo",
        slug: "cafe-inativo",
        priceCents: 1690,
        stockQuantity: 3,
        status: "INACTIVE"
      }
    });

    const primaryCatalog = await requestJson<{
      products: Array<{ id: string; slug: string; status: string }>;
      pagination: { totalItems: number };
    }>({
      path: "/catalog/public/products",
      headers: {
        host: primaryHost,
        "x-forwarded-host": primaryHost
      }
    });

    const primaryProductDetail = await requestJson<{
      product: { id: string; slug: string; status: string };
      availability: { canAddToCart: boolean; isInStock: boolean; status: string };
    }>({
      path: "/catalog/public/products/cafe-aurora",
      headers: {
        host: primaryHost,
        "x-forwarded-host": primaryHost
      }
    });

    const foreignProductDetail = await requestJson<{
      message: string;
      code: string;
    }>({
      path: "/catalog/public/products/cha-brisa",
      headers: {
        host: primaryHost,
        "x-forwarded-host": primaryHost
      }
    });

    assert.equal(primaryCatalog.statusCode, 200);
    assert.equal(primaryCatalog.body.pagination.totalItems, 1);
    assert.deepEqual(
      primaryCatalog.body.products.map((product) => ({
        id: product.id,
        slug: product.slug,
        status: product.status
      })),
      [
        {
          id: primaryProductId,
          slug: "cafe-aurora",
          status: "ACTIVE"
        }
      ]
    );

    assert.equal(primaryProductDetail.statusCode, 200);
    assert.equal(primaryProductDetail.body.product.id, primaryProductId);
    assert.equal(primaryProductDetail.body.availability.canAddToCart, true);
    assert.equal(primaryProductDetail.body.availability.isInStock, true);
    assert.equal(primaryProductDetail.body.availability.status, "ACTIVE");

    assert.equal(foreignProductDetail.statusCode, 404);
    assert.equal(foreignProductDetail.body.code, "PUBLIC_PRODUCT_NOT_FOUND");
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
