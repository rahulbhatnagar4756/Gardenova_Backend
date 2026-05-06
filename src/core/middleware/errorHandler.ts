import { Request, Response, NextFunction } from "express";
import { errorResponse } from "../utils/responseFormatter";
import { HTTP_STATUS } from "../utils/constants";
import { CustomError } from "../../interface/Error";

/**
 * Global error-handling middleware for Express.
 * Catches application errors, maps known error types (Mongoose, JWT, etc.)
 * to proper HTTP status codes, and sends a JSON error response.
 *
 * @param {CustomError} err - The error object, which may contain custom properties like `code` or `errors`.
 * @param {Request} req - Express request object.
 * @param {Response} res - Express response object used to send the error response.
 * @param {NextFunction} _next - Express next middleware function (unused, prefixed with `_`).
 * @returns {void} Sends a JSON response with appropriate HTTP status and error message.
 */
const errorHandler = (
  err: CustomError,
  req: Request,
  res: Response,
  _next: NextFunction
): void => {
  let statusCode;
  let message = err.message || "Internal Server Error";

  // Mongoose validation error
  if (err.name === "ValidationError" && err.errors) {
    statusCode = HTTP_STATUS.BAD_REQUEST;
    message = Object.values(err.errors)
      .map((error) => error.message)
      .join(", ");
  }

  // Mongoose duplicate key error
  if (err.code === 11000) {
    statusCode = HTTP_STATUS.CONFLICT;
    message = "Resource already exists";
  }

  // JWT error
  if (err.name === "JsonWebTokenError") {
    statusCode = HTTP_STATUS.UNAUTHORIZED;
    message = "Invalid token";
  }

  res.status(statusCode ?? 400).json(errorResponse(message));
};

export default errorHandler;
