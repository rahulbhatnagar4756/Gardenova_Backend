import express from "express";
import  { createRazorpayOrder, getAllPlanswithDetails, getPlanDetailsById, updatePlanDetails, verifyRazorpayPayment } from "./subscriptionController";
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
 * /api/v1/plans/create-order:
 *   post:
 *     summary: Create Razorpay order
 *     description: Creates a Razorpay payment order for subscription or plan purchase.
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
 *               - amount
 *               - currency
 *               - billing_period
 *               - userId
 *               - planId
 *             properties:
 *               amount:
 *                 type: number
 *                 example: 499
 *               currency:
 *                 type: string
 *                 example: INR
 *               billing_period:
 *                 type: string
 *                 example: monthly
 *               userId:
 *                 type: string
 *                 example: 665fdc4a91ab1234567890ef
 *               planId:
 *                 type: string
 *                 example: 665fdc4a91ab1234567890aa
 *               rec:
 *                 type: boolean
 *                 example: false
 *     responses:
 *       200:
 *         description: Razorpay order created successfully
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
 *                   example: Razorpay order created successfully
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
 *                   example: An error occurred while creating Razorpay order
 */
router.post("/create-order", auth, createRazorpayOrder);
// router.post("/create-order", auth, createRazorpayOrder );


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