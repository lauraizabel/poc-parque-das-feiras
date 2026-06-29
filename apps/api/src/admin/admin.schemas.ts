import { BadRequestException } from "@nestjs/common";
import {
  DomainStatus,
  OrderStatus,
  PlatformRole,
  StoreMemberRole,
  StoreStatus
} from "@prisma/client";
import {
  sanitizedEmail,
  sanitizedOptionalString,
  sanitizedString
} from "../platform/validation";
import { z, ZodError } from "zod";

const limitSchema = z.coerce.number().int().min(1).max(50).default(20);
const dateFilterSchema = z.coerce.date().optional();

export const listAdminStoresQuerySchema = z.object({
  search: sanitizedOptionalString({ min: 1, max: 120 }),
  status: z.nativeEnum(StoreStatus).optional(),
  createdFrom: dateFilterSchema,
  createdTo: dateFilterSchema,
  hasActiveDomain: z.coerce.boolean().optional(),
  limit: limitSchema
}).strict();

export const listAdminUsersQuerySchema = z.object({
  search: sanitizedOptionalString({ min: 1, max: 120 }),
  platformRole: z.nativeEnum(PlatformRole).optional(),
  storeId: sanitizedOptionalString({ min: 1, max: 100 }),
  membershipRole: z.nativeEnum(StoreMemberRole).optional(),
  limit: limitSchema
}).strict();

export const listAdminOrdersQuerySchema = z.object({
  storeId: sanitizedOptionalString({ min: 1, max: 100 }),
  customerEmail: sanitizedEmail().optional(),
  status: z.nativeEnum(OrderStatus).optional(),
  limit: limitSchema
}).strict();

export const listAdminDomainsQuerySchema = z.object({
  search: sanitizedOptionalString({ min: 1, max: 255 }),
  storeId: sanitizedOptionalString({ min: 1, max: 100 }),
  status: z.nativeEnum(DomainStatus).optional(),
  limit: limitSchema
}).strict();

export const updateAdminStoreStatusSchema = z.object({
  status: z.nativeEnum(StoreStatus)
}).strict();

export type ListAdminStoresQuery = z.infer<typeof listAdminStoresQuerySchema>;
export type ListAdminUsersQuery = z.infer<typeof listAdminUsersQuerySchema>;
export type ListAdminOrdersQuery = z.infer<typeof listAdminOrdersQuerySchema>;
export type ListAdminDomainsQuery = z.infer<typeof listAdminDomainsQuerySchema>;
export type UpdateAdminStoreStatusInput = z.infer<typeof updateAdminStoreStatusSchema>;

export function parseAdminQuery<T>(schema: z.ZodSchema<T>, input: unknown): T {
  try {
    return schema.parse(input);
  } catch (error) {
    if (error instanceof ZodError) {
      throw new BadRequestException({
        message: "Invalid request query",
        issues: error.issues.map((issue) => ({
          path: issue.path.join("."),
          message: issue.message
        }))
      });
    }

    throw error;
  }
}

export const adminEntitySearchSchema = sanitizedString({ min: 1, max: 255 });

export function parseAdminBody<T>(schema: z.ZodSchema<T>, input: unknown): T {
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
