import { HTTP_STATUS, MESSAGES } from "../../core/utils/constants";
import { errorResponse, successResponse } from "../../core/utils/responseFormatter";
import { AuthRequest } from "../../interface/auth";
import { findUserById } from "../auth/authRepository";
import { error } from "../../core/utils/logger";
import {
  cancelSubscriptionService,
  getAllPlansWithDetailService,
  getMySubscriptionService,
  normalizeVerifyPlanIds,
  verifySubscriptionPayment,
} from "./subscriptionRepository";
import { AuthUserPayload } from "../../interface/user";
import { Response } from "express";
import logger from "../../core/config/logger";
import { handleGooglePlayRtdn, recordBillingWebhookEvent, markBillingWebhookProcessed } from "./webhook.service";
import { CustomError } from "../../interface/Error";

/**
 * Returns all active subscription plans with feature labels for the authenticated user.
 *
 * @param {AuthRequest} req - Authenticated Express request.
 * @param {Response} res - Express response object.
 * @returns {Promise<void>} Resolves when the plans response is sent.
 */
export const getAllPlanswithDetails = async (req: AuthRequest, res: Response): Promise<void> => {
  const userPayload = req.user as AuthUserPayload | undefined;

  if (!userPayload?.userId) {
    res.status(HTTP_STATUS.UNAUTHORIZED).json(errorResponse("Unauthorized request"));
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
      res.status(HTTP_STATUS.NOT_FOUND).json(errorResponse(MESSAGES.PROFILE_USER_NOTFOUND));
      return;
    }

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
};

/**
 * Verifies a Google Play Billing purchase and activates the local subscription.
 *
 * @param {AuthRequest} req - Authenticated request with purchase fields in the body.
 * @param {Response} res - Express response object.
 * @returns {Promise<void>} Resolves when verification completes.
 */
export const verifySubscription = async (
  req: AuthRequest,
  res: Response
): Promise<void> => {
  try {
    const userPayload = req.user as AuthUserPayload | undefined;

    if (!userPayload?.userId) {
      res.status(HTTP_STATUS.UNAUTHORIZED).json(errorResponse("Unauthorized request"));
      return;
    }

    const { purchaseToken, productId, basePlanId, orderId } = req.body;

    if (!purchaseToken || !productId) {
      res.status(400).json({ error: "Missing purchaseToken or productId" });
      return;
    }
    logger.info("Received subscription verification request", {
      userId: userPayload.userId,
      purchaseToken,
      productId,
      basePlanId: basePlanId ?? null,
      orderId: orderId ?? null,
    });
    const normalized = await normalizeVerifyPlanIds(productId, basePlanId);
    logger.info("Verifying subscription", {
      userId: userPayload.userId,
      purchaseToken,
      productId: normalized.productId,
      basePlanId: normalized.basePlanId,
      planCode: normalized.planCode,
      rawProductId: productId,
      rawBasePlanId: basePlanId ?? null,
      orderId,
    });

    const result = await verifySubscriptionPayment(userPayload.userId, {
      purchaseToken,
      productId: normalized.productId,
      ...(normalized.basePlanId ? { basePlanId: normalized.basePlanId } : {}),
      orderId,
    });

    const message = result.deferred
      ? `Downgrade scheduled — stays on ${result.planCode} until period end, then ${result.pendingPlanCode}`
      : result.activated
        ? "Subscription verified and activated successfully"
        : "Purchase verified — subscription is not active yet";

    res.status(HTTP_STATUS.OK).json(successResponse(result, message));
  } catch (err) {
    const errMsg = err instanceof Error ? err.message : String(err);
    logger.error("Verify subscription failed", {
      error: errMsg,
      userId: (req.user as AuthUserPayload | undefined)?.userId,
    });
    try {
      await error("Error verifying subscription", {
        action: "verifySubscription",
        req,
        error: errMsg,
      });
    } catch {
      /* never block the HTTP response on logging */
    }
    if (!res.headersSent) {
      res
        .status(HTTP_STATUS.BAD_REQUEST)
        .json(errorResponse(errMsg || "An error occurred while verifying subscription"));
    }
  }
};

/**
 * Returns the current user's subscription, pending plan, and usage.
 *
 * @param {AuthRequest} req - Authenticated Express request.
 * @param {Response} res - Express response object.
 * @returns {Promise<void>} Resolves when the subscription response is sent.
 */
export const getMySubscription = async (
  req: AuthRequest,
  res: Response
): Promise<void> => {
  try {
    const userPayload = req.user as AuthUserPayload | undefined;

    if (!userPayload?.userId) {
      res.status(HTTP_STATUS.UNAUTHORIZED).json(errorResponse("Unauthorized request"));
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
};

/**
 * Records local cancel-at-period-end for the authenticated user's Play subscription.
 *
 * @param {AuthRequest} req - Authenticated Express request.
 * @param {Response} res - Express response object.
 * @returns {Promise<void>} Resolves when cancellation is recorded.
 */
export const cancelSubscription = async (
  req: AuthRequest,
  res: Response
): Promise<void> => {
  try {
    const userPayload = req.user as AuthUserPayload | undefined;

    if (!userPayload?.userId) {
      res.status(HTTP_STATUS.UNAUTHORIZED).json(errorResponse("Unauthorized request"));
      return;
    }

    const result = await cancelSubscriptionService(userPayload.userId!);
    res
      .status(HTTP_STATUS.OK)
      .json(
        successResponse(
          result,
          "Cancellation recorded. Turn off renew in Google Play to stop future charges; access continues until period end."
        )
      );
  } catch (err: unknown) {
    const errorObj: CustomError =
      err instanceof Error
        ? (err as CustomError)
        : ({
            name: "UnknownError",
            message: typeof err === "string" ? err : "An unknown error occurred",
          } as CustomError);

    await error("Error cancelling user subscription", {
      userId: (req.user as AuthUserPayload | undefined)?.userId,
      action: "cancelSubscription",
      req,
      error: errorObj.message,
    });
    res.status(HTTP_STATUS.BAD_REQUEST).json(errorResponse(errorObj.message));
  }
};

/**
 * Google Play Real-time Developer Notifications (Pub/Sub push).
 * ACK quickly, process async.
 *
 * @param {AuthRequest} req - Pub/Sub push request body.
 * @param {Response} res - Express response object.
 * @returns {Promise<void>} Resolves after acknowledging the webhook.
 */
export const googlePlayWebhook = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const body = req.body as {
      message?: { data?: string; messageId?: string };
      subscription?: string;
    };

    res.status(HTTP_STATUS.OK).json(successResponse(null, "Webhook received"));

    setImmediate(() => {
      void handleGooglePlayRtdn(body).catch(async (err) => {
        logger.error("Async Google Play RTDN processing failed", {
          error: err instanceof Error ? err.message : String(err),
        });
        // Best-effort: still mark a failure event if messageId present
        const mid = body.message?.messageId;
        if (mid) {
          try {
            const id = `${mid}:failed`;
            const fresh = await recordBillingWebhookEvent({
              eventId: id,
              eventType: "PROCESSING_FAILED",
              payload: { error: String(err), body },
            });
            if (fresh) await markBillingWebhookProcessed(id);
          } catch {
            /* ignore */
          }
        }
      });
    });
  } catch (err) {
    await error("Error processing Google Play webhook", {
      action: "googlePlayWebhook",
      req,
      error: err instanceof Error ? err.message : String(err),
    });
    if (!res.headersSent) {
      res
        .status(HTTP_STATUS.INTERNAL_SERVER_ERROR)
        .json(errorResponse("An error occurred while processing Google Play webhook"));
    }
  }
};
