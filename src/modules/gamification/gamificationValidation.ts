import Joi, { ObjectSchema } from "joi";

/**
 * Validates daily challenge id path param for mark-complete.
 */
export const completeDailyChallengeParamsValidation: ObjectSchema = Joi.object({
  challengeId: Joi.string().uuid().required().messages({
    "string.guid": "challengeId must be a valid UUID",
    "any.required": "challengeId is required",
  }),
});
