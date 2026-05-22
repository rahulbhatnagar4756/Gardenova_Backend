import express from "express";
import  { getAllPlanswithDetails, updatePlanDetails } from "./subscriptionController";
import auth from "../../core/middleware/authMiddleware";

const router = express.Router();
/**
 * @swagger
 * /api/v1/plans/getplans:
 *   get:
 *     summary: Get all active subscription plans with details
 *     tags:
 *       - Plans
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
 * /updateplan/{planId}:
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

export default router;