import { BadRequestException } from "@nestjs/common";
import { z, ZodError } from "zod";

const passwordPolicyMessage =
  "Password must be at least 8 characters and include upper, lower and numeric characters";

export const registerSchema = z.object({
  email: z.string().email(),
  password: z
    .string()
    .min(8, passwordPolicyMessage)
    .regex(/[a-z]/, passwordPolicyMessage)
    .regex(/[A-Z]/, passwordPolicyMessage)
    .regex(/[0-9]/, passwordPolicyMessage),
  fullName: z.string().trim().min(2).max(120).optional()
});

export const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1)
});

export const refreshSchema = z.object({
  refreshToken: z.string().min(1)
});

export type RegisterInput = z.infer<typeof registerSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
export type RefreshInput = z.infer<typeof refreshSchema>;

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
