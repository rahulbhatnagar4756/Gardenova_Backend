// src/dto/userProfileDto.ts
import { z } from "zod";

// Helper: string field that allows null or empty string
const stringOptional = z
  .union([z.string(), z.null()])
  .optional()
  .transform((val) => (val === "" ? null : val));

// Main UserProfile schema (PostgreSQL)
export const createUserProfileDto = z
  .object({
    userId: z.string().optional(),
    profileImage: stringOptional,
    dateOfBirth: z
      .union([z.string(), z.date(), z.null()])
      .optional()
      .transform((val) => (val === "" ? null : val)),
    gender: z.enum(["male", "female", "other", ""]).optional().nullable(),
    bio: stringOptional.refine(
      (val) => !val || val.length <= 500,
      "Bio cannot exceed 500 characters"
    ),
    street: stringOptional,
    city: stringOptional,
    state: stringOptional,
    country: stringOptional,
    zipCode: stringOptional,
    occupation: stringOptional,
    company: stringOptional,
  })
  .strict(); // Prevents extra fields

// For TypeScript typing
export type UserProfile = z.infer<typeof createUserProfileDto>;
