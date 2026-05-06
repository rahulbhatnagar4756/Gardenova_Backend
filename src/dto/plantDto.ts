import { z } from "zod";

// Sub-schema for locations (PostgreSQL: plant_locations)
const locationItemSchema = z
  .object({
    location_type: z.string().min(1, "Location type is required"),
    location_value: z.string().min(1, "Location value is required"),
  })
  .strict();
// MAIN DTO
export const createPlantDto = z
  .object({
    scientific_name: z.string().min(1, "Scientific name is required").trim(),
    common_name: z.string().min(1, "Common name is required").trim(),
    image_search_url: z.string().optional(),
    description: z.string().optional(),
    native: z.boolean().optional(),
    light: z.string().optional(),
    water_needs: z.string().optional(),
    maintenance_level: z.string().optional(),
    growth_form: z.string().optional(),

    space_types: z.array(z.string().min(1)).optional(),
    area_sizes: z.array(z.string().min(1)).optional(),
    challenges: z.array(z.string().min(1)).optional(),
    tech_preferences: z.array(z.string().min(1)).optional(),
    care_notes: z.array(z.string().min(1)).optional(),

    locations: z.array(locationItemSchema).optional(),

    is_deleted: z.boolean().optional().default(false),
  })
  .strict();

export type CreatePlantDto = z.infer<typeof createPlantDto>;

export const updatePlantDto = z
  .object({
    scientific_name: z.string().min(1).optional(),
    common_name: z.string().min(1).optional(),
    image_search_url: z.string().optional(),
    description: z.string().optional(),
    native: z.boolean().optional(),
    light: z.string().optional(),
    water_needs: z.string().optional(),
    maintenance_level: z.string().optional(),
    growth_form: z.string().optional(),

    space_types: z.array(z.string().min(1)).optional(),
    area_sizes: z.array(z.string().min(1)).optional(),
    challenges: z.array(z.string().min(1)).optional(),
    tech_preferences: z.array(z.string().min(1)).optional(),
    care_notes: z.array(z.string().min(1)).optional(),

    locations: z.array(locationItemSchema).optional(),

    is_deleted: z.boolean().optional(),
  })
  .strict();

export type UpdatePlantDto = z.infer<typeof updatePlantDto>;
