import { Router } from "express";
import auth from "../../core/middleware/authMiddleware";
import {
    markComplete,
    rescheduleReminderController,
    disableReminderController,
    registerToken,
    removeToken,
} from "./reminder.controller";

const router = Router();
/**
 * @swagger
 * /api/v1/reminders/complete:
 *   post:
 *     summary: Mark a reminder as completed
 *     description: |
 *       Marks a plant care reminder as completed.
 *       Updates `last_*_at = NOW()` and recalculates `next_*_at = NOW() + frequency days`.
 *       Idempotent — calling on an already completed reminder returns success.
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
 *               - notification_log_id
 *             properties:
 *               notification_log_id:
 *                 type: string
 *                 format: uuid
 *                 example: "a1b2c3d4-e5f6-7890-abcd-ef1234567890"
 *     responses:
 *       200:
 *         description: Reminder marked as completed
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 already_completed:
 *                   type: boolean
 *                   example: false
 *       400:
 *         description: Missing notification_log_id
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Reminder does not belong to this user
 *       404:
 *         description: Notification log not found
 *       409:
 *         description: Could not complete reminder (race condition)
 */
router.post("/complete", auth, markComplete);

/**
 * @swagger
 * /api/v1/reminders/reschedule:
 *   post:
 *     summary: Reschedule a reminder to a new datetime
 *     description: |
 *       Sets `next_*_at` to the provided datetime.
 *       `last_*_at` is untouched — the user hasn't done the care, just postponed it.
 *       `reschedule_to` must be a future ISO datetime string.
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
 *               - notification_log_id
 *               - reschedule_to
 *             properties:
 *               notification_log_id:
 *                 type: string
 *                 format: uuid
 *                 example: "a1b2c3d4-e5f6-7890-abcd-ef1234567890"
 *               reschedule_to:
 *                 type: string
 *                 format: date-time
 *                 example: "2026-06-25T09:00:00Z"
 *     responses:
 *       200:
 *         description: Reminder rescheduled successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 rescheduled_to:
 *                   type: string
 *                   format: date-time
 *                   example: "2026-06-25T09:00:00Z"
 *       400:
 *         description: Missing fields, invalid datetime, or past datetime
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Reminder does not belong to this user
 *       404:
 *         description: Notification log not found
 */
router.post("/reschedule", auth, rescheduleReminderController);

/**
 * @swagger
 * /api/v1/reminders/disable:
 *   post:
 *     summary: Disable a care type reminder for a plant
 *     description: |
 *       Disables notifications for the specific care type.
 *       Sets `*_notification_enabled = false` and clears `next_*_at = NULL`.
 *       User must re-enable via the update plant endpoint.
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
 *               - notification_log_id
 *             properties:
 *               notification_log_id:
 *                 type: string
 *                 format: uuid
 *                 example: "a1b2c3d4-e5f6-7890-abcd-ef1234567890"
 *     responses:
 *       200:
 *         description: Reminder disabled successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *       400:
 *         description: Missing notification_log_id
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Reminder does not belong to this user
 *       404:
 *         description: Notification log not found
 */
router.post("/disable", auth, disableReminderController);

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

export default router;