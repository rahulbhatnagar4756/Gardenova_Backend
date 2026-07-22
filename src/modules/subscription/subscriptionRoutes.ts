import express, { raw } from "express";
import { cancelSubscription, createSubscription, getAllPlanswithDetails, getMySubscription, razorpayWebhook, verifySubscription } from "./subscriptionController";
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
 *                       id:
 *                         type: string
 *                         format: uuid
 *                       code:
 *                         type: string
 *                         example: plus_yearly
 *                       tier:
 *                         type: string
 *                         enum: [free, starter, plus, pro]
 *                       billing_cycle:
 *                         type: string
 *                         enum: [monthly, yearly]
 *                         nullable: true
 *                       price_inr:
 *                         type: integer
 *                         example: 1999
 *                       razorpay_plan_id:
 *                         type: string
 *                         nullable: true
 *                       features:
 *                         type: array
 *                         items:
 *                           type: object
 *                           properties:
 *                             key:
 *                               type: string
 *                               example: diagnosis_scans
 *                             label:
 *                               type: string
 *                               example: 30 Diagnosis Scans
 *                             enabled:
 *                               type: boolean
 *       401:
 *         description: Unauthorized
 *       500:
 *         description: Internal server error
 */
router.get("/getplans", auth, getAllPlanswithDetails);

/**
 * @swagger
 * /api/v1/plans/subscriptions/create:
 *   post:
 *     summary: Create a new Razorpay subscription for the authenticated user
 *     description: >
 *       Creates (or reuses) a Razorpay customer for the user, then creates a
 *       Razorpay subscription for the given plan. The returned subscriptionId
 *       and keyId should be used to open Razorpay Checkout on the frontend.
 *       The local subscription row is saved with status 'pending' — it only
 *       flips to 'active' once the webhook confirms payment.
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
 *               - planCode
 *             properties:
 *               planCode:
 *                 type: string
 *                 example: plus_yearly
 *                 description: Must match a code in subscription_plans
 *     responses:
 *       200:
 *         description: Subscription created, ready for checkout
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
 *                       example: sub_QRstUvWxYZ1234
 *                     keyId:
 *                       type: string
 *                       example: rzp_test_XXXXXXXXXXXX
 *       400:
 *         description: planCode missing or invalid
 *       401:
 *         description: Unauthorized
 *       500:
 *         description: Internal server error
 */
router.post("/subscriptions/create", auth, createSubscription);

/**
 * @swagger
 * /api/v1/plans/subscriptions/verify:
 *   post:
 *     summary: Verify Razorpay Checkout payment and wait for activation
 *     description: >
 *       Called by the frontend immediately after Razorpay Checkout's handler
 *       callback fires. Confirms the payment signature is valid and belongs to
 *       the authenticated user, then waits (up to ~15 seconds) for the
 *       /webhooks/razorpay handler to activate the subscription locally.
 *       If the webhook is slow, falls back to fetching live status from
 *       Razorpay and activating when the subscription is already
 *       active/authenticated. May take up to ~15s — show a loading state.
 *       Treat verified=true + status=pending as payment OK (still confirming);
 *       do not start a second checkout.
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
 *               - razorpay_payment_id
 *               - razorpay_subscription_id
 *               - razorpay_signature
 *             properties:
 *               razorpay_payment_id:
 *                 type: string
 *                 example: pay_QRstUvWxYZ1234
 *               razorpay_subscription_id:
 *                 type: string
 *                 example: sub_QRstUvWxYZ1234
 *               razorpay_signature:
 *                 type: string
 *                 example: 5f7e2a8c9b1d3e4f5a6b7c8d9e0f1a2b...
 *     responses:
 *       200:
 *         description: Payment signature verified (activation may still be pending)
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
 *                   example: Subscription verified successfully
 *                 data:
 *                   type: object
 *                   properties:
 *                     verified:
 *                       type: boolean
 *                       example: true
 *                     status:
 *                       type: string
 *                       enum: [active, pending]
 *                       example: active
 *                     activated:
 *                       type: boolean
 *                       example: true
 *       400:
 *         description: Missing fields or signature verification failed
 *       401:
 *         description: Unauthorized
 *       500:
 *         description: Internal server error
 */
router.post("/subscriptions/verify", auth, verifySubscription);

/**
 * @swagger
 * /api/v1/plans/subscriptions/me:
 *   get:
 *     summary: Get the authenticated user's current subscription details
 *     description: >
 *       Resolves the user's active plan (falling back to the free plan if no
 *       active paid subscription exists), along with current usage counters
 *       and billing period info.
 *     tags:
 *       - Subscription Plans
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Subscription details fetched successfully
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
 *                   example: Subscription details fetched successfully
 *                 data:
 *                   type: object
 *                   properties:
 *                     plan:
 *                       type: object
 *                       properties:
 *                         code:
 *                           type: string
 *                           example: plus_yearly
 *                         tier:
 *                           type: string
 *                           example: plus
 *                         billing_cycle:
 *                           type: string
 *                           example: yearly
 *                         features:
 *                           type: object
 *                     status:
 *                       type: string
 *                       enum: [active, pending, paused, halted, cancelled, expired]
 *                     current_period_end:
 *                       type: string
 *                       format: date-time
 *                       nullable: true
 *                     cancel_at_period_end:
 *                       type: boolean
 *                     usage:
 *                       type: object
 *                       properties:
 *                         diagnosis_scans_used:
 *                           type: integer
 *                           example: 4
 *                         landscape_gens_used:
 *                           type: integer
 *                           example: 1
 *       401:
 *         description: Unauthorized
 *       500:
 *         description: Internal server error
 */
router.get("/subscriptions/me", auth, getMySubscription);

/**
 * @swagger
 * /api/v1/plans/subscriptions/cancel:
 *   post:
 *     summary: Cancel the authenticated user's active subscription
 *     description: >
 *       Sets cancel_at_cycle_end on the Razorpay subscription — the user
 *       retains access until current_period_end, after which they fall
 *       back to the free plan. Does not cancel immediately.
 *     tags:
 *       - Subscription Plans
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Cancellation scheduled successfully
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
 *                   example: Subscription cancelled successfully
 *                 data:
 *                   type: object
 *                   properties:
 *                     cancel_at_period_end:
 *                       type: boolean
 *                       example: true
 *                     active_until:
 *                       type: string
 *                       format: date-time
 *       400:
 *         description: No active paid subscription to cancel, or already on free plan
 *       401:
 *         description: Unauthorized
 *       500:
 *         description: Internal server error
 */
router.post("/subscriptions/cancel", auth, cancelSubscription);

/**
 * @swagger
 * /api/v1/plans/webhooks/razorpay:
 *   post:
 *     summary: Razorpay webhook receiver
 *     description: >
 *       Public endpoint (no auth) called server-to-server by Razorpay whenever
 *       a subscription lifecycle event occurs (activated, charged, halted,
 *       cancelled, completed, etc). Verifies X-Razorpay-Signature against
 *       RAZORPAY_WEBHOOK_SECRET using the raw request body, then processes
 *       the event idempotently via razorpay_webhook_events. This is the
 *       source of truth for subscription status — do not rely on /verify
 *       for activation.
 *     tags:
 *       - Subscription Plans
 *     parameters:
 *       - in: header
 *         name: X-Razorpay-Signature
 *         required: true
 *         schema:
 *           type: string
 *         description: HMAC-SHA256 signature of the raw request body, signed with the webhook secret
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               event:
 *                 type: string
 *                 example: subscription.charged
 *               created_at:
 *                 type: integer
 *               payload:
 *                 type: object
 *     responses:
 *       200:
 *         description: Webhook processed (or already processed — Razorpay retried delivery)
 *       400:
 *         description: Missing or invalid signature
 *       500:
 *         description: Internal server error
 */
router.post(
  "/webhooks/razorpay",
  raw({ type: "application/json" }),
  razorpayWebhook
);

export default router;