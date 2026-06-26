import { BadRequestException, ConflictException, Injectable, NotFoundException } from "@nestjs/common";
import { CategoryStatus } from "@prisma/client";
import { CatalogRepository } from "./catalog.repository";
import { CreateCategoryInput, UpdateCategoryInput } from "./catalog.schemas";

const RESERVED_CATEGORY_SLUGS = new Set(["all", "new", "sale", "search"]);

@Injectable()
export class CatalogService {
  constructor(private readonly catalogRepository: CatalogRepository) {}

  getBoundary() {
    return this.catalogRepository.getBoundary();
  }

  async listStoreCategories(storeId: string) {
    return {
      categories: await this.catalogRepository.listCategoriesByStore(storeId)
    };
  }

  async createCategory(input: CreateCategoryInput) {
    const slug = this.normalizeSlug(input.slug);
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
      slug = this.normalizeSlug(input.slug);
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

  private normalizeSlug(value: string) {
    const normalized = value
      .trim()
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "");

    if (normalized.length < 2) {
      throw new BadRequestException("Category slug must contain at least 2 alphanumeric characters");
    }

    return normalized;
  }

  private assertAllowedSlug(slug: string) {
    if (RESERVED_CATEGORY_SLUGS.has(slug)) {
      throw new BadRequestException("Category slug is reserved");
    }
  }
}
