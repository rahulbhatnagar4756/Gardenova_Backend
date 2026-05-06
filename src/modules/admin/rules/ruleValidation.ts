import Joi, { ObjectSchema } from "joi";

const uuidPattern =
  /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/;

const conditionSchema = Joi.object({
  questionId: Joi.string().pattern(uuidPattern).required().messages({
    "string.pattern.base": "questionId must be a valid UUID",
    "string.empty": "questionId is required",
    "any.required": "questionId is required",
  }),

  operator: Joi.string().valid("equal", "and", "or").required().messages({
    "any.only": "Operator must be one of: equals, in, and, or",
    "any.required": "Operator is required",
  }),

  value: Joi.string().min(1).required().messages({
    "string.empty": "Value is required",
    "any.required": "Value is required",
  }),
});

export const ruleValidation: ObjectSchema = Joi.object({
  name: Joi.string().min(3).required().messages({
    "string.empty": "Rule name is required",
    "string.min": "Rule name must be at least 3 characters",
    "any.required": "Rule name is required",
  }),
  conditions: Joi.array().items(conditionSchema).min(1).required().messages({
    "array.base": "Conditions must be an array",
    "array.min": "At least one condition is required",
    "any.required": "Conditions are required",
  }),
});
