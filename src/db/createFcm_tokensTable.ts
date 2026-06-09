import { connectDB } from "../core/config/db";
/**
 * Creates the `fcm_tokens` table if it does not already exist.
 *
 * The table stores Firebase Cloud Messaging (FCM) tokens associated with users.
 * It includes:
 * - A unique UUID primary key.
 * - A foreign key reference to the `users` table.
 * - The FCM token value.
 * - Creation and update timestamps.
 * - A unique constraint on the combination of `user_id` and `token`.
 *
 * Additionally, an index is created on the `user_id` column to improve lookup performance.
 *
 * @returns {Promise<void>} Resolves when the table and index have been created successfully.
 * @throws Logs any database or query execution errors to the console.
 */
export const createFcmTokensTable = async (): Promise<void> => {
    try {
        const client = await connectDB();
        
        const query = `
        CREATE TABLE IF NOT EXISTS fcm_tokens (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    UUID        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token      TEXT        NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (user_id, token)
);

CREATE INDEX IF NOT EXISTS idx_fcm_tokens_user_id ON fcm_tokens(user_id);`;

        await client.query(query);
        // console.log("FCM tokens table created successfully!");
    }
    catch (error: unknown) {
        if (error instanceof Error) {
            console.error("Error creating FCM tokens table:", error.message);
        } else {
            console.error("Unknown error:", error);
        }
    }
}
