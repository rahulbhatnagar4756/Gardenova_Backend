import { Response, NextFunction } from "express";
import { AuthRequest } from "../../interface/auth";
import { HTTP_STATUS } from "../../core/utils/constants";
import {
  errorResponse,
  successResponse,
} from "../../core/utils/responseFormatter";
import {
  completeDailyChallengeService,
  getDailyChallengesService,
  getGamificationSummaryService,
  getPlanQuotaViewService,
} from "./gamificationService";

/**
 * GET /api/v1/gamification/daily-challenges
 * Returns today's personalized daily challenges for the authenticated user.
 * @param req
 * @param res
 * @param next
 */
export const getDailyChallengesController = async (
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

    const [challenges, planQuota] = await Promise.all([
      getDailyChallengesService(userPayload.userId),
      getPlanQuotaViewService(userPayload.userId),
    ]);
    res
      .status(HTTP_STATUS.OK)
      .json(
        successResponse(
          { challenges, planQuota, date: new Date().toISOString() },
          "Daily challenges retrieved successfully"
        )
      );
  } catch (err) {
    next(err);
  }
};

/**
 * GET /api/v1/gamification/me
 * Returns points, streak, and today's challenge completion summary.
 * @param req
 * @param res
 * @param next
 */
export const getGamificationMeController = async (
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

    const [summary, challenges] = await Promise.all([
      getGamificationSummaryService(userPayload.userId),
      getDailyChallengesService(userPayload.userId),
    ]);

    res.status(HTTP_STATUS.OK).json(
      successResponse(
        {
          ...summary,
          dailyChallenges: challenges,
        },
        "Gamification profile retrieved successfully"
      )
    );
  } catch (err) {
    next(err);
  }
};

/**
 * POST /api/v1/gamification/daily-challenges/:challengeId/complete
 * Marks a daily challenge activity as complete and awards points.
 * @param req
 * @param res
 * @param next
 */
export const completeDailyChallengeController = async (
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

    const challengeId = req.params.challengeId as string;
    const result = await completeDailyChallengeService(
      userPayload.userId,
      challengeId
    );

    const message = result.alreadyCompleted
      ? "Challenge already completed"
      : "Challenge marked as complete";

    res.status(HTTP_STATUS.OK).json(successResponse(result, message));
  } catch (err) {
    if (err instanceof Error) {
      const known: Record<string, number> = {
        "Challenge not found": HTTP_STATUS.NOT_FOUND,
        "Challenge has expired": HTTP_STATUS.BAD_REQUEST,
        "Unable to complete challenge": HTTP_STATUS.BAD_REQUEST,
      };
      const status = known[err.message];
      if (status) {
        res.status(status).json(errorResponse(err.message));
        return;
      }
    }
    next(err);
  }
};
