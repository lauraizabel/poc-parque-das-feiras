import { z } from "zod";

export const saveBaselinkerConfigSchema = z.object({
  apiToken: z.string().trim().min(1),
  inventoryId: z.number().int().positive().optional(),
  enabled: z.boolean().optional().default(true),
  statusMappings: z.record(z.string(), z.number().int()).optional()
});

export type SaveBaselinkerConfigInput = z.infer<typeof saveBaselinkerConfigSchema>;

export const generateLabelSchema = z.object({
  courierCode: z.string().trim().min(1),
  extraFields: z.record(z.string(), z.string()).optional()
});

export type GenerateLabelInput = z.infer<typeof generateLabelSchema>;
