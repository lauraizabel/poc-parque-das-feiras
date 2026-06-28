import { BadRequestException } from "@nestjs/common";
import { StoreMemberRole } from "@prisma/client";
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

const manageableRoleSchema = z.enum([
  StoreMemberRole.STORE_MANAGER,
  StoreMemberRole.STORE_SUPPORT
]);

export const inviteStoreMemberSchema = z.object({
  email: z.string().trim().email(),
  role: manageableRoleSchema
}).strict();

export const updateStoreMemberRoleSchema = z.object({
  role: manageableRoleSchema
}).strict();

const hexColorSchema = z
  .string()
  .trim()
  .regex(/^#([0-9a-fA-F]{6})$/, "Use uma cor hexadecimal no formato #RRGGBB");

const optionalUrlSchema = z
  .string()
  .trim()
  .url()
  .max(500)
  .optional()
  .or(z.literal("").transform(() => undefined));

export const updateStoreThemeSchema = z.object({
  primaryColor: hexColorSchema,
  accentColor: hexColorSchema,
  surfaceColor: hexColorSchema,
  logoUrl: optionalUrlSchema,
  bannerUrl: optionalUrlSchema,
  heroTitle: z.string().trim().max(120).optional(),
  heroSubtitle: z.string().trim().max(280).optional(),
  announcementText: z.string().trim().max(180).optional()
}).strict();

export type CreateStoreInput = z.infer<typeof createStoreSchema>;
export type StoreSlugAvailabilityInput = z.infer<typeof storeSlugAvailabilitySchema>;
export type InviteStoreMemberInput = z.infer<typeof inviteStoreMemberSchema>;
export type UpdateStoreMemberRoleInput = z.infer<typeof updateStoreMemberRoleSchema>;
export type UpdateStoreThemeInput = z.infer<typeof updateStoreThemeSchema>;

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
