import { z } from "zod";

// Role DTO - strict validation, matching PostgreSQL schema
export const createRoleDto = z
  .object({
    id: z.string().uuid().optional(), // PostgreSQL auto-generates UUID
    name: z
      .string()
      .min(2, "Name must be at least 2 characters")
      .max(30, "Name cannot exceed 30 characters"),
    description: z.string().nullable().optional(), // TEXT DEFAULT NULL
    created_at: z.string().datetime().optional(), // TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    updated_at: z.string().datetime().optional(), // TIMESTAMP DEFAULT CURRENT_TIMESTAMP
  })
  .strict(); // disallow unknown fields

// TypeScript type
export type CreateRoleDto = z.infer<typeof createRoleDto>;
