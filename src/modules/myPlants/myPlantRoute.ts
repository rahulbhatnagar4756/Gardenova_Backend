import express from "express";
import auth from "../../core/middleware/authMiddleware";
import { AddPlantToUser, completeNotificationController, deleteUserPlantController, disableNotificationController, getAllPlants, getAllPlantsAdmin, getAllUserPlants,  getNotificationsController,  getPlantById,  getUserPlantById,  rescheduleNotificationController,  updateUserPlantController } from "./myPlantController";
import validateRequest from "../../core/middleware/validateRequest";
import { reminderValidation } from "./myPlantValidation";
import multer from "multer";
import path from "path";
import { importPlantsController } from "./myPlantController";
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
 *     description: Fetch the details of a plant by its unique UUID.
 *     tags: [My Plants]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         description: Unique ID of the plant
 *         schema:
 *           type: string
 *           format: id
 *           example: "1"
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
 *         description: Unauthorized - User must be authenticated
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
 *           type: string
 *           format: uuid
 *           example: "550e8400-e29b-41d4-a716-446655440000"
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
 * /api/v1/allPlants/updatePlant/{userPlantId}:
 *   patch:
 *     summary: Update care notification settings for a user's plant
 *     description: |
 *       Partially updates notification settings. Only care types whose
 *       `*_notification_enabled` field is present are updated — omitted types are untouched.
 *
 *       🔹 Rules:
 *       - When enabled: `reminder_frequency` must be > 0
 *       - When enabled: `preferred_time` required for watering and fertilizer only
 *       - When disabled: frequency resets to 0, preferred_time → null, next_*_at preserved
 *       - Each care type has its own optional note (max 500 chars)
 *
 *     tags: [My Plants]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: userPlantId
 *         required: true
 *         schema:
 *           type: integer
 *         example: 1
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               watering_notification_enabled:
 *                 type: boolean
 *               watering_preferred_time:
 *                 type: string
 *                 example: "08:00:00"
 *               watering_reminder_frequency:
 *                 type: integer
 *                 example: 3
 *               watering_note:
 *                 type: string
 *                 example: "Water at base, avoid leaves"
 *                 maxLength: 500
 *
 *               fertilizer_notification_enabled:
 *                 type: boolean
 *               fertilizer_preferred_time:
 *                 type: string
 *                 example: "09:00:00"
 *               fertilizer_reminder_frequency:
 *                 type: integer
 *                 example: 14
 *               fertilizer_note:
 *                 type: string
 *                 example: "Use liquid fertilizer, half dose"
 *                 maxLength: 500
 *
 *               pruning_notification_enabled:
 *                 type: boolean
 *               pruning_reminder_frequency:
 *                 type: integer
 *                 example: 30
 *               pruning_note:
 *                 type: string
 *                 example: "Trim dead branches only"
 *                 maxLength: 500
 *
 *               generic_notification_enabled:
 *                 type: boolean
 *               generic_care_reminder_frequency:
 *                 type: integer
 *                 example: 7
 *               generic_care_note:
 *                 type: string
 *                 example: "Rotate pot weekly for even sunlight"
 *                 maxLength: 500
 *     responses:
 *       200:
 *         description: Notification settings updated successfully
 *       400:
 *         description: Validation error (missing frequency, empty payload, etc.)
 *       401:
 *         description: Unauthorized
 *       404:
 *         description: Plant not found for this user
 *       500:
 *         description: Internal server error
 */
router.patch("/updatePlant/:userPlantId", auth, updateUserPlantController);

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
 *     security:
 *       - bearerAuth: []
 *
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - plant_id
 *             properties:
 *               plant_id:
 *                 type: integer
 *                 example: 5
 *
 *               watering_notification_enabled:
 *                 type: boolean
 *                 default: false
 *               watering_preferred_time:
 *                 type: string
 *                 example: "08:00:00"
 *                 description: Time of day for watering reminder (HH:mm:ss)
 *               watering_reminder_frequency:
 *                 type: integer
 *                 example: 3
 *                 description: Days between watering reminders
 *               watering_note:
 *                 type: string
 *                 example: "Water at base, avoid leaves"
 *                 description: Optional note for watering care (max 500 chars)
 *                 maxLength: 500
 *
 *               fertilizer_notification_enabled:
 *                 type: boolean
 *                 default: false
 *               fertilizer_preferred_time:
 *                 type: string
 *                 example: "09:00:00"
 *                 description: Time of day for fertilizer reminder (HH:mm:ss)
 *               fertilizer_reminder_frequency:
 *                 type: integer
 *                 example: 14
 *                 description: Days between fertilizer reminders
 *               fertilizer_note:
 *                 type: string
 *                 example: "Use liquid fertilizer, half dose"
 *                 description: Optional note for fertilizer care (max 500 chars)
 *                 maxLength: 500
 *
 *               pruning_notification_enabled:
 *                 type: boolean
 *                 default: false
 *               pruning_preferred_time:
 *                 type: string
 *                 example: "10:00:00"
 *                 description: Time of day for pruning reminder (HH:mm:ss)
 *               pruning_reminder_frequency:
 *                 type: integer
 *                 example: 30
 *                 description: Days between pruning reminders
 *               pruning_note:
 *                 type: string
 *                 example: "Trim dead branches only"
 *                 description: Optional note for pruning care (max 500 chars)
 *                 maxLength: 500
 *
 *               generic_notification_enabled:
 *                 type: boolean
 *                 default: false
 *               generic_care_preferred_time:
 *                 type: string
 *                 example: "09:00:00"
 *                 description: Time of day for generic care reminder (HH:mm:ss)
 *               generic_care_reminder_frequency:
 *                 type: integer
 *                 example: 7
 *                 description: Days between generic care reminders
 *               generic_care_note:
 *                 type: string
 *                 example: "Rotate pot weekly for even sunlight"
 *                 description: Optional note for generic care (max 500 chars)
 *                 maxLength: 500
 *
 *     responses:
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
 *           type: number
 *           format: id
 *           example: "1"
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
 * Multer disk storage configuration for plant CSV uploads.
 *
 * - Destination: `uploads/` directory (must exist on the server)
 * - Filename: prefixed with `plants-`, suffixed with a unique timestamp + random number
 *   to prevent collisions. Example: `plants-1715420000000-482910.csv`
 */
const storage = multer.diskStorage({
  /**
   * Sets the upload destination directory.
   * @param _req - Express request (unused)
   * @param _file - Uploaded file (unused)
   * @param cb - Multer callback
   */
  destination(_req, _file, cb) {
    cb(null, "uploads/");
  },

  /**
   * Generates a unique filename for the uploaded CSV.
   * @param _req - Express request (unused)
   * @param file - Uploaded file object
   * @param cb - Multer callback
   */
  filename(_req, file, cb) {
    const unique = `${Date.now()}-${Math.round(Math.random() * 1e6)}`;
    cb(null, `plants-${unique}${path.extname(file.originalname)}`);
  },
});

/**
 * Multer upload middleware configured for plant CSV imports.
 *
 * Constraints:
 * - **Max file size**: 500MB
 * - **Allowed types**: `.csv` only — rejects all other extensions with a 400 error
 * - **Storage**: disk (not memory) — safe for large files up to 300k rows
 *
 * Usage:
 * ```ts
 * router.post("/import", upload.single("file"), importPlantsController);
 * ```
 */
const upload = multer({
  storage,
  limits: { fileSize: 500 * 1024 * 1024 },

  /**

   * Restricts uploads to CSV files only.
   * @param _req - Express request (unused)
   * @param file - Uploaded file object
   * @param cb - Multer callback
   * @returns {void} Calls cb with an error if the file is not a CSV, otherwise accepts the file.
   */
  fileFilter(_req, file, cb) {
    if (path.extname(file.originalname).toLowerCase() !== ".csv") {
      return cb(new Error("Only CSV files are accepted."));
    }
    cb(null, true);
  },
});
/**
 * @swagger
 * /api/v1/allplants/import:
 *   post:
 *     summary: Bulk import plants from CSV
 *     description: >
 *       Uploads a CSV file and imports all rows into plantstable.
 *       The request stays open until every row is inserted — no polling needed.
 *       Expect the response to take 15–60 seconds for 300k rows.
 *     tags:
 *       - Plants Import
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
 *                 description: CSV file. First row must be headers.
 *     responses:
 *       200:
 *         description: Import completed successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 totalRows:
 *                   type: integer
 *                   example: 300000
 *                 insertedRows:
 *                   type: integer
 *                   example: 298500
 *                 skippedRows:
 *                   type: integer
 *                   example: 1200
 *                 errorRows:
 *                   type: integer
 *                   example: 300
 *                 durationMs:
 *                   type: integer
 *                   example: 18400
 *       400:
 *         description: No file or invalid file type
 *       500:
 *         description: Import failed
 */
router.post("/import", upload.single("file"), importPlantsController);
/**
 * @swagger
 * /api/v1/allplants/admin/getAllPlants:
 *   get:
 *     summary: Get all plants (Admin)
 *     description: Retrieve a list of all plants. Accessible only by authenticated admin users.
 *     tags:
 *       - [My Plants]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Successfully retrieved all plants
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
 *       401:
 *         description: Unauthorized
 *       500:
 *         description: Internal server error
 */
router.get("/admin/getAllPlants", auth, getAllPlantsAdmin);


/**
 * @swagger
 * /api/v1/allplants/deletePlant/{userPlantId}:
 *   delete:
 *     summary: Delete a user's plant
 *     description: Deletes a plant associated with the authenticated user.
 *     tags:
 *       - [My Plants]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: userPlantId
 *         required: true
 *         schema:
 *           type: string
 *         description: The ID of the user plant to delete
 *     responses:
 *       200:
 *         description: Plant deleted successfully
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
 *                   example: Plant deleted successfully
 *                 data:
 *                   nullable: true
 *                   example: null
 *       400:
 *         description: Bad request
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
 *                   example: User Plant ID is required
 *       401:
 *         description: Unauthorized
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
 *                   example: Something went wrong
 */
router.delete("/deletePlant/:userPlantId", auth, deleteUserPlantController);

/**
 * @swagger
 * /api/v1/allplants/user/notification/{activityType}/{eventType}:
 *   get:
 *     summary: Get user plant notifications
 *     description: |
 *       Returns plant notifications filtered by activity type and event type.
 *       Counts and upcoming_in_5_hours always reflect the full unfiltered dataset.
 *       Only the `tasks` array is paginated.
 *
 *       **Activity Types:** `water` | `fertilize` | `prune` | `generic` | `all`
 *
 *       **Event Types:** `upcoming` | `missed` | `completed` | `all`
 *     tags:
 *       - Notifications
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: activityType
 *         required: true
 *         schema:
 *           type: string
 *           enum: [water, fertilize, prune, generic, all]
 *         description: Filter tasks by care activity type. Use `all` to skip filtering.
 *       - in: path
 *         name: eventType
 *         required: true
 *         schema:
 *           type: string
 *           enum: [upcoming, missed, completed, all]
 *         description: Filter tasks by event status. Use `all` to skip filtering.
 *       - in: query
 *         name: page
 *         required: false
 *         schema:
 *           type: integer
 *           minimum: 1
 *           default: 1
 *         description: Page number for paginated tasks.
 *       - in: query
 *         name: limit
 *         required: false
 *         schema:
 *           type: integer
 *           minimum: 1
 *           maximum: 100
 *           default: 20
 *         description: Number of tasks per page.
 *     responses:
 *       200:
 *         description: Notifications retrieved successfully.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 message:
 *                   type: string
 *                 data:
 *                   type: object
 *                   properties:
 *                     counts:
 *                       type: object
 *                       properties:
 *                         all:       { type: integer }
 *                         upcoming:  { type: integer }
 *                         missed:    { type: integer }
 *                         completed: { type: integer }
 *                     upcoming_in_5_hours:
 *                       type: object
 *                       properties:
 *                         count: { type: integer }
 *                         tasks:
 *                           type: array
 *                           items:
 *                             $ref: '#/components/schemas/NotificationRow'
 *                     tasks:
 *                       type: array
 *                       items:
 *                         $ref: '#/components/schemas/NotificationRow'
 *                     pagination:
 *                       type: object
 *                       properties:
 *                         page:        { type: integer }
 *                         limit:       { type: integer }
 *                         total:       { type: integer }
 *                         total_pages: { type: integer }
 *                         has_next:    { type: boolean }
 *                         has_prev:    { type: boolean }
 *             example:
 *               success: true
 *               message: Notifications retrieved successfully
 *               data:
 *                 counts:
 *                   all: 47
 *                   upcoming: 12
 *                   missed: 30
 *                   completed: 5
 *                 upcoming_in_5_hours:
 *                   count: 2
 *                   tasks:
 *                     - id: "d5bcbf83-1234-5678-90ab-cdef12345678"
 *                       plant_id: 12
 *                       common_name: "Snake Plant"
 *                       scientific_name: "Dracaena trifasciata"
 *                       activity_type: "Watering"
 *                       event_type: "upcoming"
 *                       next_activity_at: "2026-06-23T08:30:00.000Z"
 *                       is_upcoming_in_5_hours: true
 *                 tasks:
 *                   - id: "a1b2c3d4-5678-90ab-cdef-111122223333"
 *                     plant_id: 7
 *                     common_name: "Pothos"
 *                     scientific_name: "Epipremnum aureum"
 *                     activity_type: "Watering"
 *                     event_type: "upcoming"
 *                     next_activity_at: "2026-06-24T10:00:00.000Z"
 *                     is_upcoming_in_5_hours: false
 *                 pagination:
 *                   page: 1
 *                   limit: 20
 *                   total: 12
 *                   total_pages: 1
 *                   has_next: false
 *                   has_prev: false
 *       400:
 *         description: Invalid activityType or eventType value.
 *       401:
 *         description: Unauthorized — missing or invalid token, or user not found.
 *       500:
 *         description: Internal server error.
 */
router.get(
  "/user/notification/:activityType/:eventType",
  auth,
  getNotificationsController
);

 
/**
 * @swagger
 * /api/v1/allplants/user/notifications/{userPlantId}/reschedule:
 *   patch:
 *     summary: Reschedule a plant care task to a new datetime
 *     tags:
 *       - Notifications
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: userPlantId
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: ID of the user_plant record
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - activityType
 *               - next_at
 *             properties:
 *               activityType:
 *                 type: string
 *                 enum: [water, fertilize, prune, generic]
 *                 description: The care activity to reschedule
 *               next_at:
 *                 type: string
 *                 format: date-time
 *                 example: "2025-06-15T09:00:00.000Z"
 *                 description: New scheduled datetime (ISO 8601)
 *     responses:
 *       200:
 *         description: Task rescheduled successfully
 *       400:
 *         description: Invalid activityType or missing fields
 *       401:
 *         description: Unauthorized
 */
router.patch(
    "/user/notifications/:userPlantId/reschedule",
    auth,
    rescheduleNotificationController
);
 
/**
 * @swagger
 * /api/v1/allplants/user/notifications/{userPlantId}/complete:
 *   patch:
 *     summary: Mark a plant care task as completed
 *     description: Sets last_at to NOW() and advances next_at by the reminder frequency. Uses Plan B completion logic.
 *     tags:
 *       - Notifications
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: userPlantId
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: ID of the user_plant record
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - activityType
 *             properties:
 *               activityType:
 *                 type: string
 *                 enum: [water, fertilize, prune, generic]
 *                 description: The care activity to mark as completed
 *     responses:
 *       200:
 *         description: Task marked as completed successfully
 *       400:
 *         description: Invalid activityType or frequency not set
 *       401:
 *         description: Unauthorized
 */
router.patch(
    "/user/notifications/:userPlantId/complete",
    auth,
    completeNotificationController
);
/**
 * @swagger
 * /api/v1/allplants/user/notifications/{userPlantId}/disable:
 *   patch:
 *     summary: Disable notifications for a specific care activity
 *     description: Sets notification_enabled to false and clears next_at. Task will no longer appear in notifications.
 *     tags:
 *       - Notifications
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: userPlantId
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: ID of the user_plant record
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - activityType
 *             properties:
 *               activityType:
 *                 type: string
 *                 enum: [water, fertilize, prune, generic]
 *                 description: The care activity to disable
 *     responses:
 *       200:
 *         description: Notification disabled successfully
 *       400:
 *         description: Invalid activityType or plant not found
 *       401:
 *         description: Unauthorized
 */
router.patch(
    "/user/notifications/:userPlantId/disable",
    auth,
    disableNotificationController
);

 
export default router;