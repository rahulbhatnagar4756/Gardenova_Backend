import { ErrorResponse } from "../../interface/Error";
import { SuccessResponse } from "../../interface/success";

/**
 * Formats a standardized success response object.
 * @param data - The data payload to return in the response.
 * @param message - A descriptive success message. Default is "Success".
 * @returns The formatted success response object.
 */
export const successResponse = <T>(
  data: T,
  message = "Success"
): SuccessResponse<T> => {
  return {
    success: true,
    message,
    data,
  };
};

/**
 * Formats a standardized error response object.
 * @param message - A descriptive error message. Default is "Error occurred".
 * @param errors - Optional detailed error information. Default is null.
 * @returns The formatted error response object.
 */
export const errorResponse = (
  message = "Error occurred",
  errors: Record<string, unknown> | null = null
): ErrorResponse => {
  const response: ErrorResponse = {
    success: false,
    message,
  };
  if (errors) {
    response.errors = errors;
  }
  return response;
};
