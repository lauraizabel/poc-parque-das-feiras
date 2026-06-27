import { BadRequestException } from "@nestjs/common";
import { sanitizedEmail, sanitizedOptionalString } from "../platform/validation";
import { z, ZodError } from "zod";

export const createOrderPaymentIntentSchema = z.object({
  sessionId: sanitizedOptionalString({ min: 6, max: 120 }),
  customerEmail: sanitizedEmail()
}).strict();

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
