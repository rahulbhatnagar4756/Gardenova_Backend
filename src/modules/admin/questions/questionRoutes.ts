import express, { RequestHandler, Router } from "express";
import auth from "../../../core/middleware/authMiddleware";
import validateRequest from "../../../core/middleware/validateRequest";
import {
  createQuestionController,
  deleteQuestionController,
  getAllQuestions,
  getQuestionOptionsGrouped,
  updateQuestionController,
} from "./questionController";
import {
  questionCreateValidation,
  questionUpdateValidation,
} from "./questionValidation";

const router: Router = express.Router();

/**
 * @swagger
 * tags:
 *   name: Questions
 *   description: APIs for managing diagnostic questions
 *
 * components:
 *   schemas:
 *     Option:
 *       type: object
 *       properties:
 *         id:
 *           type: string
 *           format: uuid
 *           nullable: true
 *           description: >
 *             Option ID:
 *             - empty string ("") for new options
 *             - UUID for existing options
 *         option_text:
 *           type: string
 *           description: Text of the option
 *           example: "Example option"
 *
 *     Question:
 *       type: object
 *       properties:
 *         id:
 *           type: string
 *           format: uuid
 *         question_text:
 *           type: string
 *         order:
 *           type: integer
 *         is_deleted:
 *           type: boolean
 *         options:
 *           type: array
 *           items:
 *             $ref: '#/components/schemas/Option'
 *
 *     QuestionCreateInput:
 *       type: object
 *       required:
 *         - question_text
 *         - order
 *         - options
 *       properties:
 *         question_text:
 *           type: string
 *         order:
 *           type: integer
 *         options:
 *           type: array
 *           description: >
 *             Array of option objects for creating a question.
 *             - id will always be empty string ("") on create.
 *           items:
 *             $ref: '#/components/schemas/Option'
 *
 *     QuestionUpdateInput:
 *       type: object
 *       required:
 *         - question_text
 *         - order
 *         - options
 *       properties:
 *         question_text:
 *           type: string
 *         order:
 *           type: integer
 *         options:
 *           type: array
 *           description: >
 *             Full list of option objects for updating a question.
 *             - Provide id for existing options
 *             - Use empty id ("") for new options
 *           items:
 *             $ref: '#/components/schemas/Option'
 */

/**
 * @swagger
 * /api/v1/admin/question:
 *   post:
 *     summary: Create a new question
 *     tags: [Questions]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/QuestionCreateInput'
 *     responses:
 *       201:
 *         description: Question created successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Question'
 */
router.post(
  "/question",
  auth,
  validateRequest(questionCreateValidation),
  createQuestionController
);

/**
 * @swagger
 * /api/v1/admin/question:
 *   get:
 *     summary: Get all questions
 *     tags: [Questions]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Questions retrieved
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
 *                     questions:
 *                       type: array
 *                       items:
 *                         $ref: '#/components/schemas/Question'
 */
router.get("/question", getAllQuestions as unknown as RequestHandler);

/**
 * @swagger
 * /api/v1/admin/question/options-grouped:
 *   get:
 *     summary: Get grouped question options
 *     description: Returns options of the first 4 questions grouped into categories like space_types, area_sizes, challenges, and tech_preferences.
 *     tags: [Questions]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Grouped options retrieved successfully
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
 *                     space_types:
 *                       type: array
 *                       items:
 *                         type: string
 *                     area_sizes:
 *                       type: array
 *                       items:
 *                         type: string
 *                     challenges:
 *                       type: array
 *                       items:
 *                         type: string
 *                     tech_preferences:
 *                       type: array
 *                       items:
 *                         type: string
 */
router.get(
  "/question/options-grouped",
  getQuestionOptionsGrouped as unknown as RequestHandler
);

/**
 * @swagger
 * /api/v1/admin/question/{id}:
 *   put:
 *     summary: Update an existing question (must include full options list)
 *     tags: [Questions]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/QuestionUpdateInput'
 *     responses:
 *       200:
 *         description: Question updated successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Question'
 *       400:
 *         description: Validation error or missing options
 *       404:
 *         description: Question not found
 */
router.put(
  "/question/:id",
  auth,
  validateRequest(questionUpdateValidation),
  updateQuestionController
);

/**
 * @swagger
 * /api/v1/admin/question/{id}:
 *   delete:
 *     summary: Soft delete a question
 *     tags: [Questions]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *     responses:
 *       200:
 *         description: Question deleted
 */
router.delete("/question/:id", auth, deleteQuestionController);

export default router;
