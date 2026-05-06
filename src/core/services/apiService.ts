import axios, {
  AxiosInstance,
  AxiosRequestConfig,
  AxiosResponse,
  AxiosError,
} from "axios";
import FormData from "form-data";
import { info, warn, error } from "../utils/logger";
import type { AxiosProgressEvent } from "axios";
import { ApiError } from "../../interface/Error";
import { ApiResponse, ParallelRequest } from "../../interface/response";

/**
 * ApiService - A wrapper around Axios with request/response interceptors,
 * logging, error handling, retries, and helper methods for HTTP requests.
 */
class ApiService {
  private axiosInstance: AxiosInstance;

  /**
   * Creates an instance of ApiService.
   * @param baseURL - The base URL for API requests.
   * @param defaultHeaders - Default headers to include in requests.
   * @param defaultTimeout - Default timeout in milliseconds (default: 30000).
   */
  constructor(
    baseURL: string = "",
    defaultHeaders: Record<string, string> = {},
    defaultTimeout: number = 30000
  ) {
    // FIXED: Ensure proper URL joining by normalizing baseURL
    const normalizedBaseURL = baseURL
      ? baseURL.endsWith("/")
        ? baseURL.slice(0, -1)
        : baseURL
      : "";

    this.axiosInstance = axios.create({
      baseURL: normalizedBaseURL,
      timeout: defaultTimeout,
      headers: {
        "Content-Type": "application/json",
        ...defaultHeaders,
      },
    });

    // Request interceptor
    this.axiosInstance.interceptors.request.use(
      (config) => {
        info("API Request", {
          method: config.method?.toUpperCase(),
          url: config.url,
          baseURL: config.baseURL,
          fullURL: `${config.baseURL}${config.url}`, // Add full URL logging
          headers: this.sanitizeHeaders(config.headers || {}),
          params: config.params,
          data: config.data ? "Present" : "None",
          timeout: config.timeout,
        });
        return config;
      },
      (error) => {
        error("Request Interceptor Error", {
          error: error.message,
          stack: error.stack,
        });
        return Promise.reject(error);
      }
    );

    // Response interceptor
    this.axiosInstance.interceptors.response.use(
      (response) => {
        info("API Response Success", {
          method: response.config.method?.toUpperCase(),
          url: response.config.url,
          fullURL: `${response.config.baseURL}${response.config.url}`, // Add full URL logging
          status: response.status,
          statusText: response.statusText,
          responseTime: response.headers["x-response-time"],
          dataSize: response.data ? JSON.stringify(response.data).length : 0,
        });
        return response;
      },
      (errorObj: AxiosError) => {
        const errorInfo: Record<string, unknown> = {
          method: errorObj.config?.method?.toUpperCase(),
          url: errorObj.config?.url,
          fullURL: `${errorObj.config?.baseURL}${errorObj.config?.url}`, // Add full URL logging
          message: errorObj.message,
          status: errorObj.response?.status,
          statusText: errorObj.response?.statusText,
          responseData: errorObj.response?.data,
        };

        if (errorObj.code === "ECONNABORTED") {
          errorInfo.type = "TIMEOUT";
        } else if (
          errorObj.code === "ENOTFOUND" ||
          errorObj.code === "ECONNREFUSED"
        ) {
          errorInfo.type = "CONNECTION_ERROR";
        } else if (
          errorObj.response?.status &&
          errorObj.response.status >= 400 &&
          errorObj.response.status < 500
        ) {
          errorInfo.type = "CLIENT_ERROR";
        } else if (
          errorObj.response?.status &&
          errorObj.response.status >= 500
        ) {
          errorInfo.type = "SERVER_ERROR";
        }

        // Call the logger function
        void error("API Response Error", errorInfo);

        return Promise.reject(errorObj);
      }
    );
  }

  /**
   * Sanitize headers for safe logging by redacting sensitive values.
   *
   * @param {Record<string, unknown>} headers - The request/response headers.
   * @returns {Record<string, unknown>} A copy of the headers with sensitive keys redacted.
   */
  private sanitizeHeaders(
    headers: Record<string, unknown>
  ): Record<string, unknown> {
    const sensitiveKeys = [
      "authorization",
      "cookie",
      "api-key",
      "x-api-key",
      "auth-token",
    ];
    const sanitized = { ...headers };

    Object.keys(sanitized).forEach((key) => {
      if (sensitiveKeys.includes(key.toLowerCase())) {
        sanitized[key] = "[REDACTED]";
      }
    });

    return sanitized;
  }

  /**
   * Perform a GET request with optional query parameters
   *
   * @template T - The expected response data type
   * @param url - The request URL (relative or absolute)
   * @param config - Axios configuration object (supports `query` as alias for `params`)
   * @returns Formatted API response
   * @throws Formatted API error with context
   */
  async get<T = unknown>(
    url: string,
    config: AxiosRequestConfig & { query?: Record<string, unknown> } = {}
  ): Promise<ApiResponse<T>> {
    try {
      // FIXED: Ensure proper URL formatting
      const normalizedUrl = url.startsWith("/") ? url : `/${url}`;
      const response = await this.axiosInstance.get<T>(normalizedUrl, {
        ...config,
        params: config.params ?? config.query, // safe fallback
      });
      return this.formatResponse(response);
    } catch (error: unknown) {
      throw this.handleError(error, "GET", url);
    }
  }

  /**
   * Perform a POST request
   * @param url - Endpoint URL
   * @param data - Request payload (default: `{}`)
   * @param config - Optional Axios request configuration
   * @returns Standardized API response
   */
  async post<T = unknown>(
    url: string,
    data: unknown = {},
    config: AxiosRequestConfig = {}
  ): Promise<ApiResponse<T>> {
    try {
      // FIXED: Ensure proper URL formatting
      const normalizedUrl = url.startsWith("/") ? url : `/${url}`;
      const response = await this.axiosInstance.post<T>(
        normalizedUrl,
        data,
        config
      );
      return this.formatResponse(response);
    } catch (error) {
      throw this.handleError(error, "POST", url);
    }
  }

  /**
   * Executes a PUT request
   *
   * @template T - Expected response type
   * @param url - Endpoint to call
   * @param data - Request body (default: empty object)
   * @param config - Optional Axios configuration
   * @returns Promise resolving to ApiResponse<T>
   */
  async put<T = unknown>(
    url: string,
    data: unknown = {},
    config: AxiosRequestConfig = {}
  ): Promise<ApiResponse<T>> {
    try {
      // FIXED: Ensure proper URL formatting
      const normalizedUrl = url.startsWith("/") ? url : `/${url}`;
      const response = await this.axiosInstance.put<T>(
        normalizedUrl,
        data,
        config
      );
      return this.formatResponse(response);
    } catch (error) {
      throw this.handleError(error, "PUT", url);
    }
  }

  /**
   * Send a PATCH request.
   *
   * @template T - The expected response type.
   * @param url - The endpoint URL.
   * @param data - The request payload (default: `{}`).
   * @param config - Optional Axios configuration.
   * @returns A formatted API response.
   * @throws Formatted error if request fails.
   */
  async patch<T = unknown>(
    url: string,
    data: unknown = {},
    config: AxiosRequestConfig = {}
  ): Promise<ApiResponse<T>> {
    try {
      // FIXED: Ensure proper URL formatting
      const normalizedUrl = url.startsWith("/") ? url : `/${url}`;
      const response = await this.axiosInstance.patch<T>(
        normalizedUrl,
        data,
        config
      );
      return this.formatResponse(response);
    } catch (error) {
      throw this.handleError(error, "PATCH", url);
    }
  }

  /**
   * Perform an HTTP DELETE request
   * @param url - The endpoint URL
   * @param config - Optional Axios config (headers, params, etc.)
   * @returns A promise resolving to the API response wrapper
   */
  async delete<T = unknown>(
    url: string,
    config: AxiosRequestConfig = {}
  ): Promise<ApiResponse<T>> {
    try {
      // FIXED: Ensure proper URL formatting
      const normalizedUrl = url.startsWith("/") ? url : `/${url}`;
      const response = await this.axiosInstance.delete<T>(
        normalizedUrl,
        config
      );
      return this.formatResponse(response);
    } catch (error) {
      throw this.handleError(error, "DELETE", url);
    }
  }

  /**
   * Uploads files or form data to the specified endpoint using `multipart/form-data`.
   * Supports both single values and arrays by automatically appending them to `FormData`.
   *
   * @param url - The endpoint URL to upload data to
   * @param data - Key-value pairs of form data; arrays are expanded with indexed keys
   * @param config - Optional Axios configuration (headers, progress tracking, etc.)
   * @returns {Promise<ApiResponse<T>>} A promise resolving to the API response wrapper
   */
  async upload<T = unknown>(
    url: string,
    data: Record<string, unknown>,
    config: AxiosRequestConfig = {}
  ): Promise<ApiResponse<T>> {
    try {
      const formData = new FormData();
      Object.keys(data).forEach((key) => {
        const value = data[key];
        if (Array.isArray(value)) {
          value.forEach((item, index) =>
            formData.append(`${key}[${index}]`, item)
          );
        } else {
          formData.append(key, value);
        }
      });

      // FIXED: Ensure proper URL formatting
      const normalizedUrl = url.startsWith("/") ? url : `/${url}`;
      const response = await this.axiosInstance.post<T>(
        normalizedUrl,
        formData,
        {
          ...config,
          headers: {
            "Content-Type": "multipart/form-data",
            ...config.headers,
          },
          onUploadProgress:
            config.onUploadProgress ||
            ((progressEvent: AxiosProgressEvent): void => {
              if (progressEvent.total) {
                const percentCompleted = Math.round(
                  (progressEvent.loaded! * 100) / progressEvent.total!
                );

                // info returns Promise<void>, we use void to ignore it in the callback
                void info("Upload Progress", {
                  url,
                  progress: `${percentCompleted}%`,
                  loaded: progressEvent.loaded,
                  total: progressEvent.total,
                });
              }
            }),
        }
      );

      return this.formatResponse(response);
    } catch (error) {
      throw this.handleError(error, "UPLOAD", url);
    }
  }

  /**
   * Downloads a file or data stream from the specified endpoint.
   * Supports progress tracking through the `onDownloadProgress` callback.
   *
   * @param url - The endpoint URL to download from
   * @param config - Optional Axios configuration (headers, params, progress tracking, etc.)
   * @returns {Promise<ApiResponse<T>>} A promise resolving to the API response wrapper
   */
  async download<T = unknown>(
    url: string,
    config: AxiosRequestConfig = {}
  ): Promise<ApiResponse<T>> {
    try {
      // FIXED: Ensure proper URL formatting
      const normalizedUrl = url.startsWith("/") ? url : `/${url}`;
      const response = await this.axiosInstance.get<T>(normalizedUrl, {
        ...config,
        responseType: "stream",
        onDownloadProgress:
          config.onDownloadProgress ||
          ((progressEvent: AxiosProgressEvent): void => {
            if (progressEvent.total && progressEvent.loaded !== undefined) {
              const percentCompleted = Math.round(
                (progressEvent.loaded * 100) / progressEvent.total
              );

              // Use void to ignore the Promise returned by info
              void info("Download Progress", {
                url,
                progress: `${percentCompleted}%`,
                loaded: progressEvent.loaded,
                total: progressEvent.total,
              });
            }
          }),
      });

      return this.formatResponse(response);
    } catch (error) {
      throw this.handleError(error, "DOWNLOAD", url);
    }
  }

  /**
   * Executes multiple API requests in parallel using the specified HTTP methods.
   * Each request is handled independently and returns either a success or failure result.
   *
   * @param {ParallelRequest[]} requests - An array of requests containing method, url, data, and config.
   * @returns {Promise<Array<{ success: true; data: unknown } | { success: false; error: unknown }>>}
   * A promise that resolves to an array of results, where each result indicates whether the request succeeded or failed.
   */
  async parallel(
    requests: ParallelRequest[]
  ): Promise<
    Array<{ success: true; data: unknown } | { success: false; error: unknown }>
  > {
    try {
      const promises = requests.map((request) => {
        const { method, url, data, config = {} } = request;

        switch (method.toLowerCase()) {
          case "get":
            return this.get(url, config);
          case "post":
            return this.post(url, data, config);
          case "put":
            return this.put(url, data, config);
          case "patch":
            return this.patch(url, data, config);
          case "delete":
            return this.delete(url, config);
          default:
            throw new Error(`Unsupported method: ${method}`);
        }
      });

      const results = await Promise.allSettled(promises);

      return results.map((result, index) => {
        if (result.status === "fulfilled") {
          return { success: true, data: result.value };
        } else {
          void error("Parallel request failed", {
            index,
            request: requests[index],
            error: (result.reason as Error).message,
          });
          return { success: false, error: result.reason };
        }
      });
    } catch (err: unknown) {
      throw this.handleError(err, "PARALLEL", "multiple");
    }
  }

  /**
   * Executes a request function with retry logic using exponential backoff.
   * Retries are attempted only for retryable errors (e.g., network issues).
   *
   * @template T - The type of the response returned by the request function.
   * @param {() => Promise<T>} requestFn - The function that performs the request and returns a promise.
   * @param {number} [maxRetries=3] - Maximum number of retry attempts before failing.
   * @param {number} [retryDelay=1000] - Initial delay (in ms) before retrying, doubled after each attempt.
   * @returns {Promise<T>} A promise that resolves with the result of the request function if successful,
   * or rejects with the last encountered error if all retries fail.
   */
  async withRetry<T>(
    requestFn: () => Promise<T>,
    maxRetries = 3,
    retryDelay = 1000
  ): Promise<T> {
    let lastError: unknown;

    for (let attempt = 1; attempt <= maxRetries + 1; attempt++) {
      try {
        const result = await requestFn();
        if (attempt > 1) {
          void info("Request succeeded after retry", { attempt, maxRetries });
        }
        return result;
      } catch (err: unknown) {
        lastError = err;

        const errObj: Error =
          err instanceof Error
            ? err
            : new Error(typeof err === "string" ? err : "Unknown error");

        if (attempt <= maxRetries) {
          const isRetryable = this.isRetryableError(errObj);

          if (isRetryable) {
            void warn("Request failed, retrying", {
              attempt,
              maxRetries,
              error: errObj.message,
              retryDelay,
            });

            const delay = retryDelay * Math.pow(2, attempt - 1);
            await this.sleep(delay);
          } else {
            void error("Non-retryable error, aborting", {
              attempt,
              error: errObj.message,
            });
            break;
          }
        }
      }
    }

    throw lastError;
  }

  /**
   * Sets the Authorization header for all Axios requests.
   *
   * @param token - The authentication token to include in the header.
   * @param type - The token type (default is "Bearer").
   */
  setAuthToken(token: string, type: string = "Bearer"): void {
    this.axiosInstance.defaults.headers.common["Authorization"] =
      `${type} ${token}`;
  }

  /**
   * Clears the stored authentication token from the Axios instance headers.
   */
  clearAuthToken(): void {
    delete this.axiosInstance.defaults.headers.common["Authorization"];
  }

  /**
   * Sets the API key in the default request headers for all requests.
   *
   * @param apiKey - The API key value to include in requests.
   * @param headerName - The header name to use (default: "X-API-Key").
   */
  setApiKey(apiKey: string, headerName = "X-API-Key"): void {
    this.axiosInstance.defaults.headers.common[headerName] = apiKey;
  }

  /**
   * Updates the base URL used by the Axios instance for all API requests.
   *
   * @param baseURL The new base URL to set for API requests.
   */
  setBaseURL(baseURL: string): void {
    const normalizedBaseURL = baseURL
      ? baseURL.endsWith("/")
        ? baseURL.slice(0, -1)
        : baseURL
      : "";
    this.axiosInstance.defaults.baseURL = normalizedBaseURL;
  }

  /**
   * Sets custom headers for all subsequent requests made by the Axios instance.
   *
   * @param headers - A record of header key-value pairs to be applied globally.
   */
  setHeaders(headers: Record<string, string>): void {
    Object.assign(this.axiosInstance.defaults.headers.common, headers);
  }

  /**
   * Formats an Axios response into a standardized `ApiResponse` structure.
   *
   * @param response - The raw Axios response to format.
   * @returns A standardized `ApiResponse` object containing the response data,
   *          status, headers, and relevant request configuration.
   */
  private formatResponse<T>(response: AxiosResponse<T>): ApiResponse<T> {
    const config: ApiResponse<T>["config"] = {};

    if (response.config.method) config.method = response.config.method;
    if (response.config.url) config.url = response.config.url;
    if (response.config.baseURL) config.baseURL = response.config.baseURL;

    return {
      data: response.data,
      status: response.status,
      statusText: response.statusText,
      headers: response.headers,
      config,
    };
  }

  /**
   * Normalizes different Axios or unknown errors into a consistent `ApiError` object.
   *
   * @param error - The error instance thrown by Axios or another source.
   * @param method - The HTTP method used for the request that failed.
   * @param url - The request URL associated with the error.
   * @returns A standardized `ApiError` object containing details about the failure.
   */
  private handleError(error: unknown, method: string, url: string): ApiError {
    const apiError: ApiError = {
      name: "ApiError",
      message: "",
      originalError: error,
      method,
      url,
    };

    if ((error as AxiosError).response) {
      const axiosError = error as AxiosError;
      apiError.name = "ApiResponseError";
      apiError.message = `${method} ${url} failed with status ${axiosError.response?.status}`;
      apiError.status = axiosError.response?.status;
      apiError.statusText = axiosError.response?.statusText;
      apiError.data = axiosError.response?.data;
      apiError.headers = axiosError.response?.headers;
    } else if ((error as AxiosError).request) {
      const axiosError = error as AxiosError;
      apiError.name = "ApiRequestError";
      apiError.message = `${method} ${url} - No response received`;
      apiError.code = axiosError.code;
    } else if (error instanceof Error) {
      apiError.name = "ApiConfigError";
      apiError.message = `${method} ${url} - ${error.message}`;
    } else {
      apiError.name = "UnknownError";
      apiError.message = `${method} ${url} - An unknown error occurred`;
    }

    return apiError;
  }

  /**
   * Determines whether a given error is retryable based on its type, code, or status.
   *
   * Retryable errors typically include:
   * - Network issues (e.g., timeouts, connection refused, not found)
   * - Server errors (status >= 500)
   * - Rate limiting (status 429)
   *
   * @param error - The error instance thrown by Axios or another source.
   * @returns `true` if the error should be retried, otherwise `false`.
   */
  private isRetryableError(error: unknown): boolean {
    // Narrow to AxiosError type if it has response or code
    const axiosError = error as
      | AxiosError
      | { code?: string; response?: { status: number } };

    if (
      axiosError.code === "ECONNABORTED" ||
      axiosError.code === "ENOTFOUND" ||
      axiosError.code === "ECONNREFUSED" ||
      axiosError.code === "ETIMEDOUT"
    ) {
      return true;
    }

    if (axiosError.response?.status ?? 0 >= 500) {
      return true;
    }

    if (axiosError.response?.status === 429) {
      return true;
    }

    return false;
  }

  /**
   * Pauses execution for a given number of milliseconds.
   *
   * @param ms - The number of milliseconds to sleep.
   * @returns A promise that resolves after the specified delay.
   */
  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}

export default ApiService;
