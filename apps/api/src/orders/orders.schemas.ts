import { BadRequestException } from "@nestjs/common";
import { OrderStatus } from "@prisma/client";
import { z, ZodError } from "zod";
import { OPERATIONAL_ORDER_STATUSES } from "./order-status.rules";

export const listManagedOrdersQuerySchema = z.object({
  status: z.nativeEnum(OrderStatus).optional()
});

export const updateManagedOrderStatusSchema = z.object({
  storeId: z.string().trim().min(1),
  status: z.enum(OPERATIONAL_ORDER_STATUSES),
  reason: z.string().trim().min(2).max(240).optional(),
  carrierName: z.string().trim().min(2).max(120).nullable().optional(),
  serviceName: z.string().trim().min(2).max(120).nullable().optional(),
  trackingCode: z.string().trim().min(2).max(120).nullable().optional(),
  trackingUrl: z.string().trim().url().nullable().optional(),
  labelUrl: z.string().trim().url().nullable().optional(),
  notes: z.string().trim().max(500).nullable().optional()
});

export type ListManagedOrdersQuery = z.infer<typeof listManagedOrdersQuerySchema>;
export type UpdateManagedOrderStatusInput = z.infer<typeof updateManagedOrderStatusSchema>;

export function parseOrdersBody<T>(schema: z.ZodSchema<T>, input: unknown): T {
  return parseOrdersInput(schema, input);
}

export function parseOrdersQuery<T>(schema: z.ZodSchema<T>, input: unknown): T {
  return parseOrdersInput(schema, input);
}

function parseOrdersInput<T>(schema: z.ZodSchema<T>, input: unknown): T {
  try {
    return schema.parse(input);
  } catch (error) {
    if (error instanceof ZodError) {
      throw new BadRequestException({
        message: "Invalid request payload",
        issues: error.issues.map((issue) => ({
          path: issue.path.join("."),
          message: issue.message
        }))
      });
    }

    throw error;
  }
}
