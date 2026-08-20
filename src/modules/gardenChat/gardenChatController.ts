import { Response, NextFunction } from "express";
import { AuthRequest } from "../../interface/auth";
import { HTTP_STATUS, MESSAGES } from "../../core/utils/constants";
import {
  errorResponse,
  successResponse,
} from "../../core/utils/responseFormatter";
import { isPaidUser } from "../../core/utils/planLimits";
import { getGardenChatHistory, handleGardenChat } from "./gardenChatService";

/**
 * Sends a paid-only rejection for free users.
 *
 * @param res - Express response
 * @returns void
 */
function rejectFreeUser(res: Response): void {
  res.status(HTTP_STATUS.FORBIDDEN).json(
    errorResponse(MESSAGES.GARDEN_CHAT_PAID_ONLY, {
      requiresUpgrade: true,
      isPaid: false,
    })
  );
}

/**
 * POST /api/v1/garden-chat
 * Sends a user message to the gardening chatbot.
 *
 * @param {AuthRequest} req - Authenticated request with message body
 * @param {Response} res - Express response
 * @param {NextFunction} next - Error middleware
 * @returns {Promise<void>} Chat reply JSON
 */
export const sendGardenChat = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const userPayload = req.user as { userId?: string } | undefined;
    if (!userPayload?.userId) {
      res.status(HTTP_STATUS.UNAUTHORIZED).json(errorResponse("Unauthorized"));
      return;
    }

    const paid = await isPaidUser(userPayload.userId);
    if (!paid) {
      rejectFreeUser(res);
      return;
    }

    const { message, image_base64, conversationId } = req.body as {
      message?: string;
      image_base64?: string;
      conversationId?: string;
    };

    const result = await handleGardenChat({
      userId: userPayload.userId,
      ...(typeof message === "string" ? { message } : {}),
      ...(typeof image_base64 === "string" ? { imageBase64: image_base64 } : {}),
      ...(conversationId ? { conversationId } : {}),
    });

    const successMessage = result.isGardeningRelated
      ? MESSAGES.GARDEN_CHAT_REPLY
      : MESSAGES.GARDEN_CHAT_NOT_RELATED;

    res
      .status(HTTP_STATUS.OK)
      .json(successResponse(result, successMessage));
  } catch (err) {
    next(err);
  }
};

/**
 * GET /api/v1/garden-chat/history
 * Returns the last garden chat messages for the user.
 *
 * @param {AuthRequest} req - Authenticated request
 * @param {Response} res - Express response
 * @param {NextFunction} next - Error middleware
 * @returns {Promise<void>} History JSON
 */
export const listGardenChatHistory = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const userPayload = req.user as { userId?: string } | undefined;
    if (!userPayload?.userId) {
      res.status(HTTP_STATUS.UNAUTHORIZED).json(errorResponse("Unauthorized"));
      return;
    }

    const paid = await isPaidUser(userPayload.userId);
    if (!paid) {
      rejectFreeUser(res);
      return;
    }

    const conversationId =
      typeof req.query.conversationId === "string"
        ? req.query.conversationId
        : undefined;
    const page =
      typeof req.query.page === "string" ? Number(req.query.page) : undefined;
    const limit =
      typeof req.query.limit === "string" ? Number(req.query.limit) : undefined;

    const result = await getGardenChatHistory({
      userId: userPayload.userId,
      ...(conversationId ? { conversationId } : {}),
      ...(page !== undefined && Number.isFinite(page) ? { page } : {}),
      ...(limit !== undefined && Number.isFinite(limit) ? { limit } : {}),
    });

    res
      .status(HTTP_STATUS.OK)
      .json(successResponse(result, MESSAGES.GARDEN_CHAT_HISTORY));
  } catch (err) {
    next(err);
  }
};
