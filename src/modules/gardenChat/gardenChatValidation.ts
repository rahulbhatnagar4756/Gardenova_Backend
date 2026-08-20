import Joi, { ObjectSchema } from "joi";

/**
 * Body schema for sending a gardening chatbot message.
 * Accepts text only, image only, or both.
 */
export const gardenChatMessageValidation: ObjectSchema = Joi.object({
  message: Joi.string().trim().max(2000).allow("").optional(),
  image_base64: Joi.string().trim().min(1).optional(),
  conversationId: Joi.string().uuid().optional(),
}).custom((value, helpers) => {
  const hasMessage = Boolean(value.message?.trim());
  const hasImage = Boolean(value.image_base64?.trim());

  if (!hasMessage && !hasImage) {
    return helpers.error("any.custom", {
      message: "Provide message, image_base64, or both",
    });
  }

  return value;
});

/**
 * Query schema for fetching gardening chatbot history.
 */
export const gardenChatHistoryValidation: ObjectSchema = Joi.object({
  conversationId: Joi.string().uuid().optional(),
  page: Joi.number().integer().min(1).optional(),
  limit: Joi.number().integer().min(1).max(50).optional(),
});
