import Joi, { ObjectSchema } from "joi";

/**
 * Optional latitude/longitude body for soil-type lookup.
 * Accepts `latitude`/`longitude` or aliases `lat`/`long`/`lng`.
 * If one coordinate is sent, the other is required.
 */
export const soilTypeValidation: ObjectSchema = Joi.object({
  latitude: Joi.number().min(-90).max(90).optional(),
  longitude: Joi.number().min(-180).max(180).optional(),
  lat: Joi.number().min(-90).max(90).optional(),
  long: Joi.number().min(-180).max(180).optional(),
  lng: Joi.number().min(-180).max(180).optional(),
})
  .custom((value, helpers) => {
    const latitude = value.latitude ?? value.lat;
    const longitude = value.longitude ?? value.long ?? value.lng;

    const hasLat = latitude !== undefined && latitude !== null && latitude !== "";
    const hasLng = longitude !== undefined && longitude !== null && longitude !== "";

    if (hasLat !== hasLng) {
      return helpers.error("any.custom", {
        message: "latitude and longitude must be provided together",
      });
    }

    return {
      latitude: hasLat ? Number(latitude) : undefined,
      longitude: hasLng ? Number(longitude) : undefined,
    };
  })
  .messages({
    "any.custom": "latitude and longitude must be provided together",
  });
