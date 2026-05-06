import Joi, { ObjectSchema } from "joi";

const base64ImageRegex = /^data:image\/(jpeg|jpg|png|webp|gif);base64,/;
const MAX_IMAGE_SIZE_MB = 5;

export const updateProfessionalProfileValidation: ObjectSchema = Joi.object({
  name: Joi.string().min(2).max(100).optional().messages({
    "string.base": "Name must be a string",
    "string.empty": "Name must not be empty",
    "string.min": "Name must be at least 2 characters",
    "string.max": "Name must not exceed 100 characters",
  }),

  email: Joi.string()
    .email({ tlds: { allow: false } })
    .max(150)
    .optional()
    .messages({
      "string.base": "Email must be a string",
      "string.empty": "Email must not be empty",
      "string.email": "Must be a valid email address",
      "string.max": "Email must not exceed 150 characters",
    }),

  profileImage: Joi.string()
    .pattern(base64ImageRegex)
    .custom((value, helpers) => {
      const base64Data = value.split(",")[1] || "";
      const approximateSizeInMB = (base64Data.length * 0.75) / (1024 * 1024);
      if (approximateSizeInMB > MAX_IMAGE_SIZE_MB) {
        return helpers.error("image.size");
      }
      return value;
    })
    .optional()
    .messages({
      "string.base": "Profile image must be a string",
      "string.empty": "Profile image must not be empty",
      "string.pattern.base": "Profile image must be a valid base64 string (jpeg, jpg, png, webp, or gif)",
      "image.size": `Profile image must not exceed ${MAX_IMAGE_SIZE_MB}MB`,
    }),

  description: Joi.string().min(1).max(1000).optional().messages({
    "string.base": "Description must be a string",
    "string.empty": "Description must not be empty",
    "string.min": "Description must be at least 1 character",
    "string.max": "Description must not exceed 1000 characters",
  }),

  category: Joi.string().min(1).max(100).optional().messages({
    "string.base": "Category must be a string",
    "string.empty": "Category must not be empty",
    "string.min": "Category must be at least 1 character",
    "string.max": "Category must not exceed 100 characters",
  }),

  region: Joi.string().min(1).max(100).optional().messages({
    "string.base": "Region must be a string",
    "string.empty": "Region must not be empty",
    "string.min": "Region must be at least 1 character",
    "string.max": "Region must not exceed 100 characters",
  }),
})
  .min(1)
  .strict()
  .messages({
    "object.min": "At least one field must be provided for update",
    "object.unknown": "Additional properties are not allowed",
  });