import Joi, { ObjectSchema } from "joi";

export const externalLinkCreateValidation: ObjectSchema = Joi.object({
  title: Joi.string()
    .min(2)
    .max(100)
    .required()
    .messages({
      "string.empty": "Title is required",
      "string.min": "Title must be at least 2 characters",
      "string.max": "Title must not exceed 100 characters",
      "any.required": "Title is required",
    }),

  url: Joi.string()
    .uri()
    .allow(null, "")
    .optional()
    .messages({
      "string.uri": "URL must be a valid URL",
    }),

  is_active: Joi.boolean()
    .optional()
    .messages({
      "boolean.base": "Active flag must be true or false",
    }),
});


export const externalLinkUpdateValidation: ObjectSchema = Joi.object({
  id: Joi.string()
    .uuid()
    .required()
    .messages({
      "string.guid": "Invalid external link id",
      "any.required": "External link id is required",
    }),

  title: Joi.string()
    .valid("Website", "Store", "Courses")
    .optional()
    .messages({
      "any.only": "Title must be one of [Website, Store, courses]",
    }),

  url: Joi.string()
    .uri()
    .allow(null, "")
    .optional()
    .messages({
      "string.uri": "URL must be a valid URL",
    }),

  is_active: Joi.boolean()
    .optional()
    .messages({
      "boolean.base": "Active flag must be true or false",
    }),
});
