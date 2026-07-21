import { HTTP_STATUS, MESSAGES } from "../../core/utils/constants";
import { errorResponse, successResponse } from "../../core/utils/responseFormatter";
import { AuthRequest } from "../../interface/auth";
import { findUserById } from "../auth/authRepository";
import { error } from "../../core/utils/logger";
import { cancelSubscriptionService, createSubscriptionService, getAllPlansWithDetailService, getMySubscriptionService, verifySubscriptionPayment } from "./subscriptionRepository";
import { AuthUserPayload } from "../../interface/user";
import { Response, NextFunction } from "express";
import logger from "../../core/config/logger";
import { verifyWebhookSignature } from "./razorPay.service";
import { handleSubscriptionEvent, recordWebhookEvent } from "./webhook.service";
import { CustomError } from "../../interface/Error";

// import { VerifyPurchaseBody } from "../../interface/subscription";
// import { getDB } from "../../core/config/db";
// import { GooglePlayError, verifySubscriptionWithGoogle } from "./googlePlay.service";

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
export const getAllPlanswithDetails = async (req: AuthRequest, res: Response): Promise<void> => {

    const userPayload = req.user as AuthUserPayload | undefined;

    if (!userPayload?.userId) {
        res
            .status(HTTP_STATUS.UNAUTHORIZED)
            .json(errorResponse("Unauthorized request"));
        return;
    }

    try {
        const user = await findUserById(userPayload.userId!);
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
    // next();
}

/**
 * Creates a new subscription for the authenticated user.
 *
 * This endpoint validates the authenticated user and the provided
 * subscription plan code before creating a subscription. It returns
 * the created subscription details on success.
 *
 * @async
 * @function createSubscription
 * @param {AuthRequest} req - Express request object containing the authenticated user and request body.
 * @param {Response} res - Express response object used to send the API response.
 * @param {NextFunction} next - Express middleware callback.
 * @returns {Promise<void>} Resolves when the subscription creation process is complete.
 *
 * @throws {401} If the user is not authenticated.
 * @throws {400} If the `planCode` is missing from the request body.
 * @throws {500} If an unexpected error occurs while creating the subscription.
 */
export const createSubscription = async (req: AuthRequest, res: Response): Promise<void> => {
    const userPayload = req.user as AuthUserPayload | undefined;

    if (!userPayload?.userId) {
        res
            .status(HTTP_STATUS.UNAUTHORIZED)
            .json(errorResponse("Unauthorized request"));
        return;
    }

    const { planCode } = req.body;
    if (!planCode) {
        res
            .status(HTTP_STATUS.BAD_REQUEST)
            .json(errorResponse("planCode is required"));
        return;
    }
    try {
        const result = await createSubscriptionService(userPayload.userId!, planCode);
        res.status(HTTP_STATUS.OK).json(successResponse(result, "Subscription created successfully"));
    }catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        const stack = err instanceof Error ? err.stack : undefined;

        console.error("Error creating subscription:", err); // temporary debug line

        await error("Error creating subscription", {
            email: userPayload.userEmail,
            action: "createSubscription",
            req,
            error: message,
            stack,
        });

        res
            .status(HTTP_STATUS.BAD_REQUEST)
            .json(errorResponse(message));
    }
}
/**
 * Verifies the payment for a Razorpay subscription.
 *
 * This endpoint validates the authenticated user and the required
 * Razorpay payment details, then verifies the subscription payment
 * signature and updates the subscription status accordingly.
 *
 * @async
 * @function verifySubscription
 * @param {AuthRequest} req - Express request object containing the authenticated user and Razorpay payment details.
 * @param {Response} res - Express response object used to send the API response.
 * @param {NextFunction} next - Express middleware callback.
 * @returns {Promise<void>} Resolves when the subscription verification process is complete.
 *
 * @throws {401} If the user is not authenticated.
 * @throws {400} If any required Razorpay payment fields are missing.
 * @throws {500} If an unexpected error occurs while verifying the subscription.
 */
export const verifySubscription = async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
        const userPayload = req.user as AuthUserPayload | undefined;

        if (!userPayload?.userId) {
            res
                .status(HTTP_STATUS.UNAUTHORIZED)
                .json(errorResponse("Unauthorized request"));
            return;
        }

        const { razorpay_payment_id, razorpay_subscription_id, razorpay_signature } = req.body;

        if (!razorpay_payment_id || !razorpay_subscription_id || !razorpay_signature) {
            res.status(400).json({ error: "Missing required fields" });
            return;
        }
        const result = await verifySubscriptionPayment(userPayload.userId, {
            razorpay_payment_id,
            razorpay_subscription_id,
            razorpay_signature,
        });
        res.status(HTTP_STATUS.OK).json(successResponse(result, "Subscription verified successfully"));
    } catch (err) {
        await error("Error verifying subscription", {
            action: "verifySubscription",
            req,
            error: err instanceof Error ? err.message : String(err),
        });
        res
            .status(HTTP_STATUS.INTERNAL_SERVER_ERROR)
            .json(errorResponse("An error occurred while verifying subscription"));

    }
    next();
}
/**
 * Retrieves the authenticated user's current subscription details.
 *
 * This endpoint validates the authenticated user and returns
 * the user's active or latest subscription information.
 *
 * @async
 * @function getMySubscription
 * @param {AuthRequest} req - Express request object containing the authenticated user.
 * @param {Response} res - Express response object used to send the API response.
 * @param {NextFunction} next - Express middleware callback.
 * @returns {Promise<void>} Resolves when the subscription retrieval process is complete.
 *
 * @throws {401} If the user is not authenticated.
 * @throws {500} If an unexpected error occurs while fetching the subscription.
 */
export const getMySubscription = async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
        const userPayload = req.user as AuthUserPayload | undefined;

        if (!userPayload?.userId) {
            res
                .status(HTTP_STATUS.UNAUTHORIZED)
                .json(errorResponse("Unauthorized request"));
            return;
        }

        const result = await getMySubscriptionService(userPayload.userId!);
        res.status(HTTP_STATUS.OK).json(successResponse(result, "User subscription retrieved successfully"));

    } catch (err) {
        await error("Error fetching user subscription", {
            action: "getMySubscription",
            req,
            error: err instanceof Error ? err.message : String(err),
        });
        res
            .status(HTTP_STATUS.INTERNAL_SERVER_ERROR)
            .json(errorResponse("An error occurred while fetching user subscription"));
    }
    next();
}

/**
 * Cancels the authenticated user's active subscription.
 *
 * This endpoint validates the authenticated user and cancels
 * their active subscription. The cancellation is processed
 * through the subscription service and the updated subscription
 * status is returned on success.
 *
 * @async
 * @function cancelSubscription
 * @param {AuthRequest} req - Express request object containing the authenticated user.
 * @param {Response} res - Express response object used to send the API response.
 * @param {NextFunction} next - Express middleware callback.
 * @returns {Promise<void>} Resolves when the subscription cancellation process is complete.
 *
 * @throws {401} If the user is not authenticated.
 * @throws {500} If an unexpected error occurs while cancelling the subscription.
 */
export const cancelSubscription = async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
        const userPayload = req.user as AuthUserPayload | undefined;

        if (!userPayload?.userId) {
            res
                .status(HTTP_STATUS.UNAUTHORIZED)
                .json(errorResponse("Unauthorized request"));
            return;
        }
        const result = await cancelSubscriptionService(userPayload.userId!);

        res.status(HTTP_STATUS.OK).json(successResponse(result, "User subscription cancelled successfully"));

    } catch (err: unknown) {
        const errorObj: CustomError = err instanceof Error
            ? (err as CustomError)
            : ({ name: "UnknownError", message: typeof err === "string" ? err : "An unknown error occurred" } as CustomError);

        await error("Error cancelling user subscription", {
            userId: (req.user as AuthUserPayload | undefined)?.userId,
            action: "cancelSubscription",
            req,
            error: errorObj.message,
            stack: errorObj.stack,
        });

        next(errorObj);
    }

}

/**
 * Processes incoming Razorpay webhook events.
 *
 * This endpoint validates the Razorpay webhook signature, ensures the
 * event has not already been processed (idempotency), and handles
 * supported subscription-related webhook events.
 *
 * @async
 * @function razorpayWebhook
 * @param {AuthRequest} req - Express request object containing the raw webhook payload as a Buffer.
 * @param {Response} res - Express response object used to acknowledge the webhook request.
 * @param {NextFunction} next - Express middleware callback.
 * @returns {Promise<void>} Resolves when the webhook has been validated and processed.
 *
 * @throws {400} If the webhook signature is missing or invalid.
 * @throws {500} If an unexpected error occurs while processing the webhook.
 */
export const razorpayWebhook = async (req: AuthRequest, res: Response): Promise<void> => {
    try {
        const signature = req.headers["x-razorpay-signature"] as string | undefined;
        if (!signature) {
            res.status(400).send("missing signature");
            return;
        }

        const isValid = verifyWebhookSignature(req.body, signature); // req.body is Buffer here
        if (!isValid) {
            logger.warn("Invalid Razorpay webhook signature");
            res.status(400).send("invalid signature");
            return;
        }

        const payload = JSON.parse(req.body.toString("utf8"));

        const isFresh = await recordWebhookEvent(payload);
        if (!isFresh) {
            // already processed this exact event, Razorpay retried delivery — ack and exit
            res.status(200).send("already processed");
            return;
        }

        // ACK Razorpay immediately — do not block the HTTP response on DB work.
        // Razorpay expects a fast 2xx; slow handlers cause retries and perceived lag.
        res.status(HTTP_STATUS.OK).json(successResponse(null, "Webhook received"));

        setImmediate(() => {
            void handleSubscriptionEvent(payload).catch((err) => {
                logger.error("Async Razorpay webhook processing failed", {
                    event: payload?.event,
                    error: err instanceof Error ? err.message : String(err),
                });
            });
        });
    } catch (err) {
        console.error("RAW WEBHOOK ERROR:", err); // temporary debug line
        await error("Error processing Razorpay webhook", {
            action: "razorpayWebhook",
            req,
            error: err instanceof Error ? err.message : String(err),
        });
        if (!res.headersSent) {
            res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json(errorResponse("An error occurred while processing Razorpay webhook"));
        }
    }
}

