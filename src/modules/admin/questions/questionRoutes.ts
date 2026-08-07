import express, { RequestHandler, Router } from "express";
import auth from "../../../core/middleware/authMiddleware";
import validateRequest from "../../../core/middleware/validateRequest";
import {
  createOptionController,
  createQuestionController,
  deleteOptionController,
  deleteQuestionController,
  getAllQuestions,
  getQuestionByIdController,
  getQuestionOptionsGrouped,
  reorderOptionsController,
  reorderQuestionsController,
  updateOptionController,
  updateQuestionController,
} from "./questionController";
import {
  optionCreateValidation,
  optionUpdateValidation,
  questionCreateValidation,
  questionUpdateValidation,
  reorderItemsValidation,
} from "./questionValidation";

const router: Router = express.Router();

/**
 * @swagger
 * tags:
 *   name: Questions
 *   description: Survey questions/options — admin can add/edit/reorder without redeploy
 */

/**
 * @swagger
 * /api/v1/admin/question:
 *   post:
 *     summary: Create a new survey question with options
 *     tags: [Questions]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [question_text, order, options]
 *             properties:
 *               question_text:
 *                 type: string
 *               order:
 *                 type: integer
 *               options:
 *                 type: array
 *                 items:
 *                   type: object
 *                   properties:
 *                     id:
 *                       type: string
 *                       nullable: true
 *                     option_text:
 *                       type: string
 *     responses:
 *       201:
 *         description: Question created
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
 *     summary: Get all active survey questions (public / app)
 *     tags: [Questions]
 *     responses:
 *       200:
 *         description: Questions retrieved
 */
router.get("/question", getAllQuestions as unknown as RequestHandler);

/**
 * @swagger
 * /api/v1/admin/question/options-grouped:
 *   get:
 *     summary: Get grouped question options
 *     tags: [Questions]
 *     responses:
 *       200:
 *         description: Grouped options
 */
router.get(
  "/question/options-grouped",
  getQuestionOptionsGrouped as unknown as RequestHandler
);

/**
 * @swagger
 * /api/v1/admin/question/reorder:
 *   put:
 *     summary: Bulk reorder survey questions (drag-drop)
 *     tags: [Questions]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [items]
 *             properties:
 *               items:
 *                 type: array
 *                 items:
 *                   type: object
 *                   required: [id, order]
 *                   properties:
 *                     id:
 *                       type: string
 *                       format: uuid
 *                     order:
 *                       type: integer
 *                       minimum: 1
 *     responses:
 *       200:
 *         description: Questions reordered; public GET cache cleared
 */
router.put(
  "/question/reorder",
  auth,
  validateRequest(reorderItemsValidation),
  reorderQuestionsController
);

/**
 * @swagger
 * /api/v1/admin/question/options/{optionId}:
 *   put:
 *     summary: Edit a single option
 *     tags: [Questions]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: optionId
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               option_text:
 *                 type: string
 *               order:
 *                 type: integer
 *     responses:
 *       200:
 *         description: Option updated
 *   delete:
 *     summary: Delete a single option
 *     tags: [Questions]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: optionId
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *     responses:
 *       200:
 *         description: Option deleted
 */
router.put(
  "/question/options/:optionId",
  auth,
  validateRequest(optionUpdateValidation),
  updateOptionController
);
router.delete("/question/options/:optionId", auth, deleteOptionController);

/**
 * @swagger
 * /api/v1/admin/question/{id}/options:
 *   post:
 *     summary: Add an option to a question
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
 *             type: object
 *             required: [option_text]
 *             properties:
 *               option_text:
 *                 type: string
 *               order:
 *                 type: integer
 *     responses:
 *       201:
 *         description: Option created
 */
router.post(
  "/question/:id/options",
  auth,
  validateRequest(optionCreateValidation),
  createOptionController
);

/**
 * @swagger
 * /api/v1/admin/question/{id}/options/reorder:
 *   put:
 *     summary: Bulk reorder options within a question
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
 *             type: object
 *             required: [items]
 *             properties:
 *               items:
 *                 type: array
 *                 items:
 *                   type: object
 *                   required: [id, order]
 *                   properties:
 *                     id:
 *                       type: string
 *                       format: uuid
 *                     order:
 *                       type: integer
 *     responses:
 *       200:
 *         description: Options reordered
 */
router.put(
  "/question/:id/options/reorder",
  auth,
  validateRequest(reorderItemsValidation),
  reorderOptionsController
);

/**
 * @swagger
 * /api/v1/admin/question/{id}:
 *   get:
 *     summary: Get one question with options (Admin)
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
 *         description: Question detail
 *   put:
 *     summary: Update question + full options list
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
 *             type: object
 *             required: [question_text, order, options]
 *             properties:
 *               question_text:
 *                 type: string
 *               order:
 *                 type: integer
 *               options:
 *                 type: array
 *                 items:
 *                   type: object
 *                   properties:
 *                     id:
 *                       type: string
 *                     option_text:
 *                       type: string
 *     responses:
 *       200:
 *         description: Question updated
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
router.get("/question/:id", auth, getQuestionByIdController);
router.put(
  "/question/:id",
  auth,
  validateRequest(questionUpdateValidation),
  updateQuestionController
);
router.delete("/question/:id", auth, deleteQuestionController);

export default router;
