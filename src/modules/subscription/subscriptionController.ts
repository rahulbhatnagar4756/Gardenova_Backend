import { HTTP_STATUS, MESSAGES } from "../../core/utils/constants";
import { errorResponse, successResponse } from "../../core/utils/responseFormatter";
import { AuthRequest } from "../../interface/auth";
import { Response } from "express";
import {  findUserById } from "../auth/authRepository";
import { error } from "../../core/utils/logger";
import {   getAllPlansWithDetailService } from "./subscriptionRepository";
import { AuthUserPayload } from "../../interface/user";
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

    const userPayload = req.user as AuthUserPayload| undefined;

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
// export const verifyPurchase=async(
//   req: AuthRequest,
//   res: Response
// ):Promise<void>=> {
//   const { purchaseToken, productId, packageName } =
//     req.body as VerifyPurchaseBody;

//   const userId = req.user as { userId?: string } | undefined;

//   try {
//     // 1. Input validation
//     if (!purchaseToken || !productId || !packageName) {
//        res.status(400).json({
//         error: "MISSING_FIELDS",
//         message:
//           "purchaseToken, productId, and packageName are required",
//       });
//       return;
//     }
//     const db = await getDB();
//     // 2. Check if purchase token already processed
//     const existingResult = await db.query(
//       `
//       SELECT
//         us.*,
//         p.tier,
//         p.billing_period
//       FROM user_subscriptions us
//       LEFT JOIN plans p
//         ON p.id = us.plan_id
//       WHERE us.purchase_token = $1
//       LIMIT 1
//       `,
//       [purchaseToken]
//     );

//     const existing = existingResult.rows[0];

//     if (existing && existing.status === "active") {
//        res.status(200).json({
//         success: true,
//         message: "Subscription already active",
//         tier: existing.tier,
//         billingPeriod: existing.billing_period,
//         expiryDate: existing.expiry_date,
//         alreadyProcessed: true,
//       });
//       return;
//     }

//     // 3. Verify with Google Play
//     let googleData;

//     try {
//       googleData = await verifySubscriptionWithGoogle(
//         packageName,
//         productId,
//         purchaseToken
//       );
//     } catch (err) {
//       if (err instanceof GooglePlayError) {
//         if (
//           err.code === "INVALID_TOKEN" ||
//           err.code === "NOT_FOUND"
//         ) {
//            res.status(400).json({
//             error: err.code,
//             message: err.message,
//           });
//           return;
//         }

//         if (err.code === "TOKEN_EXPIRED") {
//            res.status(400).json({
//             error: "TOKEN_EXPIRED",
//             message:
//               "This purchase has already expired",
//           });
//           return;
//         }

//          res.status(502).json({
//           error: "GOOGLE_API_UNAVAILABLE",
//           message:
//             "Could not verify with Google Play",
//         });
//         return;
//       }

//       throw err;
//     }

//     // 4. Validate payment state
//     if (googleData.paymentState === 0) {
//        res.status(402).json({
//         error: "PAYMENT_PENDING",
//         message:
//           "Payment is still being processed. Please try again later.",
//       });
//       return;
//     }

//     if (
//       googleData.paymentState !== 1 &&
//       googleData.paymentState !== 2
//     ) {
//        res.status(400).json({
//         error: "PAYMENT_NOT_CONFIRMED",
//         message: "Payment not confirmed by Google",
//       });
//       return;
//     }

//     // 5. Block test purchases in production
//     if (
//       googleData.purchaseType === 0 &&
//       process.env.NODE_ENV === "production"
//     ) {
//        res.status(400).json({
//         error: "TEST_PURCHASE",
//         message:
//           "Test purchases are not allowed in production",
//       });
//       return;
//     }

//     // 6. Activate subscription
//     const { subscription, plan } =
//       await activateSubscription(
//         userId,
//         googleData,
//         purchaseToken,
//         productId,
//         packageName
//       );

//      res.status(200).json({
//       success: true,
//       tier: plan.tier,
//       billingPeriod: plan.billing_period,
//       status: subscription.status,
//       expiryDate: subscription.expiry_date,
//       isTrial: googleData.paymentState === 2,
//       autoRenew: googleData.autoRenewing,
//     });
    
//   } catch (error) {
//     console.error("verifyPurchase error:", error);

//      res.status(500).json({
//       error: "INTERNAL_SERVER_ERROR",
//       message:
//         "Something went wrong while verifying the purchase",
//     });
//     return; 
//   }
// }