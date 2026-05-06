import { Router } from "express";
import {
  getCurrentUserProfile,
  softDeleteUserProfile,
  updateUserProfile,
} from "./userProfileController";
import { updateUserProfileValidation } from "./userProfileValidations";
import validateRequest from "../../core/middleware/validateRequest";
import auth from "../../core/middleware/authMiddleware";

const router = Router();

/**
 * @swagger
 * tags:
 *   name: UserProfile
 *   description: User profile management endpoints
 */

/**
 * @swagger
 * /api/v1/userProfile:
 *   get:
 *     summary: Get current user's profile
 *     tags: [UserProfile]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Profile retrieved successfully
 *       404:
 *         description: Profile not found
 *       401:
 *         description: Unauthorized - Invalid or missing token
 */
router.get("/", auth, getCurrentUserProfile);

/**
 * @swagger
 * /api/v1/userProfile:
 *   put:
 *     summary: Update current user's profile
 *     tags: [UserProfile]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: false
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               profileImage:
 *                 type: string
 *                 description: Base64 encoded image string (uploaded to S3 Bucket)
 *                 example: "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAA..."
 *               dateOfBirth:
 *                 type: string
 *                 format: date
 *                 description: User's date of birth (cannot be in the future)
 *                 example: "1990-01-01"
 *               gender:
 *                 type: string
 *                 enum: [male, female, other, ""]
 *                 description: User's gender (optional)
 *                 example: "female"
 *               bio:
 *                 type: string
 *                 maxLength: 500
 *                 description: Short biography or personal summary
 *                 example: "Experienced software engineer with 8+ years in backend development."
 *               street:
 *                 type: string
 *                 description: Street address (optional)
 *                 example: "456 Elm St"
 *               city:
 *                 type: string
 *                 description: City (optional)
 *                 example: "Los Angeles"
 *               state:
 *                 type: string
 *                 description: State or province (optional)
 *                 example: "CA"
 *               country:
 *                 type: string
 *                 description: Country (optional)
 *                 example: "USA"
 *               zipCode:
 *                 type: string
 *                 description: Postal or ZIP code (optional)
 *                 example: "90001"
 *               occupation:
 *                 type: string
 *                 maxLength: 255
 *                 description: User's current occupation or job title
 *                 example: "Senior Developer"
 *               company:
 *                 type: string
 *                 maxLength: 255
 *                 description: User's company or organization
 *                 example: "InnovateTech Inc"
 *     responses:
 *       200:
 *         description: Profile updated successfully
 *       400:
 *         description: Validation failed or image upload error
 *       401:
 *         description: Unauthorized
 *       404:
 *         description: Profile not found
 */
router.put(
  "/",
  auth,
  validateRequest(updateUserProfileValidation),
  updateUserProfile
);

/**
 * @swagger
 * /api/v1/userProfile/soft-delete:
 *   patch:
 *     summary: Soft delete the current user's profile
 *     tags: [UserProfile]
 *     security:
 *       - bearerAuth: []
 *     description: |
 *       Marks the current user's profile as deleted (`is_deleted = true`) without
 *       removing the record from the database. Returns an appropriate response
 *       if the profile is already deleted or if the user/profile is not found.
 *     responses:
 *       200:
 *         description: User profile soft deleted successfully
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
 *                   example: "User profile soft deleted successfully"
 *                 data:
 *                   type: object
 *                   nullable: true
 *                   example: null
 *       401:
 *         description: Unauthorized request (missing or invalid token)
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
 *                   example: "Unauthorized request"
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
 *                   example: "User profile not found"
 *       410:
 *         description: Profile already deleted
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
 *                   example: "User profile already deleted"
 *       500:
 *         description: Server error during soft deletion
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
 *                   example: "An unknown error occurred"
 */
router.patch(
  "/soft-delete",
  auth,
  softDeleteUserProfile
);

export default router;
