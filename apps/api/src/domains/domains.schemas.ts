import { BadRequestException } from "@nestjs/common";
import { z, ZodError } from "zod";

export const createStoreDomainSchema = z.object({
  storeId: z.string().trim().min(1),
  host: z.string().trim().min(1).max(255)
});

export type CreateStoreDomainInput = z.infer<typeof createStoreDomainSchema>;

export function parseDomainBody<T>(schema: z.ZodSchema<T>, input: unknown): T {
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
