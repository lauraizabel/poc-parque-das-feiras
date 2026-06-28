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

  it("lets merchants review and revise draft product pricing, stock and content before publishing", async () => {
    const draftResponse = await requestJson<{
      product: {
        id: string;
        status: string;
        description: string | null;
        priceCents: number;
        stockQuantity: number;
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
        name: "Camera Compacta",
        slug: "camera-compacta",
        description: "  Primeira versão do anúncio  ",
        priceCents: 249900,
        stockQuantity: 2,
        status: "DRAFT"
      }
    });

    assert.equal(draftResponse.statusCode, 201);
    assert.equal(draftResponse.body.product.status, "DRAFT");

    const draftProductId = draftResponse.body.product.id;

    const imageResponse = await requestJson<{
      image: {
        id: string;
        isPrimary: boolean;
      };
    }>({
      method: "POST",
      path: `/catalog/products/${draftProductId}/images`,
      headers: {
        authorization: `Bearer ${primaryToken}`
      },
      body: {
        storeId: primaryStoreId,
        fileName: "camera-compacta-primary.png",
        mimeType: "image/png",
        contentBase64: "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8Xw8AAoMBgAGvJ9kAAAAASUVORK5CYII=",
        altText: "Camera frontal",
        isPrimary: true
      }
    });

    assert.equal(imageResponse.statusCode, 201);
    assert.equal(imageResponse.body.image.isPrimary, true);

    const reviewResponse = await requestJson<{
      product: {
        id: string;
        name: string;
        description: string | null;
        priceCents: number;
        compareAtCents: number | null;
        stockQuantity: number;
        status: string;
        isFeatured: boolean;
      };
    }>({
      method: "PATCH",
      path: `/catalog/products/${draftProductId}`,
      headers: {
        authorization: `Bearer ${primaryToken}`
      },
      body: {
        storeId: primaryStoreId,
        name: "Camera Compacta 4K",
        description: "  Revisada com lente grande angular e bateria extra  ",
        priceCents: 279900,
        compareAtCents: 319900,
        stockQuantity: 7,
        isFeatured: true
      }
    });

    assert.equal(reviewResponse.statusCode, 200);
    assert.equal(reviewResponse.body.product.name, "Camera Compacta 4K");
    assert.equal(
      reviewResponse.body.product.description,
      "Revisada com lente grande angular e bateria extra"
    );
    assert.equal(reviewResponse.body.product.priceCents, 279900);
    assert.equal(reviewResponse.body.product.compareAtCents, 319900);
    assert.equal(reviewResponse.body.product.stockQuantity, 7);
    assert.equal(reviewResponse.body.product.status, "DRAFT");
    assert.equal(reviewResponse.body.product.isFeatured, true);

    const storeProductsResponse = await requestJson<{
      products: Array<{
        id: string;
        name: string;
        description: string | null;
        priceCents: number;
        compareAtCents: number | null;
        stockQuantity: number;
        images: Array<{ id: string; altText: string | null; isPrimary: boolean }>;
      }>;
    }>({
      method: "GET",
      path: `/catalog/${primaryStoreId}/products`,
      headers: {
        authorization: `Bearer ${primaryToken}`
      }
    });

    assert.equal(storeProductsResponse.statusCode, 200);

    const reviewedDraft = storeProductsResponse.body.products.find(
      (product) => product.id === draftProductId
    );

    assert.ok(reviewedDraft);
    assert.equal(reviewedDraft?.name, "Camera Compacta 4K");
    assert.equal(
      reviewedDraft?.description,
      "Revisada com lente grande angular e bateria extra"
    );
    assert.equal(reviewedDraft?.priceCents, 279900);
    assert.equal(reviewedDraft?.compareAtCents, 319900);
    assert.equal(reviewedDraft?.stockQuantity, 7);
    assert.equal(reviewedDraft?.images.length, 1);
    assert.equal(reviewedDraft?.images[0]?.altText, "Camera frontal");
    assert.equal(reviewedDraft?.images[0]?.isPrimary, true);
  });

  it("publishes a reviewed draft as ACTIVE and exposes it on the storefront", async () => {
    const draftResponse = await requestJson<{
      product: {
        id: string;
        status: string;
        slug: string;
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
        name: "Monitor UltraWide",
        slug: "monitor-ultrawide",
        description: "Monitor para edição e produtividade",
        priceCents: 329900,
        stockQuantity: 6,
        status: "DRAFT"
      }
    });

    assert.equal(draftResponse.statusCode, 201);
    assert.equal(draftResponse.body.product.status, "DRAFT");

    const reviewedProductId = draftResponse.body.product.id;

    const reviewResponse = await requestJson<{
      product: {
        status: string;
        priceCents: number;
        stockQuantity: number;
        description: string | null;
      };
    }>({
      method: "PATCH",
      path: `/catalog/products/${reviewedProductId}`,
      headers: {
        authorization: `Bearer ${primaryToken}`
      },
      body: {
        storeId: primaryStoreId,
        description: "Monitor para edição, design e produtividade",
        priceCents: 339900,
        compareAtCents: 369900,
        stockQuantity: 9
      }
    });

    assert.equal(reviewResponse.statusCode, 200);
    assert.equal(reviewResponse.body.product.status, "DRAFT");
    assert.equal(reviewResponse.body.product.priceCents, 339900);
    assert.equal(reviewResponse.body.product.stockQuantity, 9);

    const publishResponse = await requestJson<{
      product: { id: string; slug: string; status: string };
    }>({
      method: "POST",
      path: `/catalog/${primaryStoreId}/products/${reviewedProductId}/publish`,
      headers: {
        authorization: `Bearer ${primaryToken}`
      }
    });

    assert.equal(publishResponse.statusCode, 201);
    assert.equal(publishResponse.body.product.id, reviewedProductId);
    assert.equal(publishResponse.body.product.slug, "monitor-ultrawide");
    assert.equal(publishResponse.body.product.status, "ACTIVE");

    const publicDetailResponse = await requestJson<{
      product: { id: string; slug: string; status: string };
      availability: { canAddToCart: boolean; isInStock: boolean };
    }>({
      path: "/catalog/public/products/monitor-ultrawide",
      headers: {
        host: `${primaryStoreSlug}.lvh.me`
      }
    });

    assert.equal(publicDetailResponse.statusCode, 200);
    assert.equal(publicDetailResponse.body.product.id, reviewedProductId);
    assert.equal(publicDetailResponse.body.product.slug, "monitor-ultrawide");
    assert.equal(publicDetailResponse.body.product.status, "ACTIVE");
    assert.equal(publicDetailResponse.body.availability.canAddToCart, true);
    assert.equal(publicDetailResponse.body.availability.isInStock, true);

    const publicListResponse = await requestJson<{
      products: Array<{ id: string; slug: string }>;
    }>({
      path: "/catalog/public/products?category=eletronicos&page=1&pageSize=24",
      headers: {
        host: `${primaryStoreSlug}.lvh.me`
      }
    });

    assert.equal(publicListResponse.statusCode, 200);
    assert.ok(
      publicListResponse.body.products.some(
        (product) => product.id === reviewedProductId && product.slug === "monitor-ultrawide"
      )
    );
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

  it("lists product images and removes the primary image while promoting the next one", async () => {
    const firstImageResponse = await requestJson<{
      image: {
        id: string;
        isPrimary: boolean;
        imageUrl: string;
      };
    }>({
      method: "POST",
      path: `/catalog/products/${productId}/images`,
      headers: {
        authorization: `Bearer ${primaryToken}`
      },
      body: {
        storeId: primaryStoreId,
        fileName: "notebook-gallery-cover.png",
        mimeType: "image/png",
        contentBase64: "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8Xw8AAoMBgAGvJ9kAAAAASUVORK5CYII=",
        altText: "Capa do notebook",
        isPrimary: true,
        sortOrder: 0
      }
    });

    const secondImageResponse = await requestJson<{
      image: {
        id: string;
        isPrimary: boolean;
        altText: string | null;
      };
    }>({
      method: "POST",
      path: `/catalog/products/${productId}/images`,
      headers: {
        authorization: `Bearer ${primaryToken}`
      },
      body: {
        storeId: primaryStoreId,
        fileName: "notebook-gallery-side.png",
        mimeType: "image/png",
        contentBase64: "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8Xw8AAoMBgAGvJ9kAAAAASUVORK5CYII=",
        altText: "Lateral do notebook",
        isPrimary: false,
        sortOrder: 1
      }
    });

    const imageListResponse = await requestJson<{
      images: Array<{
        id: string;
        isPrimary: boolean;
        altText: string | null;
        asset: { id: string; mimeType: string } | null;
      }>;
    }>({
      path: `/catalog/${primaryStoreId}/products/${productId}/images`,
      headers: {
        authorization: `Bearer ${primaryToken}`
      }
    });

    assert.equal(imageListResponse.statusCode, 200);
    assert.equal(imageListResponse.body.images.length, 2);
    assert.equal(imageListResponse.body.images[0]?.id, firstImageResponse.body.image.id);
    assert.equal(imageListResponse.body.images[0]?.isPrimary, true);
    assert.equal(imageListResponse.body.images[1]?.id, secondImageResponse.body.image.id);
    assert.equal(imageListResponse.body.images[1]?.asset?.mimeType, "image/png");

    const removalResponse = await requestJson<{
      removed: boolean;
      image: {
        id: string;
        isPrimary: boolean;
        asset: { id: string } | null;
      } | null;
    }>({
      method: "DELETE",
      path: `/catalog/${primaryStoreId}/products/${productId}/images/${firstImageResponse.body.image.id}`,
      headers: {
        authorization: `Bearer ${primaryToken}`
      }
    });

    assert.equal(removalResponse.statusCode, 200);
    assert.equal(removalResponse.body.removed, true);
    assert.equal(removalResponse.body.image?.id, firstImageResponse.body.image.id);
    assert.equal(removalResponse.body.image?.isPrimary, true);

    const imageListAfterRemoval = await requestJson<{
      images: Array<{
        id: string;
        isPrimary: boolean;
        altText: string | null;
      }>;
    }>({
      path: `/catalog/${primaryStoreId}/products/${productId}/images`,
      headers: {
        authorization: `Bearer ${primaryToken}`
      }
    });

    assert.equal(imageListAfterRemoval.statusCode, 200);
    assert.equal(imageListAfterRemoval.body.images.length, 1);
    assert.equal(imageListAfterRemoval.body.images[0]?.id, secondImageResponse.body.image.id);
    assert.equal(imageListAfterRemoval.body.images[0]?.isPrimary, true);
    assert.equal(imageListAfterRemoval.body.images[0]?.altText, "Lateral do notebook");

    const deletedImage = await prisma.productImage.findUnique({
      where: { id: firstImageResponse.body.image.id }
    });

    const deletedAsset = await prisma.asset.findUnique({
      where: { id: removalResponse.body.image?.asset?.id ?? "" }
    });

    assert.equal(deletedImage, null);
    assert.equal(deletedAsset, null);
  });

  it("updates image ordering and primary selection so the storefront reflects the chosen cover", async () => {
    const coverImageResponse = await requestJson<{
      image: {
        id: string;
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
        fileName: "notebook-order-cover.png",
        mimeType: "image/png",
        contentBase64: "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8Xw8AAoMBgAGvJ9kAAAAASUVORK5CYII=",
        altText: "Capa original",
        isPrimary: true,
        sortOrder: 0
      }
    });

    const detailImageResponse = await requestJson<{
      image: {
        id: string;
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
        fileName: "notebook-order-detail.png",
        mimeType: "image/png",
        contentBase64: "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8Xw8AAoMBgAGvJ9kAAAAASUVORK5CYII=",
        altText: "Detalhe lateral",
        isPrimary: false,
        sortOrder: 5
      }
    });

    const reprioritizedImageResponse = await requestJson<{
      image: {
        id: string;
        isPrimary: boolean;
        sortOrder: number;
        altText: string | null;
      };
    }>({
      method: "PATCH",
      path: `/catalog/${primaryStoreId}/products/${productId}/images/${detailImageResponse.body.image.id}`,
      headers: {
        authorization: `Bearer ${primaryToken}`
      },
      body: {
        storeId: primaryStoreId,
        altText: "Nova capa lateral",
        isPrimary: true,
        sortOrder: 0
      }
    });

    assert.equal(reprioritizedImageResponse.statusCode, 200);
    assert.equal(reprioritizedImageResponse.body.image.id, detailImageResponse.body.image.id);
    assert.equal(reprioritizedImageResponse.body.image.isPrimary, true);
    assert.equal(reprioritizedImageResponse.body.image.sortOrder, 0);
    assert.equal(reprioritizedImageResponse.body.image.altText, "Nova capa lateral");

    const demotedImageResponse = await requestJson<{
      image: {
        id: string;
        isPrimary: boolean;
        sortOrder: number;
      };
    }>({
      method: "PATCH",
      path: `/catalog/${primaryStoreId}/products/${productId}/images/${coverImageResponse.body.image.id}`,
      headers: {
        authorization: `Bearer ${primaryToken}`
      },
      body: {
        storeId: primaryStoreId,
        isPrimary: false,
        sortOrder: 3
      }
    });

    assert.equal(demotedImageResponse.statusCode, 200);
    assert.equal(demotedImageResponse.body.image.isPrimary, false);
    assert.equal(demotedImageResponse.body.image.sortOrder, 3);

    const orderedImagesResponse = await requestJson<{
      images: Array<{
        id: string;
        isPrimary: boolean;
        sortOrder: number;
        altText: string | null;
      }>;
    }>({
      path: `/catalog/${primaryStoreId}/products/${productId}/images`,
      headers: {
        authorization: `Bearer ${primaryToken}`
      }
    });

    assert.equal(orderedImagesResponse.statusCode, 200);
    assert.deepEqual(
      orderedImagesResponse.body.images.map((image) => ({
        id: image.id,
        isPrimary: image.isPrimary,
        sortOrder: image.sortOrder
      })),
      [
        {
          id: detailImageResponse.body.image.id,
          isPrimary: true,
          sortOrder: 0
        },
        {
          id: coverImageResponse.body.image.id,
          isPrimary: false,
          sortOrder: 3
        }
      ]
    );

    const storefrontProductResponse = await requestJson<{
      product: {
        images: Array<{
          imageUrl: string;
          altText: string | null;
          isPrimary: boolean;
          sortOrder: number;
        }>;
      };
    }>({
      path: `/catalog/public/products/notebook-pro`,
      headers: {
        host: `${primaryStoreSlug}.lvh.me`
      }
    });

    assert.equal(storefrontProductResponse.statusCode, 200);
    assert.equal(storefrontProductResponse.body.product.images[0]?.altText, "Nova capa lateral");
    assert.equal(storefrontProductResponse.body.product.images[0]?.isPrimary, true);
    assert.equal(storefrontProductResponse.body.product.images[0]?.sortOrder, 0);
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

    const oversizedContentBase64 = Buffer.alloc(5 * 1024 * 1024 + 1, 7).toString("base64");
    const oversizedImageResponse = await requestJson<{
      code: string;
      sizeBytes: number;
    }>({
      method: "POST",
      path: `/catalog/products/${productId}/images`,
      headers: {
        authorization: `Bearer ${primaryToken}`
      },
      body: {
        storeId: primaryStoreId,
        fileName: "huge-image.png",
        mimeType: "image/png",
        contentBase64: oversizedContentBase64
      }
    });

    assert.equal(oversizedImageResponse.statusCode, 400);
    assert.equal(oversizedImageResponse.body.code, "PRODUCT_IMAGE_TOO_LARGE");
    assert.ok((oversizedImageResponse.body.sizeBytes ?? 0) > 5 * 1024 * 1024);

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

    const foreignUpdateResponse = await requestJson<{
      code: string;
    }>({
      method: "PATCH",
      path: `/catalog/${secondaryStoreId}/products/${productId}/images/non-existent-image`,
      headers: {
        authorization: `Bearer ${secondaryToken}`
      },
      body: {
        storeId: secondaryStoreId,
        isPrimary: true,
        sortOrder: 0
      }
    });

    assert.equal(foreignUpdateResponse.statusCode, 404);
    assert.equal(foreignUpdateResponse.body.code, "PRODUCT_NOT_FOUND");

    const foreignRemovalResponse = await requestJson<{
      code: string;
    }>({
      method: "DELETE",
      path: `/catalog/${secondaryStoreId}/products/${productId}/images/non-existent-image`,
      headers: {
        authorization: `Bearer ${secondaryToken}`
      }
    });

    assert.equal(foreignRemovalResponse.statusCode, 404);
    assert.equal(foreignRemovalResponse.body.code, "PRODUCT_NOT_FOUND");
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
