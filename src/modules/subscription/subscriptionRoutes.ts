import express, { Router } from "express";
import auth from "../../core/middleware/authMiddleware";
import validateRequest from "../../core/middleware/validateRequest";
import { createPlanValidation } from "./subscriptionValidation";
import { CreatePlan, getActivePlansForProfessionals, getPlans, updatePlan, updateSubscriptionStatusById } from "./subscriptionController";



const router: Router = express.Router();
/**
 * @swagger
 * tags:
 *   name: Subscription
 *   description: Subscription plan management
 */

/**
 * @swagger
 * /api/v1/subscription:
 *   post:
 *     summary: Create subscription plan
 *     description: |
 *       **Admin only**. Creates a professional subscription plan.
 *
 *       ⚠️ Business rules:
 *       - Only 3 plans are allowed: **Talk, Gold, Diamante**
 *       - Plan names are immutable after creation
 *       - Annual price must be monthly_price × 12
 *       - Maximum of 3 plans can exist in the system
 *       - Subscriptions are for professionals only (customers are free)
 *       - Billing is annual (monthly price is display-only)
 *     tags:
 *       - Subscription
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - plan_name
 *               - description
 *               - price_monthly
 *               - price_annual
 *               - leads_limit
 *               - cities_coverage
 *               - appear_in_search
 *               - premium_profile_badge
 *               - priority_customer_support
 *               - status
 *             properties:
 *               plan_name:
 *                 type: string
 *                 enum:
 *                   - Talk
 *                   - Gold
 *                   - Diamante
 *                 example: Talk
 *               description:
 *                 type: string
 *                 example: Entry-level plan for professionals
 *               price_monthly:
 *                 type: number
 *                 example: 49
 *               price_annual:
 *                 type: number
 *                 example: 588
 *               leads_limit:
 *                 type: integer
 *                 nullable: true
 *                 description: null means unlimited leads
 *                 example: 0
 *               cities_coverage:
 *                 type: integer
 *                 example: 1
 *               appear_in_search:
 *                 type: boolean
 *                 example: false
 *               premium_profile_badge:
 *                 type: boolean
 *                 example: false
 *               priority_customer_support:
 *                 type: boolean
 *                 example: false
 *               status:
 *                 type: string
 *                 enum:
 *                   - active
 *                   - inactive
 *                 example: active
 *     responses:
 *       201:
 *         description: Subscription plan created successfully
 *       400:
 *         description: Validation or business rule error
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden (Admin only)
 */
router.post("/", auth, validateRequest(createPlanValidation), CreatePlan);


/**
 * @swagger
 * /api/v1/subscription:
 *   get:
 *     summary: Get all subscription plans
 *     description: Fetch all subscription plans
 *     tags: [Subscription]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Subscription plans fetched successfully
 *       401:
 *         description: Unauthorized
 */
router.get("/", auth, getPlans);

/**
 * @swagger
 * /api/v1/subscription/update:
 *   put:
 *     summary: Update subscription plan
 *     description: Admin only. Updates an existing subscription plan by ID. Plan name cannot be modified.
 *     tags:
 *       - Subscription
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Subscription plan ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - description
 *               - price_monthly
 *               - price_annual
 *               - leads_limit
 *               - cities_coverage
 *               - appear_in_search
 *               - premium_profile_badge
 *               - priority_customer_support
 *               - status
 *             properties:
 *               description:
 *                 type: string
 *                 example: Updated description for professionals
 *               price_monthly:
 *                 type: number
 *                 example: 59.99
 *               price_annual:
 *                 type: number
 *                 example: 599.99
 *               leads_limit:
 *                 type: integer
 *                 example: 300
 *               cities_coverage:
 *                 type: integer
 *                 example: 8
 *               appear_in_search:
 *                 type: boolean
 *                 example: true
 *               premium_profile_badge:
 *                 type: boolean
 *                 example: true
 *               priority_customer_support:
 *                 type: boolean
 *                 example: true
 *               status:
 *                 type: string
 *                 enum:
 *                   - active
 *                   - inactive
 *     responses:
 *       200:
 *         description: Subscription plan updated successfully
 *       400:
 *         description: Validation error
 *       401:
 *         description: Unauthorized
 *       404:
 *         description: Plan not found
 */
router.put("/update", auth,  updatePlan);

/**
 * @swagger
 * /api/v1/subscription/status/{id}:
 *   patch:
 *     summary: Update subscription plan status
 *     description: |
 *       **Admin only**. Activate or deactivate a subscription plan by ID.
 *
 *        Business rules:
 *       - Only the `status` field can be updated using this endpoint
 *       - Used to temporarily enable or disable a plan without modifying other details
 *     tags: [Subscription]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Subscription plan ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - status
 *             properties:
 *               status:
 *                 type: string
 *                 enum: [active, inactive]
 *                 example: inactive
 *     responses:
 *       200:
 *         description: Subscription plan status updated successfully
 *       400:
 *         description: Invalid status value
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden (Admin only)
 *       404:
 *         description: Subscription plan not found
 */
router.patch("/status/:id", auth, updateSubscriptionStatusById);

/**
 * @swagger
 * /api/v1/subscription/subscription-plans  :
 *   get:
 *     summary: "Retrieve the active subscription plans for professionals"
 *     description: "Fetches all active subscription plans available to professionals, ordered by type (silver, gold, platinum)."
 *     security:
 *       - bearerAuth: []  # Assuming you're using Bearer authentication
 *     tags:
 *       - Subscription
 *     responses:
 *       200:
 *         description: "Successfully retrieved active subscription plans."
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/SubscriptionPlan'
 *       401:
 *         description: "Unauthorized access. Missing or invalid token."
 *       500:
 *         description: "Internal server error."
 */
/**
 * @swagger
 * components:
 *   schemas:
 *     SubscriptionPlan:
 *       type: object
 *       properties:
 *         id:
 *           type: integer
 *           description: "The unique identifier for the subscription plan."
 *         name:
 *           type: string
 *           description: "The name of the subscription plan (e.g., silver, gold, platinum)."
 *         price:
 *           type: number
 *           format: float
 *           description: "The price of the subscription plan."
 *         features:
 *           type: array
 *           items:
 *             type: string
 *           description: "List of features provided by the subscription plan."
 *         created_at:
 *           type: string
 *           format: date-time
 *           description: "The timestamp when the subscription plan was created."
 *         updated_at:
 *           type: string
 *           format: date-time
 *           description: "The timestamp when the subscription plan was last updated."
 */
router.get("/subscription-plans", auth, getActivePlansForProfessionals);

export default router;
