import { NextFunction, Response } from "express";
import { HTTP_STATUS } from "../../core/utils/constants";
import { errorResponse, successResponse } from "../../core/utils/responseFormatter";
import { AuthRequest } from "../../interface/auth";
import { AuthUserPayload } from "../../interface/user";
import { findUserById } from "../auth/authRepository";
import {
  getMissedNotificationsService,
  markMissedNotificationCompleteService,
} from "./missedNotificationService";

/**
 * Resolves the authenticated user from JWT payload.
 *
 * @param {AuthRequest} req - Express request with auth payload.
 * @param {Response} res - Express response object.
 * @returns {Promise<any | null>} User object when found, otherwise null.
 */
async function resolveUser(req: AuthRequest, res: Response): Promise<any | null> { //eslint-disable-line @typescript-eslint/no-explicit-any
  const userPayload = req.user as AuthUserPayload | undefined;
  if (!userPayload?.userId) {
    res.status(HTTP_STATUS.UNAUTHORIZED).json(errorResponse("Unauthorized"));
    return null;
  }

  const user = await findUserById(userPayload.userId);
  if (!user) {
    res.status(HTTP_STATUS.UNAUTHORIZED).json(errorResponse("User not found"));
    return null;
  }

  return user;
}

/**
 * Returns paginated missed notifications for the authenticated user.
 *
 * @param {AuthRequest} req - Express request object.
 * @param {Response} res - Express response object.
 * @param {NextFunction} next - Express next middleware.
 * @returns {Promise<void>} Sends JSON response.
 */
export const getMissedNotificationsController = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const user = await resolveUser(req, res);
    if (!user) return;

    const page = Math.max(1, parseInt((req.query.page as string) ?? "1", 10) || 1);
    const limit = Math.min(100, Math.max(1, parseInt((req.query.limit as string) ?? "20", 10) || 20));

    const data = await getMissedNotificationsService(user.id!, page, limit);

    res.status(HTTP_STATUS.OK).json(
      successResponse(data, "Missed notifications retrieved successfully")
    );
  } catch (err) {
    if (err instanceof Error) {
      res.status(HTTP_STATUS.BAD_REQUEST).json(errorResponse(err.message));
      return;
    }
    next(err);
  }
};

/**
 * Marks one missed notification as complete for the authenticated user.
 *
 * @param {AuthRequest} req - Express request object.
 * @param {Response} res - Express response object.
 * @param {NextFunction} next - Express next middleware.
 * @returns {Promise<void>} Sends JSON response.
 */
export const markMissedNotificationCompleteController = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const user = await resolveUser(req, res);
    if (!user) return;

    const { missedNotificationId } = req.params;
    if (!missedNotificationId) {
      res.status(HTTP_STATUS.BAD_REQUEST).json(errorResponse("missedNotificationId is required"));
      return;
    }

    await markMissedNotificationCompleteService(user.id!, missedNotificationId);

    res.status(HTTP_STATUS.OK).json(
      successResponse(null, "Missed notification marked as completed successfully")
    );
  } catch (err) {
    if (err instanceof Error) {
      res.status(HTTP_STATUS.BAD_REQUEST).json(errorResponse(err.message));
      return;
    }
    next(err);
  }
};
