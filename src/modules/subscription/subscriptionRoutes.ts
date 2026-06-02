import express from "express";
import  { createRazorpayOrder, getAllPlanswithDetails, getAllRazorpayOrders, getPlanDetailsById, updatePlanDetails, verifyRazorpayPayment } from "./subscriptionController";
import auth from "../../core/middleware/authMiddleware";

const router = express.Router();
/**
 * @swagger
 * /api/v1/plans/getplans:
 *   get:
 *     summary: Get all active subscription plans with details
 *     tags:
 *       - Subscription Plans
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Successfully fetched all active plans
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 data:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       plan_id:
 *                         type: string
 *                         format: uuid
 *                       name:
 *                         type: string
 *                         example: Starter
 *                       tier:
 *                         type: string
 *                         enum: [free, starter, plus, pro]
 *                       price_monthly:
 *                         type: number
 *                         example: 9.99
 *                       price_yearly:
 *                         type: number
 *                         example: 99.99
 *                       plan_status:
 *                         type: boolean
 *                         example: true
 *                       limit_id:
 *                         type: string
 *                         format: uuid
 *                       scans_per_month:
 *                         type: integer
 *                         example: 100
 *                       landscape_gens_per_month:
 *                         type: integer
 *                         example: 50
 *                       max_saved_plants:
 *                         type: integer
 *                         example: -1
 *                       care_reminders:
 *                         type: boolean
 *                       ad_free:
 *                         type: boolean
 *                       ai_care_assistant:
 *                         type: boolean
 *                       hd_renders:
 *                         type: boolean
 *                       priority_support:
 *                         type: boolean
 *                       pdf_export:
 *                         type: boolean
 *                       priority_generation:
 *                         type: boolean
 *                       premium_styles:
 *                         type: boolean
 *                       before_after_downloads:
 *                         type: boolean
 *       401:
 *         description: Unauthorized
 *       500:
 *         description: Internal server error
 */
router.get("/getplans", auth, getAllPlanswithDetails);
/**
 * @swagger
 * /api/v1/plans/orders:
 *   get:
 *     summary: Get all Razorpay orders
 *     description: >
 *       Fetches Razorpay orders for the authenticated user.
 *       Admins can pass `all=true` to retrieve orders across all users.
 *       Results are paginated using `count` and `skip` query parameters.
 *     tags:
 *       - Subscription Plans
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: count
 *         schema:
 *           type: integer
 *           default: 10
 *           minimum: 1
 *           maximum: 100
 *         required: false
 *         description: Number of orders to fetch per page
 *       - in: query
 *         name: skip
 *         schema:
 *           type: integer
 *           default: 0
 *           minimum: 0
 *         required: false
 *         description: Number of orders to skip (for pagination)
 *       - in: query
 *         name: from
 *         schema:
 *           type: integer
 *         required: false
 *         description: Unix timestamp to filter orders created after this time
 *         example: 1700000000
 *       - in: query
 *         name: to
 *         schema:
 *           type: integer
 *         required: false
 *         description: Unix timestamp to filter orders created before this time
 *         example: 1710000000
 *       - in: query
 *         name: all
 *         schema:
 *           type: boolean
 *           default: false
 *         required: false
 *         description: "Admin only: set to true to fetch orders across all users"
 *     responses:
 *       200:
 *         description: Orders fetched successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 message:
 *                   type: string
 *                   example: Razorpay orders fetched successfully
 *                 data:
 *                   type: object
 *                   properties:
 *                     totalCount:
 *                       type: integer
 *                       example: 42
 *                     orders:
 *                       type: array
 *                       items:
 *                         type: object
 *                         properties:
 *                           id:
 *                             type: string
 *                             example: order_PzJ2xKq1234ABC
 *                           entity:
 *                             type: string
 *                             example: order
 *                           amount:
 *                             type: integer
 *                             description: Amount in paise (1 INR = 100 paise)
 *                             example: 49900
 *                           amount_paid:
 *                             type: integer
 *                             example: 49900
 *                           amount_due:
 *                             type: integer
 *                             example: 0
 *                           currency:
 *                             type: string
 *                             example: INR
 *                           receipt:
 *                             type: string
 *                             example: receipt_1712345678901
 *                           status:
 *                             type: string
 *                             enum: [created, attempted, paid]
 *                             example: paid
 *                           attempts:
 *                             type: integer
 *                             example: 1
 *                           notes:
 *                             type: object
 *                             properties:
 *                               userId:
 *                                 type: string
 *                                 example: user_abc123
 *                               planId:
 *                                 type: string
 *                                 example: plan_xyz789
 *                               billing_period:
 *                                 type: string
 *                                 example: monthly
 *                           created_at:
 *                             type: integer
 *                             description: Unix timestamp of order creation
 *                             example: 1712345678
 *       401:
 *         description: Unauthorized — missing or invalid token
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: false
 *                 message:
 *                   type: string
 *                   example: Unauthorized request
 *       404:
 *         description: User not found
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: false
 *                 message:
 *                   type: string
 *                   example: User not found
 *       500:
 *         description: Internal server error
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: false
 *                 message:
 *                   type: string
 *                   example: An error occurred while fetching Razorpay orders
 */
router.get("/orders", auth, getAllRazorpayOrders);

/**
 * @swagger
 * /api/v1/plans/updateplan/{planId}:
 *   patch:
 *     summary: Update subscription plan details
 *     description: Allows an Admin to update plan and plan limit details.
 *     tags:
 *       - Subscription Plans
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: planId
 *         required: true
 *         schema:
 *           type: string
 *         description: ID of the subscription plan
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               name:
 *                 type: string
 *                 example: Premium Plan
 *               description:
 *                 type: string
 *                 example: Best plan for enterprise users
 *               price:
 *                 type: number
 *                 example: 999
 *               billing_cycle:
 *                 type: string
 *                 example: monthly
 *               max_users:
 *                 type: integer
 *                 example: 20
 *               max_projects:
 *                 type: integer
 *                 example: 100
 *               storage_limit:
 *                 type: integer
 *                 example: 500
 *             example:
 *               name: Premium Plan
 *               description: Best plan for enterprise users
 *               price: 999
 *               billing_cycle: monthly
 *               max_users: 20
 *               max_projects: 100
 *               storage_limit: 500
 *     responses:
 *       200:
 *         description: Subscription plan updated successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 message:
 *                   type: string
 *                   example: Subscription plan updated successfully
 *                 data:
 *                   nullable: true
 *                   example: null
 *
 *       400:
 *         description: Invalid update payload
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: false
 *                 message:
 *                   type: string
 *                   example: No valid fields provided to update
 *
 *       401:
 *         description: Unauthorized request
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: false
 *                 message:
 *                   type: string
 *                   example: Unauthorized request
 *
 *       403:
 *         description: Forbidden - Admins only
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: false
 *                 message:
 *                   type: string
 *                   example: Forbidden request - Admins only
 *
 *       404:
 *         description: Plan or user not found
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: false
 *                 message:
 *                   type: string
 *                   example: Plan not found
 *
 *       500:
 *         description: Internal server error
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: false
 *                 message:
 *                   type: string
 *                   example: An error occurred while updating subscription plan
 */
router.patch("/updateplan/:planId", auth, updatePlanDetails);

/**
 * @swagger
 * /api/v1/plans/{planId}:
 *   get:
 *     summary: Get subscription plan details by ID
 *     description: Retrieve detailed information about a specific subscription plan.
 *     tags:
 *       - Subscription Plans
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: planId
 *         required: true
 *         schema:
 *           type: string
 *         description: Subscription plan ID
 *     responses:
 *       200:
 *         description: Subscription plan details retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 message:
 *                   type: string
 *                   example: Subscription plan details retrieved successfully
 *                 data:
 *                   type: object
 *                   properties:
 *                     plan_id:
 *                       type: string
 *                       example: "1"
 *                     name:
 *                       type: string
 *                       example: Premium Plan
 *                     tier:
 *                       type: string
 *                       example: premium
 *                     price_monthly:
 *                       type: number
 *                       example: 9.99
 *                     price_yearly:
 *                       type: number
 *                       example: 99.99
 *                     plan_status:
 *                       type: boolean
 *                       example: true
 *                     scans_per_month:
 *                       type: integer
 *                       example: 100
 *                     landscape_gens_per_month:
 *                       type: integer
 *                       example: 50
 *                     max_saved_plants:
 *                       type: integer
 *                       example: 500
 *                     care_reminders:
 *                       type: boolean
 *                       example: true
 *                     ad_free:
 *                       type: boolean
 *                       example: true
 *                     ai_care_assistant:
 *                       type: boolean
 *                       example: true
 *                     hd_renders:
 *                       type: boolean
 *                       example: true
 *                     priority_support:
 *                       type: boolean
 *                       example: true
 *                     pdf_export:
 *                       type: boolean
 *                       example: true
 *                     priority_generation:
 *                       type: boolean
 *                       example: true
 *                     premium_styles:
 *                       type: boolean
 *                       example: true
 *                     before_after_downloads:
 *                       type: boolean
 *                       example: true
 *       401:
 *         description: Unauthorized request
 *       404:
 *         description: User or plan not found
 *       500:
 *         description: Internal server error
 */
router.get("/:planId", auth, getPlanDetailsById);

/**
 * @swagger
 * /api/v1/plans/create-subscription:
 *   post:
 *     summary: Create Razorpay subscription
 *     description: Creates a Razorpay subscription for the selected plan and returns the subscription details required for Razorpay Checkout.
 *     tags:
 *       - Subscription Plans
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - planId
 *             properties:
 *               planId:
 *                 type: string
 *                 description: Database ID of the subscription plan.
 *                 example: 665fdc4a91ab1234567890aa
 *               billing_period:
 *                 type: string
 *                 description: Subscription billing cycle.
 *                 enum:
 *                   - monthly
 *                   - yearly
 *                 default: monthly
 *                 example: monthly
 *     responses:
 *       200:
 *         description: Subscription created successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 message:
 *                   type: string
 *                   example: Subscription created successfully
 *                 data:
 *                   type: object
 *                   properties:
 *                     subscriptionId:
 *                       type: string
 *                       example: sub_Qxyz123456789
 *                     status:
 *                       type: string
 *                       example: created
 *                     billingPeriod:
 *                       type: string
 *                       example: monthly
 *       401:
 *         description: Unauthorized request
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: false
 *                 message:
 *                   type: string
 *                   example: Unauthorized request
 *       404:
 *         description: User or plan not found
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: false
 *                 message:
 *                   type: string
 *                   example: Plan not found
 *       500:
 *         description: Internal server error
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: false
 *                 message:
 *                   type: string
 *                   example: An error occurred while creating subscription
 */
router.post("/create-subscription", auth, createRazorpayOrder);

/**
 * @swagger
 * /api/v1/plans/verify-payment:
 *   post:
 *     summary: Verify Razorpay payment
 *     description: Verifies Razorpay payment signature and activates user subscription.
 *     tags:
 *       - Subscription Plans
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - paymentId
 *               - orderId
 *               - signature
 *               - billing_period
 *               - userId
 *               - planId
 *             properties:
 *               paymentId:
 *                 type: string
 *                 example: pay_NAbCdEf1234567
 *               orderId:
 *                 type: string
 *                 example: order_NXyZaBc987654
 *               signature:
 *                 type: string
 *                 example: 9f1c2e8c6a7b1234567890abcdef1234567890abcdef1234567890abcdef12
 *               billing_period:
 *                 type: string
 *                 enum:
 *                   - monthly
 *                   - yearly
 *                 example: monthly
 *               userId:
 *                 type: string
 *                 example: 665fdc4a91ab1234567890ef
 *               planId:
 *                 type: string
 *                 example: 665fdc4a91ab1234567890aa
 *     responses:
 *       200:
 *         description: Razorpay payment verified successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 message:
 *                   type: string
 *                   example: Razorpay payment verified successfully
 *                 data:
 *                   type: object
 *                   nullable: true
 *       401:
 *         description: Unauthorized request
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: false
 *                 message:
 *                   type: string
 *                   example: Unauthorized request
 *       404:
 *         description: User not found
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: false
 *                 message:
 *                   type: string
 *                   example: User not found
 *       500:
 *         description: Internal server error
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: false
 *                 message:
 *                   type: string
 *                   example: An error occurred while verifying Razorpay payment
 */
router.post("/verify-payment", auth, verifyRazorpayPayment);

// router.post("/webhook", webhookController); // Endpoint to receive Razorpay webhooks

export default router;