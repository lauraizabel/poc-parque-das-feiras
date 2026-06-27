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

describe("catalog products", () => {
  const suffix = Date.now().toString(36);
  const primaryEmail = `product-primary-${suffix}@example.com`;
  const secondaryEmail = `product-secondary-${suffix}@example.com`;
  const primaryStoreSlug = `product-primary-${suffix}`;
  const password = "StrongPass123";

  let app: INestApplication;
  let baseUrl = "";
  let primaryUserId = "";
  let secondaryUserId = "";
  let primaryStoreId = "";
  let secondaryStoreId = "";
  let primaryToken = "";
  let secondaryToken = "";
  let categoryId = "";
  let productId = "";

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
        fullName: "Primary Product Owner",
        storeName: "Primary Product Store",
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
        fullName: "Secondary Product Owner",
        storeName: "Secondary Product Store",
        storeSlug: `product-secondary-${suffix}`
      }
    });

    primaryUserId = primaryRegistration.body.user.id;
    primaryStoreId = primaryRegistration.body.store.id;
    primaryToken = primaryRegistration.body.tokens.accessToken;

    secondaryUserId = secondaryRegistration.body.user.id;
    secondaryStoreId = secondaryRegistration.body.store.id;
    secondaryToken = secondaryRegistration.body.tokens.accessToken;

    const categoryResponse = await requestJson<{
      category: { id: string };
    }>({
      method: "POST",
      path: "/catalog/categories",
      headers: {
        authorization: `Bearer ${primaryToken}`
      },
      body: {
        storeId: primaryStoreId,
        name: "Eletronicos",
        slug: "eletronicos"
      }
    });
    categoryId = categoryResponse.body.category.id;
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

  it("creates a product linked to the store category with normalized slug and sku", async () => {
    const response = await requestJson<{
      product: {
        id: string;
        storeId: string;
        categoryId: string | null;
        slug: string;
        sku: string | null;
        status: string;
      };
    }>({
      method: "POST",
      path: "/catalog/products",
      headers: {
        authorization: `Bearer ${primaryToken}`
      },
      body: {
        storeId: primaryStoreId,
        categoryId,
        name: "Notebook Pro",
        slug: "Notebook Pro",
        sku: "nb-pro-01",
        priceCents: 599900,
        compareAtCents: 699900,
        stockQuantity: 8,
        status: "DRAFT"
      }
    });

    assert.equal(response.statusCode, 201);
    productId = response.body.product.id;
    assert.equal(response.body.product.storeId, primaryStoreId);
    assert.equal(response.body.product.categoryId, categoryId);
    assert.equal(response.body.product.slug, "notebook-pro");
    assert.equal(response.body.product.sku, "NB-PRO-01");
    assert.equal(response.body.product.status, "DRAFT");
  });

  it("lists only products from the requested store", async () => {
    await requestJson({
      method: "POST",
      path: "/catalog/products",
      headers: {
        authorization: `Bearer ${secondaryToken}`
      },
      body: {
        storeId: secondaryStoreId,
        name: "Outro Produto",
        slug: "outro-produto",
        priceCents: 199900,
        stockQuantity: 3
      }
    });

    const response = await requestJson<{
      products: Array<{
        id: string;
        storeId: string;
      }>;
    }>({
      path: `/catalog/${primaryStoreId}/products`,
      headers: {
        authorization: `Bearer ${primaryToken}`
      }
    });

    assert.equal(response.statusCode, 200);
    assert.equal(response.body.products.length, 1);
    assert.equal(response.body.products[0]?.id, productId);
    assert.equal(response.body.products[0]?.storeId, primaryStoreId);
  });

  it("exposes only active in-stock products on the public storefront endpoints", async () => {
    const publishResponse = await requestJson<{
      product: { status: string };
    }>({
      method: "POST",
      path: `/catalog/${primaryStoreId}/products/${productId}/publish`,
      headers: {
        authorization: `Bearer ${primaryToken}`
      }
    });

    assert.equal(publishResponse.statusCode, 201);
    assert.equal(publishResponse.body.product.status, "ACTIVE");

    const hiddenProductResponse = await requestJson<{
      product: { id: string };
    }>({
      method: "POST",
      path: "/catalog/products",
      headers: {
        authorization: `Bearer ${primaryToken}`
      },
      body: {
        storeId: primaryStoreId,
        categoryId,
        name: "Produto Rascunho",
        slug: "produto-rascunho",
        priceCents: 159900,
        stockQuantity: 4,
        status: "DRAFT"
      }
    });

    assert.equal(hiddenProductResponse.statusCode, 201);

    const outOfStockResponse = await requestJson<{
      product: { id: string };
    }>({
      method: "POST",
      path: "/catalog/products",
      headers: {
        authorization: `Bearer ${primaryToken}`
      },
      body: {
        storeId: primaryStoreId,
        categoryId,
        name: "Produto Sem Estoque",
        slug: "produto-sem-estoque",
        priceCents: 259900,
        stockQuantity: 0,
        status: "ACTIVE"
      }
    });

    assert.equal(outOfStockResponse.statusCode, 201);

    const homeResponse = await requestJson<{
      store: { id: string; slug: string; matchedHost: string };
      categories: Array<{ slug: string }>;
      products: Array<{ id: string; slug: string; status: string }>;
    }>({
      path: "/catalog/public/home",
      headers: {
        host: `${primaryStoreSlug}.lvh.me`
      }
    });

    assert.equal(homeResponse.statusCode, 200);
    assert.equal(homeResponse.body.store.id, primaryStoreId);
    assert.equal(homeResponse.body.store.slug, primaryStoreSlug);
    assert.equal(homeResponse.body.store.matchedHost, `${primaryStoreSlug}.lvh.me`);
    assert.equal(homeResponse.body.categories.length, 1);
    assert.deepEqual(
      homeResponse.body.products.map((product) => product.slug),
      ["notebook-pro"]
    );

    const catalogResponse = await requestJson<{
      selectedCategorySlug: string | null;
      products: Array<{ id: string; slug: string }>;
      pagination: { page: number; totalItems: number; totalPages: number };
    }>({
      path: "/catalog/public/products?category=eletronicos&page=1&pageSize=1",
      headers: {
        host: `${primaryStoreSlug}.lvh.me`
      }
    });

    assert.equal(catalogResponse.statusCode, 200);
    assert.equal(catalogResponse.body.selectedCategorySlug, "eletronicos");
    assert.equal(catalogResponse.body.pagination.page, 1);
    assert.equal(catalogResponse.body.pagination.totalItems, 1);
    assert.equal(catalogResponse.body.pagination.totalPages, 1);
    assert.deepEqual(
      catalogResponse.body.products.map((product) => product.slug),
      ["notebook-pro"]
    );
  });

  it("returns a public product detail by slug and keeps out-of-stock products visible but blocked", async () => {
    const primaryImageResponse = await requestJson<{
      image: {
        imageUrl: string;
        altText: string | null;
        isPrimary: boolean;
        asset: { mimeType: string; sizeBytes: number } | null;
      };
    }>({
      method: "POST",
      path: `/catalog/products/${productId}/images`,
      headers: {
        authorization: `Bearer ${primaryToken}`
      },
      body: {
        storeId: primaryStoreId,
        fileName: "notebook-pro-primary.png",
        mimeType: "image/png",
        contentBase64: "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8Xw8AAoMBgAGvJ9kAAAAASUVORK5CYII=",
        altText: "Notebook Pro aberto",
        isPrimary: true,
        sortOrder: 0
      }
    });

    assert.equal(primaryImageResponse.statusCode, 201);
    assert.equal(primaryImageResponse.body.image.isPrimary, true);
    assert.equal(primaryImageResponse.body.image.altText, "Notebook Pro aberto");
    assert.equal(primaryImageResponse.body.image.asset?.mimeType, "image/png");
    assert.ok((primaryImageResponse.body.image.asset?.sizeBytes ?? 0) > 0);
    assert.match(primaryImageResponse.body.image.imageUrl, /^data:image\/png;base64,/);

    const secondaryImageResponse = await requestJson<{
      image: {
        imageUrl: string;
        isPrimary: boolean;
      };
    }>({
      method: "POST",
      path: `/catalog/products/${productId}/images`,
      headers: {
        authorization: `Bearer ${primaryToken}`
      },
      body: {
        storeId: primaryStoreId,
        fileName: "notebook-pro-side.png",
        mimeType: "image/png",
        contentBase64: "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8Xw8AAoMBgAGvJ9kAAAAASUVORK5CYII=",
        altText: "Notebook Pro lateral",
        isPrimary: false,
        sortOrder: 1
      }
    });

    assert.equal(secondaryImageResponse.statusCode, 201);
    assert.equal(secondaryImageResponse.body.image.isPrimary, false);

    const activeResponse = await requestJson<{
      product: { slug: string; status: string; images: Array<{ imageUrl: string }> };
      availability: { canAddToCart: boolean; isInStock: boolean; status: string };
    }>({
      path: `/catalog/public/products/notebook-pro`,
      headers: {
        host: `${primaryStoreSlug}.lvh.me`
      }
    });

    assert.equal(activeResponse.statusCode, 200);
    assert.equal(activeResponse.body.product.slug, "notebook-pro");
    assert.equal(activeResponse.body.product.status, "ACTIVE");
    assert.equal(activeResponse.body.product.images.length, 2);
    assert.equal(activeResponse.body.availability.canAddToCart, true);
    assert.equal(activeResponse.body.availability.isInStock, true);

    const outOfStockResponse = await requestJson<{
      product: { status: string; stockQuantity: number };
      availability: { canAddToCart: boolean; isInStock: boolean; status: string };
    }>({
      method: "PATCH",
      path: `/catalog/products/${productId}`,
      headers: {
        authorization: `Bearer ${primaryToken}`
      },
      body: {
        storeId: primaryStoreId,
        stockQuantity: 0,
        status: "ACTIVE"
      }
    });

    assert.equal(outOfStockResponse.statusCode, 200);
    assert.equal(outOfStockResponse.body.product.status, "OUT_OF_STOCK");

    const blockedPurchaseResponse = await requestJson<{
      product: { status: string; stockQuantity: number };
      availability: { canAddToCart: boolean; isInStock: boolean; status: string };
    }>({
      path: `/catalog/public/products/notebook-pro`,
      headers: {
        host: `${primaryStoreSlug}.lvh.me`
      }
    });

    assert.equal(blockedPurchaseResponse.statusCode, 200);
    assert.equal(blockedPurchaseResponse.body.product.status, "OUT_OF_STOCK");
    assert.equal(blockedPurchaseResponse.body.product.stockQuantity, 0);
    assert.equal(blockedPurchaseResponse.body.availability.canAddToCart, false);
    assert.equal(blockedPurchaseResponse.body.availability.isInStock, false);
    assert.equal(blockedPurchaseResponse.body.availability.status, "OUT_OF_STOCK");
  });

  it("rejects unsupported image uploads and foreign-store image writes", async () => {
    const unsupportedMimeResponse = await requestJson<{
      code: string;
    }>({
      method: "POST",
      path: `/catalog/products/${productId}/images`,
      headers: {
        authorization: `Bearer ${primaryToken}`
      },
      body: {
        storeId: primaryStoreId,
        fileName: "manual.pdf",
        mimeType: "application/pdf",
        contentBase64: "JVBERi0xLjQK",
        altText: "Manual"
      }
    });

    assert.equal(unsupportedMimeResponse.statusCode, 400);
    assert.equal(unsupportedMimeResponse.body.code, "PRODUCT_IMAGE_MIME_UNSUPPORTED");

    const foreignStoreResponse = await requestJson<{
      code: string;
    }>({
      method: "POST",
      path: `/catalog/products/${productId}/images`,
      headers: {
        authorization: `Bearer ${secondaryToken}`
      },
      body: {
        storeId: secondaryStoreId,
        fileName: "foreign.png",
        mimeType: "image/png",
        contentBase64: "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8Xw8AAoMBgAGvJ9kAAAAASUVORK5CYII="
      }
    });

    assert.equal(foreignStoreResponse.statusCode, 404);
    assert.equal(foreignStoreResponse.body.code, "PRODUCT_NOT_FOUND");
  });

  it("rejects invalid compareAt price and foreign category access", async () => {
    const invalidPriceResponse = await requestJson<{
      message: string;
    }>({
      method: "PATCH",
      path: `/catalog/products/${productId}`,
      headers: {
        authorization: `Bearer ${primaryToken}`
      },
      body: {
        storeId: primaryStoreId,
        priceCents: 400000,
        compareAtCents: 300000
      }
    });

    assert.equal(invalidPriceResponse.statusCode, 400);
    assert.match(invalidPriceResponse.body.message, /compareAtCents/);

    const foreignCategoryResponse = await requestJson<{
      code: string;
    }>({
      method: "PATCH",
      path: `/catalog/products/${productId}`,
      headers: {
        authorization: `Bearer ${secondaryToken}`
      },
      body: {
        storeId: secondaryStoreId,
        categoryId
      }
    });

    assert.equal(foreignCategoryResponse.statusCode, 404);
    assert.equal(foreignCategoryResponse.body.code, "PRODUCT_NOT_FOUND");
  });

  it("publishes with stock and falls back to OUT_OF_STOCK when stock reaches zero", async () => {
    const publishResponse = await requestJson<{
      product: { status: string };
    }>({
      method: "POST",
      path: `/catalog/${primaryStoreId}/products/${productId}/publish`,
      headers: {
        authorization: `Bearer ${primaryToken}`
      }
    });

    assert.equal(publishResponse.statusCode, 201);
    assert.equal(publishResponse.body.product.status, "ACTIVE");

    const updateStockResponse = await requestJson<{
      product: { status: string; stockQuantity: number };
    }>({
      method: "PATCH",
      path: `/catalog/products/${productId}`,
      headers: {
        authorization: `Bearer ${primaryToken}`
      },
      body: {
        storeId: primaryStoreId,
        stockQuantity: 0,
        status: "ACTIVE"
      }
    });

    assert.equal(updateStockResponse.statusCode, 200);
    assert.equal(updateStockResponse.body.product.status, "OUT_OF_STOCK");
  });

  it("deactivates and archives the product for the correct store only", async () => {
    const deactivateResponse = await requestJson<{
      product: { status: string };
    }>({
      method: "POST",
      path: `/catalog/${primaryStoreId}/products/${productId}/deactivate`,
      headers: {
        authorization: `Bearer ${primaryToken}`
      }
    });

    assert.equal(deactivateResponse.statusCode, 201);
    assert.equal(deactivateResponse.body.product.status, "INACTIVE");

    const archiveResponse = await requestJson<{
      product: { status: string };
    }>({
      method: "POST",
      path: `/catalog/${primaryStoreId}/products/${productId}/archive`,
      headers: {
        authorization: `Bearer ${primaryToken}`
      }
    });

    assert.equal(archiveResponse.statusCode, 201);
    assert.equal(archiveResponse.body.product.status, "ARCHIVED");
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
