import { AuthRequest } from "../../interface/auth";
import { Response, NextFunction } from "express";
import { processDesign, processDesignWithLocation, processDesignWithSurvey } from "./landScapeDesignService";
import { checkAndConsumeUsage } from "../../core/utils/planLimits";
import { HTTP_STATUS } from "../../core/utils/constants";
import { errorResponse } from "../../core/utils/responseFormatter";


/**
 * Controller to generate a landscape design from an uploaded image.
 *
 * This endpoint:
 * 1. Validates the presence of a base64 image in the request body
 * 2. Passes the image and user preferences to the design processing pipeline
 * 3. Returns the generated garden/landscape design result
 *
 * @route POST /landscape/design
 *
 * @param {AuthRequest} req - Express request object (authenticated)
 * @param {string} req.body.image_base64 - Base64 encoded input image
 *
 * @param {Response} res - Express response object
 * @param {NextFunction} next - Express next middleware function
 *
 * @returns {Promise<void>} Sends JSON response:
 *  - success {boolean}
 *  - message {string}
 *  - data {DesignResult} Generated landscape design output
 *
 * @throws Returns 400 if image is missing
 * @throws Returns 500 if processing fails
 */
export const getLandScapeDesign = async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
    const userPayload = req.user as { userId: string }; // Assuming userId is stored in the JWT payload
    try {
        const { image_base64 } = req.body as {
            image_base64?: string;
        };
        if (!image_base64) {
            res.status(400).json({
                success: false,
                message: "Image is required for landscape design",
            });
            return;
        }
       const usage = await checkAndConsumeUsage(userPayload.userId, "landscape");

        if (!usage.allowed) {
            res
                .status(HTTP_STATUS.FORBIDDEN)
                .json(
                    errorResponse(
                        `Monthly landscape generation limit reached (${usage.limit}). Upgrade your plan to continue.`
                    )
                );
            return;
        }

        const result = await processDesign({
            image_base64,
            userId: userPayload.userId,
        });

        res.status(200).json({
            success: true,
            message: "Landscape design generated successfully",
            data: result, // <-- Return the design result here
            // In a real implementation, you would return the designed landscape data here
        });
        return;
    } catch (error) {
        console.error("Error generating landscape design:", error);

        next(error);
    }
};

/**
 * Controller to generate a location-aware landscape design.
 *
 * This endpoint runs a single combined pipeline that:
 * 1. Detects the space type from the uploaded image
 * 2. Describes the scene using a vision model
 * 3. Looks up native / climate-appropriate plants for the given GPS coordinates
 * 4. Generates a design plan grounded in scene + local plant data
 * 5. Inpaints the final garden image
 *
 * @route POST /landscape/with-location
 *
 * @param {AuthRequest} req - Express request (authenticated)
 * @param {Response} res - Express response
 * @param {NextFunction} next - Express next middleware handler
 *
 * @returns {Promise<void>} Sends a JSON response with `{ success, message, data }`.
 */
export const getLandScapeDesignWithLocation = async (
    req: AuthRequest,
    res: Response,
    next: NextFunction
): Promise<void> => {
    const userPayload = req.user as { userId: string };

    try {
        const { image_base64, latitude, longitude } = req.body as {
            image_base64?: string;
            latitude?: unknown;
            longitude?: unknown;
        };

        if (!image_base64) {
            res.status(HTTP_STATUS.BAD_REQUEST).json(
                errorResponse("image_base64 is required")
            );
            return;
        }

        const lat = Number(latitude);
        const lng = Number(longitude);

        if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
            res.status(HTTP_STATUS.BAD_REQUEST).json(
                errorResponse("Valid latitude and longitude are required")
            );
            return;
        }

        if (lat < -90 || lat > 90 || lng < -180 || lng > 180) {
            res.status(HTTP_STATUS.BAD_REQUEST).json(
                errorResponse("latitude must be -90…90, longitude must be -180…180")
            );
            return;
        }

        const usage = await checkAndConsumeUsage(userPayload.userId, "landscape");
        if (!usage.allowed) {
            res.status(HTTP_STATUS.FORBIDDEN).json(
                errorResponse(
                    `Monthly landscape generation limit reached (${usage.limit}). Upgrade your plan to continue.`
                )
            );
            return;
        }

        const result = await processDesignWithLocation({
            image_base64,
            latitude: lat,
            longitude: lng,
            userId: userPayload.userId,
        });

        res.status(HTTP_STATUS.OK).json({
            success: true,
            message: "Location-aware landscape design generated successfully",
            data: result,
        });
    } catch (error) {
        console.error("Error generating location-aware landscape design:", error);
        next(error);
    }
};

/**
 * Controller to generate a survey-based landscape design.
 *
 * Loads the user's onboarding answers, recommends plants from those answers,
 * then generates a garden image. GPS is not used.
 *
 * @param {AuthRequest} req - Express request (authenticated)
 * @param {Response} res - Express response
 * @param {NextFunction} next - Express next middleware handler
 * @returns {Promise<void>} Sends a JSON response with `{ success, message, data }`.
 */
export const getLandScapeDesignWithSurvey = async (
    req: AuthRequest,
    res: Response,
    next: NextFunction
): Promise<void> => {
    const userPayload = req.user as { userId: string };

    try {
        const { image_base64, responseId } = req.body as {
            image_base64?: string;
            responseId?: string;
        };

        if (!image_base64) {
            res.status(HTTP_STATUS.BAD_REQUEST).json(
                errorResponse("image_base64 is required")
            );
            return;
        }

        const usage = await checkAndConsumeUsage(userPayload.userId, "landscape");
        if (!usage.allowed) {
            res.status(HTTP_STATUS.FORBIDDEN).json(
                errorResponse(
                    `Monthly landscape generation limit reached (${usage.limit}). Upgrade your plan to continue.`
                )
            );
            return;
        }

        const result = await processDesignWithSurvey({
            image_base64,
            userId: userPayload.userId,
            ...(typeof responseId === "string" && responseId.trim()
                ? { responseId: responseId.trim() }
                : {}),
        });

        res.status(HTTP_STATUS.OK).json({
            success: true,
            message: "Survey-based landscape design generated successfully",
            data: result,
        });
    } catch (error) {
        const message = error instanceof Error ? error.message : "Unknown error";
        if (message.includes("No onboarding survey answers")) {
            res.status(HTTP_STATUS.BAD_REQUEST).json(errorResponse(message));
            return;
        }
        console.error("Error generating survey-based landscape design:", error);
        next(error);
    }
};
