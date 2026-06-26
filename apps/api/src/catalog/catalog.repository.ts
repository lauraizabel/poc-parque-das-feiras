import { Injectable } from "@nestjs/common";
import { CategoryStatus, ProductStatus } from "@prisma/client";
import { prisma } from "@acme/database";
import { DomainBoundary } from "../platform/domain-boundary";

@Injectable()
export class CatalogRepository {
  getBoundary(): DomainBoundary {
    return {
      module: "catalog",
      description: "Products, categories, inventory-facing metadata and media references.",
      responsibilities: ["products", "categories", "pricing snapshots", "catalog media links"],
      dependsOn: ["database", "stores"]
    };
  }

  findCategoryById(categoryId: string) {
    return prisma.category.findUnique({
      where: { id: categoryId }
    });
  }

  findCategoryBySlug(storeId: string, slug: string) {
    return prisma.category.findUnique({
      where: {
        storeId_slug: {
          storeId,
          slug
        }
      }
    });
  }

  listCategoriesByStore(storeId: string) {
    return prisma.category.findMany({
      where: { storeId },
      orderBy: [
        { sortOrder: "asc" },
        { createdAt: "asc" }
      ]
    });
  }

  findPublicStoreById(storeId: string) {
    return prisma.store.findUnique({
      where: { id: storeId },
      select: {
        id: true,
        name: true,
        slug: true,
        currencyCode: true,
        locale: true
      }
    });
  }

  listPublicCategoriesByStore(storeId: string) {
    return prisma.category.findMany({
      where: {
        storeId,
        status: CategoryStatus.ACTIVE
      },
      orderBy: [
        { sortOrder: "asc" },
        { createdAt: "asc" }
      ]
    });
  }

  createCategory(input: {
    storeId: string;
    name: string;
    slug: string;
    description?: string;
    sortOrder?: number;
  }) {
    return prisma.category.create({
      data: {
        storeId: input.storeId,
        name: input.name,
        slug: input.slug,
        description: input.description,
        sortOrder: input.sortOrder ?? 0,
        status: CategoryStatus.ACTIVE
      }
    });
  }

  updateCategory(
    categoryId: string,
    input: {
      name?: string;
      slug?: string;
      description?: string | null;
      status?: CategoryStatus;
      sortOrder?: number;
    }
  ) {
    return prisma.category.update({
      where: { id: categoryId },
      data: input
    });
  }

  findProductById(productId: string) {
    return prisma.product.findUnique({
      where: { id: productId }
    });
  }

  findProductBySlug(storeId: string, slug: string) {
    return prisma.product.findUnique({
      where: {
        storeId_slug: {
          storeId,
          slug
        }
      }
    });
  }

  findProductBySku(storeId: string, sku: string) {
    return prisma.product.findUnique({
      where: {
        storeId_sku: {
          storeId,
          sku
        }
      }
    });
  }

  countPublicProductsByStore(storeId: string, categoryId?: string) {
    return prisma.product.count({
      where: {
        storeId,
        categoryId,
        status: ProductStatus.ACTIVE,
        stockQuantity: {
          gt: 0
        }
      }
    });
  }

  listPublicProductsByStore(input: {
    storeId: string;
    categoryId?: string;
    skip?: number;
    take?: number;
    featuredFirst?: boolean;
  }) {
    return prisma.product.findMany({
      where: {
        storeId: input.storeId,
        categoryId: input.categoryId,
        status: ProductStatus.ACTIVE,
        stockQuantity: {
          gt: 0
        }
      },
      include: {
        category: true,
        images: {
          orderBy: [
            { isPrimary: "desc" },
            { sortOrder: "asc" },
            { createdAt: "asc" }
          ],
          take: 1
        }
      },
      orderBy: input.featuredFirst
        ? [{ isFeatured: "desc" }, { createdAt: "desc" }]
        : [{ createdAt: "desc" }],
      skip: input.skip ?? 0,
      take: input.take
    });
  }

  listProductsByStore(storeId: string) {
    return prisma.product.findMany({
      where: { storeId },
      include: {
        category: true
      },
      orderBy: [
        { createdAt: "desc" }
      ]
    });
  }

  createProduct(input: {
    storeId: string;
    categoryId?: string;
    name: string;
    slug: string;
    description?: string;
    sku?: string;
    priceCents: number;
    compareAtCents?: number | null;
    currencyCode?: string;
    stockQuantity: number;
    status: ProductStatus;
    isFeatured?: boolean;
  }) {
    return prisma.product.create({
      data: {
        storeId: input.storeId,
        categoryId: input.categoryId,
        name: input.name,
        slug: input.slug,
        description: input.description,
        sku: input.sku,
        priceCents: input.priceCents,
        compareAtCents: input.compareAtCents,
        currencyCode: input.currencyCode ?? "BRL",
        stockQuantity: input.stockQuantity,
        status: input.status,
        isFeatured: input.isFeatured ?? false
      }
    });
  }

  updateProduct(
    productId: string,
    input: {
      categoryId?: string | null;
      name?: string;
      slug?: string;
      description?: string | null;
      sku?: string | null;
      priceCents?: number;
      compareAtCents?: number | null;
      currencyCode?: string;
      stockQuantity?: number;
      status?: ProductStatus;
      isFeatured?: boolean;
    }
  ) {
    return prisma.product.update({
      where: { id: productId },
      data: input
    });
  }
}
