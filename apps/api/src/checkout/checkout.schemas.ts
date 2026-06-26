import { BadRequestException } from "@nestjs/common";
import { z, ZodError } from "zod";

export const createOrderFromCartSchema = z.object({
  sessionId: z.string().trim().min(6).max(120).optional(),
  customerEmail: z.email().trim().max(320),
  customerFullName: z.string().trim().min(2).max(160),
  customerPhoneNumber: z.string().trim().min(8).max(40).optional(),
  shippingRecipientName: z.string().trim().min(2).max(160),
  shippingPhoneNumber: z.string().trim().min(8).max(40).optional(),
  shippingPostalCode: z.string().trim().min(5).max(20),
  shippingState: z.string().trim().min(2).max(80),
  shippingCity: z.string().trim().min(2).max(120),
  shippingDistrict: z.string().trim().min(2).max(120),
  shippingStreet: z.string().trim().min(2).max(160),
  shippingNumber: z.string().trim().min(1).max(40),
  shippingComplement: z.string().trim().max(160).optional(),
  billingRecipientName: z.string().trim().min(2).max(160).optional(),
  billingPhoneNumber: z.string().trim().min(8).max(40).optional(),
  billingPostalCode: z.string().trim().min(5).max(20).optional(),
  billingState: z.string().trim().min(2).max(80).optional(),
  billingCity: z.string().trim().min(2).max(120).optional(),
  billingDistrict: z.string().trim().min(2).max(120).optional(),
  billingStreet: z.string().trim().min(2).max(160).optional(),
  billingNumber: z.string().trim().min(1).max(40).optional(),
  billingComplement: z.string().trim().max(160).optional(),
  shippingCents: z.number().int().min(0).default(0),
  discountCents: z.number().int().min(0).default(0),
  notes: z.string().trim().max(500).optional()
});

export type CreateOrderFromCartInput = z.infer<typeof createOrderFromCartSchema>;

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
