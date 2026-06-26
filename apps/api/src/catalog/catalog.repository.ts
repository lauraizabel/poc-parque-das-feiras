import { Injectable } from "@nestjs/common";
import { CategoryStatus } from "@prisma/client";
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
}
