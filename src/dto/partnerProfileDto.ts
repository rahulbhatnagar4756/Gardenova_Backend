// src/dto/partnerProfileDto.ts
import { z } from "zod";

export const createPartnerProfileDto = z
  .object({
    email: z.string().email({ message: "Invalid email format" }),
    mobileNumber: z
      .string()
      .regex(/^\+?[1-9]\d{7,14}$/, "Invalid mobile number"),

    companyName: z.string().optional(),

    speciality1: z.string().optional(),
    speciality2: z.string().optional(),
    speciality3: z.string().optional(),

    street: z.string().optional(),
    city: z.string().optional(),
    state: z.string().optional(),
    country: z.string().optional(),
    zipCode: z.string().optional(),

    website: z.string().url().optional(),
    contactPerson: z.string().optional(),
    projectImageUrl: z.string().optional(),

    status: z.enum(["active", "inactive", "pending", "suspended"]).optional(),
    rating: z.number().min(0).max(5).optional(),
  })
  .strict();

export type PartnerProfile = z.infer<typeof createPartnerProfileDto>;
