import {  Response, NextFunction } from 'express';
import logger from '../config/logger';
import { AuthRequest } from '../../interface/auth';

/**
 * Express middleware that logs detailed request and response information.
 *
 * Captures:
 * - HTTP method and URL
 * - Response status and time
 * - User info (if available)
 * - Query parameters
 * - Request and response bodies (only for error responses)
 *
 * Sensitive fields like password and token are masked before logging.
 *
 * @param {AuthRequest} req - Express request object with optional user data
 * @param {Response} res - Express response object
 * @param {NextFunction} next - Express next middleware function
 * @returns {void}
 */
const detailedLogger = (req: AuthRequest, res: Response, next: NextFunction):void => {
  const start = Date.now();

  // capture request body
  const requestBody = { ...req.body };
  // remove sensitive fields
  if (requestBody.password) requestBody.password = '***';
  if (requestBody.token) requestBody.token = '***';

  // intercept response body

  const originalJson = res.json.bind(res);
  let responseBody: any; // eslint-disable-line @typescript-eslint/no-explicit-any
/**
 * Intercepts Express res.json to capture the response body for logging.
 *
 * This wrapper stores the response payload before sending it to the client,
 * allowing it to be used later in logging (e.g., for error tracking).
 *
 * ⚠️ Note: Only captures responses sent via res.json().
 * It does not capture res.send(), streams, or res.end().
 *
 * @param {any} body - The response body being sent to the client
 * @returns {Response} Express Response object
 */
  res.json = (body):Response => {
    responseBody = body;
    return originalJson(body);
  };

  res.on('finish', () => {
    const user = req.user as { userId: string; userEmail: string; role: string };
    const isError = res.statusCode >= 400;

    const logData: any = {// eslint-disable-line @typescript-eslint/no-explicit-any
      method: req.method,
      url: req.originalUrl,
      status: res.statusCode,
      responseTime: `${Date.now() - start}ms`,
      ip: req.ip,
      userId: user?.userId ?? null,
      userEmail: user?.userEmail ?? null,
      userRole: user?.role ?? null,
      ...(req.query && Object.keys(req.query).length && { queryParams: req.query }),
    };

    // only on errors — add req body + res body
    if (isError) {
      logData.requestBody = requestBody;
      logData.responseBody = responseBody;
    }

    if (isError) {
      logger.error('API Error', logData);
    } else {
      logger.info('API Request', logData);
    }
  });

  next();
};

export default detailedLogger;