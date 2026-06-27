import { BadRequestException } from "@nestjs/common";
import {
  sanitizedEmail,
  sanitizedOptionalString,
  sanitizedString
} from "../platform/validation";
import { z, ZodError } from "zod";

export const createOrderFromCartSchema = z.object({
  sessionId: sanitizedOptionalString({ min: 6, max: 120 }),
  customerEmail: sanitizedEmail(),
  customerFullName: sanitizedString({ min: 2, max: 160 }),
  customerPhoneNumber: sanitizedOptionalString({ min: 8, max: 40 }),
  shippingRecipientName: sanitizedString({ min: 2, max: 160 }),
  shippingPhoneNumber: sanitizedOptionalString({ min: 8, max: 40 }),
  shippingPostalCode: sanitizedString({ min: 5, max: 20 }),
  shippingState: sanitizedString({ min: 2, max: 80 }),
  shippingCity: sanitizedString({ min: 2, max: 120 }),
  shippingDistrict: sanitizedString({ min: 2, max: 120 }),
  shippingStreet: sanitizedString({ min: 2, max: 160 }),
  shippingNumber: sanitizedString({ min: 1, max: 40 }),
  shippingComplement: sanitizedOptionalString({ max: 160 }),
  billingRecipientName: sanitizedOptionalString({ min: 2, max: 160 }),
  billingPhoneNumber: sanitizedOptionalString({ min: 8, max: 40 }),
  billingPostalCode: sanitizedOptionalString({ min: 5, max: 20 }),
  billingState: sanitizedOptionalString({ min: 2, max: 80 }),
  billingCity: sanitizedOptionalString({ min: 2, max: 120 }),
  billingDistrict: sanitizedOptionalString({ min: 2, max: 120 }),
  billingStreet: sanitizedOptionalString({ min: 2, max: 160 }),
  billingNumber: sanitizedOptionalString({ min: 1, max: 40 }),
  billingComplement: sanitizedOptionalString({ max: 160 }),
  shippingMethodId: sanitizedString({ min: 1, max: 100 }),
  discountCents: z.number().int().min(0).default(0),
  notes: sanitizedOptionalString({ max: 500, preserveNewlines: true })
}).strict();

export const calculateShippingOptionsSchema = z.object({
  sessionId: sanitizedOptionalString({ min: 6, max: 120 }),
  customerEmail: sanitizedEmail(),
  shippingPostalCode: sanitizedString({ min: 5, max: 20 }),
  shippingState: sanitizedString({ min: 2, max: 80 }),
  shippingCity: sanitizedString({ min: 2, max: 120 }),
  shippingDistrict: sanitizedOptionalString({ min: 2, max: 120 })
}).strict();

export type CreateOrderFromCartInput = z.infer<typeof createOrderFromCartSchema>;
export type CalculateShippingOptionsInput = z.infer<typeof calculateShippingOptionsSchema>;

export function parseCheckoutBody<T>(schema: z.ZodSchema<T>, input: unknown): T {
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
