import Joi, { NumberSchema, ObjectSchema, StringSchema } from "joi";

/**
 * Validates a time string in `HH:MM:SS` (24-hour) format.
 */
const timePattern = /^([01]\d|2[0-3]):([0-5]\d):([0-5]\d)$/;
/**
 * Creates a Joi validator for reminder preferred time fields.
 *
 * @param label - Human-readable field name used in validation messages.
 * @returns Joi string validator enforcing `HH:MM:SS` format.
 */
const timeField = (label: string):StringSchema<string>=>
  Joi.string().pattern(timePattern).messages({
    "string.pattern.base": `${label} must be in HH:MM:SS format`,
  });

/**
 * Creates a Joi validator for reminder frequency fields.
 *
 * Frequency must be a non-negative integer.
 *
 * @param label - Human-readable field name used in validation messages.
 * @returns Joi number validator.
 */
const frequencyField = (label: string):NumberSchema  =>
  Joi.number().integer().min(0).messages({
    "number.base": `${label} frequency must be a number`,
    "number.integer": `${label} frequency must be an integer`,
    "number.min": `${label} frequency cannot be negative`,
  });

/**
 * Creates a Joi validator for snooze duration fields.
 *
 * Snooze duration must be at least 1 minute.
 *
 * @param label - Human-readable field name used in validation messages.
 * @returns Joi number validator.
 */


/**
 * Joi schema for validating plant reminder settings updates.
 *
 * Supports configuration for:
 * - Watering reminders
 * - Fertilizer reminders
 * - Pruning reminders
 * - Generic care reminders
 *
 * Each reminder type can define:
 * - Notification enabled status
 * - Preferred notification time (`HH:MM:SS`)
 * - Reminder frequency
 * - Snooze duration in minutes
 *
 * Unknown fields are rejected.
 */
export const reminderValidation: ObjectSchema = Joi.object({
  plant_id: Joi.number().required().messages({
    "number.base":  "Plant ID must be a number",
    "any.required": "Plant ID is required",
  }),

  // ── Watering ──────────────────────────────────────────────────────────────
  watering_notification_enabled: Joi.boolean(),
  watering_preferred_time:       timeField("Watering preferred time"),
  watering_reminder_frequency:   frequencyField("Watering"),
  watering_note:                 Joi.string().max(500).optional().messages({
    "string.base": "Watering note must be a string",
    "string.max":  "Watering note cannot exceed 500 characters",
  }),

  // ── Fertilizer ────────────────────────────────────────────────────────────
  fertilizer_notification_enabled: Joi.boolean(),
  fertilizer_preferred_time:       timeField("Fertilizer preferred time"),
  fertilizer_reminder_frequency:   frequencyField("Fertilizer"),
  fertilizer_note:                 Joi.string().max(500).optional().messages({
    "string.base": "Fertilizer note must be a string",
    "string.max":  "Fertilizer note cannot exceed 500 characters",
  }),

  // ── Pruning ───────────────────────────────────────────────────────────────
  pruning_notification_enabled:  Joi.boolean(),
  pruning_preferred_time:        timeField("Pruning preferred time"),
  pruning_reminder_frequency:    frequencyField("Pruning"),
  pruning_note:                  Joi.string().max(500).optional().messages({
    "string.base": "Pruning note must be a string",
    "string.max":  "Pruning note cannot exceed 500 characters",
  }),

  // ── Generic Care ──────────────────────────────────────────────────────────
  generic_notification_enabled:    Joi.boolean(),
  generic_care_preferred_time:     timeField("Generic care preferred time"),
  generic_care_reminder_frequency: frequencyField("Generic care"),
  generic_care_note:               Joi.string().max(500).optional().messages({
    "string.base": "Generic care note must be a string",
    "string.max":  "Generic care note cannot exceed 500 characters",
  }),
})
  .required()
  .unknown(false);