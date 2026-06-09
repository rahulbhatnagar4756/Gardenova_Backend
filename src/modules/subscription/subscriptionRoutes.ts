import express from "express";
import  {  getAllPlanswithDetails } from "./subscriptionController";
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
router.get("/getplans",auth, getAllPlanswithDetails);


// router.post("/verify",auth, verifyPurchase);


export default router;