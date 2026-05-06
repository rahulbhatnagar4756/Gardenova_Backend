import Joi, { ObjectSchema } from "joi";

/**
 * Validation schema for creating/updating questions
 * Matches your Swagger `QuestionInput` and PostgreSQL structure
 */
export const questionValidation: ObjectSchema = Joi.object({
  question_text: Joi.string().min(5).max(255).required().messages({
    "string.empty": "Question text is required",
    "string.min": "Question text must be at least 5 characters long",
    "string.max": "Question text must not exceed 255 characters",
    "any.required": "Question text is required",
  }),

  order: Joi.number().integer().min(1).required().messages({
    "number.base": "Order must be a valid number",
    "number.min": "Order must be at least 1",
    "any.required": "Order is required",
  }),

  options: Joi.array()
    .items(
      Joi.string().min(1).max(255).required().messages({
        "string.base": "Each option must be a string",
        "string.empty": "Option text cannot be empty",
        "string.min": "Option text must be at least 1 character",
        "string.max": "Option text must not exceed 255 characters",
        "any.required": "Option text is required",
      })
    )
    .min(1)
    .required()
    .messages({
      "array.base": "Options must be an array of strings",
      "array.min": "At least 2 options are required",
      "any.required": "Options field is required",
    }),
});

export const questionCreateValidation: ObjectSchema = Joi.object({
  question_text: Joi.string().min(5).max(255).required(),

  order: Joi.number().integer().min(1).required(),

  options: Joi.array()
    .items(
      Joi.object({
        id: Joi.string().uuid().allow("", null).optional(),
        option_text: Joi.string().min(1).max(255).required(),
      })
    )
    .min(1)
    .required(),
});

export const questionUpdateValidation: ObjectSchema = Joi.object({
  question_text: Joi.string().min(5).max(255).required(),

  order: Joi.number().integer().min(1).required(),

  options: Joi.array()
    .items(
      Joi.object({
        id: Joi.string().uuid().allow("", null).optional(),
        option_text: Joi.string().min(1).max(255).required(),
      })
    )
    .min(1)
    .required(),
});
