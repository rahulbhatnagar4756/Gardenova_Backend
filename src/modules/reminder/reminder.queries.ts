
import {  getDB } from '../../core/config/db';
import { UserPlant, ReminderType, NotificationLog } from '../../interface/reminder';

/**
 * Fetches all user plants that have at least one due reminder.
 *
 * A plant is considered "due" if any reminder type (watering, fertilizer,
 * pruning, or generic care) meets all of the following conditions:
 * - Notification is enabled
 * - Next scheduled date exists and is in the past or present
 * - Preferred time condition is satisfied (if set)
 *
 * The query uses `FOR UPDATE SKIP LOCKED` to safely support concurrent
 * cron workers without duplicate processing.
 *
 * @returns {Promise<UserPlant[]>} Array of user plants with due reminders
 */
export async function getDuePlants(): Promise<UserPlant[]> {
  const now = new Date();
    const pool = await getDB();

  const { rows } = await pool.query<UserPlant>(
    `
    SELECT up.*
    FROM user_plants up
    WHERE
      -- At least one reminder type is enabled and overdue
      (
        (
          up.watering_notification_enabled = true
          AND up.next_watered_at IS NOT NULL
          AND up.next_watered_at <= $1
          AND (up.watering_preferred_time IS NULL OR CURRENT_TIME >= up.watering_preferred_time)
        ) OR (
          up.fertilizer_notification_enabled = true
          AND up.next_fertilized_at IS NOT NULL
          AND up.next_fertilized_at <= $1
          AND (up.fertilizer_preferred_time IS NULL OR CURRENT_TIME >= up.fertilizer_preferred_time)
        ) OR (
          up.pruning_notification_enabled = true
          AND up.next_pruned_at IS NOT NULL
          AND up.next_pruned_at <= $1
          AND (up.pruning_preferred_time IS NULL OR CURRENT_TIME >= up.pruning_preferred_time)
        ) OR (
          up.generic_notification_enabled = true
          AND up.next_generic_care_at IS NOT NULL
          AND up.next_generic_care_at <= $1
          AND (up.generic_care_preferred_time IS NULL OR CURRENT_TIME >= up.generic_care_preferred_time)
        )
      )
    FOR UPDATE SKIP LOCKED
    `,
    [now]
  );

  return rows;
}

// ─── Idempotency check ───────────────────────────────────────────────────────
// Returns existing active log if one already exists for this plant+type+cycle
/**
 * Retrieves an active notification log entry for a specific plant reminder.
 *
 * An active log is defined as a log that:
 * - Matches the given plant ID
 * - Matches the reminder type
 * - Matches the scheduled timestamp
 * - Has a status of either `sent` or `snoozed`
 *
 * This is used for idempotency to prevent duplicate notifications
 * from being sent by concurrent cron executions.
 *
 * @param userPlantId - ID of the plant associated with the reminder
 * @param reminderType - Type of reminder (watering, fertilizer, pruning, etc.)
 * @param scheduledFor - Exact scheduled timestamp of the reminder
 *
 * @returns {Promise<NotificationLog | null>} Matching active log or null if none exists
 */
export async function getActiveLog(
  userPlantId: string,
  reminderType: ReminderType,
  scheduledFor: Date
): Promise<NotificationLog | null> {
    const pool = await getDB();
  const { rows } = await pool.query<NotificationLog>(
    `
    SELECT * FROM notification_log
    WHERE user_plant_id  = $1
      AND reminder_type  = $2
      AND scheduled_for  = $3
      AND status IN ('sent', 'snoozed')
    LIMIT 1
    `,
    [userPlantId, reminderType, scheduledFor]
  );
  return rows[0] ?? null;
}

// ─── Insert notification log ─────────────────────────────────────────────────
/**
 * Inserts a new notification log entry for a plant reminder.
 *
 * This function is used as an idempotency guard before sending FCM notifications.
 * If a conflicting log already exists (based on the unique constraint),
 * the insert is skipped using `ON CONFLICT DO NOTHING`.
 *
 * The log is created with an initial status of `sent`.
 *
 * @param data - Notification log details
 * @param data.userPlantId - ID of the plant associated with the reminder
 * @param data.userId - ID of the user who owns the plant
 * @param data.reminderType - Type of reminder (watering, fertilizer, pruning, etc.)
 * @param data.scheduledFor - Scheduled timestamp for the reminder
 * @param data.fcmMessageId - Firebase message ID (nullable if not yet available)
 *
 * @returns {Promise<NotificationLog | undefined>}
 * Returns the created notification log row if insert succeeded,
 * otherwise `undefined` if a conflict prevented insertion.
 */
export async function insertNotificationLog(data: {
  userPlantId: string;
  userId: string;
  reminderType: ReminderType;
  scheduledFor: Date;
  fcmMessageId: string | null;
}): Promise<NotificationLog| undefined> {
    const pool = await getDB();
  const { rows } = await pool.query<NotificationLog>(
    `
    INSERT INTO notification_log
      (user_plant_id, user_id, reminder_type, scheduled_for, fcm_message_id, status)
    VALUES ($1, $2, $3, $4, $5, 'sent')
    ON CONFLICT ON CONSTRAINT idx_notif_log_idempotency DO NOTHING
    RETURNING *
    `,
    [
      data.userPlantId,
      data.userId,
      data.reminderType,
      data.scheduledFor,
      data.fcmMessageId,
    ]
  );
  return rows[0];
}





// ─── FCM token queries ───────────────────────────────────────────────────────
/**
 * Retrieves all FCM tokens associated with a user.
 *
 * These tokens are used for sending push notifications across devices.
 *
 * @param userId - User UUID
 * @returns {Promise<string[]>} List of FCM tokens
 */
export async function getTokensForUser(userId: string): Promise<string[]> {
    const pool = await getDB();
    const { rows } = await pool.query<{ token: string }>(
        `SELECT token FROM user_push_tokens
         WHERE user_id = $1
         ORDER BY updated_at DESC
         LIMIT 1`,
        [userId]
    );
    return rows.map((r) => r.token);
}
/**
 * Deletes invalid or expired FCM tokens from the database.
 *
 * This is typically called after Firebase reports token errors.
 *
 * @param tokens - Array of invalid FCM tokens
 * @returns {Promise<void>}
 */
export async function deleteInvalidTokens(tokens: string[]): Promise<void> {
    const pool = await getDB();
    if (!tokens.length) return;
    await pool.query(
        `DELETE FROM user_push_tokens WHERE token = ANY($1::text[])`,
        [tokens]
    );
}
/**
 * Inserts or updates an FCM token for a user.
 *
 * If the token already exists for the user, its `updated_at` timestamp is refreshed.
 * This ensures a user can safely re-login or re-register devices.
 *
 * @param userId - User UUID
 * @param token - FCM device token
 * @returns {Promise<void>}
 */
export async function upsertFcmToken(userId: string, token: string): Promise<void> {
    const pool = await getDB();
    await pool.query(
        `INSERT INTO user_push_tokens (user_id, token)
         VALUES ($1, $2)
         ON CONFLICT (user_id, token) DO UPDATE SET updated_at = NOW()`,
        [userId, token]
    );
}
/**
 * Deletes a specific FCM token for a user.
 *
 * Used during logout or device unlinking.
 *
 * @param userId - User UUID
 * @param token - FCM token to remove
 * @returns {Promise<void>}
 */
export async function deleteFcmToken(userId: string, token: string): Promise<void> {
    const pool = await getDB();
    await pool.query(
        `DELETE FROM user_push_tokens WHERE user_id = $1 AND token = $2`,
        [userId, token]
    );
}

