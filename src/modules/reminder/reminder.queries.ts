
import { connectDB } from '../../core/config/db';
import { UserPlant, ReminderType, NotificationLog } from '../../interface/reminder';

// ─── Fetch all due plants ────────────────────────────────────────────────────
// A plant+type is "due" if:
//   1. notification is enabled
//   2. next_X_at is in the past
//   3. preferred_time has been reached (if set)
//   4. no active (sent/snoozed) notification_log exists for this cycle

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
    const pool = await connectDB();

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
    const pool = await connectDB();
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
    const pool = await connectDB();
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

// ─── Get log by ID (with plant data) ────────────────────────────────────────
/**
 * Retrieves a notification log entry along with its associated plant data.
 *
 * This is used when processing reminder actions (e.g., snooze or complete),
 * where both the log and plant configuration are required in a single query.
 *
 * @param logId - UUID of the notification log entry
 *
 * @returns {Promise<(NotificationLog & { plant: UserPlant }) | null>}
 * Returns the notification log with embedded plant data if found,
 * otherwise returns null.
 */
export async function getLogWithPlant(
  logId: string
): Promise<(NotificationLog & { plant: UserPlant }) | null> {
    const pool = await connectDB();
  const { rows } = await pool.query(
    `
    SELECT
      nl.*,
      row_to_json(up.*) AS plant
    FROM notification_log nl
    JOIN user_plants up ON up.id = nl.user_plant_id
    WHERE nl.id = $1
    LIMIT 1
    `,
    [logId]
  );
  if (!rows[0]) return null;
  return { ...rows[0], plant: rows[0].plant };
}

// ─── Snooze a log entry ──────────────────────────────────────────────────────
/**
 * Snoozes an active notification log entry.
 *
 * This updates the log status to `snoozed` and sets a new `snoozed_until`
 * timestamp. Only logs currently in `sent` status can be snoozed.
 *
 * This ensures that completed or already-snoozed reminders cannot be
 * accidentally modified in an invalid state.
 *
 * @param logId - UUID of the notification log to snooze
 * @param snoozedUntil - New timestamp until which the reminder is postponed
 *
 * @returns {Promise<NotificationLog | null>}
 * Returns the updated notification log if the operation succeeds,
 * otherwise returns null if no matching active log was found.
 */
// export async function snoozeLog(
//   logId: string,
//   snoozedUntil: Date
// ): Promise<NotificationLog | null> {
//     const pool = await connectDB();
//   const { rows } = await pool.query<NotificationLog>(
//     `
//     UPDATE notification_log
//     SET status = 'snoozed', snoozed_until = $2, updated_at = NOW()
//     WHERE id = $1
//       AND status = 'sent'           -- can only snooze an active notification
//     RETURNING *
//     `,
//     [logId, snoozedUntil]
//   );
//   return rows[0] ?? null;
// }

// ─── Mark log as completed ───────────────────────────────────────────────────
/**
 * Marks a notification log as completed.
 *
 * Only logs in `sent` or `snoozed` state can be completed.
 * This prevents invalid transitions from already completed logs.
 *
 * @param logId - UUID of the notification log
 * @returns {Promise<NotificationLog | null>}
 * Returns the updated log if successful, otherwise null if no valid log was found.
 */
export async function completeLog(logId: string): Promise<NotificationLog | null> {
    const pool = await connectDB();
  const { rows } = await pool.query<NotificationLog>(
    `
    UPDATE notification_log
    SET status = 'completed', updated_at = NOW()
    WHERE id = $1
      AND status IN ('sent', 'snoozed')
    RETURNING *
    `,
    [logId]
  );
  return rows[0] ?? null;
}

// ─── Update user_plants after completion ────────────────────────────────────
/**
 * Updates a user plant after a reminder is marked as completed.
 *
 * This function:
 * - Sets the "last_*" timestamp for the reminder type
 * - Recalculates the next scheduled reminder using frequency (in days)
 * - Updates the plant's `updated_at` timestamp
 *
 * @param userPlantId - ID of the plant being updated
 * @param reminderType - Type of reminder (watering, fertilizer, pruning, etc.)
 * @param now - Timestamp of completion
 * @returns {Promise<void>}
 */
export async function updatePlantAfterCompletion(
  userPlantId: string,
  reminderType: ReminderType,
  now: Date
): Promise<void> {
  // Map type → columns
  const pool = await connectDB();
  const colMap: Record<ReminderType, { last: string; next: string; freq: string }> = {
    water:     { last: "last_watered_at",     next: "next_watered_at",     freq: "watering_reminder_frequency" },
    fertilize: { last: "last_fertilized_at",  next: "next_fertilized_at",  freq: "fertilizer_reminder_frequency" },
    prune:     { last: "last_pruned_at",       next: "next_pruned_at",      freq: "pruning_reminder_frequency" },
    generic:   { last: "last_generic_care_at", next: "next_generic_care_at", freq: "generic_care_reminder_frequency" },
};

  const { last, next, freq } = colMap[reminderType];

  await pool.query(
    `
    UPDATE user_plants
    SET
      ${last}    = $2,
      ${next}    = $2 + (${freq} * INTERVAL '1 day'),
      updated_at = NOW()
    WHERE id = $1
    `,
    [userPlantId, now]
  );
}

// ─── Get snoozed logs that are now due ───────────────────────────────────────
/**
 * Fetches snoozed notification logs that are now due to be re-triggered.
 *
 * A log is considered due if:
 * - Status is `snoozed`
 * - `snoozed_until` timestamp is in the past or present
 *
 * Uses `FOR UPDATE SKIP LOCKED` to safely support concurrent cron workers.
 *
 * @returns {Promise<(NotificationLog & { plant: UserPlant })[]>}
 * List of due snoozed logs with embedded plant data.
 */
// export async function getDueSnoozedLogs(): Promise<
//   (NotificationLog & { plant: UserPlant })[]
// > {
//     const pool = await connectDB();
//   const { rows } = await pool.query(
//     `
//     SELECT
//       nl.*,
//       row_to_json(up.*) AS plant
//     FROM notification_log nl
//     JOIN user_plants up ON up.id = nl.user_plant_id
//     WHERE nl.status       = 'snoozed'
//       AND nl.snoozed_until <= NOW()
//     FOR UPDATE OF nl SKIP LOCKED
//     `
//   );
//   return rows.map((r) => ({ ...r, plant: r.plant }));
// }

// ─── Reset snoozed log back to sent (after re-firing) ───────────────────────
/**
 * Resets a snoozed notification log back to active (`sent` state).
 *
 * This is used when a snoozed reminder is re-fired by the cron system.
 * It clears the snooze state and optionally updates the FCM message ID.
 *
 * @param logId - UUID of the notification log
 * @param newMessageId - New FCM message ID (optional)
 * @returns {Promise<void>}
 */
// export async function resetSnoozedLog(
//   logId: string,
//   newMessageId: string | null
// ): Promise<void> {
//     const pool = await connectDB();
//   await pool.query(
//     `
//     UPDATE notification_log
//     SET
//       status         = 'sent',
//       snoozed_until  = NULL,
//       fcm_message_id = COALESCE($2, fcm_message_id),
//       sent_at        = NOW(),
//       updated_at     = NOW()
//     WHERE id = $1
//     `,
//     [logId, newMessageId]
//   );
// }

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
    const pool = await connectDB();
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
    const pool = await connectDB();
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
    const pool = await connectDB();
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
    const pool = await connectDB();
    await pool.query(
        `DELETE FROM user_push_tokens WHERE user_id = $1 AND token = $2`,
        [userId, token]
    );
}

/**
 * Reschedules a plant reminder by updating the next scheduled
 * occurrence timestamp for the specified reminder type.
 *
 * Updates the corresponding reminder date column on the user's plant
 * record and refreshes the `updated_at` timestamp.
 *
 * @param userPlantId - The ID of the user's plant record.
 * @param reminderType - The type of reminder to reschedule.
 * @param rescheduleTo - The new date and time when the reminder should occur.
 * @returns A promise that resolves when the reminder has been updated.
 */
export async function rescheduleReminder(
    userPlantId: string,
    reminderType: ReminderType,
    rescheduleTo: Date
): Promise<void> {
    const pool = await connectDB();

    const nextColMap: Record<ReminderType, string> = {
        water:     "next_watered_at",
        fertilize: "next_fertilized_at",
        prune:     "next_pruned_at",
        generic:   "next_generic_care_at",
    };

    await pool.query(
        `UPDATE user_plants
         SET ${nextColMap[reminderType]} = $1, updated_at = NOW()
         WHERE id = $2`,
        [rescheduleTo, userPlantId]
    );
}
/**
 * Disables a plant reminder by turning off notifications and
 * clearing the next scheduled reminder date for the specified
 * reminder type.
 *
 * Updates the corresponding notification-enabled flag to `false`,
 * sets the next reminder timestamp to `NULL`, and refreshes the
 * `updated_at` timestamp.
 *
 * @param userPlantId - The ID of the user's plant record.
 * @param reminderType - The type of reminder to disable.
 * @returns A promise that resolves when the reminder has been disabled.
 */
export async function disableReminder(
    userPlantId: string,
    reminderType: ReminderType
): Promise<void> {
    const pool = await connectDB();

    const colMap: Record<ReminderType, { enabled: string; next_at: string }> = {
        water:     { enabled: "watering_notification_enabled",   next_at: "next_watered_at" },
        fertilize: { enabled: "fertilizer_notification_enabled", next_at: "next_fertilized_at" },
        prune:     { enabled: "pruning_notification_enabled",    next_at: "next_pruned_at" },
        generic:   { enabled: "generic_notification_enabled",    next_at: "next_generic_care_at" },
    };

    const cols = colMap[reminderType];
    await pool.query(
        `UPDATE user_plants
         SET ${cols.enabled} = false, ${cols.next_at} = NULL, updated_at = NOW()
         WHERE id = $1`,
        [userPlantId]
    );
}