import { BadRequestException } from "@nestjs/common";
import { ShipmentStatus, ShippingMethodStatus, ShippingMethodType } from "@prisma/client";
import { z, ZodError } from "zod";

export const createShippingMethodSchema = z.object({
  storeId: z.string().trim().min(1),
  name: z.string().trim().min(2).max(120),
  description: z.string().trim().max(500).optional(),
  type: z.nativeEnum(ShippingMethodType).default(ShippingMethodType.FIXED_PRICE),
  status: z.nativeEnum(ShippingMethodStatus).optional(),
  priceCents: z.number().int().min(0).default(0),
  estimatedDaysMin: z.number().int().min(0).max(365).nullable().optional(),
  estimatedDaysMax: z.number().int().min(0).max(365).nullable().optional(),
  minimumOrderCents: z.number().int().min(0).nullable().optional(),
  maximumOrderCents: z.number().int().min(0).nullable().optional(),
  sortOrder: z.number().int().min(0).max(10_000).optional(),
  isDefault: z.boolean().optional()
});

export const updateShippingMethodSchema = z.object({
  storeId: z.string().trim().min(1),
  name: z.string().trim().min(2).max(120).optional(),
  description: z.string().trim().max(500).nullable().optional(),
  type: z.nativeEnum(ShippingMethodType).optional(),
  status: z.nativeEnum(ShippingMethodStatus).optional(),
  priceCents: z.number().int().min(0).optional(),
  estimatedDaysMin: z.number().int().min(0).max(365).nullable().optional(),
  estimatedDaysMax: z.number().int().min(0).max(365).nullable().optional(),
  minimumOrderCents: z.number().int().min(0).nullable().optional(),
  maximumOrderCents: z.number().int().min(0).nullable().optional(),
  sortOrder: z.number().int().min(0).max(10_000).optional(),
  isDefault: z.boolean().optional()
});

export const createShipmentSchema = z.object({
  orderId: z.string().trim().min(1),
  storeId: z.string().trim().min(1),
  shippingMethodId: z.string().trim().min(1).nullable().optional(),
  status: z.nativeEnum(ShipmentStatus).optional(),
  shippingMethodName: z.string().trim().min(2).max(120),
  carrierName: z.string().trim().min(2).max(120).nullable().optional(),
  serviceName: z.string().trim().min(2).max(120).nullable().optional(),
  trackingCode: z.string().trim().min(2).max(120).nullable().optional(),
  trackingUrl: z.string().trim().url().nullable().optional(),
  labelUrl: z.string().trim().url().nullable().optional(),
  priceCents: z.number().int().min(0).default(0),
  estimatedDaysMin: z.number().int().min(0).max(365).nullable().optional(),
  estimatedDaysMax: z.number().int().min(0).max(365).nullable().optional(),
  notes: z.string().trim().max(500).nullable().optional()
});

export type CreateShippingMethodInput = z.infer<typeof createShippingMethodSchema>;
export type UpdateShippingMethodInput = z.infer<typeof updateShippingMethodSchema>;
export type CreateShipmentInput = z.infer<typeof createShipmentSchema>;

export function parseShippingBody<T>(schema: z.ZodSchema<T>, input: unknown): T {
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
