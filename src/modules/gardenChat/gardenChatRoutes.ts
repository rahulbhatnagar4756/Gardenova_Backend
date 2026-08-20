import { Router } from "express";
import auth from "../../core/middleware/authMiddleware";
import validateRequest from "../../core/middleware/validateRequest";
import {
  gardenChatHistoryValidation,
  gardenChatMessageValidation,
} from "./gardenChatValidation";
import { listGardenChatHistory, sendGardenChat } from "./gardenChatController";

const router = Router();

/**
 * @swagger
 * /api/v1/garden-chat:
 *   post:
 *     summary: Chat with the gardening bot
 *     description: >
 *       Paid subscription required. Free users receive HTTP 403.
 *       Verifies the message is gardening related first.
 *       Accepts text only, image only (`image_base64`), or both together as JSON.
 *       If it is gardening related, answers using the last 10 messages as conversation context.
 *       The response includes only the current question and assistant answer.
 *     tags: [Garden Chat]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               message:
 *                 type: string
 *                 example: My tomato leaves are turning yellow. What should I do?
 *               image_base64:
 *                 type: string
 *                 description: Base64 encoded image or data URI. Use this, message, or both.
 *               conversationId:
 *                 type: string
 *                 format: uuid
 *                 description: Optional. Omit to continue the user's latest conversation.
 *     responses:
 *       200:
 *         description: Chat processed
 *       403:
 *         description: Free plan — upgrade required
 *       400:
 *         description: Validation error
 *       401:
 *         description: Unauthorized
 */
router.post("/", auth, validateRequest(gardenChatMessageValidation), sendGardenChat);

/**
 * @swagger
 * /api/v1/garden-chat/history:
 *   get:
 *     summary: Get garden chat message history
 *     description: Returns paginated question-and-answer turns, newest first. Paid subscription required. Free users receive HTTP 403.
 *     tags: [Garden Chat]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: conversationId
 *         schema:
 *           type: string
 *           format: uuid
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           minimum: 1
 *           default: 1
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           minimum: 1
 *           maximum: 50
 *           default: 10
 *     responses:
 *       200:
 *         description: History fetched
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Free plan — upgrade required
 */
router.get(
  "/history",
  auth,
  validateRequest(gardenChatHistoryValidation, "query"),
  listGardenChatHistory
);

export default router;
