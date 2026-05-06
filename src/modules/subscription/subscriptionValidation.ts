import Joi, { ObjectSchema } from "joi";

export const createPlanValidation: ObjectSchema = Joi.object({
  plan_name: Joi.string()
    .valid("Silver", "Gold", "Diamond")
    .required()
    .messages({
      "any.only": "Plan name must be silver, Gold, or Diamante",
      "any.required": "Plan name is required",
    }),

  description: Joi.string()
    .min(5)
    .required()
    .messages({
      "string.base": "Description must be a string",
      "string.empty": "Description is required",
      "string.min": "Description must be at least 5 characters",
      "any.required": "Description is required",
    }),

  cities_coverage: Joi.number()
    .integer()
    .min(1)
    .required()
    .messages({
      "number.base": "Cities coverage must be a number",
      "number.integer": "Cities coverage must be an integer",
      "number.min": "Cities coverage must be at least 1",
      "any.required": "Cities coverage is required",
    }),

  price_monthly: Joi.number()
    .min(0)
    .precision(2)
    .required()
    .messages({
      "number.base": "Monthly price must be a number",
      "number.min": "Monthly price cannot be negative",
      "any.required": "Monthly price is required",
    }),

  price_annual: Joi.number()
    .min(0)
    .precision(2)
    .required()
    .messages({
      "number.base": "Annual price must be a number",
      "number.min": "Annual price cannot be negative",
      "any.required": "Annual price is required",
    }),

  leads_limit: Joi.number()
    .integer()
    .min(0)
    .allow(null)
    .messages({
      "number.base": "Leads limit must be a number",
      "number.integer": "Leads limit must be an integer",
      "number.min": "Leads limit cannot be negative",
    }),

  appear_in_search: Joi.boolean()
    .required()
    .messages({
      "boolean.base": "Appear in search must be true or false",
      "any.required": "Appear in search is required",
    }),

  premium_profile_badge: Joi.boolean()
    .required()
    .messages({
      "boolean.base": "Premium profile badge must be true or false",
      "any.required": "Premium profile badge is required",
    }),

  priority_customer_support: Joi.boolean()
    .required()
    .messages({
      "boolean.base": "Priority customer support must be true or false",
      "any.required": "Priority customer support is required",
    }),

  status: Joi.string()
    .valid("active", "inactive")
    .required()
    .messages({
      "any.only": "Status must be either 'active' or 'inactive'",
      "any.required": "Status is required",
    }),
})
  
// Update Plan Validation (same as create)
export const updatePlanValidation: ObjectSchema = Joi.object({
  //  Explicitly forbid plan_name
  
  id: Joi.string().required().messages({
    "string.base": "Plan ID must be a string",
    "any.required": "Plan ID is required",
  }),
  description: Joi.string().min(5).required().messages({
    "string.base": "Description must be a string",
    "string.empty": "Description is required",
    "string.min": "Description must be at least 5 characters",
    "any.required": "Description is required",
  }),

  price_monthly: Joi.number().required().messages({
    "number.base": "Monthly price must be a number",
    "any.required": "Monthly price is required",
  }),

  price_annual: Joi.number().required().messages({
    "number.base": "Annual price must be a number",
    "any.required": "Annual price is required",
  }),

  // leads_limit: Joi.number().integer().min(0).required().messages({
  //   "number.base": "Lead limit must be a number",
  //   "number.integer": "Lead limit must be an integer",
  //   "any.required": "Lead limit per month is required",
  // }),

  cities_coverage: Joi.number().integer().required().messages({
    "number.base": "Number of regions must be a number",
    "number.integer": "Number of regions must be an integer",
    "any.required": "Number of regions is required",
  }),

  appear_in_search: Joi.boolean().required().messages({
    "boolean.base": "Highlight in result must be true or false",
    "any.required": "Highlight in result is required",
  }),

  premium_profile_badge: Joi.boolean().required().messages({
    "boolean.base": "Verification badge must be true or false",
    "any.required": "Verification badge is required",
  }),

  status: Joi.string().valid("active", "inactive").required().messages({
    "any.only": "Status must be either 'active' or 'inactive'",
    "any.required": "Status is required",
  }),
}).required().unknown(false);