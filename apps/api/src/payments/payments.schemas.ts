import { BadRequestException } from "@nestjs/common";
import { z, ZodError } from "zod";

export const createOrderPaymentIntentSchema = z.object({
  sessionId: z.string().trim().min(6).max(120).optional(),
  customerEmail: z.email().trim().max(320)
});

export type CreateOrderPaymentIntentInput = z.infer<typeof createOrderPaymentIntentSchema>;

export function parsePaymentsBody<T>(schema: z.ZodSchema<T>, input: unknown): T {
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
