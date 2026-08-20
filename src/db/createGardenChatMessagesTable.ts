import { connectDB } from "../core/config/db";

/**
 * Creates the garden_chat_messages table used by the gardening chatbot.
 *
 * @returns {Promise<void>} Resolves when the table exists.
 */
export async function createGardenChatMessagesTable(): Promise<void> {
  try {
    const client = await connectDB();
    await client.query(`
      CREATE EXTENSION IF NOT EXISTS "pgcrypto";

      CREATE TABLE IF NOT EXISTS garden_chat_messages (
        id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        conversation_id  UUID NOT NULL,
        user_id          UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        role             VARCHAR(16) NOT NULL CHECK (role IN ('user', 'assistant')),
        content          TEXT NOT NULL,
        is_gardening     BOOLEAN,
        image_url        TEXT,
        created_at       TIMESTAMPTZ NOT NULL DEFAULT now()
      );

      CREATE INDEX IF NOT EXISTS idx_garden_chat_user_created
        ON garden_chat_messages (user_id, created_at DESC);
      CREATE INDEX IF NOT EXISTS idx_garden_chat_conversation_created
        ON garden_chat_messages (conversation_id, created_at DESC);
    `);
  } catch (error: unknown) {
    if (error instanceof Error) {
      console.error("Error creating garden_chat_messages table:", error.message);
    } else {
      console.error("Unknown error creating garden_chat_messages table:", error);
    }
  }
}

if (require.main === module) {
  void createGardenChatMessagesTable().then(() => process.exit(0));
}
