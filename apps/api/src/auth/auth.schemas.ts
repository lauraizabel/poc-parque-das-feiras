import { BadRequestException } from "@nestjs/common";
import { sanitizedEmail, sanitizedString } from "../platform/validation";
import { z, ZodError } from "zod";

const passwordPolicyMessage =
  "Password must be at least 8 characters and include upper, lower and numeric characters";

export const registerSchema = z.object({
  email: sanitizedEmail(),
  password: z
    .string()
    .min(8, passwordPolicyMessage)
    .regex(/[a-z]/, passwordPolicyMessage)
    .regex(/[A-Z]/, passwordPolicyMessage)
    .regex(/[0-9]/, passwordPolicyMessage),
  fullName: sanitizedString({ min: 2, max: 120 }).optional()
}).strict();

export const loginSchema = z.object({
  email: sanitizedEmail(),
  password: z.string().min(1)
}).strict();

export const refreshSchema = z.object({
  refreshToken: z.string().min(1)
}).strict();

export const registerMerchantSchema = z.object({
  email: sanitizedEmail(),
  password: z
    .string()
    .min(8, passwordPolicyMessage)
    .regex(/[a-z]/, passwordPolicyMessage)
    .regex(/[A-Z]/, passwordPolicyMessage)
    .regex(/[0-9]/, passwordPolicyMessage),
  fullName: sanitizedString({ min: 2, max: 120 }),
  storeName: sanitizedString({ min: 2, max: 120 }),
  storeSlug: sanitizedString({ min: 2, max: 60 }),
  supportEmail: sanitizedEmail().optional(),
  currencyCode: sanitizedString({ min: 3, max: 3 }).optional(),
  locale: sanitizedString({ min: 2, max: 10 }).optional()
}).strict();

export type RegisterInput = z.infer<typeof registerSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
export type RefreshInput = z.infer<typeof refreshSchema>;
export type RegisterMerchantInput = z.infer<typeof registerMerchantSchema>;

export function parseBody<T>(schema: z.ZodSchema<T>, input: unknown): T {
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
