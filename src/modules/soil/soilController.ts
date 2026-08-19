import { Response, NextFunction } from "express";
import { AuthRequest } from "../../interface/auth";
import { HTTP_STATUS } from "../../core/utils/constants";
import {
  errorResponse,
  successResponse,
} from "../../core/utils/responseFormatter";
import { findCoordinatesByUserId, saveUserCoordinates } from "./soilModel";
import { classifySoilType } from "./soilService";

/**
 * POST /api/v1/soil/type
 * Returns soil type (organic | salt | clay | sand) for coordinates.
 * Saves lat/long when provided; otherwise uses the user's last saved coordinates.
 *
 * @param {AuthRequest} req - Authenticated request with optional lat/long body.
 * @param {Response} res - Express response.
 * @param {NextFunction} next - Error middleware.
 * @returns {Promise<void>} Sends soil type JSON.
 */
export const getSoilType = async (
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

    const bodyLat = (req.body?.latitude ?? req.body?.lat) as number | undefined;
    const bodyLng = (req.body?.longitude ?? req.body?.long ?? req.body?.lng) as
      | number
      | undefined;

    let latitude = bodyLat;
    let longitude = bodyLng;
    let source: "request" | "saved" = "request";

    if (latitude === undefined || longitude === undefined) {
      const saved = await findCoordinatesByUserId(userPayload.userId);
      if (!saved) {
        res
          .status(HTTP_STATUS.BAD_REQUEST)
          .json(
            errorResponse(
              "No coordinates provided and no saved location found for this user"
            )
          );
        return;
      }
      latitude = Number(saved.latitude);
      longitude = Number(saved.longitude);
      source = "saved";
    }

    const soilType = await classifySoilType(latitude, longitude);
    await saveUserCoordinates({
      userId: userPayload.userId,
      latitude,
      longitude,
      soilType,
    });

    res.status(HTTP_STATUS.OK).json(
      successResponse(
        {
          latitude,
          longitude,
          soilType,
          source,
        },
        "Soil type retrieved successfully"
      )
    );
  } catch (err) {
    next(err);
  }
};
