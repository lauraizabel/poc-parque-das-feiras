import { BadRequestException } from "@nestjs/common";
import {
  sanitizedNullableOptionalString,
  sanitizedOptionalString,
  sanitizedString
} from "../platform/validation";
import { CategoryStatus, ProductStatus } from "@prisma/client";
import { z, ZodError } from "zod";

export const createCategorySchema = z.object({
  storeId: sanitizedString({ min: 1, max: 100 }),
  name: sanitizedString({ min: 2, max: 120 }),
  slug: sanitizedString({ min: 2, max: 80 }),
  description: sanitizedOptionalString({ max: 500, preserveNewlines: true }),
  sortOrder: z.number().int().min(0).max(10_000).optional()
}).strict();

export const updateCategorySchema = z.object({
  storeId: sanitizedString({ min: 1, max: 100 }),
  name: sanitizedOptionalString({ min: 2, max: 120 }),
  slug: sanitizedOptionalString({ min: 2, max: 80 }),
  description: sanitizedNullableOptionalString({ max: 500, preserveNewlines: true }),
  status: z.nativeEnum(CategoryStatus).optional(),
  sortOrder: z.number().int().min(0).max(10_000).optional()
}).strict();

export const createProductSchema = z.object({
  storeId: sanitizedString({ min: 1, max: 100 }),
  categoryId: sanitizedOptionalString({ min: 1, max: 100 }),
  name: sanitizedString({ min: 2, max: 160 }),
  slug: sanitizedString({ min: 2, max: 120 }),
  description: sanitizedOptionalString({ max: 4_000, preserveNewlines: true }),
  sku: sanitizedOptionalString({ min: 2, max: 80 }),
  priceCents: z.number().int().min(0),
  compareAtCents: z.number().int().min(0).nullable().optional(),
  currencyCode: sanitizedOptionalString({ min: 3, max: 3 }),
  stockQuantity: z.number().int().min(0),
  status: z.nativeEnum(ProductStatus).optional(),
  isFeatured: z.boolean().optional()
}).strict();

export const updateProductSchema = z.object({
  storeId: sanitizedString({ min: 1, max: 100 }),
  categoryId: sanitizedString({ min: 1, max: 100 }).nullable().optional(),
  name: sanitizedOptionalString({ min: 2, max: 160 }),
  slug: sanitizedOptionalString({ min: 2, max: 120 }),
  description: sanitizedNullableOptionalString({ max: 4_000, preserveNewlines: true }),
  sku: sanitizedNullableOptionalString({ min: 2, max: 80 }),
  priceCents: z.number().int().min(0).optional(),
  compareAtCents: z.number().int().min(0).nullable().optional(),
  currencyCode: sanitizedOptionalString({ min: 3, max: 3 }),
  stockQuantity: z.number().int().min(0).optional(),
  status: z.nativeEnum(ProductStatus).optional(),
  isFeatured: z.boolean().optional()
}).strict();

export const publicCatalogProductsQuerySchema = z.object({
  category: sanitizedOptionalString({ min: 1, max: 80 }),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(24).default(12)
}).strict();

export type CreateCategoryInput = z.infer<typeof createCategorySchema>;
export type UpdateCategoryInput = z.infer<typeof updateCategorySchema>;
export type CreateProductInput = z.infer<typeof createProductSchema>;
export type UpdateProductInput = z.infer<typeof updateProductSchema>;
export type PublicCatalogProductsQuery = z.infer<typeof publicCatalogProductsQuerySchema>;

export function parseCatalogBody<T>(schema: z.ZodSchema<T>, input: unknown): T {
  return parseCatalogInput(schema, input, "body");
}

export function parseCatalogQuery<T>(schema: z.ZodSchema<T>, input: unknown): T {
  return parseCatalogInput(schema, input, "query");
}

function parseCatalogInput<T>(
  schema: z.ZodSchema<T>,
  input: unknown,
  source: "body" | "query"
) {
  try {
    return schema.parse(input);
  } catch (error) {
    if (error instanceof ZodError) {
      throw new BadRequestException({
        message: `Invalid request ${source}`,
        issues: error.issues.map((issue) => ({
          path: issue.path.join("."),
          message: issue.message
        }))
      });
    }

    throw error;
  }
}
