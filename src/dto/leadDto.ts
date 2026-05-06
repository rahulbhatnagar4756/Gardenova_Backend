import { z } from "zod";

// DTO - strict validation for PostgreSQL
export const createLeadDto = z
  .object({
    partnerIds: z
      .array(z.string().uuid({ message: "Invalid UUID format" }))
      .min(1, "At least one partner profile ID is required"),
    userId: z.string().uuid({ message: "Invalid UUID format" }),
    leadsStatus: z
      .enum(["new", "converted", "closed"])
      .optional()
      .default("new"),
    isDeleted: z.boolean().optional().default(false),
  })
  .strict();

export type CreateLeadDto = z.infer<typeof createLeadDto>;
