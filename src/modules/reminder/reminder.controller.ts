import {  Response } from 'express';
import {
  getLogWithPlant,
  snoozeLog,
  completeLog,
  updatePlantAfterCompletion,
  upsertFcmToken,
  deleteFcmToken,
} from './reminder.queries';
import { ReminderType } from '../../interface/reminder';
import { connectDB } from '../../core/config/db';
import { AuthUserPayload } from '../../interface/user';
import { findUserByEmail } from '../auth/authRepository';
import { AuthRequest } from '../../interface/auth';

// ─── POST /reminders/snooze ──────────────────────────────────────────────────
/**
 * Snoozes a plant-care reminder notification.
 *
 * Validates ownership of the notification, determines the configured
 * snooze duration for the reminder type, and updates the notification
 * log with a new `snoozed_until` timestamp.
 *
 * Request body:
 * - notification_log_id: UUID of the notification log entry.
 *
 * Responses:
 * - 200: Reminder successfully snoozed.
 * - 400: Missing notification ID or reminder already completed.
 * - 403: Notification does not belong to the authenticated user.
 * - 404: Notification log not found.
 * - 409: Reminder could not be snoozed due to a state conflict.
 *
 * @param {Request} req - Express request object.
 * @param {Response} res - Express response object.
 * @returns {Promise<Response>}
 */
export async function snoozeReminder(req: AuthRequest, res: Response): Promise<Response> {
  const { notification_log_id } = req.body;

  if (!notification_log_id) {
    return res.status(400).json({ error: 'notification_log_id is required' });
  }

  // 1. Fetch log + plant (to get snooze_minutes config)
  const logWithPlant = await getLogWithPlant(notification_log_id);

  if (!logWithPlant) {
    return res.status(404).json({ error: 'Notification log not found' });
  }

  // 2. Auth check — ensure log belongs to requesting user
  const userPayload = req.user as AuthUserPayload | undefined;
  const email = userPayload?.userEmail; // Assuming userEmail is unique identifier

  const user = await findUserByEmail(email!);
  if(!user) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  const userId = user.id;
  if (logWithPlant.user_id !== userId) {
    return res.status(403).json({ error: 'Forbidden' });
  }

  // 3. Already completed?
  if (logWithPlant.status === 'completed') {
    return res.status(400).json({ error: 'Cannot snooze a completed reminder' });
  }

  // 4. Already snoozed? Update snooze time (re-snooze from now)
  // Pick snooze duration from plant config
  const snoozeMap: Record<ReminderType, number> = {
    watering:     logWithPlant.plant.watering_snooze_minutes,
    fertilizer:   logWithPlant.plant.fertilizer_snooze_minutes,
    pruning:      logWithPlant.plant.pruning_snooze_minutes,
    generic_care: logWithPlant.plant.generic_care_snooze_minutes,
  };

  const snoozeMinutes = snoozeMap[logWithPlant.reminder_type as ReminderType] ?? 30;
  const snoozedUntil = new Date(Date.now() + snoozeMinutes * 60 * 1000);

  const updated = await snoozeLog(notification_log_id, snoozedUntil);

  if (!updated) {
    // Could be already snoozed — update directly
    const pool = await connectDB();
    const { rows } = await pool.query(
      `UPDATE notification_log
       SET status = 'snoozed', snoozed_until = $2, updated_at = NOW()
       WHERE id = $1 AND status IN ('sent','snoozed')
       RETURNING *`,
      [notification_log_id, snoozedUntil]
    );
    if (!rows[0]) {
      return res.status(409).json({ error: 'Reminder could not be snoozed' });
    }
  }

  return res.json({
    success: true,
    snoozed_until: snoozedUntil,
    snooze_minutes: snoozeMinutes,
  });
}

// ─── POST /reminders/complete ────────────────────────────────────────────────
/**
 * Marks a plant care reminder notification as completed.
 *
 * Steps:
 * - Validates `notification_log_id` from request body
 * - Fetches the notification log and associated plant
 * - Ensures the requesting user owns the reminder
 * - Prevents re-processing if already completed (idempotent)
 * - Marks the notification log as completed
 * - Updates plant's last and next scheduled care timestamps
 *
 * @param req - Express request object containing `notification_log_id`
 * @param res - Express response object
 * @returns JSON response indicating success or failure status
 */
export async function markComplete(req: AuthRequest, res: Response):Promise<Response> {
  const { notification_log_id } = req.body;

  if (!notification_log_id) {
    return res.status(400).json({ error: 'notification_log_id is required' });
  }

  const logWithPlant = await getLogWithPlant(notification_log_id);

  if (!logWithPlant) {
    return res.status(404).json({ error: 'Notification log not found' });
  }

  const userPayload =req.user as AuthUserPayload | undefined;
  const email = userPayload?.userEmail; // Assuming userEmail is unique identifier
  const user = await findUserByEmail(email!);
  if(!user) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  const userId = user.id;
  if (logWithPlant.user_id !== userId) {
    return res.status(403).json({ error: 'Forbidden' });
  }

  if (logWithPlant.status === 'completed') {
    // Idempotent — already done, return success
    return res.json({ success: true, already_completed: true });
  }

  const now = new Date();

  // 1. Mark log completed
  const completed = await completeLog(notification_log_id);
  if (!completed) {
    return res.status(409).json({ error: 'Could not complete reminder' });
  }

  // 2. Update plant's last_X_at and recalculate next_X_at
  await updatePlantAfterCompletion(
    logWithPlant.user_plant_id,
    logWithPlant.reminder_type as ReminderType,
    now
  );

  return res.json({ success: true });
}

// ─── POST /reminders/token ───────────────────────────────────────────────────
// Called by app on login or when FCM token refreshes
/**
 * Registers or updates an FCM (Firebase Cloud Messaging) token for a user.
 *
 * If the token already exists for the user, it will be updated (upsert operation).
 * This allows the system to send push notifications to the user's device.
 * @param req - Express request object containing the FCM token in the request body
 *              and authenticated user information in `req.user`.
 * @param res - Express response object
 * @returns  JSON response indicating whether the token was successfully stored
 */
export async function registerToken(req: AuthRequest, res: Response): Promise<Response> {
  const { token } = req.body;
  const userPayload = req.user as AuthUserPayload | undefined;
  const email = userPayload?.userEmail; // Assuming userEmail is unique identifier
  const user = await findUserByEmail(email!);
  if(!user) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  const userId = user.id;

  if (!token) return res.status(400).json({ error: 'token is required' });

  await upsertFcmToken(userId!, token);
  return res.json({ success: true });
}

// ─── DELETE /reminders/token ─────────────────────────────────────────────────
// Called on logout
/**
 * Removes an FCM (Firebase Cloud Messaging) token for a user.
 *
 * This is used when a device is logged out or when the push token
 * should no longer receive notifications.
 *
 * @param req - Express request object containing the FCM token in the body
 *              and authenticated user information in `req.user`.
 * @param res - Express response object
 * @returns JSON response confirming whether the token was removed successfully
 */
export async function removeToken(req: AuthRequest, res: Response): Promise<Response> {
  const { token } = req.body;
  const userPayload = req.user as AuthUserPayload | undefined;
  const email = userPayload?.userEmail;
  const user = await findUserByEmail(email!);
  if(!user) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  const userId = user.id;

  if (!token) return res.status(400).json({ error: 'token is required' });

  await deleteFcmToken(userId!, token);
  return res.json({ success: true });
}