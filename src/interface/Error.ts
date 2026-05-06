export interface CustomError extends Error {
  name: string; // required to match Error
  message: string; // required
  stack?: string; // optional
  code?: string | number; // optional
  errors?: Record<string, { message: string }>; // optional for Mongoose
}

export interface MongoValidationError extends Error {
  code?: number;
  errInfo?: {
    details?: Array<{
      name?: string;
      path?: string;
      value?: unknown;
      message?: string;
    }>;
  };
}

export interface ApiError extends Error {
  status?: number | undefined;
  statusText?: string | undefined;
  data?: unknown;
  headers?: unknown;
  code?: string | undefined;
  originalError: unknown;
  method: string;
  url: string;
}

export interface ErrorResponse {
  success: false;
  message: string;
  errors?: Record<string, unknown> | null;
}
