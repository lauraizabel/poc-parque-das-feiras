import { BadRequestException } from "@nestjs/common";
import { z, ZodError } from "zod";

export const createStoreSchema = z.object({
  name: z.string().trim().min(2).max(120),
  slug: z.string().trim().min(2).max(60),
  defaultSubdomain: z.string().trim().min(2).max(63).optional(),
  supportEmail: z.string().email().optional(),
  currencyCode: z.string().trim().length(3).optional(),
  locale: z.string().trim().min(2).max(10).optional()
});

export const storeSlugAvailabilitySchema = z.object({
  slug: z.string().trim().min(1).max(60)
});

export type CreateStoreInput = z.infer<typeof createStoreSchema>;
export type StoreSlugAvailabilityInput = z.infer<typeof storeSlugAvailabilitySchema>;

export function parseStoreBody<T>(schema: z.ZodSchema<T>, input: unknown): T {
  try {
    return schema.parse(input);
  } catch (error) {
    if (error instanceof ZodError) {
      throw new BadRequestException({
        message: "Invalid store request body",
        issues: error.issues.map((issue) => ({
          path: issue.path.join("."),
          message: issue.message
        }))
      });
    }

    throw error;
  }
}

export function parseStoreQuery<T>(schema: z.ZodSchema<T>, input: unknown): T {
  try {
    return schema.parse(input);
  } catch (error) {
    if (error instanceof ZodError) {
      throw new BadRequestException({
        message: "Invalid store request query",
        issues: error.issues.map((issue) => ({
          path: issue.path.join("."),
          message: issue.message
        }))
      });
    }

    throw error;
  }
}
