import { connectDB } from "../core/config/db";

/**
 * Creates the table used to track missed care notifications.
 *
 * One row is stored per user + plant + notification feature. When the same
 * notification is missed again, the count is incremented instead of inserting
 * a duplicate row.
 */
export async function createMissedNotificationsTable(): Promise<void> {
  try {
    const client = await connectDB();

    await client.query(`
      CREATE EXTENSION IF NOT EXISTS "pgcrypto";

      CREATE TABLE IF NOT EXISTS missed_notifications (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id UUID NOT NULL,
        plant_id TEXT NOT NULL,
        notification_feature VARCHAR(50) NOT NULL,
        missed_count INTEGER NOT NULL DEFAULT 1,
        last_missed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        UNIQUE (user_id, plant_id, notification_feature)
      );

      CREATE INDEX IF NOT EXISTS idx_missed_notifications_user_id
        ON missed_notifications (user_id);

      CREATE INDEX IF NOT EXISTS idx_missed_notifications_plant_id
        ON missed_notifications (plant_id);

      CREATE INDEX IF NOT EXISTS idx_missed_notifications_feature
        ON missed_notifications (notification_feature);
    `);

    console.error("missed_notifications table ready");
  } catch (error: unknown) {
    if (error instanceof Error) {
      console.error("Error creating missed_notifications table:", error.message);
    } else {
      console.error("Unknown error creating missed_notifications table:", error);
    }
  }
}

if (require.main === module) {
  void createMissedNotificationsTable().then(() => process.exit(0));
}
