import { NextFunction, Response } from "express";
import { AuthRequest } from "../../interface/auth";
import { HTTP_STATUS, MESSAGES } from "../../core/utils/constants";
import {
  errorResponse,
  successResponse,
} from "../../core/utils/responseFormatter";
import { checkAndConsumeUsage } from "../../core/utils/planLimits";
import {
  compareUserPlantScan,
  getUserPlantScanById,
  listUserPlantScans,
} from "./plantScanService";

/**
 * GET /api/v1/plant-scans
 * Returns the authenticated user's plant scan history.
 *
 * @param req - Authenticated request
 * @param res - Express response
 * @param next - Error middleware
 */
export const listPlantScansController = async (
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

    const page = Math.max(1, Number(req.query.page) || 1);
    const limit = Math.min(50, Math.max(1, Number(req.query.limit) || 10));

    const result = await listUserPlantScans(userPayload.userId, page, limit);

    res
      .status(HTTP_STATUS.OK)
      .json(successResponse(result, MESSAGES.PLANT_SCANS_FETCHED));
  } catch (err) {
    next(err);
  }
};

/**
 * GET /api/v1/plant-scans/:id
 * Returns full diagnosis details for one of the user's scans.
 *
 * @param req - Authenticated request
 * @param res - Express response
 * @param next - Error middleware
 */
export const getPlantScanByIdController = async (
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

    const scanId = String(req.params.id ?? "");
    const uuidPattern =
      /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    if (!uuidPattern.test(scanId)) {
      res.status(HTTP_STATUS.BAD_REQUEST).json(errorResponse("Invalid scan id"));
      return;
    }

    const scan = await getUserPlantScanById(userPayload.userId, scanId);
    if (!scan) {
      res.status(HTTP_STATUS.NOT_FOUND).json(errorResponse("Scan not found"));
      return;
    }

    res
      .status(HTTP_STATUS.OK)
      .json(successResponse(scan, MESSAGES.PLANT_SCAN_DETAIL_FETCHED));
  } catch (err) {
    next(err);
  }
};

/**
 * POST /api/v1/plant-scans/:id/compare
 * Scans a new plant photo, saves it to history, and compares it with the given scan.
 *
 * @param req - Authenticated request
 * @param res - Express response
 * @param next - Error middleware
 */
export const comparePlantScanController = async (
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

    const scanId = String(req.params.id ?? "");
    const uuidPattern =
      /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    if (!uuidPattern.test(scanId)) {
      res.status(HTTP_STATUS.BAD_REQUEST).json(errorResponse("Invalid scan id"));
      return;
    }

    const historyScan = await getUserPlantScanById(userPayload.userId, scanId);
    if (!historyScan) {
      res.status(HTTP_STATUS.NOT_FOUND).json(errorResponse("Scan not found"));
      return;
    }

    const usage = await checkAndConsumeUsage(userPayload.userId, "diagnosis");
    if (!usage.allowed) {
      res
        .status(HTTP_STATUS.FORBIDDEN)
        .json(
          errorResponse(
            `Monthly diagnosis scan limit reached (${usage.limit}). Upgrade your plan to continue.`
          )
        );
      return;
    }

    const body = req.body as {
      image_base64?: string;
      latitude?: number;
      longitude?: number;
    };

    const plants = await compareUserPlantScan({
      userId: userPayload.userId,
      historyScanId: scanId,
      imageBase64: body.image_base64 ?? "",
      ...(typeof body.latitude === "number" ? { latitude: body.latitude } : {}),
      ...(typeof body.longitude === "number" ? { longitude: body.longitude } : {}),
    });

    if (!plants) {
      res.status(HTTP_STATUS.NOT_FOUND).json(errorResponse("Scan not found"));
      return;
    }

    res
      .status(HTTP_STATUS.OK)
      .json(successResponse({ plants }, MESSAGES.PLANT_SCAN_COMPARED));
  } catch (err) {
    next(err);
  }
};
