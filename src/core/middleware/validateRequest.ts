import { Request, Response, NextFunction } from "express";
import { ObjectSchema } from "joi";
import { errorResponse } from "../utils/responseFormatter";
import { HTTP_STATUS } from "../utils/constants";
import { RequestProperty } from "../../interface/request";

/**
 * Generic middleware factory to validate request data against a Joi schema.
 * Can validate `req.body` (default), `req.query`, or `req.params`.
 *
 * @param {ObjectSchema} schema - Joi schema used for validation.
 * @param {RequestProperty} [property="body"] - Which part of the request to validate ('body' | 'query' | 'params').
 * @returns {(req: Request, res: Response, next: NextFunction) => void | Response}
 * Middleware function that validates the request and either calls `next()` or responds with a 400 error.
 */
const validateRequest = (
  schema: ObjectSchema,
  property: RequestProperty = "body"
) => {
  return (req: Request, res: Response, next: NextFunction): void | Response => {
    const { error } = schema.validate(req[property], { abortEarly: false });

    if (error) {
      const errors = error.details.map((detail) => ({
        field: detail.path[0],
        message: detail.message,
      }));

      return res
        .status(HTTP_STATUS.BAD_REQUEST)
        .json(errorResponse("Validation failed", { errors }));
    }

    next();
  };
};

export default validateRequest;
