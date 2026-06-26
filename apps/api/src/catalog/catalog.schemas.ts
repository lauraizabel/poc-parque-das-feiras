import { BadRequestException } from "@nestjs/common";
import { CategoryStatus } from "@prisma/client";
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

export type CreateCategoryInput = z.infer<typeof createCategorySchema>;
export type UpdateCategoryInput = z.infer<typeof updateCategorySchema>;

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
