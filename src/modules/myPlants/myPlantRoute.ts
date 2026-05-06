import express from "express";
import auth from "../../core/middleware/authMiddleware";
import { AddPlantToUser, getAllPlants, getAllUserPlants, getPlantById, getUserPlantById, updateUserPlantController } from "./myPlantController";
import validateRequest from "../../core/middleware/validateRequest";
import { importAllPlantsHandler } from "./importAllPlnatController";
import { importPlantCareHandler } from "./importPlantCareController";
import { importPlantToxicToPetsHandler } from "./importPetToxicPlantController";
import { reminderValidation } from "./myPlantValidation";
const router = express.Router();
/**
 * @swagger
 * /api/v1/allplants:
 *   get:
 *     summary: Get all plants (Paginated)
 *     description: Retrieve a paginated list of plants for the authenticated user. Requires a valid bearer token and user role "User".
 *     tags: [My Plants]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           default: 1
 *         description: The page number for pagination.
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 10
 *         description: The number of plants per page.
 *       - in: query
 *         name: search
 *         schema:
 *           type: string
 *         required: false
 *         description: Search plants by common name, scientific name, or description (case-insensitive, partial match supported).
 *        
 *     responses:
 *       200:
 *         description: Successfully retrieved list of plants.
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
 *                   example: Plants retrieved successfully
 *                 data:
 *                   type: object
 *                   properties:
 *                     currentPage:
 *                       type: integer
 *                       example: 1
 *                     totalPages:
 *                       type: integer
 *                       example: 10
 *                     totalCount:
 *                       type: integer
 *                       example: 100
 *                     limit:
 *                       type: integer
 *                       example: 10
 *                     plants:
 *                       type: array
 *                       items:
 *                         type: object
 *                         properties:
 *                           id:
 *                             type: integer
 *                             example: 1
 *                           scientific_name:
 *                             type: string
 *                             example: "Rosa rubiginosa"
 *                           common_name:
 *                             type: string
 *                             example: "Rose"
 *                           description:
 *                             type: string
 *                             example: "A beautiful flowering plant"
 *                           image_url:
 *                             type: string
 *                             example: "https://example.com/rose.jpg"
 *                           water_reminder_frequency:
 *                             type: string
 *                             example: "Every 2 days"
 *                           water_notification_enabled:
 *                             type: boolean
 *                             example: true
 *                           fertilizer_schedule:
 *                             type: string
 *                             example: "Monthly"
 *                           fertilizer_notification_enabled:
 *                             type: boolean
 *                             example: false
 *                           pruning_alert:
 *                             type: string
 *                             example: "Spring"
 *                           pruning_notification_enabled:
 *                             type: boolean
 *                             example: true
 *                           created_at:
 *                             type: string
 *                             format: date-time
 *                             example: "2024-01-15T10:30:00Z"
 *                           updated_at:
 *                             type: string
 *                             format: date-time
 *                             example: "2024-06-01T08:00:00Z"
 *       401:
 *         description: Unauthorized - User must be authenticated and have the correct role.
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
 *                   example: Unauthorized
 *       500:
 *         description: Internal Server Error
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
 *                   example: Something went wrong
 */
router.get("/",auth, getAllPlants);

/**
 * @swagger
 * tags:
 *   name: My Plants
 *   description: Plant management APIs
 */

/**
 * @swagger
 * /api/v1/allplants/{id}:
 *   get:
 *     summary: Get plant by ID
 *     description: Fetch the details of a plant by its unique serial ID.
 *     tags: [My Plants]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *           example: 1
 *         description: Unique serial ID of the plant
 *     responses:
 *       200:
 *         description: Plant details retrieved successfully
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
 *                   example: Plant details retrieved successfully
 *                 data:
 *                   $ref: '#/components/schemas/PlantRecommendation'
 *       400:
 *         description: Bad Request (Invalid or missing ID)
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
 *                   example: Plant ID is required
 *       401:
 *         description: Unauthorized - User must be authenticated.
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
 *                   example: Unauthorized
 *       404:
 *         description: Plant not found
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
 *                   example: Plant not found
 *       500:
 *         description: Internal Server Error
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
 *                   example: Something went wrong
 */

/**
 * @swagger
 * components:
 *   schemas:
 *     PlantRecommendation:
 *       type: object
 *       properties:
 *         id:
 *           type: integer
 *           example: 1
 *         name:
 *           type: string
 *           example: Rose
 *         description:
 *           type: string
 *           example: A beautiful flowering plant.
 *         imageUrl:
 *           type: string
 *           example: https://example.com/rose.jpg
 *         createdAt:
 *           type: string
 *           format: date-time
 *           example: 2023-02-01T10:00:00Z
 *         updatedAt:
 *           type: string
 *           format: date-time
 *           example: 2023-02-01T10:00:00Z
 *
 *   securitySchemes:
 *     bearerAuth:
 *       type: http
 *       scheme: bearer
 *       bearerFormat: JWT
 */
router.get("/:id",auth, getPlantById);
/**
 * @swagger
 * components:
 *   schemas:
 *     UpdateUserPlantRequest:
 *       type: object
 *       description: >
 *         Flat notification settings payload. Only fields that are provided will be updated.
 *         At least one `*_notification_enabled` field must be present.
 *         When a care type's `notification_enabled` is `true`:
 *           - `reminder_frequency` is required and must be > 0.
 *           - `preferred_time` is required for `watering` and `fertilizer` only.
 *         When `notification_enabled` is `false`: frequency resets to 0, preferred_time to null,
 *         and `next_*_at` is preserved.
 *         `pruning` and `generic` do not have a `preferred_time` field.
 *       properties:
 *         plant_id:
 *           type: integer
 *           nullable: true
 *           description: Ignored by this endpoint. Accepted so clients can reuse the add-plant body.
 *           example: 1
 *
 *         watering_notification_enabled:
 *           type: boolean
 *           description: Toggle watering notifications on or off.
 *           example: true
 *         watering_preferred_time:
 *           type: string
 *           format: time
 *           nullable: true
 *           description: Required when watering_notification_enabled is true.
 *           example: "09:00:00"
 *         watering_reminder_frequency:
 *           type: integer
 *           nullable: true
 *           description: Frequency in days. Required and must be > 0 when watering_notification_enabled is true.
 *           example: 3
 *
 *         fertilizer_notification_enabled:
 *           type: boolean
 *           description: Toggle fertilizer notifications on or off.
 *           example: false
 *         fertilizer_preferred_time:
 *           type: string
 *           format: time
 *           nullable: true
 *           description: Required when fertilizer_notification_enabled is true.
 *           example: "09:00:00"
 *         fertilizer_reminder_frequency:
 *           type: integer
 *           nullable: true
 *           description: Frequency in days. Required and must be > 0 when fertilizer_notification_enabled is true.
 *           example: 15
 *
 *         pruning_notification_enabled:
 *           type: boolean
 *           description: Toggle pruning notifications on or off.
 *           example: false
 *         pruning_reminder_frequency:
 *           type: integer
 *           nullable: true
 *           description: Frequency in days. Required and must be > 0 when pruning_notification_enabled is true.
 *           example: 30
 *
 *         generic_notification_enabled:
 *           type: boolean
 *           description: Toggle generic care notifications on or off.
 *           example: false
 *         generic_care_reminder_frequency:
 *           type: integer
 *           nullable: true
 *           description: Frequency in days. Required and must be > 0 when generic_notification_enabled is true.
 *           example: 7
 */

/**
 * @swagger
 * /api/v1/allPlants/updatePlant/{userPlantId}:
 *   patch:
 *     summary: Update care notification settings for a user's plant
 *     description: |
 *       Partially updates notification settings using a flat payload (same shape as the add-plant API).
 *
 *       **Rules:**
 *       - Only care types whose `*_notification_enabled` field is present in the request are updated — omitted types are untouched.
 *       - When `*_notification_enabled` is `true`: `*_reminder_frequency` is required and must be > 0.
 *         `*_preferred_time` is required for `watering` and `fertilizer` only.
 *         `next_*_at` is recalculated as `NOW() + reminder_frequency days`.
 *       - When `*_notification_enabled` is `false`: frequency resets to `0`,
 *         preferred_time is set to `null`, and `next_*_at` is **preserved**.
 *       - `pruning` and `generic` have no `preferred_time` field.
 *       - `plant_id` in the body is accepted but ignored — the plant is identified by the path param.
 *     tags:
 *       - My Plants
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: userPlantId
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: UUID of the user_plant record to update
 *         example: "a1b2c3d4-e5f6-7890-abcd-ef1234567890"
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/UpdateUserPlantRequest'
 *           examples:
 *             toggle_watering_on:
 *               summary: Toggle watering ON
 *               value:
 *                 watering_notification_enabled: true
 *                 watering_preferred_time: "09:00:00"
 *                 watering_reminder_frequency: 3
 *             toggle_fertilizer_off:
 *               summary: Toggle fertilizer OFF
 *               value:
 *                 fertilizer_notification_enabled: false
 *             full_payload:
 *               summary: Full flat payload (same as add-plant body)
 *               value:
 *                 plant_id: 1
 *                 watering_notification_enabled: true
 *                 watering_preferred_time: "09:00:00"
 *                 watering_reminder_frequency: 3
 *                 fertilizer_notification_enabled: false
 *                 fertilizer_preferred_time: "09:00:00"
 *                 fertilizer_reminder_frequency: 15
 *                 pruning_notification_enabled: false
 *                 pruning_reminder_frequency: 30
 *                 generic_notification_enabled: false
 *                 generic_care_reminder_frequency: 7
 *             update_multiple:
 *               summary: Update a subset of care types
 *               value:
 *                 watering_notification_enabled: true
 *                 watering_preferred_time: "07:00:00"
 *                 watering_reminder_frequency: 2
 *                 pruning_notification_enabled: true
 *                 pruning_reminder_frequency: 14
 *     responses:
 *       200:
 *         description: Notification settings updated successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: "Plant notifications updated successfully"
 *                 data:
 *                   $ref: '#/components/schemas/UserPlantResponse'
 *       400:
 *         description: Validation error
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *             examples:
 *               missing_frequency:
 *                 value:
 *                   message: "watering: reminder_frequency is required and must be > 0 when notification is enabled"
 *               missing_time:
 *                 value:
 *                   message: "watering: preferred_time is required when notification is enabled"
 *               empty_payload:
 *                 value:
 *                   message: "At least one care type must be provided"
 *       401:
 *         description: Unauthorized — missing or invalid token
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: "Unauthorized"
 *       404:
 *         description: Plant not found for this user
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: "Plant not found for this user"
 *       500:
 *         description: Internal server error
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: "Internal server error"
 */
router.patch("/updatePlant/:userPlantId", auth, updateUserPlantController);

/**
 * @swagger
 * tags:
 *   name: My Plants
 *   description: User plant management APIs
 */

/**
 * @swagger
 * components:
 *   securitySchemes:
 *     bearerAuth:
 *       type: http
 *       scheme: bearer
 *       bearerFormat: JWT
 *
 *   schemas:
 *
 *     TimeString:
 *       type: string
 *       pattern: '^([01]\d|2[0-3]):([0-5]\d):([0-5]\d)$'
 *       example: "09:00:00"
 *       description: Time in HH:mm:ss format
 *
 *     AddUserPlantRequest:
 *       type: object
 *       required:
 *         - plant_id
 *       properties:
 *
 *         plant_id:
 *           type: integer
 *           example: 1
 *           description: ID of the plant species to add
 *
 *         # ───────────── WATERING ─────────────
 *         watering_notification_enabled:
 *           type: boolean
 *           default: false
 *           description: Enable watering notifications
 *
 *         watering_preferred_time:
 *           $ref: '#/components/schemas/TimeString'
 *           description: Preferred time for watering reminder. Defaults to "09:00:00"
 *
 *         watering_reminder_frequency:
 *           type: integer
 *           minimum: 0
 *           example: 3
 *           description: Watering interval in days. Defaults to 0
 *
 *         # ───────────── FERTILIZER ─────────────
 *         fertilizer_notification_enabled:
 *           type: boolean
 *           default: false
 *           description: Enable fertilizer notifications
 *
 *         fertilizer_preferred_time:
 *           $ref: '#/components/schemas/TimeString'
 *           description: Preferred time for fertilizer reminder. Defaults to "09:00:00"
 *
 *         fertilizer_reminder_frequency:
 *           type: integer
 *           minimum: 0
 *           example: 15
 *           description: Fertilizing interval in days. Defaults to 0
 *
 *         # ───────────── PRUNING ─────────────
 *         pruning_notification_enabled:
 *           type: boolean
 *           default: false
 *           description: Enable pruning notifications
 *
 *         pruning_reminder_frequency:
 *           type: integer
 *           minimum: 0
 *           example: 30
 *           description: Pruning interval in days. Defaults to 0
 *
 *         # ───────────── GENERIC CARE ─────────────
 *         generic_notification_enabled:
 *           type: boolean
 *           default: false
 *           description: Enable generic care notifications
 *
 *         generic_care_reminder_frequency:
 *           type: integer
 *           minimum: 0
 *           example: 7
 *           description: Generic care interval in days. Defaults to 0
 *
 *     UserPlantResponse:
 *       type: object
 *       properties:
 *
 *         id:
 *           type: string
 *           format: uuid
 *
 *         user_id:
 *           type: string
 *           format: uuid
 *
 *         plant_id:
 *           type: integer
 *
 *         added_at:
 *           type: string
 *           format: date-time
 *
 *         # ───────────── WATERING ─────────────
 *         watering_notification_enabled:
 *           type: boolean
 *
 *         watering_preferred_time:
 *           $ref: '#/components/schemas/TimeString'
 *
 *         watering_reminder_frequency:
 *           type: integer
 *
 *         last_watered_at:
 *           type: string
 *           format: date-time
 *           nullable: true
 *
 *         next_watered_at:
 *           type: string
 *           format: date-time
 *           nullable: true
 *
 *         # ───────────── FERTILIZER ─────────────
 *         fertilizer_notification_enabled:
 *           type: boolean
 *
 *         fertilizer_preferred_time:
 *           $ref: '#/components/schemas/TimeString'
 *
 *         fertilizer_reminder_frequency:
 *           type: integer
 *
 *         last_fertilized_at:
 *           type: string
 *           format: date-time
 *           nullable: true
 *
 *         next_fertilized_at:
 *           type: string
 *           format: date-time
 *           nullable: true
 *
 *         # ───────────── PRUNING ─────────────
 *         pruning_notification_enabled:
 *           type: boolean
 *
 *         pruning_reminder_frequency:
 *           type: integer
 *
 *         last_pruned_at:
 *           type: string
 *           format: date-time
 *           nullable: true
 *
 *         next_pruned_at:
 *           type: string
 *           format: date-time
 *           nullable: true
 *
 *         # ───────────── GENERIC CARE ─────────────
 *         generic_notification_enabled:
 *           type: boolean
 *
 *         generic_care_reminder_frequency:
 *           type: integer
 *
 *         last_generic_care_at:
 *           type: string
 *           format: date-time
 *           nullable: true
 *
 *         next_generic_care_at:
 *           type: string
 *           format: date-time
 *           nullable: true
 *
 *         health_status:
 *           type: string
 *           example: "healthy"
 *
 *         created_at:
 *           type: string
 *           format: date-time
 *
 *         updated_at:
 *           type: string
 *           format: date-time
 *
 *     ErrorResponse:
 *       type: object
 *       properties:
 *         success:
 *           type: boolean
 *           example: false
 *         message:
 *           type: string
 *           example: "Plant species not found"
 */

/**
 * @swagger
 * /api/v1/allPlants/addplant:
 *   post:
 *     summary: Add plant to user's collection
 *     description: |
 *       Adds a plant to the authenticated user's collection.
 *
 *       🔹 Rules:
 *       - `plant_id` is required
 *       - If notification is disabled → next_* field will be null
 *       - Frequency defaults to 0 if not provided
 *       - Preferred time defaults to "09:00:00" if not provided
 *
 *     tags: [My Plants]
 *
 *     security:
 *       - bearerAuth: []
 *
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/AddUserPlantRequest'
 *
 *     responses:
 *
 *       201:
 *         description: Plant added successfully
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
 *                   example: "Plant added successfully"
 *                 data:
 *                   $ref: '#/components/schemas/UserPlantResponse'
 *
 *       400:
 *         description: Validation failed or missing plant_id
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *
 *       401:
 *         description: Unauthorized — invalid or missing token
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *
 *       404:
 *         description: Plant species not found
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *
 *       409:
 *         description: Plant already added to user
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *
 *       500:
 *         description: Internal server error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 */
router.post("/addplant", auth, validateRequest(reminderValidation), AddPlantToUser);
/**
 * @swagger
 * /api/v1/allPlants/user/myplants:
 *   get:
 *     summary: Get all plants of the authenticated user
 *     tags: [My Plants]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           default: 1
 *         description: Page number for pagination
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 10
 *         description: Number of records per page
 *       - in: query
 *         name: search
 *         schema:
 *           type: string
 *         description: Search by plant name or nickname
 *     responses:
 *       200:
 *         description: User plants retrieved successfully
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
 *                   example: User plants retrieved successfully
 *                 data:
 *                   type: object
 *                   properties:
 *                     plants:
 *                       type: array
 *                       items:
 *                         $ref: '#/components/schemas/PlantRecommendation'
 *                     pagination:
 *                       type: object
 *                       properties:
 *                         currentPage:
 *                           type: integer
 *                           example: 1
 *                         totalPages:
 *                           type: integer
 *                           example: 5
 *                         totalItems:
 *                           type: integer
 *                           example: 45
 *       400:
 *         description: Bad Request
 *       401:
 *         description: Unauthorized
 *       404:
 *         description: User not found
 *       500:
 *         description: Internal Server Error
 */
router.get("/user/myplants", auth, getAllUserPlants);

/**
 * @swagger
 * tags:
 *   name: My Plants
 *   description: Plant management APIs
 */

/**
 * @swagger
 * /api/v1/allplants/user/plants/{id}:
 *   get:
 *     summary: Get a specific plant of the authenticated user
 *     description: Fetch the details of a specific plant owned by the authenticated user.
 *     tags: [My Plants]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: integer
 *           example: 1
 *         description: Unique identifier for the user's plant
 *     responses:
 *       200:
 *         description: User's plant details retrieved successfully
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
 *                   example: User plant retrieved successfully
 *                 data:
 *                   $ref: '#/components/schemas/PlantRecommendation'
 *       400:
 *         description: Bad Request (Missing or invalid plant ID)
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
 *                   example: Plant ID is required
 *       401:
 *         description: Unauthorized - User must be authenticated and authorized
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
 *                   example: Unauthorized
 *       404:
 *         description: Plant not found
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
 *                   example: Plant not found
 *       500:
 *         description: Internal Server Error
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
 *                   example: Something went wrong
 */

/**
 * @swagger
 * components:
 *   securitySchemes:
 *     bearerAuth:
 *       type: http
 *       scheme: bearer
 *       bearerFormat: JWT
 */

router.get("/user/plants/:id", auth, getUserPlantById);

/**
 * @swagger
 * /api/v1/allplants/importAllPlants:
 *   post:
 *     summary: Import all plants from an Excel file
 *     tags:
 *       - [My Plants] 
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             required:
 *               - file
 *             properties:
 *               file:
 *                 type: string
 *                 format: binary
 *                 description: Excel file containing plant data
 *     responses:
 *       200:
 *         description: Plants imported successfully
 *       400:
 *         description: Invalid file or data
 *       401:
 *         description: Unauthorized
 *       500:
 *         description: Server error
 */
router.post("/importAllPlants", auth, ...importAllPlantsHandler);


/**
 * @swagger
 * /api/v1/allplants/importPlantCareData:
 *   post:
 *     summary: Import all plants from an Excel file
 *     tags:
 *       - [My Plants] 
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             required:
 *               - file
 *             properties:
 *               file:
 *                 type: string
 *                 format: binary
 *                 description: Excel file containing plant data
 *     responses:
 *       200:
 *         description: Plants imported successfully
 *       400:
 *         description: Invalid file or data
 *       401:
 *         description: Unauthorized
 *       500:
 *         description: Server error
 */
router.post("/importPlantCareData", auth, ...importPlantCareHandler);



/**
 * @swagger
 * /api/v1/allplants/importPlantToxicToPets:
 *   post:
 *     summary: Import all plants from an Excel file
 *     tags:
 *       - [My Plants] 
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             required:
 *               - file
 *             properties:
 *               file:
 *                 type: string
 *                 format: binary
 *                 description: Excel file containing plant data
 *     responses:
 *       200:
 *         description: Plants imported successfully
 *       400:
 *         description: Invalid file or data
 *       401:
 *         description: Unauthorized
 *       500:
 *         description: Server error
 */
router.post("/importPlantToxicToPets", auth, ...importPlantToxicToPetsHandler);

export default router;