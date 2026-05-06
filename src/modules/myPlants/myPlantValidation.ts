import Joi, { ObjectSchema } from "joi";

export const reminderValidation: ObjectSchema = Joi.object({
  plant_id: Joi.number()
    .integer()
    .required()
    .messages({
      "number.base": "Plant ID must be a number",
      "number.integer": "Plant ID must be an integer",
      "any.required": "Plant ID is required",
    }),

  // ── Watering ──────────────────────────────────────────────────────────────
  watering_notification_enabled: Joi.boolean().messages({
    "boolean.base": "Watering notification must be true or false",
  }),
  watering_preferred_time: Joi.string()
    .pattern(/^([01]\d|2[0-3]):([0-5]\d):([0-5]\d)$/)
    .messages({
      "string.pattern.base": "Watering preferred time must be in HH:MM:SS format",
    }),
  watering_reminder_frequency: Joi.number()
    .integer()
    .min(0)
    .messages({
      "number.base": "Watering frequency must be a number",
      "number.integer": "Watering frequency must be an integer",
      "number.min": "Watering frequency cannot be negative",
    }),

  // ── Fertilizer ────────────────────────────────────────────────────────────
  fertilizer_notification_enabled: Joi.boolean().messages({
    "boolean.base": "Fertilizer notification must be true or false",
  }),
  fertilizer_preferred_time: Joi.string()
    .pattern(/^([01]\d|2[0-3]):([0-5]\d):([0-5]\d)$/)
    .messages({
      "string.pattern.base": "Fertilizer preferred time must be in HH:MM:SS format",
    }),
  fertilizer_reminder_frequency: Joi.number()
    .integer()
    .min(0)
    .messages({
      "number.base": "Fertilizer frequency must be a number",
      "number.integer": "Fertilizer frequency must be an integer",
      "number.min": "Fertilizer frequency cannot be negative",
    }),

  // ── Pruning ───────────────────────────────────────────────────────────────
  pruning_notification_enabled: Joi.boolean().messages({
    "boolean.base": "Pruning notification must be true or false",
  }),
  pruning_reminder_frequency: Joi.number()
    .integer()
    .min(0)
    .messages({
      "number.base": "Pruning frequency must be a number",
      "number.integer": "Pruning frequency must be an integer",
      "number.min": "Pruning frequency cannot be negative",
    }),

  // ── Generic Care ──────────────────────────────────────────────────────────
  generic_notification_enabled: Joi.boolean().messages({
    "boolean.base": "Generic notification must be true or false",
  }),
  generic_care_reminder_frequency: Joi.number()
    .integer()
    .min(0)
    .messages({
      "number.base": "Generic care frequency must be a number",
      "number.integer": "Generic care frequency must be an integer",
      "number.min": "Generic care frequency cannot be negative",
    }),
})
  .required()
  .unknown(false);