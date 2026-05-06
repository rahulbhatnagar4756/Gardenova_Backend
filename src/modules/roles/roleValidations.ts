import Joi, { ObjectSchema } from "joi";

export const roleValidation: ObjectSchema = Joi.object({
  name: Joi.string().min(2).max(30).required().messages({
    "string.base": "Role name must be a string",
    "string.empty": "Role name is required",
    "string.min": "Role name must be at least 2 characters",
    "string.max": "Role name must not exceed 30 characters",
    "any.required": "Role name is required",
  }),

  description: Joi.string().allow(null, "").optional().messages({
    "string.base": "Description must be a string",
  }),
}).options({ stripUnknown: true });
