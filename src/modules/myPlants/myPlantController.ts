import { NextFunction, RequestHandler, Response } from "express";
import { AuthRequest } from "../../interface/auth";
import { AuthUserPayload } from "../../interface/user";
import { errorResponse, successResponse } from "../../core/utils/responseFormatter";
import { HTTP_STATUS } from "../../core/utils/constants";
import { findUserByEmail } from "../auth/authRepository";
import { addPlantToUserService, 
    deleteUserPlantService, 
    getAllPlantsAdminService, 
    getAllPlantsService, 
     
    getNotificationsService, 
    getUserPlantByIdService, 
    getUserPlantsService, 
    importPlantsService,
    mapFlatToNested,
    updateUserPlantService, 
 } from "./myPlantServices";
import { ZodError } from "zod";
import { getPlantDetailsByIdService } from "./myPlantServices";
import { FlatUpdateUserPlantInput } from "../../interface/myPlants";


/**
 * Retrieves a paginated list of all plants.
 *
 * Requires authenticated user with role "User".
 *
 * Query Parameters:
 * - page (optional): Page number (default: 1)
 * - limit (optional): Items per page (default: 10)
 *
 * @param {AuthRequest} req - Express request object containing auth payload and query params.
 * @param {Response} res - Express response object.
 * @param {NextFunction} next - Express next middleware function.
 * @returns {Promise<void>} Sends paginated plant list response.
 */
export const getAllPlants = async (
    req: AuthRequest,
    res: Response,
    next: NextFunction
): Promise<void> => {
    const userPayload = req.user as AuthUserPayload | undefined;
    if (!userPayload?.userEmail) {
        res.status(HTTP_STATUS.UNAUTHORIZED).json(errorResponse("Unauthorized"));
        return;
    }

    const user = await findUserByEmail(userPayload.userEmail);
    if (!user) {
        res.status(HTTP_STATUS.UNAUTHORIZED).json(errorResponse("User not found"));
        return;
    }
    if (userPayload.role !== "User") {
        res.status(HTTP_STATUS.UNAUTHORIZED).json(errorResponse("Unauthorized Role"));
        return;
    }

    try {
        const page   = parseInt(req.query.page as string) || 1;
        const limit  = parseInt(req.query.limit as string) || 20;
        const search = (req.query.search as string)?.trim() || undefined;
        // const lang   = (req.headers["accept-language"] ?? "en").toLowerCase(); // 

        const data = await getAllPlantsService(page, limit,user.id!, search); // 

        res.status(HTTP_STATUS.OK).json(successResponse(
            data,
            "Plants retrieved successfully"
        ));
    }
    catch (err) {
        if (err instanceof ZodError) {
            res
                .status(HTTP_STATUS.BAD_REQUEST)
                .json(errorResponse("Validation failed", { issues: err.issues }));
            return;
        }
        next(err);
    }
};

/**
 * Retrieves detailed information about a plant by its ID.
 *
 * Requires authenticated user with role "User".
 *
 * Route Parameters:
 * - id: Plant UUID
 *
 * @param {AuthRequest} req - Express request object containing plant ID.
 * @param {Response} res - Express response object.
 * @param {NextFunction} next - Express next middleware function.
 * @returns {Promise<void>} Sends plant details if found.
 */
export const getPlantById = async (
    req: AuthRequest,
    res: Response,
    next: NextFunction
): Promise<void> => {
    const userPayload = req.user as AuthUserPayload | undefined;
    if (!userPayload?.userEmail) {
        res.status(HTTP_STATUS.UNAUTHORIZED).json(errorResponse("Unauthorized"));
        return;
    }
    const user = await findUserByEmail(userPayload.userEmail);
    if (!user) {
        res.status(HTTP_STATUS.UNAUTHORIZED).json(errorResponse("User not found"));
        return;
    }
    // if (userPayload.role !== "User") {
    //     res.status(HTTP_STATUS.UNAUTHORIZED).json(errorResponse("Unauthorized Role"));
    //     return;
    // }

    try {
        const plantId = req.params.id;
        if (!plantId) {
            res.status(HTTP_STATUS.BAD_REQUEST).json(errorResponse("Plant ID is required"));
            return;
        }
        if (!user.id) {
            res.status(HTTP_STATUS.UNAUTHORIZED).json(errorResponse("User ID not found"));
            return;
        }
        // const lang = (req.headers["accept-language"] ?? "en").toLowerCase(); // 👈

        const data = await getPlantDetailsByIdService(plantId,user.id); // 👈

        res.status(HTTP_STATUS.OK).json(
            successResponse(data, "Plant details retrieved successfully")
        );
    }
    catch (err) {
        if (err instanceof ZodError) {
            res.status(HTTP_STATUS.BAD_REQUEST).json(
                errorResponse("Validation failed", { issues: err.issues })
            );
            return;
        }

        if (err instanceof Error) {
            res.status(HTTP_STATUS.NOT_FOUND).json(errorResponse(err.message));
            return;
        }

        next(err);
    }
};

/**
 * Adds a plant to the authenticated user's plant list.
 *
 * Requires authenticated user with role "User".
 *
 * Route Parameters:
 * - id: Plant UUID to be added
 *
 * @param {AuthRequest} req - Express request object containing plant ID.
 * @param {Response} res - Express response object.
 * @param {NextFunction} next - Express next middleware function.
 * @returns {Promise<void>} Sends confirmation response after successful addition.
 */
export const AddPlantToUser = async (
    req: AuthRequest,
    res: Response,
    next: NextFunction
): Promise<void> => {
 
    // ── 1. Auth checks ────────────────────────────────────────────────────────
    const userPayload = req.user as AuthUserPayload | undefined;
 
    if (!userPayload?.userEmail) {
        res.status(HTTP_STATUS.UNAUTHORIZED).json(errorResponse("Unauthorized"));
        return;
    }
 
    if (userPayload.role !== "User") {
        res.status(HTTP_STATUS.UNAUTHORIZED).json(errorResponse("Unauthorized Role"));
        return;
    }
 
    const user = await findUserByEmail(userPayload.userEmail);
    if (!user) {
        res.status(HTTP_STATUS.NOT_FOUND).json(errorResponse("User not found"));
        return;
    }
 
    // ── 2. Validate required field ────────────────────────────────────────────
    const { plant_id } = req.body;
 
    if (!plant_id) {
        res.status(HTTP_STATUS.BAD_REQUEST).json(errorResponse("plant_id is required"));
        return;
    }
 
    // ── 3. Call service ───────────────────────────────────────────────────────
    try {
        const data = await addPlantToUserService(user.id!, req.body);
 
        res.status(HTTP_STATUS.CREATED).json(
            successResponse(data, "Plant added successfully")
        );
 
    } catch (err) {
        if (err instanceof Error) {
            const knownErrors: Record<string, number> = {
                "Plant species not found":  HTTP_STATUS.NOT_FOUND,
                "Plant already added to user": HTTP_STATUS.CONFLICT,
            };
 
            const statusCode = knownErrors[err.message] ?? HTTP_STATUS.BAD_REQUEST;
            res.status(statusCode).json(errorResponse(err.message));
            return;
        }
 
        next(err);
    }
};
/**
 * Retrieves all plants associated with the authenticated user.
 *
 * Requires authenticated user with role "User".
 *
 * @param {AuthRequest} req - Express request object containing auth payload.
 * @param {Response} res - Express response object.
 * @param {NextFunction} next - Express next middleware function.
 * @returns {Promise<void>} Sends user's plant list.
 */
export const getAllUserPlants = async (
    req: AuthRequest,
    res: Response,
    next: NextFunction
): Promise<void> => {

    // ── 1. Auth Checks ────────────────────────────────────────────────────────
    const userPayload = req.user as AuthUserPayload | undefined;

    if (!userPayload?.userEmail) {
        res.status(HTTP_STATUS.UNAUTHORIZED).json(errorResponse("Unauthorized"));
        return;
    }

    if (userPayload.role !== "User") {
        res.status(HTTP_STATUS.UNAUTHORIZED).json(errorResponse("Unauthorized Role"));
        return;
    }

    const user = await findUserByEmail(userPayload.userEmail);
    if (!user) {
        res.status(HTTP_STATUS.NOT_FOUND).json(errorResponse("User not found"));
        return;
    }

    // ── 2. Call Service ───────────────────────────────────────────────────────
    try {
        const page = parseInt(req.query.page as string) || 1;
        const limit = parseInt(req.query.limit as string) || 20;
        const search = (req.query.search as string)?.trim() || undefined;
        //  const lang   = (req.headers["accept-language"] ?? "en").toLowerCase(); 

        const data = await getUserPlantsService(user.id!, page, limit, search);

        res.status(HTTP_STATUS.OK).json(
            successResponse(data, "User plants retrieved successfully")
        );

    } catch (err) {
        if (err instanceof Error) {
            res.status(HTTP_STATUS.BAD_REQUEST).json(
                errorResponse(err.message)
            );
            return;
        }
        next(err);
    }
};


/**
 * Controller to retrieve a specific plant belonging to an authenticated user.
 *
 * @async
 * @function getUserPlantById
 *
 * @param {AuthRequest} req  Express request object extended with authenticated user payload.
 * @param {Response} res  Express response object used to send back HTTP responses.
 * @param {NextFunction} next  Express next middleware function for error handling.
 *
 * @returns {Promise<void>} Returns a JSON response with plant data if found.
 *
 * @throws {401} If user is not authenticated or does not have the "User" role.
 * @throws {404} If the user or plant is not found.
 * @throws {400} If plant ID is missing or if a service error occurs.
 *
 * @description
 * This endpoint:
 * 1. Validates authenticated user from JWT payload.
 * 2. Ensures the role is strictly "User".
 * * 3. Fetches the user record using email.
 * 4. Validates the plant ID from route parameters.
 * 5. Calls the service layer to fetch the plant belonging to the user.
 * 6. Returns standardized success or error responses.
 */
export const getUserPlantById = async (
    req: AuthRequest,
    res: Response,
    next: NextFunction
): Promise<void> => {

    // ── 1. Auth ───────────────────────────────────────────────────────────────
    const userPayload = req.user as AuthUserPayload | undefined;

    if (!userPayload?.userEmail) {
        res.status(HTTP_STATUS.UNAUTHORIZED).json(errorResponse("Unauthorized"));
        return;
    }

    if (userPayload.role !== "User") {
        res.status(HTTP_STATUS.UNAUTHORIZED).json(errorResponse("Unauthorized Role"));
        return;
    }

    const user = await findUserByEmail(userPayload.userEmail);
    if (!user) {
        res.status(HTTP_STATUS.NOT_FOUND).json(errorResponse("User not found"));
        return;
    }

    // ── 2. Param validation ───────────────────────────────────────────────────
    // ── 2. Param validation ───────────────────────────────────────────────────
    if (!req.params.id) {
        res.status(HTTP_STATUS.BAD_REQUEST).json(errorResponse("Plant ID is required"));
        return;
    }
    
    // ── 3. Service ────────────────────────────────────────────────────────────
    try {
        const plant = await getUserPlantByIdService(user.id!, req.params.id);

        if (!plant) {
            res.status(HTTP_STATUS.NOT_FOUND).json(errorResponse("Plant not found"));
            return;
        }

        res.status(HTTP_STATUS.OK).json(
            successResponse(plant, "Plant retrieved successfully")
        );
    } catch (err) {
        next(err);
    }
};


/**
 * Controller to update notification settings for a user's plant.
 *
 * This endpoint allows partial updates for one or more care types (watering, fertilizer, pruning, generic care)
 * for a specific user's plant. Only the care types included in the request body are updated. 
 *
 * **Behavior:**
 * - If `notification_enabled` is `true` for a care type, `preferred_time` and `reminder_frequency` are required.
 * - If `notification_enabled` is `false`, the `reminder_frequency` is preserved, `preferred_time` may be ignored,
 *   and `next_*_at` is not reset.
 *
 * @param {AuthRequest} req - Express request object, must contain:
 *   - `req.user` with authenticated user's payload
 *   - `req.params.userPlantId` UUID of the user_plant record
 *   - `req.body` partial object containing any of the care types to update
 * @param {Response} res - Express response object
 * 
 * @returns {Promise<void>} - Sends JSON response with:
 *   - 200: Updated plant notification settings
 *   - 400: Missing userPlantId or invalid payload
 *   - 401: Unauthorized (no user or invalid token)
 *   - 404: User not found
 *   - 500: Internal server error
 *
 * @example
 * // PATCH /updatePlant/123e4567-e89b-12d3-a456-426614174000
 * // Request body:
 * {
 *   "watering": {
 *     "notification_enabled": true,
 *     "preferred_time": "08:00:00",
 *     "reminder_frequency": 3
 *   },
 *   "pruning": {
 *     "notification_enabled": false
 *   }
 * }
 *
 * // Response (200):
 * {
 *   "message": "Plant notifications updated successfully",
 *   "data": {
 *     "id": "123e4567-e89b-12d3-a456-426614174000",
 *     "user_id": "d4e5f6a1-b2c3-4567-89ab-cdef01234567",
 *     "plant_id": 42,
 *     "watering_notification_enabled": true,
 *     "watering_preferred_time": "08:00:00",
 *     "watering_reminder_frequency": 3,
 *     "next_watered_at": "2026-03-19T08:00:00.000Z",
 *     ...
 *   }
 * }
 */
export const updateUserPlantController = async (
    req: AuthRequest,
    res: Response
): Promise<void> => {
    try {
        const userPayload = req.user as AuthUserPayload | undefined;
        const userPlantId = req.params.userPlantId;
 
        if (!userPlantId) {
            res.status(400).json({ message: "Plant ID is required" });
            return;
        }
 
        if (!userPayload?.userEmail) {
            res.status(401).json({ message: "Unauthorized" });
            return;
        }
 
        const user = await findUserByEmail(userPayload.userEmail);
        if (!user) {
            res.status(404).json({ message: "User not found" });
            return;
        }
 
        const nestedPayload = mapFlatToNested(req.body as FlatUpdateUserPlantInput);
 
        const updated = await updateUserPlantService(user.id!, userPlantId, nestedPayload);
 
        res.status(200).json(successResponse(updated, "Plant notifications updated successfully"));
    } catch (err) {
        if (err instanceof Error) {
            const knownErrors: Record<string, number> = {
                "Plant not found for this user": 404,
            };
            const statusCode = knownErrors[err.message] ?? 400;
            res.status(statusCode).json({ message: err.message });
        } else {
            res.status(500).json({ message: "Internal server error" });
        }
    }
};
/**
 * Imports plant data from an uploaded CSV file.
 *
 * Expects a multipart/form-data request with a file field named `file`.
 * The uploaded CSV is processed by the importPlantsService.
 *
 * @async
 * @function importPlantsController
 * @param {Request} req - Express request object containing uploaded file.
 * @param {Response} res - Express response object.
 * @returns {Promise<void>} Sends a JSON response with import result.
 *
 * @throws {500} Returns error response if import fails.
 */
export const importPlantsController: RequestHandler = async (req, res): Promise<void> => {
  if (!req.file) {
    res.status(400).json({
      success: false,
      message: "No file uploaded. Send a CSV via multipart/form-data field 'file'.",
    });
    return;
  }
 
  try {
    const result = await importPlantsService(req.file.path); // blocks until done
 
    res.status(200).json({
      success: true,
      ...result,
    });
  } catch (err) {
    if (err instanceof Error) {
            res.status(400).json({ message: err.message });
        } else {
            res.status(500).json({ message: "Internal server error" });
        }
  }
};

/**
 * Retrieves all plants for admin users with pagination and optional search.
 *
 * Access Control:
 * - Requires authenticated user
 * - Requires user role to be "Admin"
 *
 * Query Parameters:
 * @param req.query.page   Page number for pagination (default: 1)
 * @param req.query.limit  Number of items per page (default: 10)
 * @param req.query.search Optional search keyword
 *
 * Responses:
 * - 200: Plants retrieved successfully
 * - 400: Validation failed
 * - 401: Unauthorized or user not found
 * - 403: Unauthorized role
 * - 500: Internal server error
 *
 * @param req Express authenticated request object
 * @param res Express response object
 * @param next Express next middleware function
 *
 * @returns Promise<void>
 */
export const getAllPlantsAdmin = async (
    req:AuthRequest,
    res:Response,
    next:NextFunction
):Promise<void> => {
    const userPayload = req.user as AuthUserPayload | undefined;
    if (!userPayload?.userEmail) {
        res.status(HTTP_STATUS.UNAUTHORIZED).json(errorResponse("Unauthorized"));
        return;
    }
    const user = await findUserByEmail(userPayload.userEmail);
    if (!user) {
        res.status(HTTP_STATUS.UNAUTHORIZED).json(errorResponse("User not found"));
        return;
    }
    if (userPayload.role !== "Admin") {
        res.status(HTTP_STATUS.UNAUTHORIZED).json(errorResponse("Unauthorized Role"));
        return;
    }

    try {
        const page   = parseInt(req.query.page as string) || 1;
        const limit  = parseInt(req.query.limit as string) || 5;
        // const search = (req.query.search as string)?.trim() || undefined;
        const data = await getAllPlantsAdminService(page, limit);
        res.status(HTTP_STATUS.OK).json(successResponse(
            data,
            "Plants retrieved successfully"
        ));
    }
    catch (err) {
        if (err instanceof ZodError) {
            res 
                .status(HTTP_STATUS.BAD_REQUEST)
                .json(errorResponse("Validation failed", { issues: err.issues }));
            return;
        }

        res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json(
            errorResponse("Something went wrong", {
                details: (err as Error).message,
            })
        );
        next(err);
    }
};

/**
 * Deletes a user's plant by its ID.
 *
 * This controller:
 * - Validates the authenticated user
 * - Ensures the user exists
 * - Verifies the user role is "User"
 * - Validates the `userPlantId` route parameter
 * - Calls the service to delete the plant
 *
 * @async
 * @function deleteUserPlantController
 *
 * @param {AuthRequest} req - Express request object containing authenticated user data and route params.
 * @param {Response} res - Express response object used to send API responses.
 * @param {NextFunction} next - Express next middleware function.
 *
 * @returns {Promise<void>} Returns a JSON response with success or error details.
 *
 * @throws {Error} Returns a BAD_REQUEST response if deletion fails with a known error.
 */
export const deleteUserPlantController= async (
    req: AuthRequest,
    res: Response,
    next: NextFunction
): Promise<void> => {
    const userPayload = req.user as AuthUserPayload | undefined;
    if (!userPayload?.userEmail) {
        res.status(HTTP_STATUS.UNAUTHORIZED).json(errorResponse("Unauthorized"));
        return;
    }
    const user = await findUserByEmail(userPayload.userEmail);

    if (!user) {
        res.status(HTTP_STATUS.UNAUTHORIZED).json(errorResponse("User not found"));
        return;
    }
    if (userPayload.role !== "User") {
        res.status(HTTP_STATUS.UNAUTHORIZED).json(errorResponse("Unauthorized Role"));
        return;
    }

    try {
        const userPlantId = req.params.userPlantId;
        if (!userPlantId) {
            res.status(HTTP_STATUS.BAD_REQUEST).json(errorResponse("User Plant ID is required"));
            return;
        }
        await deleteUserPlantService(user.id!, userPlantId);
        res.status(HTTP_STATUS.OK).json(successResponse(
            null,
            "Plant deleted successfully"
        ));
    }
    catch (err) {
        if (err instanceof Error) {
            res.status(HTTP_STATUS.BAD_REQUEST).json(errorResponse(err.message));
            return;
        }
        res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json(
            errorResponse("Something went wrong", {
                details: (err as Error).message,
            })
        );
        next(err);
    }
};


/**
 * Retrieves notification details for the authenticated user.
 *
 * @param req - Express request object containing user authentication data and params.
 * @param res - Express response object.
 * @param next - Express next middleware function.
 * @returns Promise<void>
 */
export const getNotificationsController = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const userPayload = req.user as AuthUserPayload | undefined;
    if (!userPayload?.userEmail) {
      res.status(HTTP_STATUS.UNAUTHORIZED).json(errorResponse("Unauthorized"));
      return;
    }
 
    const user = await findUserByEmail(userPayload.userEmail);
    if (!user) {
      res.status(HTTP_STATUS.UNAUTHORIZED).json(errorResponse("User not found"));
      return;
    }
 
    const activityType = (req.params.activityType as string).trim().toLowerCase();
    const eventType = (req.params.eventType as string).trim().toLowerCase();
 
    // "all" → null so the service returns every type / every event
    const resolvedActivity = activityType === "all" ? null : activityType;
    const resolvedEvent = eventType === "all" ? null : eventType;
 
    const data = await getNotificationsService(
      user.id!,
      resolvedActivity,
      resolvedEvent
    );
 
    res.status(HTTP_STATUS.OK).json(
      successResponse(data, "Notifications retrieved successfully")
    );
  } catch (err) {
    if (err instanceof Error) {
      res.status(HTTP_STATUS.BAD_REQUEST).json(errorResponse(err.message));
      return;
    }
    next(err);
  }
};


