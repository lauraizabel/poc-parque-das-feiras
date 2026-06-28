import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { CategoryStatus, ProductStatus } from "@prisma/client";
import { createHash } from "node:crypto";
import { PublicStorefrontContext } from "../auth/auth.types";
import { CatalogRepository } from "./catalog.repository";
import {
  CreateCategoryInput,
  CreateProductInput,
  PublicCatalogProductsQuery,
  UpdateCategoryInput,
  UpdateProductInput,
  UploadProductImageInput
} from "./catalog.schemas";

const RESERVED_CATEGORY_SLUGS = new Set(["all", "new", "sale", "search"]);
const RESERVED_PRODUCT_SLUGS = new Set(["cart", "checkout", "category", "new", "sale"]);

@Injectable()
export class CatalogService {
  constructor(
    private readonly catalogRepository: CatalogRepository,
    private readonly configService: ConfigService
  ) {}

  getBoundary() {
    return this.catalogRepository.getBoundary();
  }

  async getPublicHomepage(publicStore: PublicStorefrontContext) {
    const store = await this.getResolvedPublicStore(publicStore);
    const [categories, featuredProducts] = await Promise.all([
      this.catalogRepository.listPublicCategoriesByStore(publicStore.storeId),
      this.catalogRepository.listPublicProductsByStore({
        storeId: publicStore.storeId,
        take: 6,
        featuredFirst: true
      })
    ]);

    return {
      store,
      categories,
      products: featuredProducts
    };
  }

  async listPublicProducts(
    publicStore: PublicStorefrontContext,
    query: PublicCatalogProductsQuery
  ) {
    const store = await this.getResolvedPublicStore(publicStore);
    const categories = await this.catalogRepository.listPublicCategoriesByStore(publicStore.storeId);
    const requestedCategorySlug = query.category?.trim().toLowerCase() ?? null;
    const selectedCategory =
      categories.find((category) => category.slug === requestedCategorySlug) ?? null;

    if (requestedCategorySlug && !selectedCategory) {
      return {
        store,
        categories,
        selectedCategorySlug: requestedCategorySlug,
        products: [],
        pagination: {
          page: 1,
          pageSize: query.pageSize,
          totalItems: 0,
          totalPages: 0
        }
      };
    }

    const totalItems = await this.catalogRepository.countPublicProductsByStore(
      publicStore.storeId,
      selectedCategory?.id
    );
    const totalPages = totalItems > 0 ? Math.ceil(totalItems / query.pageSize) : 0;
    const page = totalPages > 0 ? Math.min(query.page, totalPages) : 1;
    const products = await this.catalogRepository.listPublicProductsByStore({
      storeId: publicStore.storeId,
      categoryId: selectedCategory?.id,
      skip: (page - 1) * query.pageSize,
      take: query.pageSize
    });

    return {
      store,
      categories,
      selectedCategorySlug: selectedCategory?.slug ?? null,
      products,
      pagination: {
        page,
        pageSize: query.pageSize,
        totalItems,
        totalPages
      }
    };
  }

  async getPublicProduct(publicStore: PublicStorefrontContext, productSlug: string) {
    const store = await this.getResolvedPublicStore(publicStore);
    const normalizedSlug = this.normalizeSlug(productSlug, "Product");
    const product = await this.catalogRepository.findPublicProductBySlug(
      publicStore.storeId,
      normalizedSlug
    );

    if (
      !product ||
      (product.status !== ProductStatus.ACTIVE && product.status !== ProductStatus.OUT_OF_STOCK)
    ) {
      throw new NotFoundException({
        message: "Product not found",
        code: "PUBLIC_PRODUCT_NOT_FOUND",
        productSlug: normalizedSlug
      });
    }

    return {
      store,
      product,
      availability: {
        canAddToCart: product.status === ProductStatus.ACTIVE && product.stockQuantity > 0,
        isInStock: product.stockQuantity > 0,
        status: product.status
      }
    };
  }

  async listStoreCategories(storeId: string) {
    return {
      categories: await this.catalogRepository.listCategoriesByStore(storeId)
    };
  }

  async createCategory(input: CreateCategoryInput) {
    const slug = this.normalizeSlug(input.slug, "Category");
    this.assertAllowedSlug(slug);

    const existingCategory = await this.catalogRepository.findCategoryBySlug(
      input.storeId,
      slug
    );

    if (existingCategory) {
      throw new ConflictException({
        message: "Category slug is already in use for this store",
        code: "CATEGORY_SLUG_ALREADY_IN_USE",
        slug
      });
    }

    return {
      category: await this.catalogRepository.createCategory({
        storeId: input.storeId,
        name: input.name.trim(),
        slug,
        description: input.description?.trim(),
        sortOrder: input.sortOrder
      })
    };
  }

  async updateCategory(categoryId: string, input: UpdateCategoryInput) {
    const category = await this.catalogRepository.findCategoryById(categoryId);

    if (!category || category.storeId !== input.storeId) {
      throw new NotFoundException({
        message: "Category not found",
        code: "CATEGORY_NOT_FOUND",
        categoryId
      });
    }

    let slug: string | undefined;

    if (input.slug) {
      slug = this.normalizeSlug(input.slug, "Category");
      this.assertAllowedSlug(slug);

      const existingCategory = await this.catalogRepository.findCategoryBySlug(
        input.storeId,
        slug
      );

      if (existingCategory && existingCategory.id !== categoryId) {
        throw new ConflictException({
          message: "Category slug is already in use for this store",
          code: "CATEGORY_SLUG_ALREADY_IN_USE",
          slug
        });
      }
    }

    return {
      category: await this.catalogRepository.updateCategory(categoryId, {
        name: input.name?.trim(),
        slug,
        description: input.description === undefined ? undefined : input.description?.trim() ?? null,
        status: input.status,
        sortOrder: input.sortOrder
      })
    };
  }

  async deactivateCategory(storeId: string, categoryId: string) {
    const category = await this.catalogRepository.findCategoryById(categoryId);

    if (!category || category.storeId !== storeId) {
      throw new NotFoundException({
        message: "Category not found",
        code: "CATEGORY_NOT_FOUND",
        categoryId
      });
    }

    return {
      category: await this.catalogRepository.updateCategory(categoryId, {
        status: CategoryStatus.INACTIVE
      })
    };
  }

  async listStoreProducts(storeId: string) {
    return {
      products: await this.catalogRepository.listProductsByStore(storeId)
    };
  }

  async createProduct(input: CreateProductInput) {
    await this.assertCategoryBelongsToStore(input.storeId, input.categoryId);

    const slug = this.normalizeSlug(input.slug, "Product");
    this.assertAllowedProductSlug(slug);

    const existingSlug = await this.catalogRepository.findProductBySlug(input.storeId, slug);
    if (existingSlug) {
      throw new ConflictException({
        message: "Product slug is already in use for this store",
        code: "PRODUCT_SLUG_ALREADY_IN_USE",
        slug
      });
    }

    const normalizedSku = this.normalizeSku(input.sku);
    if (normalizedSku) {
      const existingSku = await this.catalogRepository.findProductBySku(
        input.storeId,
        normalizedSku
      );
      if (existingSku) {
        throw new ConflictException({
          message: "Product SKU is already in use for this store",
          code: "PRODUCT_SKU_ALREADY_IN_USE",
          sku: normalizedSku
        });
      }
    }

    const compareAtCents = this.validateCompareAtPrice(
      input.priceCents,
      input.compareAtCents ?? null
    );
    const status = this.normalizeProductStatus(
      input.status ?? ProductStatus.DRAFT,
      input.stockQuantity
    );

    return {
      product: await this.catalogRepository.createProduct({
        storeId: input.storeId,
        categoryId: input.categoryId,
        name: input.name.trim(),
        slug,
        description: input.description?.trim(),
        sku: normalizedSku,
        priceCents: input.priceCents,
        compareAtCents,
        currencyCode: input.currencyCode?.toUpperCase() ?? "BRL",
        stockQuantity: input.stockQuantity,
        status,
        isFeatured: input.isFeatured
      })
    };
  }

  async updateProduct(productId: string, input: UpdateProductInput) {
    const product = await this.catalogRepository.findProductById(productId);

    if (!product || product.storeId !== input.storeId) {
      throw new NotFoundException({
        message: "Product not found",
        code: "PRODUCT_NOT_FOUND",
        productId
      });
    }

    await this.assertCategoryBelongsToStore(input.storeId, input.categoryId);

    let slug: string | undefined;
    if (input.slug) {
      slug = this.normalizeSlug(input.slug, "Product");
      this.assertAllowedProductSlug(slug);
      const existingSlug = await this.catalogRepository.findProductBySlug(input.storeId, slug);
      if (existingSlug && existingSlug.id !== productId) {
        throw new ConflictException({
          message: "Product slug is already in use for this store",
          code: "PRODUCT_SLUG_ALREADY_IN_USE",
          slug
        });
      }
    }

    let sku: string | null | undefined;
    if (input.sku !== undefined) {
      sku = this.normalizeSku(input.sku ?? undefined) ?? null;
      if (sku) {
        const existingSku = await this.catalogRepository.findProductBySku(input.storeId, sku);
        if (existingSku && existingSku.id !== productId) {
          throw new ConflictException({
            message: "Product SKU is already in use for this store",
            code: "PRODUCT_SKU_ALREADY_IN_USE",
            sku
          });
        }
      }
    }

    const nextPrice = input.priceCents ?? product.priceCents;
    const nextCompareAt = input.compareAtCents === undefined
      ? product.compareAtCents
      : input.compareAtCents;
    const nextStock = input.stockQuantity ?? product.stockQuantity;
    const nextStatus = this.normalizeProductStatus(
      input.status ?? product.status,
      nextStock
    );

    return {
      product: await this.catalogRepository.updateProduct(productId, {
        categoryId: input.categoryId === undefined ? undefined : input.categoryId,
        name: input.name?.trim(),
        slug,
        description: input.description === undefined ? undefined : input.description?.trim() ?? null,
        sku,
        priceCents: input.priceCents,
        compareAtCents: this.validateCompareAtPrice(nextPrice, nextCompareAt),
        currencyCode: input.currencyCode?.toUpperCase(),
        stockQuantity: input.stockQuantity,
        status: nextStatus,
        isFeatured: input.isFeatured
      })
    };
  }

  async publishProduct(storeId: string, productId: string) {
    const product = await this.ensureStoreProduct(storeId, productId);
    const status =
      product.stockQuantity > 0 ? ProductStatus.ACTIVE : ProductStatus.OUT_OF_STOCK;

    return {
      product: await this.catalogRepository.updateProduct(productId, {
        status
      })
    };
  }

  async deactivateProduct(storeId: string, productId: string) {
    await this.ensureStoreProduct(storeId, productId);

    return {
      product: await this.catalogRepository.updateProduct(productId, {
        status: ProductStatus.INACTIVE
      })
    };
  }

  async archiveProduct(storeId: string, productId: string) {
    await this.ensureStoreProduct(storeId, productId);

    return {
      product: await this.catalogRepository.updateProduct(productId, {
        status: ProductStatus.ARCHIVED
      })
    };
  }

  async uploadProductImage(productId: string, input: UploadProductImageInput) {
    const product = await this.ensureStoreProduct(input.storeId, productId);
    const mimeType = input.mimeType.trim().toLowerCase();
    this.assertSupportedImageMimeType(mimeType);

    const normalizedBase64 = input.contentBase64.replace(/\s+/g, "");
    const contentBuffer = Buffer.from(normalizedBase64, "base64");

    if (contentBuffer.length === 0) {
      throw new BadRequestException({
        message: "Image content is empty",
        code: "PRODUCT_IMAGE_CONTENT_REQUIRED"
      });
    }

    if (contentBuffer.length > 5 * 1024 * 1024) {
      throw new BadRequestException({
        message: "Image exceeds the maximum size of 5MB",
        code: "PRODUCT_IMAGE_TOO_LARGE",
        sizeBytes: contentBuffer.length
      });
    }

    const safeFileName = this.normalizeAssetFileName(input.fileName);
    const contentHash = createHash("sha1").update(contentBuffer).digest("hex").slice(0, 12);
    const extension = this.resolveImageExtension(mimeType);
    const bucket = this.configService.getOrThrow<string>("S3_BUCKET");
    const storageKey = `products/${product.storeId}/${product.id}/${Date.now()}-${contentHash}-${safeFileName}.${extension}`;
    const imageUrl = `data:${mimeType};base64,${normalizedBase64}`;
    const currentImageCount = await this.catalogRepository.countProductImages(product.id);
    const isPrimary = input.isPrimary ?? currentImageCount === 0;

    return {
      image: await this.catalogRepository.createProductImage({
        productId: product.id,
        storeId: product.storeId,
        bucket,
        key: storageKey,
        mimeType,
        sizeBytes: contentBuffer.length,
        publicUrl: imageUrl,
        imageUrl,
        altText: input.altText?.trim() ?? null,
        sortOrder: input.sortOrder ?? currentImageCount,
        isPrimary
      })
    };
  }

  async listProductImages(storeId: string, productId: string) {
    await this.ensureStoreProduct(storeId, productId);

    return {
      images: await this.catalogRepository.listProductImages(productId)
    };
  }

  async removeProductImage(storeId: string, productId: string, imageId: string) {
    await this.ensureStoreProduct(storeId, productId);

    const image = await this.catalogRepository.findProductImageById(imageId);

    if (!image || image.productId !== productId) {
      throw new NotFoundException({
        message: "Product image not found",
        code: "PRODUCT_IMAGE_NOT_FOUND",
        imageId
      });
    }

    const removedImage = await this.catalogRepository.deleteProductImage(imageId);

    return {
      removed: true,
      image: removedImage
    };
  }

  private normalizeSlug(value: string, entity: "Category" | "Product") {
    const normalized = value
      .trim()
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "");

    if (normalized.length < 2) {
      throw new BadRequestException(
        `${entity} slug must contain at least 2 alphanumeric characters`
      );
    }

    return normalized;
  }

  private assertAllowedSlug(slug: string) {
    if (RESERVED_CATEGORY_SLUGS.has(slug)) {
      throw new BadRequestException("Category slug is reserved");
    }
  }

  private assertAllowedProductSlug(slug: string) {
    if (RESERVED_PRODUCT_SLUGS.has(slug)) {
      throw new BadRequestException("Product slug is reserved");
    }
  }

  private normalizeSku(value: string | undefined) {
    if (!value) {
      return undefined;
    }

    const normalized = value.trim().toUpperCase();
    return normalized.length > 0 ? normalized : undefined;
  }

  private assertSupportedImageMimeType(mimeType: string) {
    const supportedMimeTypes = new Set([
      "image/jpeg",
      "image/png",
      "image/webp",
      "image/gif"
    ]);

    if (!supportedMimeTypes.has(mimeType)) {
      throw new BadRequestException({
        message: "Image MIME type is not supported",
        code: "PRODUCT_IMAGE_MIME_UNSUPPORTED",
        mimeType
      });
    }
  }

  private resolveImageExtension(mimeType: string) {
    if (mimeType === "image/jpeg") {
      return "jpg";
    }

    return mimeType.split("/")[1] ?? "bin";
  }

  private normalizeAssetFileName(fileName: string) {
    const normalized = fileName
      .trim()
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/\.[a-z0-9]+$/i, "")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "");

    return normalized.length > 0 ? normalized : "product-image";
  }

  private validateCompareAtPrice(priceCents: number, compareAtCents: number | null | undefined) {
    if (compareAtCents === null || compareAtCents === undefined) {
      return compareAtCents ?? null;
    }

    if (compareAtCents <= priceCents) {
      throw new BadRequestException(
        "compareAtCents must be greater than priceCents when provided"
      );
    }

    return compareAtCents;
  }

  private normalizeProductStatus(status: ProductStatus, stockQuantity: number) {
    if (status === ProductStatus.ACTIVE && stockQuantity <= 0) {
      return ProductStatus.OUT_OF_STOCK;
    }

    return status;
  }

  private async assertCategoryBelongsToStore(storeId: string, categoryId?: string | null) {
    if (!categoryId) {
      return;
    }

    const category = await this.catalogRepository.findCategoryById(categoryId);

    if (!category || category.storeId !== storeId) {
      throw new NotFoundException({
        message: "Category not found for this store",
        code: "CATEGORY_NOT_FOUND",
        categoryId
      });
    }
  }

  private async ensureStoreProduct(storeId: string, productId: string) {
    const product = await this.catalogRepository.findProductById(productId);

    if (!product || product.storeId !== storeId) {
      throw new NotFoundException({
        message: "Product not found",
        code: "PRODUCT_NOT_FOUND",
        productId
      });
    }

    return product;
  }

  private async getResolvedPublicStore(publicStore: PublicStorefrontContext) {
    const store = await this.catalogRepository.findPublicStoreById(publicStore.storeId);

    if (!store) {
      throw new NotFoundException({
        message: "Store not found",
        code: "STORE_NOT_FOUND",
        storeId: publicStore.storeId
      });
    }

    return {
      ...store,
      source: publicStore.source,
      matchedHost: publicStore.matchedHost
    };
  }
}
