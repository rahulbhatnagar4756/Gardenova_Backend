import express from "express";
import {
  cancelSubscription,
  getAllPlanswithDetails,
  getMySubscription,
  googlePlayWebhook,
  verifySubscription,
} from "./subscriptionController";
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
 *       401:
 *         description: Unauthorized
 */
router.get("/getplans", auth, getAllPlanswithDetails);

/**
 * @swagger
 * /api/v1/plans/subscriptions/verify:
 *   post:
 *     summary: Verify a Google Play Billing purchase and activate or defer subscription
 *     description: >
 *       Called by the Android app after BillingClient returns a purchase.
 *       Verifies the purchaseToken with Google Play, acknowledges it, and
 *       updates the local user_subscriptions row.
 *
 *       Android replacement mode (required when user already has an active sub
 *       in the same subscription group):
 *       - Upgrade (higher tier / higher price): ReplacementMode.CHARGE_FULL_PRICE
 *         → backend activates the new plan immediately and clears pending_plan.
 *       - Downgrade (lower tier / lower price): ReplacementMode.DEFERRED
 *         → backend keeps the current plan active (does NOT switch to free),
 *         sets pending_plan_id, and switches at current_period_end when Play RTDN confirms.
 *       Verify always returns the same JSON shape for upgrade and downgrade:
 *       { verified, status, activated, deferred, planCode, pendingPlanCode, pendingEffectiveAt }
 *       (pending_* are null when not deferred). Success message is the same when activated.
 *       Always call this endpoint with the returned purchaseToken after purchase.
 *       Use GET /subscriptions/me for current plan + pending_plan + pending_effective_at.
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
 *               - purchaseToken
 *               - productId
 *             properties:
 *               purchaseToken:
 *                 type: string
 *               productId:
 *                 type: string
 *                 example: starter
 *               basePlanId:
 *                 type: string
 *                 example: monthly
 *               orderId:
 *                 type: string
 *     responses:
 *       200:
 *         description: >
 *           Purchase verified. Same success envelope and data keys for upgrade and
 *           downgrade (pendingPlanCode / pendingEffectiveAt are null unless deferred).
 *       400:
 *         description: Invalid purchase or missing fields
 *       401:
 *         description: Unauthorized
 */
router.post("/subscriptions/verify", auth, verifySubscription);

/**
 * @swagger
 * /api/v1/plans/subscriptions/me:
 *   get:
 *     summary: Get the authenticated user's current subscription details
 *     tags:
 *       - Subscription Plans
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Subscription details
 *       401:
 *         description: Unauthorized
 */
router.get("/subscriptions/me", auth, getMySubscription);

/**
 * @swagger
 * /api/v1/plans/subscriptions/cancel:
 *   post:
 *     summary: Mark subscription to cancel at period end (local)
 *     description: >
 *       Sets cancel_at_period_end locally. The user should also turn off
 *       auto-renew in Google Play / BillingClient; RTDN syncs final status.
 *     tags:
 *       - Subscription Plans
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Cancellation recorded
 *       401:
 *         description: Unauthorized
 */
router.post("/subscriptions/cancel", auth, cancelSubscription);

/**
 * @swagger
 * /api/v1/plans/webhooks/google-play:
 *   post:
 *     summary: Google Play RTDN (Pub/Sub push) receiver
 *     description: >
 *       Receives Real-time Developer Notifications via Cloud Pub/Sub push.
 *       Acknowledges immediately and processes subscription renewals /
 *       cancellations asynchronously.
 *     tags:
 *       - Subscription Plans
 *     responses:
 *       200:
 *         description: Webhook accepted
 */
router.post("/webhooks/google-play", googlePlayWebhook);

export default router;
