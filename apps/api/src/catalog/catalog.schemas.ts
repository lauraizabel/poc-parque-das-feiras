import { BadRequestException } from "@nestjs/common";
import { CategoryStatus, ProductStatus } from "@prisma/client";
import { z, ZodError } from "zod";

export const createCategorySchema = z.object({
  storeId: z.string().trim().min(1),
  name: z.string().trim().min(2).max(120),
  slug: z.string().trim().min(2).max(80),
  description: z.string().trim().max(500).optional(),
  sortOrder: z.number().int().min(0).max(10_000).optional()
});

export const updateCategorySchema = z.object({
  storeId: z.string().trim().min(1),
  name: z.string().trim().min(2).max(120).optional(),
  slug: z.string().trim().min(2).max(80).optional(),
  description: z.string().trim().max(500).nullable().optional(),
  status: z.nativeEnum(CategoryStatus).optional(),
  sortOrder: z.number().int().min(0).max(10_000).optional()
});

export const createProductSchema = z.object({
  storeId: z.string().trim().min(1),
  categoryId: z.string().trim().min(1).optional(),
  name: z.string().trim().min(2).max(160),
  slug: z.string().trim().min(2).max(120),
  description: z.string().trim().max(4_000).optional(),
  sku: z.string().trim().min(2).max(80).optional(),
  priceCents: z.number().int().min(0),
  compareAtCents: z.number().int().min(0).nullable().optional(),
  currencyCode: z.string().trim().length(3).optional(),
  stockQuantity: z.number().int().min(0),
  status: z.nativeEnum(ProductStatus).optional(),
  isFeatured: z.boolean().optional()
});

export const updateProductSchema = z.object({
  storeId: z.string().trim().min(1),
  categoryId: z.string().trim().min(1).nullable().optional(),
  name: z.string().trim().min(2).max(160).optional(),
  slug: z.string().trim().min(2).max(120).optional(),
  description: z.string().trim().max(4_000).nullable().optional(),
  sku: z.string().trim().min(2).max(80).nullable().optional(),
  priceCents: z.number().int().min(0).optional(),
  compareAtCents: z.number().int().min(0).nullable().optional(),
  currencyCode: z.string().trim().length(3).optional(),
  stockQuantity: z.number().int().min(0).optional(),
  status: z.nativeEnum(ProductStatus).optional(),
  isFeatured: z.boolean().optional()
});

export type CreateCategoryInput = z.infer<typeof createCategorySchema>;
export type UpdateCategoryInput = z.infer<typeof updateCategorySchema>;
export type CreateProductInput = z.infer<typeof createProductSchema>;
export type UpdateProductInput = z.infer<typeof updateProductSchema>;

export function parseCatalogBody<T>(schema: z.ZodSchema<T>, input: unknown): T {
  try {
    return schema.parse(input);
  } catch (error) {
    if (error instanceof ZodError) {
      throw new BadRequestException({
        message: "Invalid request body",
        issues: error.issues.map((issue) => ({
          path: issue.path.join("."),
          message: issue.message
        }))
      });
    }

    throw error;
  }
}
