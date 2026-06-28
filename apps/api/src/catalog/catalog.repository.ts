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

  findProductsByIds(storeId: string, productIds: string[]) {
    return prisma.product.findMany({
      where: {
        storeId,
        id: {
          in: productIds
        }
      },
      include: {
        category: true
      }
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

  findPublicProductBySlug(storeId: string, slug: string) {
    return prisma.product.findUnique({
      where: {
        storeId_slug: {
          storeId,
          slug
        }
      },
      include: {
        category: true,
        images: {
          orderBy: [
            { isPrimary: "desc" },
            { sortOrder: "asc" },
            { createdAt: "asc" }
          ]
        }
      }
    });
  }

  listProductsByStore(storeId: string) {
    return prisma.product.findMany({
      where: { storeId },
      include: {
        category: true,
        images: {
          orderBy: [
            { isPrimary: "desc" },
            { sortOrder: "asc" },
            { createdAt: "asc" }
          ]
        }
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

  countProductImages(productId: string) {
    return prisma.productImage.count({
      where: { productId }
    });
  }

  findProductImageById(imageId: string) {
    return prisma.productImage.findUnique({
      where: { id: imageId },
      include: {
        asset: true
      }
    });
  }

  listProductImages(productId: string) {
    return prisma.productImage.findMany({
      where: { productId },
      include: {
        asset: true
      },
      orderBy: [
        { isPrimary: "desc" },
        { sortOrder: "asc" },
        { createdAt: "asc" }
      ]
    });
  }

  createProductImage(input: {
    productId: string;
    storeId: string;
    bucket: string;
    key: string;
    mimeType: string;
    sizeBytes: number;
    publicUrl: string;
    imageUrl: string;
    altText?: string | null;
    sortOrder: number;
    isPrimary: boolean;
  }) {
    return prisma.$transaction(async (tx) => {
      if (input.isPrimary) {
        await tx.productImage.updateMany({
          where: {
            productId: input.productId
          },
          data: {
            isPrimary: false
          }
        });
      }

      const asset = await tx.asset.create({
        data: {
          storeId: input.storeId,
          key: input.key,
          bucket: input.bucket,
          mimeType: input.mimeType,
          sizeBytes: input.sizeBytes,
          publicUrl: input.publicUrl
        }
      });

      return tx.productImage.create({
        data: {
          productId: input.productId,
          assetId: asset.id,
          altText: input.altText ?? null,
          imageUrl: input.imageUrl,
          sortOrder: input.sortOrder,
          isPrimary: input.isPrimary
        },
        include: {
          asset: true
        }
      });
    });
  }

  updateProductImage(input: {
    imageId: string;
    productId: string;
    altText?: string | null;
    sortOrder?: number;
    isPrimary?: boolean;
  }) {
    return prisma.$transaction(async (tx) => {
      if (input.isPrimary) {
        await tx.productImage.updateMany({
          where: {
            productId: input.productId,
            NOT: {
              id: input.imageId
            }
          },
          data: {
            isPrimary: false
          }
        });
      }

      return tx.productImage.update({
        where: { id: input.imageId },
        data: {
          altText: input.altText,
          sortOrder: input.sortOrder,
          isPrimary: input.isPrimary
        },
        include: {
          asset: true
        }
      });
    });
  }

  deleteProductImage(imageId: string) {
    return prisma.$transaction(async (tx) => {
      const existingImage = await tx.productImage.findUnique({
        where: { id: imageId },
        include: {
          asset: true
        }
      });

      if (!existingImage) {
        return null;
      }

      await tx.productImage.delete({
        where: { id: imageId }
      });

      if (existingImage.assetId) {
        await tx.asset.delete({
          where: { id: existingImage.assetId }
        });
      }

      if (existingImage.isPrimary) {
        const fallbackPrimary = await tx.productImage.findFirst({
          where: { productId: existingImage.productId },
          orderBy: [
            { sortOrder: "asc" },
            { createdAt: "asc" }
          ]
        });

        if (fallbackPrimary) {
          await tx.productImage.update({
            where: { id: fallbackPrimary.id },
            data: {
              isPrimary: true
            }
          });
        }
      }

      return existingImage;
    });
  }
}
