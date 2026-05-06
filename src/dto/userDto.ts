import { z } from "zod";

/**
 * DTO for creating a user (email/password or Firebase OAuth)
 * Matches PostgreSQL schema
 */
export const createUserDto = z
  .object({
    name: z
      .string()
      .min(2, "Name must be at least 2 characters")
      .max(50, "Name must be at most 50 characters")
      .trim(),

    email: z
      .string()
      .email("Invalid email format")
      .max(255, "Email must be at most 255 characters")
      .toLowerCase()
      .trim(),

    password: z
      .string()
      .min(6, "Password must be at least 6 characters")
      .max(255, "Password must be at most 255 characters")
      .optional(),

    firebaseUid: z
      .string()
      .max(255, "Firebase UID must be at most 255 characters")
      .optional(),

    roleId: z.string().uuid("Role ID must be a valid UUID"),

    phoneNumber: z
      .string()
      .max(20, "Phone number must be at most 20 characters")
      .regex(
        /^[+]?[(]?[0-9]{1,4}[)]?[-\s./0-9]*$/,
        "Invalid phone number format"
      )
      .optional(),

    isEmailVerified: z.boolean().optional().default(false),

    profilePicture: z.string().url("Invalid profile picture URL").optional(),
  })
  .refine((data) => data.password || data.firebaseUid, {
    message: "Either password or firebaseUid must be provided",
    path: ["password"],
  });

/**
 * DTO for updating user information
 * All fields optional (for PATCH)
 */
export const updateUserDto = z.object({
  name: z.string().min(2).max(50).trim().optional(),
  email: z
    .string()
    .email("Invalid email")
    .max(255)
    .toLowerCase()
    .trim()
    .optional(),
  password: z.string().min(6).max(255).optional(),
  firebaseUid: z.string().max(255).optional(),
  phoneNumber: z
    .string()
    .max(20)
    .regex(/^[+]?[(]?[0-9]{1,4}[)]?[-\s./0-9]*$/, "Invalid phone number format")
    .optional(),
  profilePicture: z.string().url("Invalid profile picture URL").optional(),
  isEmailVerified: z.boolean().optional(),
  roleId: z.string().uuid().optional(),
});

/**
 * DTO for creating a Google OAuth user
 */
export const createGoogleUserDto = z.object({
  name: z.string().min(2).max(50).trim(),
  email: z.string().email("Invalid email").max(255).toLowerCase().trim(),
  firebaseUid: z.string().min(1, "Firebase UID is required").max(255),
  roleId: z.string().uuid("Role ID must be a valid UUID"),
  profilePicture: z.string().url("Invalid profile picture URL").optional(),
  isEmailVerified: z.boolean().default(true),
});

export type CreateUserDto = z.infer<typeof createUserDto>;
export type UpdateUserDto = z.infer<typeof updateUserDto>;
export type CreateGoogleUserDto = z.infer<typeof createGoogleUserDto>;
