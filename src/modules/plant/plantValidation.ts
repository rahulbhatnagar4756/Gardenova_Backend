import Joi, { ObjectSchema } from "joi";

/**
 * Validation for a single location item
 */
const locationSchema = Joi.object({
  location_type: Joi.string().min(1).required().messages({
    "string.base": "location_type must be a string",
    "string.empty": "location_type is required",
    "any.required": "location_type is required",
  }),
  location_value: Joi.string().min(1).required().messages({
    "string.base": "location_value must be a string",
    "string.empty": "location_value is required",
    "any.required": "location_value is required",
  }),
})
  .strict()
  .messages({
    "object.unknown": "Unknown field in location object is not allowed",
  });

/**
 * CREATE VALIDATION
 */
export const plantValidation: ObjectSchema = Joi.object({
  scientific_name: Joi.string().min(1).required().messages({
    "any.required": "Scientific name is required",
  }),
  common_name: Joi.string().min(1).required().messages({
    "any.required": "Common name is required",
  }),
  image_search_url: Joi.string().allow("").optional(),
  description: Joi.string().optional(),
  native: Joi.boolean().optional(),
  light: Joi.string().optional(),
  water_needs: Joi.string().optional(),
  maintenance_level: Joi.string().optional(),
  growth_form: Joi.string().optional(),
  space_types: Joi.array().items(Joi.string().min(1)).optional(),
  area_sizes: Joi.array().items(Joi.string().min(1)).optional(),
  challenges: Joi.array().items(Joi.string().min(1)).optional(),
  tech_preferences: Joi.array().items(Joi.string().min(1)).optional(),
  care_notes: Joi.array().items(Joi.string().min(1)).optional(),
  locations: Joi.array().items(locationSchema).optional(),
  is_deleted: Joi.boolean().optional().default(false),
})
  .strict()
  .messages({
    "object.unknown": "Unknown field is not allowed in plant object",
  });

/**
 * UPDATE VALIDATION
 * All fields optional because user may send partial update
 */
export const updatePlantValidation: ObjectSchema = Joi.object({
  scientific_name: Joi.string().min(1).optional(),
  common_name: Joi.string().min(1).optional(),
  image_search_url: Joi.string().allow("").optional(),
  description: Joi.string().optional(),
  native: Joi.boolean().optional(),
  light: Joi.string().optional(),
  water_needs: Joi.string().optional(),
  maintenance_level: Joi.string().optional(),
  growth_form: Joi.string().optional(),
  space_types: Joi.array().items(Joi.string().min(1)).optional(),
  area_sizes: Joi.array().items(Joi.string().min(1)).optional(),
  challenges: Joi.array().items(Joi.string().min(1)).optional(),
  tech_preferences: Joi.array().items(Joi.string().min(1)).optional(),
  care_notes: Joi.array().items(Joi.string().min(1)).optional(),
  locations: Joi.array().items(locationSchema).optional(),
  is_deleted: Joi.boolean().optional(),
})
  .strict()
  .messages({
    "object.unknown": "Unknown field is not allowed during update",
  });

export const plantIdentifyValidation = Joi.object({
  images: Joi.array()
    .items(Joi.string().min(10).message("Invalid Base64 or URL"))
    .min(1)
    .required()
    .messages({
      "array.min": "At least one image is required",
      "any.required": "Images field is required",
    }),

  latitude: Joi.number().optional(),

  longitude: Joi.number().optional(),

  similar_images: Joi.boolean().default(true).optional(),
});
