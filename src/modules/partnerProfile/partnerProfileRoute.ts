// src/modules/partnerProfile/partnerProfileRoutes.ts
import { Router } from "express";
import {
  updatePartnerProfile,
  deletePartnerProfile,
  getAllPartnerProfiles,
  updatePartnerRating,
  createPartnerProfileController,
  updatePartnerStatusController,
  getPartnerProfileByIdController,
} from "./partnerProfileController";
import {
  createPartnerProfileValidation,
  updatePartnerProfileValidation,
  updatePartnerRatingValidation,
  updatePartnerStatusValidation,
} from "./partnerProfileValidation";
import validateRequest from "../../core/middleware/validateRequest";
import auth from "../../core/middleware/authMiddleware";

const router = Router();

/**
 * @swagger
 * tags:
 *   name: PartnerProfile
 *   description: Partner profile management endpoints
 */

/**
 * @swagger
 * /api/v1/partnerProfile:
 *   post:
 *     summary: Create partner profile
 *     description: Creates a profile for the authenticated partner. Each partner can have only one profile.
 *     tags: [PartnerProfile]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               email:
 *                 type: string
 *                 example: partner@example.com
 *               mobileNumber:
 *                 type: string
 *                 example: "+14155552671"
 *               companyName:
 *                 type: string
 *                 example: Acme Solutions
 *               speciality:
 *                 type: array
 *                 items:
 *                   type: string
 *                 example: ["cardiology", "telemedicine"]
 *               address:
 *                 type: object
 *                 properties:
 *                   street:
 *                     type: string
 *                     example: "123 Main St"
 *                   city:
 *                     type: string
 *                     example: "New York"
 *                   state:
 *                     type: string
 *                     example: "NY"
 *                   country:
 *                     type: string
 *                     example: "USA"
 *                   zipCode:
 *                     type: string
 *                     example: "10001"
 *               website:
 *                 type: string
 *                 example: "https://acme.example.com"
 *               contactPerson:
 *                 type: string
 *                 example: "Jane Doe"
 *               projectImageUrl:
 *                 type: string
 *                 description: URL
 *               status:
 *                 type: string
 *                 enum: [active, inactive, pending, suspended]
 *     responses:
 *       201:
 *         description: Profile created successfully
 *       409:
 *         description: Profile already exists
 *       401:
 *         description: Unauthorized
 *       400:
 *         description: Validation error
 */
router.post(
  "/",
  auth,
  validateRequest(createPartnerProfileValidation),
  createPartnerProfileController
);

/**
 * @swagger
 * /api/v1/partnerProfile/{id}:
 *   get:
 *     summary: Get a specific partner profile by ID
 *     tags: [PartnerProfile]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Unique ID of the partner profile
 *     responses:
 *       200:
 *         description: Partner profile retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 data:
 *                   $ref: '#/components/schemas/PartnerProfile'
 *       400:
 *         description: Partner profile ID is required
 *       401:
 *         description: Unauthorized or invalid token
 *       404:
 *         description: Partner profile not found
 */
router.get("/:id", auth, getPartnerProfileByIdController);

/**
 * @swagger
 * /api/v1/partnerProfile:
 *   get:
 *     summary: Get all partner profiles (paginated)
 *     tags: [PartnerProfile]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           default: 1
 *         description: Page number (1-based)
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 5
 *         description: Number of items per page
 *     responses:
 *       200:
 *         description: Paginated profiles retrieved successfully
 *       401:
 *         description: Unauthorized
 */
router.get("/", auth, getAllPartnerProfiles);

/**
 * @swagger
 * /api/v1/partnerProfile/{id}:
 *   put:
 *     summary: Update a partner's profile by ID
 *     tags: [PartnerProfile]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - name: id
 *         in: path
 *         required: true
 *         description: Partner profile ID
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               email:
 *                 type: string
 *                 example: partner@example.com
 *               mobileNumber:
 *                 type: string
 *                 example: "+14155552671"
 *               companyName:
 *                 type: string
 *                 example: Acme Solutions
 *               speciality:
 *                 type: array
 *                 items:
 *                   type: string
 *                 example: ["cardiology", "telemedicine"]
 *               address:
 *                 type: object
 *                 properties:
 *                   street:
 *                     type: string
 *                     example: "456 Elm St"
 *                   city:
 *                     type: string
 *                     example: "Los Angeles"
 *                   state:
 *                     type: string
 *                     example: "CA"
 *                   country:
 *                     type: string
 *                     example: "USA"
 *                   zipCode:
 *                     type: string
 *                     example: "90001"
 *               website:
 *                 type: string
 *                 example: "https://acme.example.com"
 *               contactPerson:
 *                 type: string
 *                 example: "John Smith"
 *               projectImageUrl:
 *                 type: string
 *                 description: URL of the project image (can be base64 or image URL)
 *               rating:
 *                 type: number
 *                 format: float
 *                 description: Average partner rating (0.0 - 5.0)
 *                 example: 4.5
 *               status:
 *                 type: string
 *                 enum: [active, inactive, pending, suspended]
 *     responses:
 *       200:
 *         description: Profile updated successfully
 *       404:
 *         description: Profile not found
 *       401:
 *         description: Unauthorized
 *       400:
 *         description: Validation error
 */
router.put(
  "/:id",
  auth,
  validateRequest(updatePartnerProfileValidation),
  updatePartnerProfile
);

/**
 * @swagger
 * /api/v1/partnerProfile/rating:
 *   patch:
 *     summary: Update the rating of a partner profile
 *     description: Updates only the rating field of a specific partner profile using the partnerId provided in the request body.
 *     tags: [PartnerProfile]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - partnerId
 *               - rating
 *             properties:
 *               partnerId:
 *                 type: string
 *                 description: The unique ID of the partner profile
 *                 example: "652f8e9b4a5c9e5b4a3d9c22"
 *               rating:
 *                 type: number
 *                 description: Rating value between 0 and 5
 *                 example: 4.5
 *     responses:
 *       200:
 *         description: Rating updated successfully
 *       400:
 *         description: Validation Error
 *       404:
 *         description: Partner profile not found
 *       401:
 *         description: Unauthorized
 */
router.patch(
  "/rating",
  auth,
  validateRequest(updatePartnerRatingValidation),
  updatePartnerRating
);

/**
 * @swagger
 * /api/v1/partnerProfile/status:
 *   patch:
 *     summary: Update the status of a partner profile
 *     description: Updates only the status field of a specific partner profile using the partnerId provided in the request body.
 *     tags: [PartnerProfile]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - partnerId
 *               - status
 *             properties:
 *               partnerId:
 *                 type: string
 *                 description: The unique ID of the partner profile
 *                 example: "652f8e9b4a5c9e5b4a3d9c22"
 *               status:
 *                 type: string
 *                 description: The new status to set (e.g., pending, approved, rejected, inactive)
 *                 example: "approved"
 *     responses:
 *       200:
 *         description: Status updated successfully
 *       400:
 *         description: Validation Error
 *       404:
 *         description: Partner profile not found
 *       401:
 *         description: Unauthorized
 */
router.patch(
  "/status",
  auth,
  validateRequest(updatePartnerStatusValidation),
  updatePartnerStatusController
);

/**
 * @swagger
 * /api/v1/partnerProfile/{id}:
 *   delete:
 *     summary: Delete a partner's profile by ID
 *     tags: [PartnerProfile]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - name: id
 *         in: path
 *         required: true
 *         description: Partner profile ID
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Profile deleted successfully
 *       404:
 *         description: Profile not found
 *       401:
 *         description: Unauthorized
 */
router.delete("/:id", auth, deletePartnerProfile);

export default router;
