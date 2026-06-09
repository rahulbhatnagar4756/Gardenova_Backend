import { Router } from 'express';
import auth from '../../core/middleware/authMiddleware';
import {
  snoozeReminder,
  markComplete,
  registerToken,
  removeToken,
} from './reminder.controller';

const router = Router();


/**
 * @swagger
 * tags:
 *   name: Reminders
 *   description: Plant care reminder notifications (FCM)
 *
 * components:
 *   securitySchemes:
 *     bearerAuth:
 *       type: http
 *       scheme: bearer
 *       bearerFormat: JWT
 *
 *   schemas:
 *     Error:
 *       type: object
 *       properties:
 *         error:
 *           type: string
 *           example: "notification_log_id is required"
 *
 *     NotificationLog:
 *       type: object
 *       properties:
 *         id:
 *           type: string
 *           format: uuid
 *         user_plant_id:
 *           type: string
 *           format: uuid
 *         user_id:
 *           type: string
 *           format: uuid
 *         reminder_type:
 *           type: string
 *           enum: [watering, fertilizer, pruning, generic_care]
 *         scheduled_for:
 *           type: string
 *           format: date-time
 *         sent_at:
 *           type: string
 *           format: date-time
 *         status:
 *           type: string
 *           enum: [sent, snoozed, completed]
 *         snoozed_until:
 *           type: string
 *           format: date-time
 *           nullable: true
 *         fcm_message_id:
 *           type: string
 *           nullable: true
 */

/**
 * @swagger
 * /api/v1/reminders/snooze:
 *   post:
 *     summary: Snooze a reminder
 *     description: >
 *       Snoozes an active reminder. The snooze duration is read from the plant's
 *       config (watering_snooze_minutes, fertilizer_snooze_minutes, etc.) — no
 *       duration needed in the request body. Can also re-snooze an already snoozed reminder.
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
 *                 description: The ID received in the FCM notification data payload
 *                 example: "a1b2c3d4-e5f6-7890-abcd-ef1234567890"
 *     responses:
 *       200:
 *         description: Reminder snoozed successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 snoozed_until:
 *                   type: string
 *                   format: date-time
 *                   description: Timestamp when the reminder will re-fire
 *                   example: "2024-06-01T10:30:00.000Z"
 *                 snooze_minutes:
 *                   type: integer
 *                   description: Duration in minutes the reminder was snoozed for
 *                   example: 30
 *       400:
 *         description: Missing notification_log_id or reminder is already completed
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       403:
 *         description: Reminder does not belong to the authenticated user
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       404:
 *         description: Notification log not found
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       409:
 *         description: Reminder could not be snoozed (race condition)
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
router.post('/snooze',auth, snoozeReminder);

/**
 * @swagger
 * /api/v1/reminders/complete:
 *   post:
 *     summary: Mark a reminder as completed
 *     description: >
 *       Marks a reminder as completed. Updates the plant's last_X_at timestamp
 *       and recalculates next_X_at based on the reminder frequency.
 *       Idempotent — calling this on an already completed reminder returns success.
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
 *                 description: The ID received in the FCM notification data payload
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
 *                   description: Present and true if the reminder was already completed before this call
 *                   example: false
 *       400:
 *         description: Missing notification_log_id
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       403:
 *         description: Reminder does not belong to the authenticated user
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       404:
 *         description: Notification log not found
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       409:
 *         description: Could not complete reminder (race condition)
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
router.post('/complete',auth, markComplete);

/**
 * @swagger
 * /api/v1/reminders/token:
 *   post:
 *     summary: Register an FCM device token
 *     description: >
 *       Registers or refreshes an FCM token for the authenticated user's device.
 *       Call this on app start and whenever the FCM token is refreshed by the SDK.
 *       Upserts on conflict — safe to call multiple times with the same token.
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
 *                 description: FCM registration token from the device
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
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *   delete:
 *     summary: Remove an FCM device token
 *     description: >
 *       Removes an FCM token for the authenticated user's device.
 *       Call this on logout to stop notifications on that device.
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
 *                 description: FCM registration token to remove
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
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
router.post('/token',auth, registerToken);
router.delete('/token',auth, removeToken);

export default router;