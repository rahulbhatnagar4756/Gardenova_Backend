import { Response, NextFunction } from "express";
import jwt, {
  JsonWebTokenError,
  NotBeforeError,
  TokenExpiredError,
} from "jsonwebtoken";

import config from "../config/env";
import { errorResponse } from "../utils/responseFormatter";
import { HTTP_STATUS, MESSAGES } from "../utils/constants";
import { warn, error } from "../utils/logger";
import { AuthRequest, AuthTokenPayload, RateLimitErrorResponse } from "../../interface/auth";



import { RateLimiterMemory, RateLimiterRes } from "rate-limiter-flexible";

/**
 * In-memory rate limiter instance for controlling user request frequency.
 *
 * Configuration:
 * - Allows 10 requests (points) per 60 seconds per key (e.g., per user/IP).
 *
 * Useful for preventing abuse and protecting APIs from excessive traffic.
 */

export const userRateLimiter = new RateLimiterMemory({
  points: 60, // Number of points
  duration: 60,
});
/**
 * Generates a structured rate limit error response when a user exceeds allowed requests.
 *
 * @param rateLimiterRes - The response object returned by rate-limiter-flexible
 * @returns A standardized error object containing retry timing and rate limit details
 *
 * The returned object includes:
 * - HTTP status code (429)
 * - Error code identifier
 * - Human-readable message
 * - Retry timing in seconds, minutes, and ISO timestamp
 * - Usage details (consumed and remaining points)
 */
export const getRateLimitErrorMessage = (rateLimiterRes: RateLimiterRes): RateLimitErrorResponse  => {
  const retryAfterSeconds = Math.ceil(rateLimiterRes.msBeforeNext / 1000);
  const retryAfterMinutes = Math.ceil(retryAfterSeconds / 60);

  return {
    code: "RATE_LIMIT_EXCEEDED",
    statusCode: 429,
    message: "Too many requests. Please slow down.",
    details: {
      retryAfterSeconds,
      retryAfterMinutes,
      retryAt: new Date(Date.now() + rateLimiterRes.msBeforeNext).toISOString(),
      remainingPoints: rateLimiterRes.remainingPoints,     // always 0 when blocked
      consumedPoints: rateLimiterRes.consumedPoints,       // how many they used
    },
  };
};

/**
 * Middleware to authenticate requests using a JWT token.
 * Extracts the token from the Authorization header, verifies it, and attaches
 * the decoded user payload to `req.user`. If the token is missing or invalid,
 * responds with an Unauthorized error.
 *
 * @param {AuthRequest} req - Express request object extended with `user` for decoded JWT payload.
 * @param {Response} res - Express response object used to return Unauthorized errors.
 * @param {NextFunction} next - Express next middleware function.
 * @returns {Promise<void>} Resolves when authentication passes or response is sent on failure.
 * @throws {Error} If the JWT token is expired, invalid, or not active.
 */
const auth = async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
  const requestInfo = {
    method: req.method,
    url: req.originalUrl,
    ip: req.ip || req.socket.remoteAddress,
    userAgent: req.get("User-Agent"),
  };

  // ── 1. JWT Verification ──────────────────────────────────────────────────
  try {
    const token = req.header("Authorization")?.replace("Bearer ", "");

    if (!token) {
      await warn("Authentication failed - missing token", { ...requestInfo }, { source: "middleware.auth" });
      res.status(HTTP_STATUS.UNAUTHORIZED).json(
        errorResponse(MESSAGES.TOKEN_MISSING, { code: "TOKEN_MISSING", statusCode: HTTP_STATUS.UNAUTHORIZED })
      );
      return;
    }

    const decoded = jwt.verify(token, config.JWT_SECRET) as AuthTokenPayload;

    req.user = {
      userEmail: Buffer.from(decoded.userEmail, "base64").toString("utf-8"),
      role:      Buffer.from(decoded.role,      "base64").toString("utf-8"),
      userId:    Buffer.from(decoded.userId,    "base64").toString("utf-8"),
      ...(decoded.exp && { exp: decoded.exp }),
      ...(decoded.iat && { iat: decoded.iat }),
    };

  } catch (err: unknown) {
    if (err instanceof TokenExpiredError) {
      await warn("Authentication failed - token expired",
        { ...requestInfo, expiredAt: err.expiredAt?.toISOString() ?? null },
        { source: "middleware.auth" }
      );
      res.status(HTTP_STATUS.UNAUTHORIZED).json(
        errorResponse(MESSAGES.TOKEN_EXPIRED, { code: "TOKEN_EXPIRED", statusCode: HTTP_STATUS.UNAUTHORIZED })
      );
      return;
    }
    if (err instanceof JsonWebTokenError) {
      await warn("Authentication failed - invalid token",
        { ...requestInfo, errorName: err.name, errorMessage: err.message },
        { source: "middleware.auth" }
      );
      res.status(HTTP_STATUS.UNAUTHORIZED).json(
        errorResponse(MESSAGES.TOKEN_INVALID, { code: "TOKEN_INVALID", statusCode: HTTP_STATUS.UNAUTHORIZED })
      );
      return;
    }
    if (err instanceof NotBeforeError) {
      await warn("Authentication failed - token not active yet",
        { ...requestInfo, notBefore: err.date?.toISOString() ?? null },
        { source: "middleware.auth" }
      );
      res.status(HTTP_STATUS.UNAUTHORIZED).json(
        errorResponse(MESSAGES.TOKEN_NOT_ACTIVE, { code: "TOKEN_NOT_ACTIVE", statusCode: HTTP_STATUS.UNAUTHORIZED })
      );
      return;
    }
    await error("Authentication failed - unexpected JWT error",
      { ...requestInfo, errorName: err instanceof Error ? err.name : "UnknownError",
        errorMessage: err instanceof Error ? err.message : String(err),
        stack: err instanceof Error ? err.stack : undefined },
      { source: "middleware.auth" }
    );
    res.status(HTTP_STATUS.UNAUTHORIZED).json(
      errorResponse(MESSAGES.JWT_UNKNOWN_ERROR, { code: "JWT_UNKNOWN_ERROR", statusCode: HTTP_STATUS.UNAUTHORIZED })
    );
    return;
  }

  // ── 2. Rate Limiting (only reached if JWT passed) ────────────────────────
  try {
    const { userId } = req.user as { userId: string };
    const rateLimiterRes = await userRateLimiter.consume(userId);

    res.set({
      "X-RateLimit-Limit":     String(userRateLimiter.points),
      "X-RateLimit-Remaining": String(rateLimiterRes.remainingPoints),
      "X-RateLimit-Reset":     new Date(Date.now() + rateLimiterRes.msBeforeNext).toISOString(),
    });

  } catch (err) {
    if (err instanceof RateLimiterRes) {
      const info = getRateLimitErrorMessage(err);

      await warn(
        `Rate limit exceeded for user`,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        { ...requestInfo, userId: (req.user as any)?.userId },
        { source: "middleware.auth" }
      );

      res.set({
        "Retry-After":           String(info.details.retryAfterSeconds),
        "X-RateLimit-Limit":     String(userRateLimiter.points),
        "X-RateLimit-Remaining": "0",
        "X-RateLimit-Reset":     info.details.retryAt,
      });

      res.status(429).json(errorResponse(info.message, info));
      return; // ← don't call next()
    }

    // Rate limiter infra failure — fail open (log but don't block user)
    console.error("Rate limiter unexpected error:", err);
  }

  next();
};

export default auth;
