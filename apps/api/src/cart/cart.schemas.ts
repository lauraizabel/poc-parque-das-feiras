import { BadRequestException } from "@nestjs/common";
import { z, ZodError } from "zod";

const cartIdentitySchema = z
  .object({
    sessionId: z.string().trim().min(6).max(120).optional(),
    customerEmail: z.email().trim().max(320).optional()
  })
  .refine((value) => Boolean(value.sessionId || value.customerEmail), {
    message: "sessionId or customerEmail is required",
    path: ["sessionId"]
  });

export const resolveCartSchema = cartIdentitySchema;

export const addCartItemSchema = cartIdentitySchema.extend({
  productId: z.string().trim().min(1),
  variantId: z.string().trim().min(1).optional(),
  quantity: z.number().int().min(1).max(100)
});

export const updateCartItemSchema = cartIdentitySchema.extend({
  quantity: z.number().int().min(1).max(100)
});

export const clearCartSchema = cartIdentitySchema;

export type ResolveCartInput = z.infer<typeof resolveCartSchema>;
export type AddCartItemInput = z.infer<typeof addCartItemSchema>;
export type UpdateCartItemInput = z.infer<typeof updateCartItemSchema>;
export type ClearCartInput = z.infer<typeof clearCartSchema>;

export function parseCartBody<T>(schema: z.ZodSchema<T>, input: unknown): T {
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
