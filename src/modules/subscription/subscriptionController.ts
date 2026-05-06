import { NextFunction, Response } from "express";
import { AuthUserPayload } from "../../interface/user";
import { AuthRequest } from "../../interface/auth";
import { HTTP_STATUS } from "../../core/utils/constants";
import { errorResponse, successResponse } from "../../core/utils/responseFormatter";
import { findUserByEmail } from "../auth/authRepository";
import { SubscriptionPlanInput } from "../../interface/subscription";
import { createSubscriptionPlan, getAllSubscriptionPlans, getSubscriptionPlanById, updateSubscriptionPlan, updateSubscriptionPlanStatusById } from "./subscriptionRepository";
import { CustomError } from "../../interface/Error";
import { error } from "../../core/utils/logger";

// src/core/cache/nodeCache.ts
import NodeCache from "node-cache";

export const appCache = new NodeCache({
    stdTTL: 600,        // 10 minutes
    checkperiod: 120,   // cleanup interval
    useClones: false,   // better performance
});
export const CACHE_KEYS = {
    SUBSCRIPTION_PLANS: "subscription_plans",
};


/**
 * Controller to create a new subscription plan.
 * 
 * Only accessible to Admin users. 
 * Validates input, prevents duplicates, enforces max 3 plans, 
 * and only allows the predefined plan names: "Talk", "Gold", "Diamante".
 * Also clears subscription plan cache after creation.
 *
 * @param {AuthRequest} req - Express request object with authenticated user
 * @param {Response} res - Express response object
 * @param {NextFunction} next - Express next function for error handling
 * @returns {Promise<void>} No direct return; sends HTTP response
 *
 * @example
 * POST /api/v1/subscription
 * {
 *   "plan_name": "Gold",
 *   "description": "Best plan for professionals",
 *   "monthly_price": 99,
 *   "annual_price": 1188,
 *   "lead_limit_per_month": 100,
 *   "number_of_regions": 3,
 *   "highlight_in_result": true,
 *   "verification_badge": true,
 *   "status": "active"
 * }
 */
export const CreatePlan = async (
    req: AuthRequest,
    res: Response,
    next: NextFunction
): Promise<void> => {
    const ALLOWED_PLAN_NAMES = ["Silver", "Gold", "Diamante"];

    const userPayload = req.user as AuthUserPayload | undefined;

    if (!userPayload?.userEmail) {
        res.status(HTTP_STATUS.UNAUTHORIZED).json(errorResponse("Unauthorized request"));
        return;
    }

    const user = await findUserByEmail(userPayload.userEmail);
    if (!user) {
        res.status(HTTP_STATUS.UNAUTHORIZED).json(errorResponse("User not found"));
        return;
    }

    if (userPayload.role !== "Admin") {
        res.status(HTTP_STATUS.FORBIDDEN).json(errorResponse("Unauthorized role"));
        return;
    }

    try {
        const requiredFields = [
            "plan_name",
            "description",
            "price_monthly",
            "price_annual",
            "leads_limit",
            "cities_coverage",
            "appear_in_search",
            "premium_profile_badge",
            "priority_customer_support",
            "status"
        ];

        const missingFields = requiredFields.filter((field) => {
            if (field === "leads_limit") {
                return req.body[field] === undefined; // allow null
            }
            return req.body[field] === undefined || req.body[field] === null;
        });

        if (missingFields.length > 0) {
            res.status(HTTP_STATUS.BAD_REQUEST).json(
                errorResponse(`Missing required fields: ${missingFields.join(", ")}`)
            );
            return;
        }

        const plan: SubscriptionPlanInput = req.body;



        // 1️Allowed plan names only
        if (!ALLOWED_PLAN_NAMES.includes(plan.plan_name)) {
            res.status(HTTP_STATUS.BAD_REQUEST).json(
                errorResponse("Invalid plan name. Allowed: Talk, Gold, Diamante")
            );
            return;
        }

        //  Maximum 3 plans only
        const existingPlans = await getAllSubscriptionPlans();
        if (existingPlans.length >= 3) {
            res.status(HTTP_STATUS.BAD_REQUEST).json(
                errorResponse("Maximum number of subscription plans already created")
            );
            return;
        }

        //  Prevent duplicate plan
        const duplicatePlan = existingPlans.find(
            (p) => p.plan_name === plan.plan_name
        );
        if (duplicatePlan) {
            res.status(HTTP_STATUS.CONFLICT).json(
                errorResponse("Subscription plan already exists")
            );
            return;
        }

        // //  Annual price must be monthly × 12
        // const expectedAnnualPrice = plan.monthly_price * 12;
        // if (plan.annual_price !== expectedAnnualPrice) {
        //     res.status(HTTP_STATUS.BAD_REQUEST).json(
        //         errorResponse("Annual price must be monthly price × 12")
        //     );
        //     return;
        // }

        /* ===============================
           CREATE PLAN
        =============================== */

        const newPlan = await createSubscriptionPlan(plan);
        appCache.del(CACHE_KEYS.SUBSCRIPTION_PLANS);

        res.status(HTTP_STATUS.CREATED).json(
            successResponse(newPlan, "Subscription plan created successfully")
        );

    } catch (err: unknown) {
        const errorObj: CustomError =
            err instanceof Error
                ? (err as CustomError)
                : {
                    name: "UnknownError",
                    message:
                        typeof err === "string" ? err : "An unknown error occurred",
                };

        await error(
            "Subscription plan creation failed",
            {
                error: errorObj.message,
                stack: errorObj.stack,
                userId: user?.id,
            },
            { userId: user?.id!, source: "subscription.CreatePlan", req }
        );

        next(errorObj);
    }
};



/**
 * Controller to fetch all subscription plans.
 *
 * Uses caching (NodeCache) to reduce database queries.
 * If cached plans exist, returns them immediately; otherwise, fetches from the database and caches them.
 *
 * @param {AuthRequest} req - Express request object, optionally containing authenticated user
 * @param {Response} res - Express response object
 * @param {NextFunction} next - Express next function for error handling
 * @returns {Promise<void>} Sends JSON response with subscription plans
 *
 * @example
 * GET /api/v1/subscription
 * Response:
 * {
 *   "success": true,
 *   "data": [
 *     {
 *       "id": "uuid",
 *       "plan_name": "Gold",
 *       "description": "Best plan for professionals",
 *       "monthly_price": 99,
 *       "annual_price": 1188,
 *       "lead_limit_per_month": 100,
 *       "number_of_regions": 3,
 *       "highlight_in_result": true,
 *       "verification_badge": true,
 *       "status": "active",
 *       "created_at": "...",
 *       "updated_at": "..."
 *     }
 *   ],
 *   "message": "Subscription plans fetched successfully"
 * }
 */
export const getPlans = async (
    req: AuthRequest,
    res: Response,
    next: NextFunction
): Promise<void> => {
    try {


        // const cachedPlans = appCache.get(CACHE_KEYS.SUBSCRIPTION_PLANS);

        // if (cachedPlans) {
        //     res.status(HTTP_STATUS.OK).json(
        //         successResponse(
        //             { plans: cachedPlans },
        //             "Subscription plans fetched successfully (cached)"
        //         )
        //     );
        //     return;
        // }

        //  Fetch from DB
        const plans = await getAllSubscriptionPlans();

        // Save to cache
        // appCache.set(CACHE_KEYS.SUBSCRIPTION_PLANS, plans);

        res.status(HTTP_STATUS.OK).json(
            successResponse({ plans: plans }, "Subscription plans fetched successfully")
        );
    } catch (err: unknown) {
        // Handle unknown errors
        const errorObj = err instanceof Error ? err : { name: "UnknownError", message: "An unknown error occurred" };
        console.error("Error fetching subscription plans:", errorObj);
        next(errorObj); // pass to Express error middleware
    }
}

/**
 * Controller to update a subscription plan by ID.
 *
 * - Only Admin users can update plans.
 * - Plan name **cannot be changed**.
 * - Required fields must be present in the request body.
 * - After update, cached subscription plans are invalidated.
 *
 * @param {AuthRequest} req - Express request object, with authenticated user and plan ID in params
 * @param {Response} res - Express response object
 * @param {NextFunction} next - Express next function for error handling
 * @returns {Promise<void>} Sends JSON response with updated subscription plan
 *
 * @example
 * PUT /api/v1/subscription/{id}
 * Request body:
 * {
 *   "description": "Updated description",
 *   "monthly_price": 99,
 *   "annual_price": 1188,
 *   "lead_limit_per_month": 50,
 *   "number_of_regions": 3,
 *   "highlight_in_result": true,
 *   "verification_badge": true,
 *   "status": "active"
 * }
 */
export const updatePlan = async (
    req: AuthRequest,
    res: Response,
    next: NextFunction
): Promise<void> => {
    const userPayload = req.user as AuthUserPayload | undefined;
    const planId = req.body.id as string | undefined;

    try {
        if (!userPayload?.userEmail) {
            res.status(HTTP_STATUS.UNAUTHORIZED).json(errorResponse("Unauthorized request"));
            return;
        }

        const user = await findUserByEmail(userPayload.userEmail);
        if (!user) {
            res.status(HTTP_STATUS.UNAUTHORIZED).json(errorResponse("User not found"));
            return;
        }

        if (userPayload.role !== "Admin") {
            res.status(HTTP_STATUS.FORBIDDEN).json(errorResponse("Unauthorized Role"));
            return;
        }

        const existingPlan = await getSubscriptionPlanById(planId!);
        if (!existingPlan) {
            res.status(HTTP_STATUS.NOT_FOUND).json(errorResponse("Plan not found"));
            return;
        }

        // Prevent plan name modification
        if (
            "plan_name" in req.body &&
            req.body.plan_name !== existingPlan.plan_name
        ) {
            res.status(HTTP_STATUS.BAD_REQUEST).json(
                errorResponse("Plan name cannot be modified")
            );
            return;
        }

        const requiredFields: (keyof SubscriptionPlanInput)[] = [
            "plan_name",
            "description",
            "price_monthly",
            "price_annual",
            "leads_limit",
            "cities_coverage",
            "appear_in_search",
            "premium_profile_badge",
            "priority_customer_support",
            "status",
        ];

        for (const field of requiredFields) {
            if (!(field in req.body)) {
                res.status(HTTP_STATUS.BAD_REQUEST).json(
                    errorResponse(`Missing required field: ${field}`)
                );
                return;
            }
        }

        // Enforce annual pricing rule
        // if (req.body.monthly_price * 12 !== req.body.annual_price) {
        //     res.status(HTTP_STATUS.BAD_REQUEST).json(
        //         errorResponse("Annual price must be monthly price × 12")
        //     );
        //     return;
        // }

        const updates: SubscriptionPlanInput = {
            ...req.body,
            plan_name: existingPlan.plan_name,
        };

        const updatedPlan = await updateSubscriptionPlan(planId!, updates);
        if (!updatedPlan) {
            res.status(HTTP_STATUS.NOT_FOUND).json(errorResponse("Plan not found"));
            return;
        }

        // Invalidate cache
        appCache.del(CACHE_KEYS.SUBSCRIPTION_PLANS);

        res.status(HTTP_STATUS.OK).json(
            successResponse(updatedPlan, "Subscription plan updated successfully")
        );
    } catch (err: unknown) {
        const errorObj =
            err instanceof Error
                ? err
                : { name: "UnknownError", message: "An unknown error occurred" };

        console.error("Error updating subscription plan:", errorObj);
        next(errorObj);
    }
};


/**
 * Controller to update only the status of a subscription plan by ID.
 * Only Admin users can update.
 *
 * @param req AuthRequest with user and plan ID in params
 * @param res Response
 * @param next NextFunction
 */
export const updateSubscriptionStatusById = async (
    req: AuthRequest,
    res: Response,
    next: NextFunction
): Promise<void> => {
    const planId = req.params.id as string | undefined;
    const { status } = req.body;

    try {
        // Auth & Role Check
        const userPayload = req.user as AuthUserPayload | undefined;
        if (!userPayload?.userEmail) {
            res.status(HTTP_STATUS.UNAUTHORIZED).json(errorResponse("Unauthorized request"));
            return;
        }

        const user = await findUserByEmail(userPayload.userEmail);
        if (!user || userPayload.role !== "Admin") {
            res.status(HTTP_STATUS.FORBIDDEN).json(errorResponse("Unauthorized Role"));
            return;
        }

        //  Input validation
        if (!planId) {
            res.status(HTTP_STATUS.BAD_REQUEST).json(errorResponse("Subscription plan ID is required"));
            return;
        }

        if (!status || !["active", "inactive"].includes(status)) {
            res.status(HTTP_STATUS.BAD_REQUEST).json(errorResponse("Status must be 'active' or 'inactive'"));
            return;
        }

        //  Fetch existing plan
        const existingPlan = await getSubscriptionPlanById(planId);
        if (!existingPlan) {
            res.status(HTTP_STATUS.NOT_FOUND).json(errorResponse("Subscription plan not found"));
            return;
        }

        //  Update only the status
        const updatedPlan = await updateSubscriptionPlanStatusById(planId, {
            ...existingPlan,
            status,
        });

        if (!updatedPlan) {
            res.status(HTTP_STATUS.NOT_FOUND).json(errorResponse("Failed to update subscription plan"));
            return;
        }

        //  Clear cache
        appCache.del(CACHE_KEYS.SUBSCRIPTION_PLANS);

        // Return success
        res.status(HTTP_STATUS.OK).json(
            successResponse(updatedPlan, "Subscription plan status updated successfully")
        );
    } catch (error: unknown) {
        console.error("Failed to update subscription plan status:", error);
        next(error);
    }
};

/**
 * Controller to fetch all active subscription plans for professionals.
 * 
 * This API:
 * - Validates the authenticated user from the request.
 * - Fetches the user using the email from the auth payload.
 * - Retrieves all subscription plans from the database/service.
 * - Filters only plans with status "active".
 * - Returns the active plans in the response.
 *
 * @param {AuthRequest} req - Express request object containing authenticated user payload.
 * @param {Response} res - Express response object used to send the response.
 * @param {NextFunction} next - Express next middleware function for error handling.
 * 
 * @returns {Promise<void>} Sends a JSON response with active subscription plans or an error.
 */
export const getActivePlansForProfessionals= async(
    req: AuthRequest,
    res: Response,
    next: NextFunction
): Promise<void> => {
    try {
        const userPayload = req.user as AuthUserPayload | undefined;
        if (!userPayload?.userEmail) {
            res.status(HTTP_STATUS.UNAUTHORIZED).json(errorResponse("Unauthorized request"));
            return;
        }
        const user = await findUserByEmail(userPayload.userEmail);
        if (!user) {
            res.status(HTTP_STATUS.UNAUTHORIZED).json(errorResponse("User not found"));
            return;
        }

       const result = await getAllSubscriptionPlans();
       const activePlans = result.filter(plan => plan.status === "active"); 
       
       res.status(HTTP_STATUS.OK).json(
        successResponse({ plans: activePlans }, "Active subscription plans fetched successfully")
       );
    } catch (error: unknown) {
        console.error("Failed to fetch active subscription plans:", error);
        
        next(error);
    }
};  