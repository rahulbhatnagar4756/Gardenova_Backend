import express, { Router } from "express";
import validateRequest from "../../core/middleware/validateRequest";
import { answerValidation } from "./answerValidation";
import {
  submitAnswer,
  getRecommendedPlantsController,
  getUserAnswersController,
  // getRecommendedPartnersController,
} from "./answerController";

import auth from "../../core/middleware/authMiddleware";
const router: Router = express.Router();
/**
 * @swagger
 * components:
 *   schemas:
 *     SurveyAnswerItem:
 *       type: object
 *       required:
 *         - questionId
 *         - type
 *         - selectedOption
 *       properties:
 *         questionId:
 *           type: string
 *           format: uuid
 *           example: "a1b2c3d4-e5f6-7890-abcd-ef1234567890"
 *         type:
 *           type: integer
 *           example: 1
 *         selectedOption:
 *           type: string
 *           example: "Balcony or Terrace (Pots, planters, vertical space)"
 *
 *     SubmitAnswersInput:
 *       type: object
 *       required:
 *         - answers
 *       properties:
 *         answers:
 *           type: array
 *           minItems: 1
 *           maxItems: 6
 *           items:
 *             $ref: '#/components/schemas/SurveyAnswerItem'
 *           example:
 *             - questionId: "a1b2c3d4-e5f6-7890-abcd-ef1234567890"
 *               type: 1
 *               selectedOption: "Balcony or Terrace (Pots, planters, vertical space)"
 *             - questionId: "b2c3d4e5-f6a7-8901-bcde-f12345678901"
 *               type: 1
 *               selectedOption: "Partial Sun (3–6 hours, some shade)"
 *             - questionId: "c3d4e5f6-a7b8-9012-cdef-123456789012"
 *               type: 1
 *               selectedOption: "Grow Food (Vegetables, herbs & edible plants)"
 *             - questionId: "d4e5f6a7-b8c9-0123-defa-234567890123"
 *               type: 1
 *               selectedOption: "Once a Week (Weekends or occasional watering)"
 *             - questionId: "e5f6a7b8-c9d0-1234-efab-345678901234"
 *               type: 1
 *               selectedOption: "Tropical / Humid (Hot, wet, lush conditions year-round)"
 *             - questionId: "f6a7b8c9-d0e1-2345-fabc-456789012345"
 *               type: 1
 *               selectedOption: "Casual Gardener (Tried a few plants with mixed success)"
 *
 * /api/v1/answers:
 *   post:
 *     summary: Submit survey answers
 *     description: >
 *       Submit all 6 survey answers in a single request.
 *       Each answer corresponds to one question (space type, sunlight,
 *       goal, watering frequency, climate, experience level).
 *       All answers must be plain strings matching the displayed option text.
 *     tags: [Answers]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/SubmitAnswersInput'
 *     responses:
 *       201:
 *         description: Answers submitted successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ApiResponse'
 *             example:
 *               success: true
 *               message: "Answers submitted successfully"
 *               data:
 *                 responseId: "b6e64bdb-61e2-4d58-bb58-5fcd6b9c8a77"
 *       400:
 *         description: Validation error — missing answers, empty selectedOption, or invalid questionId format
 *         content:
 *           application/json:
 *             example:
 *               success: false
 *               message: "Validation failed"
 *               data:
 *                 issues:
 *                   - path: ["answers", 0, "selectedOption"]
 *                     message: "selectedOption must not be empty"
 *       500:
 *         description: Internal server error
 *         content:
 *           application/json:
 *             example:
 *               success: false
 *               message: "Something went wrong"
 *               data:
 *                 details: "Failed to create survey response — no row returned"
 */



/**
 * @swagger
 * /api/v1/answers/plants/{responseId}:
 *   get:
 *     summary: Get recommended plants for a submitted survey
 *     description: Fetch plant recommendations using the survey answers associated with a given response ID.
 *     tags: [Answers]
 *     parameters:
 *       - in: path
 *         name: responseId
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: Unique ID of the survey response
 *     responses:
 *       200:
 *         description: Plant recommendations fetched successfully
 *         content:
 *           application/json:
 *             schema:
 *               allOf:
 *                 - $ref: '#/components/schemas/ApiResponse'
 *             example:
 *               success: true
 *               message: "Plant recommendations fetched successfully"
 *               data:
 *                 responseId: "b6e64bdb-61e2-4d58-bb58-5fcd6b9c8a77"
 *                 plantRecommendations:
 *                   - id: "P001"
 *                     name: "Rose"
 *                     scientific: "Rosa"
 *                     image: "https://example.com/rose.jpg"
 *                     description: "A beautiful flowering plant."
 *                     whyRecommended: "Best for aesthetic gardens"
 *       404:
 *         description: No answers found for this responseId
 */

/**
 * @swagger
 * /api/v1/answers/partners/{responseId}:
 *   get:
 *     summary: Get recommended professional partners for a survey
 *     description: Fetch partner recommendations (landscapers, designers, etc.) for a given survey response ID.
 *     tags: [Answers]
 *     parameters:
 *       - in: path
 *         name: responseId
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: Unique ID of the survey response
 *     responses:
 *       200:
 *         description: Partner recommendations fetched successfully
 *         content:
 *           application/json:
 *             schema:
 *               allOf:
 *                 - $ref: '#/components/schemas/ApiResponse'
 *             example:
 *               success: true
 *               message: "Partner recommendations fetched successfully"
 *               data:
 *                 responseId: "b6e64bdb-61e2-4d58-bb58-5fcd6b9c8a77"
 *                 partnerRecommendations:
 *                   - partnerId: "P001"
 *                     companyName: "GreenLandscapes"
 *                     speciality: "Garden design"
 *                     email: "contact@greenland.com"
 *                     mobileNumber: "+1-555-1234"
 *                     contactPerson: "John Doe"
 *                     address: "Los Angeles, CA"
 *                     website: "https://greenland.com"
 *                     projectImageUrl: "https://example.com/project.jpg"
 *                     whyRecommended: "Matches your aesthetic preferences"
 *       404:
 *         description: No answers found for this responseId
 */

router.post("", auth,validateRequest(answerValidation), submitAnswer);
router.get("/plants/:responseId", getRecommendedPlantsController);
// router.get("/partners/:responseId", getRecommendedPartnersController);
/**
 * @swagger
 * /api/v1/answers/{responseId}:
 *   get:
 *     summary: Get user answers by response ID
 *     tags: [Answers]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: responseId
 *         required: true
 *         schema:
 *           type: string
 *         description: Response ID
 *     responses:
 *       200:
 *         description: User answers retrieved successfully
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
 *       400:
 *         description: Invalid response ID
 *       401:
 *         description: Unauthorized
 *       404:
 *         description: Answers not found
 *       500:
 *         description: Internal server error
 */
router.get("/:responseId", auth, getUserAnswersController);

export default router;
