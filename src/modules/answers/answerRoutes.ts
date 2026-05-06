import express, { Router } from "express";
import validateRequest from "../../core/middleware/validateRequest";
import { answerValidation } from "./answerValidation";
import {
  submitAnswer,
  getRecommendedPlantsController,
  getRecommendedPartnersController,
} from "./answerController";

const router: Router = express.Router();

/**
 * @swagger
 * tags:
 *   name: Answers
 *   description: API for submitting survey answers and fetching recommendations
 */

/**
 * @swagger
 * components:
 *   schemas:
 *     AnswerItem:
 *       type: object
 *       required:
 *         - questionId
 *         - type
 *       properties:
 *         questionId:
 *           type: string
 *           format: uuid
 *           description: Unique identifier of the question (UUID from PostgreSQL)
 *           example: "c9d4c053-49b6-410c-bc78-2d54a9991870"
 *         type:
 *           type: integer
 *           enum: [1, 2]
 *           description: "1 = selectedOption, 2 = selectedAddress"
 *           example: 1
 *         selectedOption:
 *           type: string
 *           description: Option selected by the user (required if type=1)
 *           example: "Aesthetics"
 *         selectedAddress:
 *           type: object
 *           description: Address selected by the user (required if type=2)
 *           properties:
 *             state:
 *               type: string
 *               example: "California"
 *             city:
 *               type: string
 *               example: "Los Angeles"
 *
 *     AnswerInput:
 *       type: object
 *       required:
 *         - answers
 *       properties:
 *         answers:
 *           type: array
 *           items:
 *             $ref: '#/components/schemas/AnswerItem'
 *
 *     PlantRecommendation:
 *       type: object
 *       properties:
 *         id:
 *           type: string
 *         name:
 *           type: string
 *         scientific:
 *           type: string
 *         image:
 *           type: string
 *         description:
 *           type: string
 *         whyRecommended:
 *           type: string
 *
 *     PartnerRecommendation:
 *       type: object
 *       properties:
 *         partnerId:
 *           type: string
 *         companyName:
 *           type: string
 *         speciality:
 *           type: string
 *         email:
 *           type: string
 *         mobileNumber:
 *           type: string
 *         contactPerson:
 *           type: string
 *         website:
 *           type: string
 *         address:
 *           type: string
 *         projectImageUrl:
 *           type: string
 *         whyRecommended:
 *           type: string
 *
 *     ApiResponse:
 *       type: object
 *       properties:
 *         success:
 *           type: boolean
 *         message:
 *           type: string
 *         data:
 *           type: object
 */

/**
 * @swagger
 * /api/v1/answers:
 *   post:
 *     summary: Submit answers for survey questions
 *     description: Submit multiple answers in a single request. Supports both selected options and selected addresses.
 *     tags: [Answers]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/AnswerInput'
 *     responses:
 *       201:
 *         description: Answers submitted successfully
 *         content:
 *           application/json:
 *             schema:
 *               allOf:
 *                 - $ref: '#/components/schemas/ApiResponse'
 *             example:
 *               success: true
 *               message: "Answers submitted successfully"
 *               data:
 *                 responseId: "b6e64bdb-61e2-4d58-bb58-5fcd6b9c8a77"
 *       400:
 *         description: Validation error
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

router.post("", validateRequest(answerValidation), submitAnswer);
router.get("/plants/:responseId", getRecommendedPlantsController);
router.get("/partners/:responseId", getRecommendedPartnersController);

export default router;
