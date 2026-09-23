import { Router } from "express";
import auth from "../../core/middleware/authMiddleware";
import {
  getMissedNotificationsController,
  markMissedNotificationCompleteController,
} from "./missedNotificationsController";

const router = Router();

/**
 * @swagger
 * /api/v1/missed-notifications:
 *   get:
 *     summary: Get missed notifications for authenticated user
 *     tags:
 *       - Missed Notifications
 *     security:
 *       - bearerAuth: []
 *     parameters:
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
 *           maximum: 100
 *           default: 20
 *     responses:
 *       200:
 *         description: Missed notifications retrieved successfully
 *       401:
 *         description: Unauthorized
 */
router.get("/", auth, getMissedNotificationsController);

/**
 * @swagger
 * /api/v1/missed-notifications/{missedNotificationId}/complete:
 *   patch:
 *     summary: Mark one missed notification as completed
 *     tags:
 *       - Missed Notifications
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: missedNotificationId
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *     responses:
 *       200:
 *         description: Missed notification marked as completed successfully
 *       400:
 *         description: Invalid request
 *       401:
 *         description: Unauthorized
 */
router.patch("/:missedNotificationId/complete", auth, markMissedNotificationCompleteController);

export default router;
