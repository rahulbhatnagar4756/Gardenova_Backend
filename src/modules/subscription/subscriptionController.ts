import { HTTP_STATUS, MESSAGES } from "../../core/utils/constants";
import { errorResponse, successResponse } from "../../core/utils/responseFormatter";
import { AuthRequest } from "../../interface/auth";
import { Response, NextFunction } from "express";
import { findUserByEmail } from "../auth/authRepository";
import { error } from "../../core/utils/logger";
import {  createRazorpayOrderService, getAllPlansWithDetailService, getAllRazorpayOrdersService, getPlanDetailsByIdServices, updatePlanDetailService, verifyRazorpayPaymentService } from "./subscriptionRepository";

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
    // next();
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
export const updatePlanDetails = async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {

    const userPayload = req.user as { userEmail?: string, role?: string } | undefined;

    if (!userPayload?.userEmail) {
        res
            .status(HTTP_STATUS.UNAUTHORIZED)
            .json(errorResponse("Unauthorized request"));
        return;
    }

    if (userPayload.role !== "Admin") {
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
        const { data } = req.body;

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
/**
 * Retrieves subscription plan details by plan ID.
 *
 * This controller:
 * - Validates authenticated user access
 * - Checks if the user exists
 * - Fetches subscription plan details using the provided plan ID
 * - Returns the subscription plan data
 *
 * @param req - Express request object containing authenticated user info and route params
 * @param req.params.planId - Subscription plan ID
 * @param res - Express response object
 * @param next - Express next middleware function
 *
 * @returns JSON response with subscription plan details
 *
 * @throws 401 - If user is unauthorized
 * @throws 404 - If user is not found
 * @throws 500 - If an internal server error occurs
 */
export const getPlanDetailsById = async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
    const userPayload = req.user as { userEmail?: string } | undefined;

    if (!userPayload?.userEmail) {
        res.status(HTTP_STATUS.UNAUTHORIZED)
            .json(errorResponse("Unauthorized request"));
        return;
    }

    try {
        const user = await findUserByEmail(userPayload.userEmail);
        if (!user) {
            await error("Profile retrieval failed - User not found", {
                email: userPayload.userEmail,
                action: "getPlanDetailsById",
                req,
            });
            res
                .status(HTTP_STATUS.NOT_FOUND)

                .json(errorResponse(MESSAGES.PROFILE_USER_NOTFOUND));
            return;
        }

        const { planId } = req.params;
        // Placeholder for actual subscription plan retrieval logic
        const subscriptionPlan = await getPlanDetailsByIdServices(planId!);


        res
            .status(HTTP_STATUS.OK)
            .json(successResponse(subscriptionPlan, "Subscription plan details retrieved successfully"));
        return;
    }
    catch (err) {
        await error("Error fetching subscription plan details", {
            email: userPayload.userEmail,
            action: "getPlanDetailsById",
            req,
            error: err instanceof Error ? err.message : String(err),
        });
        res
            .status(HTTP_STATUS.INTERNAL_SERVER_ERROR)
            .json(errorResponse("An error occurred while fetching subscription plan details"));
    }

    next();

}


/**
 * Creates a Razorpay order for subscription/payment processing.
 *
 * This controller:
 * - Validates authenticated user access
 * - Checks if the user exists in the database
 * - Creates a Razorpay order using the provided subscription/payment details
 * - Returns the created Razorpay order response
 *
 * @param req - Express request object containing authenticated user and request body
 * @param req.body.planId - Subscription plan ID
 * @param req.body.billing_period - Subscription billing period (monthly/yearly)
 * @param req.body.amount - Payment amount
 * @param req.body.currency - Payment currency (e.g. INR)
 * @param res - Express response object
 * @param next - Express next middleware function
 *
 * @returns JSON response with Razorpay order details
 *
 * @throws 401 - If user is unauthorized
 * @throws 404 - If user is not found
 * @throws 500 - If an internal server error occurs while creating the order
 */
export const createRazorpayOrder = async (
  req: AuthRequest,
  res: Response
): Promise<void> => {
  const userPayload = req.user as { userEmail?: string } | undefined;

  if (!userPayload?.userEmail) {
    res.status(HTTP_STATUS.UNAUTHORIZED).json(errorResponse("Unauthorized request"));
    return;
  }

  try {
    const user = await findUserByEmail(userPayload.userEmail);
    if (!user) {
      await error("Profile retrieval failed - User not found", {
        email: userPayload.userEmail,
        action: "createRazorpayOrder",
        req,
      });
      res.status(HTTP_STATUS.NOT_FOUND).json(errorResponse(MESSAGES.PROFILE_USER_NOTFOUND));
      return;
    }

    const { planId } = req.body;
    const billing_period = req.body.billing_period || "monthly"; // default to monthly if not provided
    
    const createOrderResult = await createRazorpayOrderService(
      planId,
      user.id!,
      billing_period
    );

    res.status(HTTP_STATUS.OK).json(successResponse(createOrderResult, "Razorpay order created successfully"));
  } catch (err) {
    await error("Error creating Razorpay order", {
      email: userPayload.userEmail,
      action: "createRazorpayOrder",
      req,
      error: err instanceof Error ? err.message : String(err),
    });
    res
      .status(HTTP_STATUS.INTERNAL_SERVER_ERROR)
      .json(errorResponse("An error occurred while creating Razorpay order"));
  }
  // next();
};

/**
 * Get Razorpay orders for the authenticated user.
 *
 * @param req - Authenticated request containing user details and query parameters.
 * @param res - Express response object.
 * @param next - Express next middleware function.
 * @returns Promise<void>
 */
export const getAllRazorpayOrders = async (
  req: AuthRequest,
  res: Response
): Promise<void> => {
  const userPayload = req.user as { userEmail?: string; role?: string } | undefined;

  if (!userPayload?.userEmail) {
    res.status(HTTP_STATUS.UNAUTHORIZED).json(errorResponse("Unauthorized request"));
    return;
  }

  try {
    const user = await findUserByEmail(userPayload.userEmail);
    if (!user) {
      await error("Profile retrieval failed - User not found", {
        email: userPayload.userEmail,
        action: "getAllRazorpayOrders",
        req,
      });
      res.status(HTTP_STATUS.NOT_FOUND).json(errorResponse(MESSAGES.PROFILE_USER_NOTFOUND));
      return;
    }

    const {
      from,
      to,
      count = "10",
      skip = "0",
      all = "false",          // admin-only: fetch all users' orders
    } = req.query as Record<string, string>;

    const isAdmin = userPayload.role === "admin";

    // Only admins can fetch orders across all users
    const filterUserId = isAdmin && all === "true" ? undefined : user.id!;

    const result = await getAllRazorpayOrdersService(
      filterUserId,
      from ? Number(from) : undefined,
      to ? Number(to) : undefined,
      Number(count),
      Number(skip)
    );

   // ✅ Guard: surface service-level failures properly
    if (!result.success) {
      res
        .status(HTTP_STATUS.INTERNAL_SERVER_ERROR)
        .json(errorResponse(result.message ?? "Failed to fetch plan details"));
      return;
    }

    res
      .status(HTTP_STATUS.OK)
      .json(successResponse(result, "Subscription plan details retrieved successfully"));
      return;
  } catch (err) {
    await error("Error fetching Razorpay orders", {
      email: userPayload.userEmail,
      action: "getAllRazorpayOrders",
      req,
      error: err instanceof Error ? err.message : String(err),
    });
    res
      .status(HTTP_STATUS.INTERNAL_SERVER_ERROR)
      .json(errorResponse("An error occurred while fetching Razorpay orders"));
  }
//   next();
};

/**
 * Verifies a Razorpay payment and activates the user's subscription.
 *
 * This controller:
 * - Validates authenticated user access
 * - Checks if the user exists in the database
 * - Verifies Razorpay payment signature
 * - Activates or updates the user's subscription after successful verification
 * - Returns payment verification status
 *
 * @param req - Express request object containing authenticated user and payment details
 * @param req.body.paymentId - Razorpay payment ID
 * @param req.body.orderId - Razorpay order ID
 * @param req.body.signature - Razorpay payment signature
 * @param res - Express response object
 * @param next - Express next middleware function
 *
 * @returns JSON response with payment verification result
 *
 * @throws 401 - If user is unauthorized
 * @throws 404 - If user is not found
 * @throws 400 - If payment verification fails
 * @throws 500 - If an internal server error occurs during verification
 */
export const verifyRazorpayPayment = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  const userPayload = req.user as { userEmail?: string } | undefined;

  if (!userPayload?.userEmail) {
    res.status(HTTP_STATUS.UNAUTHORIZED).json(errorResponse("Unauthorized request"));
    return;
  }

  try {
    const user = await findUserByEmail(userPayload.userEmail);
    if (!user) {
      await error("Profile retrieval failed - User not found", {
        email: userPayload.userEmail,
        action: "verifyRazorpayPayment",
        req,
      });
      res.status(HTTP_STATUS.NOT_FOUND).json(errorResponse(MESSAGES.PROFILE_USER_NOTFOUND));
      return;
    }

    const { paymentId, subscription_id, signature } = req.body;

    // ✅ userId, planId, billing_period come from the order notes — not client body
    const verificationResult = await verifyRazorpayPaymentService(
      paymentId,
      subscription_id,
      signature
    );

    if (!verificationResult.success) {
      res.status(HTTP_STATUS.BAD_REQUEST).json(errorResponse(verificationResult.message));
      return;
    }

    res.status(HTTP_STATUS.OK).json(successResponse(null, verificationResult.message));
    return;
  } catch (err) {
    await error("Error verifying Razorpay payment", {
      email: userPayload.userEmail,
      action: "verifyRazorpayPayment",
      req,
      error: err instanceof Error ? err.message : String(err),
    });
    res
      .status(HTTP_STATUS.INTERNAL_SERVER_ERROR)
      .json(errorResponse("An error occurred while verifying Razorpay payment"));
  }
  next();
};



// export const webhookController = async (req:AuthRequest, res: Response, next: NextFunction): Promise<void> => {

//     const userPayload = req.user as { userEmail?: string } | undefined;
//     const user = await findUserByEmail(userPayload?.userEmail || "");

//     if(!user) {
//         await error("Webhook received from Razorpay - User not found", {
//             email: userPayload?.userEmail,
//             action: "webhookController",
//             req,
//         });
//         res.status(HTTP_STATUS.NOT_FOUND)
//             .json(errorResponse(MESSAGES.PROFILE_USER_NOTFOUND));
//         return;
//     }

//     try {
//         const expectedSignature = crypto
//     .createHmac('sha256', process.env.RAZORPAY_WEBHOOK_SECRET)
//     .update(req.body)
//     .digest('hex');

//   if (expectedSignature !== req.headers['x-razorpay-signature']) {
//      res.status(400).json({ error: 'Invalid webhook signature' });
//      return;
//   }

//   const event = JSON.parse(req.body);

//   if (event.event === 'payment.captured') {
//     const payment = event.payload.payment.entity;

//     // notes were saved during order creation (step 1)
//     const { user_id, plan_id, billing_period } = payment.notes;

//     const expires_at = new Date();
//     billing_period === 'yearly'
//       ? expires_at.setFullYear(expires_at.getFullYear() + 1)
//       : expires_at.setMonth(expires_at.getMonth() + 1);
//     const db = await connectDB();
//     await db.query(
//       `INSERT INTO subscriptions 
//         (user_id, plan_id, billing_period, status, started_at, expires_at)
//        VALUES ($1, $2, $3, 'active', now(), $4)
//        ON CONFLICT ON CONSTRAINT uq_user_active_sub
//        DO UPDATE SET
//          plan_id        = EXCLUDED.plan_id,
//          billing_period = EXCLUDED.billing_period,
//          status         = 'active',
//          started_at     = now(),
//          expires_at     = EXCLUDED.expires_at,
//          updated_at     = now()`,
//       [user_id, plan_id, billing_period, expires_at]
//     );
//   }




//         res.status(HTTP_STATUS.OK).json(successResponse(null, "Webhook received successfully"));
//     } catch (err) {
//         await error("Error processing Razorpay webhook", {
//             email: userPayload?.userEmail,
//             action: "webhookController",
//             req,
//             error: err instanceof Error ? err.message : String(err),
//         });
//         res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR)
//             .json(errorResponse("An error occurred while processing Razorpay webhook"));
//     }
//     next();
// }