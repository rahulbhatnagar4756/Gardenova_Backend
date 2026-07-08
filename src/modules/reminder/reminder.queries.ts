
import {  getDB } from '../../core/config/db';
import { UserPlant, ReminderType, NotificationLog } from '../../interface/reminder';


export const dbReminderTypeMap: Record<ReminderType, string> = {
    water:     'watering',
    fertilize: 'fertilizer',
    prune:     'pruning',
    generic:   'generic_care',
};
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
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    const { rows } = await client.query<UserPlant>(  // pool → client
      `
      SELECT up.*, p.common_name
      FROM user_plants up
      LEFT JOIN plant_table_final p ON p.id = up.plant_id
      WHERE
        (
          (
            up.watering_notification_enabled = true
            AND up.next_watered_at IS NOT NULL
            AND up.next_watered_at <= $1
            AND (
              up.watering_preferred_time IS NULL
              OR (NOW() AT TIME ZONE 'Asia/Kolkata')::time >= up.watering_preferred_time
            )
          ) OR (
            up.fertilizer_notification_enabled = true
            AND up.next_fertilized_at IS NOT NULL
            AND up.next_fertilized_at <= $1
            AND (
              up.fertilizer_preferred_time IS NULL
              OR (NOW() AT TIME ZONE 'Asia/Kolkata')::time >= up.fertilizer_preferred_time
            )
          ) OR (
            up.pruning_notification_enabled = true
            AND up.next_pruned_at IS NOT NULL
            AND up.next_pruned_at <= $1
            AND (
              up.pruning_preferred_time IS NULL
              OR (NOW() AT TIME ZONE 'Asia/Kolkata')::time >= up.pruning_preferred_time
            )
          ) OR (
            up.generic_notification_enabled = true
            AND up.next_generic_care_at IS NOT NULL
            AND up.next_generic_care_at <= $1
            AND (
              up.generic_care_preferred_time IS NULL
              OR (NOW() AT TIME ZONE 'Asia/Kolkata')::time >= up.generic_care_preferred_time
            )
          )
        )
      FOR UPDATE OF up SKIP LOCKED
      `,
      [now]
    );

    await client.query('COMMIT');
    return rows;

  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();  // connection pool wapas
  }
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
        `SELECT * FROM notification_log
         WHERE user_plant_id = $1
           AND reminder_type = $2
           AND scheduled_for = $3
           AND status IN ('sent', 'snoozed')
         LIMIT 1`,
        [userPlantId, dbReminderTypeMap[reminderType], scheduledFor]  // ✅
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
 * 
 */
export async function insertNotificationLog(data: {
  userPlantId: string;
  userId: string;
  reminderType: ReminderType;
  scheduledFor: Date;
  fcmMessageId: string | null;
}): Promise<NotificationLog | undefined> {
    const pool = await getDB();

    // Manual idempotency check — partial index ke saath ON CONFLICT kaam nahi karta
    const { rows: existing } = await pool.query<NotificationLog>(
        `SELECT * FROM notification_log
         WHERE user_plant_id = $1
           AND reminder_type = $2
           AND scheduled_for = $3
           AND status IN ('sent', 'snoozed')
         LIMIT 1`,
        [data.userPlantId, data.reminderType, data.scheduledFor]
    );

    if (existing[0]) return undefined; // already exists

    const { rows } = await pool.query<NotificationLog>(
    `INSERT INTO notification_log
       (user_plant_id, user_id, reminder_type, scheduled_for, fcm_message_id, status)
     VALUES ($1, $2, $3, $4, $5, 'sent')
     RETURNING *`,
    [
        data.userPlantId,
        data.userId,
        dbReminderTypeMap[data.reminderType],  // ✅ mapped value
        data.scheduledFor,
        data.fcmMessageId,
    ]
);;

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
         ORDER BY updated_at DESC`,
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
         ON CONFLICT ON CONSTRAINT uq_user_push_tokens_user_token 
         DO UPDATE SET updated_at = NOW()`,
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


/**
 * Retrieves push notification tokens for a list of users.
 *
 * Queries the `user_push_tokens` table and returns a map where each key is a
 * user ID and the value is an array of that user's push tokens, ordered by
 * most recently updated first.
 *
 * @param userIds - Array of user UUIDs to retrieve push tokens for.
 * @returns A promise that resolves to a map of user IDs to their associated
 * push notification tokens.
 *
 */
export async function getTokensForUsers(
  userIds: string[]
): Promise<Map<string, string[]>> {
  const pool = await getDB();
  const { rows } = await pool.query<{ user_id: string; token: string }>(
    `SELECT user_id, token FROM user_push_tokens
     WHERE user_id = ANY($1::uuid[])
     ORDER BY updated_at DESC`,
    [userIds]
  );
  const map = new Map<string, string[]>();
  for (const row of rows) {
    if (!map.has(row.user_id)) map.set(row.user_id, []);
    map.get(row.user_id)!.push(row.token);
  }
  return map;
}
/**
 * Retrieves notification log entries that have already been processed for a
 * batch of reminder keys.
 *
 * A log is considered active if its status is either `sent` or `snoozed`.
 * The returned set contains composite keys in the format:
 *
 * `userPlantId:reminderType:scheduledForISOString`
 *
 * which can be used for efficient existence checks when determining whether
 * a reminder should be sent again.
 *
 * @param keys - List of reminder identifiers consisting of:
 *   - `userPlantId`: The user plant UUID.
 *   - `reminderType`: The reminder type.
 *   - `scheduledFor`: The scheduled reminder timestamp.
 *
 * @returns A promise that resolves to a set of composite keys representing
 * active notification logs.
 *
 */
export async function getActiveLogsForBatch(
  keys: Array<{ userPlantId: string; reminderType: ReminderType; scheduledFor: Date }>
): Promise<Set<string>> {
  const pool = await getDB();
  const { rows } = await pool.query<{
    user_plant_id: string;
    reminder_type: string;
    scheduled_for: string;
  }>(
    `SELECT user_plant_id, reminder_type, scheduled_for
     FROM notification_log
     WHERE (user_plant_id::text, reminder_type, scheduled_for) IN (
       SELECT * FROM unnest($1::text[], $2::text[], $3::timestamptz[])
     )
     AND status IN ('sent', 'snoozed')`,
    [
      keys.map((k) => k.userPlantId),
      keys.map((k) => dbReminderTypeMap[k.reminderType]),
      keys.map((k) => k.scheduledFor),
    ]
  );
  return new Set(
    rows.map((r) => `${r.user_plant_id}:${r.reminder_type}:${new Date(r.scheduled_for).toISOString()}`)
  );
}
