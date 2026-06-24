import { Router } from "express";
import auth from "../../core/middleware/authMiddleware";
import {
   
    registerToken,
    removeToken,
} from "./reminder.controller";
import { processDueReminders } from "./reminder.processor";

const router = Router();

/**
 * @swagger
 * /api/v1/reminders/token:
 *   post:
 *     summary: Register an FCM device token
 *     description: |
 *       Registers or refreshes an FCM token for the authenticated user's device.
 *       Call on app start and whenever the FCM token is refreshed by the SDK.
 *       Safe to call multiple times with the same token (upsert).
 *     tags: [Reminders]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - token
 *             properties:
 *               token:
 *                 type: string
 *                 example: "fGQz8k2rT1u:APA91bHPRg..."
 *     responses:
 *       200:
 *         description: Token registered successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *       400:
 *         description: Missing token
 *       401:
 *         description: Unauthorized
 *   delete:
 *     summary: Remove an FCM device token
 *     description: |
 *       Removes an FCM token for the authenticated user's device.
 *       Call on logout to stop notifications on that device.
 *     tags: [Reminders]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - token
 *             properties:
 *               token:
 *                 type: string
 *                 example: "fGQz8k2rT1u:APA91bHPRg..."
 *     responses:
 *       200:
 *         description: Token removed successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *       400:
 *         description: Missing token
 *       401:
 *         description: Unauthorized
 */
router.post("/token",   auth, registerToken);
router.delete("/token", auth, removeToken);

router.post("/test-trigger", async (req, res) => {
  await processDueReminders();
  res.json({ success: true });
});

export default router;