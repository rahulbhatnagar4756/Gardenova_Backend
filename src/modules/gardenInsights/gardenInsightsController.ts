import { NextFunction, Response } from "express";
import { AuthRequest } from "../../interface/auth";
import { HTTP_STATUS, MESSAGES } from "../../core/utils/constants";
import {
  errorResponse,
  successResponse,
} from "../../core/utils/responseFormatter";
import { getGardenInsights } from "./gardenInsightsService";

/**
 * GET /api/v1/garden-insights
 * Returns pie-chart scores for the authenticated user's garden.
 *
 * @param req - Authenticated request
 * @param res - Express response
 * @param next - Error middleware
 * @returns Pie-chart garden insight JSON
 */
export const getGardenInsightsController = async (
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

    const result = await getGardenInsights(userPayload.userId);

    res
      .status(HTTP_STATUS.OK)
      .json(successResponse(result, MESSAGES.GARDEN_INSIGHTS_FETCHED));
  } catch (err) {
    next(err);
  }
};
