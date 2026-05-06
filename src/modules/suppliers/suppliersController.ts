import { HTTP_STATUS } from "../../core/utils/constants";
import { errorResponse, successResponse } from "../../core/utils/responseFormatter";
import { AuthRequest, csvUser } from "../../interface/auth";
import { AuthUserPayload } from "../../interface/user";
import { NextFunction, Response } from "express";
import { findUserByEmail } from "../auth/authRepository";
import { createSuppliersService, fetchSortedSuppliers, getAllSuppliersProfilesDb } from "./suppliersRepositry";

/**
 * Controller to import suppliers in bulk from parsed CSV data.
 *
 * This endpoint performs the following steps:
 * 1. Validates the authenticated user's presence using the request payload.
 * 2. Ensures the user exists in the system.
 * 3. Verifies that the user has the `Admin` role.
 * 4. Retrieves supplier data parsed from the CSV file attached to the request.
 * 5. Calls the supplier creation service to register all suppliers in bulk.
 * 6. Returns a success response with the created supplier records.
 *
 * @async
 * @function importSuppliersController
 * @param {AuthRequest} req - Express request object containing authenticated user information and parsed supplier CSV data (`req.professional`).
 * @param {Response} res - Express response object used to send API responses.
 * @param {NextFunction} next - Express next middleware function.
 * @returns {Promise<void>} Resolves when the response is sent.
 *
 * @throws {401} If the user is not authenticated, does not exist, or does not have the Admin role.
 * @throws {400} If no supplier data is found in the request.
 * @throws {500} If an internal error occurs while creating suppliers.
 */
export const importSuppliersController = async (req: AuthRequest, res: Response, next: NextFunction): Promise<void>=> {
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
        res
            .status(HTTP_STATUS.UNAUTHORIZED)
            .json(errorResponse("Unauthorized Role"));
        return;
    }

    try {
        const suppliers = req.professional as csvUser[] | undefined;

        if (!suppliers || suppliers.length === 0) {
            res.status(HTTP_STATUS.BAD_REQUEST).json(
                errorResponse("No suppliers data found")
            );
            return;
        }

        // Register all professionals
        const result = await createSuppliersService(suppliers);

        res.status(HTTP_STATUS.CREATED).json(successResponse(result, "suppliers registered successfully"));
        return;

    }
    catch (error) {
        console.error("Error in creatSuppliers:", error);
        res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json(
            errorResponse(
                "Failed to create professionals",
                {
                    message: error instanceof Error ? error.message : String(error),
                }
            )
        );

    }
    next();

};


/**
 * Controller to retrieve all supplier profiles with pagination.
 *
 * This endpoint performs the following steps:
 * 1. Validates the authenticated user's presence in the request payload.
 * 2. Ensures the user has the `Admin` role.
 * 3. Confirms the user exists in the system.
 * 4. Reads pagination parameters (`page`, `limit`) from the query string.
 * 5. Fetches supplier profiles and total count from the database.
 * 6. Returns paginated supplier data including metadata such as
 *    current page, total pages, total records, and page limit.
 *
 * @async
 * @function getAllSuppliersController
 * @param {AuthRequest} req - Express request object containing authenticated user data and pagination query parameters.
 * @param {Response} res - Express response object used to return the API response.
 * @param {NextFunction} next - Express middleware function for error handling.
 * @returns {Promise<void>} Resolves when the response is sent.
 *
 * @throws {401} If the user is not authenticated, does not exist, or does not have the Admin role.
 * @throws {500} If an unexpected error occurs while retrieving supplier profiles.
 */
export const getAllSuppliersController = async (
    req: AuthRequest,
    res: Response,
    next: NextFunction
): Promise<void> => {
    const userPayload = req.user as AuthUserPayload | undefined;

    if (!userPayload?.userEmail) {
        res.status(HTTP_STATUS.UNAUTHORIZED).json(errorResponse("Unauthorized"));
        return;
    }

    if (userPayload.role !== "Admin") {
        res
            .status(HTTP_STATUS.UNAUTHORIZED)
            .json(errorResponse("Unauthorized Role"));
        return;
    }

    const user = await findUserByEmail(userPayload.userEmail);
    if (!user) {
        res.status(HTTP_STATUS.UNAUTHORIZED).json(errorResponse("User not found"));
        return;
    }

    try {
        // Pagination params
        const page = parseInt(req.query.page as string) || 1;
        const limit = parseInt(req.query.limit as string) || 5;
        const offset = (page - 1) * limit;

        // Fetch paginated professionals + total count
        const { professionals, totalCount } =
            await getAllSuppliersProfilesDb(limit, offset);

        const totalPages = Math.ceil(totalCount / limit);

        res.status(HTTP_STATUS.OK).json(
            successResponse({
                currentPage: page,
                totalPages,
                totalCount,
                limit,
                professionals,
            })
        );
    } catch (err) {
        next(err);
    }
};

/**
 * Controller to retrieve suppliers sorted by proximity to the user's location.
 *
 * This endpoint:
 * 1. Validates the user's latitude and longitude from query parameters.
 * 2. Optionally filters suppliers by category.
 * 3. Applies pagination using `limit` and `offset`.
 * 4. Delegates the sorting and filtering logic to the `fetchSortedSuppliers` service.
 * 5. Returns suppliers sorted by distance from the user.
 *
 * Query Parameters:
 * - `lat` (number, required): User's latitude.
 * - `lng` (number, required): User's longitude.
 * - `category` (string, optional): Supplier category for filtering.
 * - `limit` (number, optional): Maximum number of results to return (default: 50, max: 100).
 * - `offset` (number, optional): Number of records to skip for pagination (default: 0).
 *
 * @async
 * @function getSortedSuppliersController
 * @param {AuthRequest} req - Express request object containing query parameters for location, filtering, and pagination.
 * @param {Response} res - Express response object used to send the API response.
 * @returns {Promise<void>} Resolves when the response is sent.
 *
 * @throws {400} If latitude or longitude is missing or invalid.
 * @throws {500} If an unexpected server error occurs while retrieving suppliers.
 */
export async function getSortedSuppliersController(
    req: AuthRequest,
    res: Response
): Promise<void> {
    try {
        const { lat, lng, category, limit = "50", offset = "0" } = req.query;

        // --- Validate required params ---
        if (!lat || !lng) {
            res.status(400).json({ error: "User location (lat, lng) is required." });
            return;
        }

        const userLat = parseFloat(lat as string);
        const userLng = parseFloat(lng as string);

        if (isNaN(userLat) || isNaN(userLng)) {
            res.status(400).json({ error: "Invalid lat/lng values." });
            return;
        }

        const pageLimit = Math.min(parseInt(limit as string) || 50, 100);
        const pageOffset = parseInt(offset as string) || 0;

        // --- Delegate to service ---
        const result = await fetchSortedSuppliers({
            userLat,
            userLng,
            category: category as string | undefined,
            limit: pageLimit,
            offset: pageOffset,
        });

        res.status(200).json(successResponse(result, "Professionals retrieved successfully"));
    } catch (error: unknown) {
        if (error instanceof Error) {
            console.error("getSortedProfessionals error:", error.message);
            res.status(500).json({ error: error.message });
        } else {
            res.status(500).json({ error: "Unknown server error." });
        }
    }
    
}
