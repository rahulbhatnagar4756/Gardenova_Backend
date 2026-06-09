import { connectDB } from "../core/config/db";
/**
 * Creates the `notification_log` table and its indexes if they do not already exist.
 *
 * The table tracks plant care reminder notifications sent to users, including:
 * - The associated user plant.
 * - Reminder type (watering, fertilizer, pruning, or generic care).
 * - Scheduled send time and actual send time.
 * - Notification status (sent, snoozed, or completed).
 * - Snooze information and FCM message identifier.
 * - Creation and update timestamps.
 *
 * Indexes are created to optimize queries by:
 * - `user_plant_id`
 * - `status`
 * - `snoozed_until` for snoozed notifications
 *
 * An idempotency index ensures that only one active notification
 * (`sent` or `snoozed`) exists for a given plant, reminder type,
 * and scheduled cycle.
 *
 * @returns {Promise<void>} Resolves when the table and indexes have been created.
 * @throws Logs any database connection or query execution errors to the console.
 */
export const createnotification_logTable = async (): Promise<void> => {
    try {
        const client = await connectDB();

        const query = `
        CREATE TABLE IF NOT EXISTS notification_log (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_plant_id   UUID        NOT NULL REFERENCES user_plants(id) ON DELETE CASCADE,
  user_id         UUID        NOT NULL,
  reminder_type   VARCHAR(20) NOT NULL CHECK (reminder_type IN ('watering','fertilizer','pruning','generic_care')),
  scheduled_for   TIMESTAMPTZ NOT NULL,   -- the next_X_at value at time of send
  sent_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  status          VARCHAR(20) NOT NULL DEFAULT 'sent' CHECK (status IN ('sent','snoozed','completed')),
  snoozed_until   TIMESTAMPTZ,
  fcm_message_id  TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
 
CREATE INDEX IF NOT EXISTS idx_notif_log_user_plant   ON notification_log(user_plant_id);
CREATE INDEX IF NOT EXISTS idx_notif_log_status       ON notification_log(status);
CREATE INDEX IF NOT EXISTS idx_notif_log_snoozed_until ON notification_log(snoozed_until) WHERE status = 'snoozed';
-- Idempotency index: one active notification per plant+type+cycle
CREATE UNIQUE INDEX IF NOT EXISTS idx_notif_log_idempotency
  ON notification_log(user_plant_id, reminder_type, scheduled_for)
  WHERE status IN ('sent', 'snoozed');`;

        await client.query(query);
        // console.log("Notification log table created successfully!");
    }   
    catch (error: unknown) {
        if (error instanceof Error) {
            console.error("Error creating notification log table:", error.message);
        } else {
            console.error("Unknown error:", error);
        }
    }
}