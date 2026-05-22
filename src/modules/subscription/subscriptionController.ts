import { HTTP_STATUS, MESSAGES } from "../../core/utils/constants";
import { errorResponse, successResponse } from "../../core/utils/responseFormatter";
import { AuthRequest } from "../../interface/auth";
import { Response, NextFunction } from "express";
import { findUserByEmail } from "../auth/authRepository";
import { error } from "../../core/utils/logger";
import { getAllPlansWithDetailService, updatePlanDetailService } from "./subscriptionRepository";

/**
 * Retrieve all subscription plans with their details.
 *
 * This controller:
 * 1. Validates the authenticated user.
 * 2. Verifies the user exists in the database.
 * 3. Fetches all subscription plans with detailed information.
 * 4. Returns the retrieved plans or appropriate error responses.
 *
 * @async
 * @function getAllPlanswithDetails
 *
 * @param {AuthRequest} req - Express request object containing
 * authenticated user information in `req.user`.
 *
 * @param {Response} res - Express response object used
 * to send API responses.
 *
 * @param {NextFunction} next - Express middleware next function.
 *
 * @returns {Promise<void>} Resolves when the response is sent.
 *
 * @throws Will return:
 * - 401 if the request is unauthorized
 * - 404 if the user is not found
 * - 500 if fetching subscription plans fails
 */
export const getAllPlanswithDetails = async (req: AuthRequest, res: Response, next: NextFunction):Promise<void> => {

    const userPayload = req.user as { userEmail?: string } | undefined;

    if (!userPayload?.userEmail) {
        res
            .status(HTTP_STATUS.UNAUTHORIZED)
            .json(errorResponse("Unauthorized request"));
        return;
    }

    try {
        const user = await findUserByEmail(userPayload.userEmail);
        if (!user) {
            await error("Profile retrieval failed - User not found", {
                email: userPayload.userEmail,
                action: "getCurrentUserProfile",
                req,
            });
            res
                .status(HTTP_STATUS.NOT_FOUND)
                .json(errorResponse(MESSAGES.PROFILE_USER_NOTFOUND));
            return;
        }
        // Placeholder for actual subscription plan retrieval logic

        const subscriptionPlans = await getAllPlansWithDetailService();
        if (!subscriptionPlans.success) {
            res
                .status(HTTP_STATUS.INTERNAL_SERVER_ERROR)
                .json(errorResponse(subscriptionPlans.message || "Failed to fetch subscription plans"));
            return;
        }
        res
            .status(HTTP_STATUS.OK)
            .json(successResponse(subscriptionPlans.data, "Subscription plans retrieved successfully"));
    } catch (err) {
        await error("Error fetching subscription plans", {
            email: userPayload.userEmail,
            action: "getAllPlanswithDetails",
            req,
            error: err instanceof Error ? err.message : String(err),
        });
        res
            .status(HTTP_STATUS.INTERNAL_SERVER_ERROR)
            .json(errorResponse("An error occurred while fetching subscription plans"));
    }
    next();
}
/**
 * Update subscription plan details.
 *
 * This controller allows only Admin users to update
 * the details of an existing subscription plan.
 *
 * Flow:
 * 1. Validates authenticated user.
 * 2. Ensures the user has Admin role.
 * 3. Verifies the user exists in the database.
 * 4. Updates the subscription plan using provided data.
 * 5. Returns appropriate success or error responses.
 *
 * @async
 * @function updatePlanDetails
 *
 * @param {AuthRequest} req - Express request object containing:
 * - authenticated user payload (`req.user`)
 * - route params (`req.params.planId`)
 * - request body (`req.body.data`)
 *
 * @param {Response} res - Express response object.
 *
 * @param {NextFunction} next - Express next middleware function.
 *
 * @returns {Promise<void>} Resolves when the response is sent.
 *
 * @throws Will return:
 * - 401 if the request is unauthorized
 * - 403 if the user is not an Admin
 * - 404 if the user is not found
 * - 500 for unexpected server errors
 */
export const updatePlanDetails =async (req:AuthRequest, res:Response, next:NextFunction):Promise<void> => {

    const userPayload = req.user as { userEmail?: string, role?:string } | undefined;

    if (!userPayload?.userEmail) {
        res
            .status(HTTP_STATUS.UNAUTHORIZED)
            .json(errorResponse("Unauthorized request"));
        return;
    }

    if(userPayload.role !== "Admin"){
        res
            .status(HTTP_STATUS.FORBIDDEN)
            .json(errorResponse("Forbidden request - Admins only"));
        return;
    }

    try {
        const user = await findUserByEmail(userPayload.userEmail);
        if (!user) {
            await error("Profile retrieval failed - User not found", {
                email: userPayload.userEmail,
                action: "updatePlanDetails",
                req,
            });
            res
                .status(HTTP_STATUS.NOT_FOUND)
                .json(errorResponse(MESSAGES.PROFILE_USER_NOTFOUND));
            return;
        }
        const { planId } = req.params;
        const{data} = req.body;

        await updatePlanDetailService(planId!, data);
        // Placeholder for actual subscription plan update logic

        res
            .status(HTTP_STATUS.OK)
            .json(successResponse(null, "Subscription plan updated successfully"));
    } catch (err) {
        await error("Error updating subscription plan", {
            email: userPayload.userEmail,
            action: "updatePlanDetails",
            req,
            error: err instanceof Error ? err.message : String(err),

        });
        res
            .status(HTTP_STATUS.INTERNAL_SERVER_ERROR)
            .json(errorResponse("An error occurred while updating subscription plan"));
    }
    next();
}