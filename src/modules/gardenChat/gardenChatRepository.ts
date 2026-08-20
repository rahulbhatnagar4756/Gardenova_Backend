import { getDB } from "../../core/config/db";

export type GardenChatRole = "user" | "assistant";

export interface GardenChatMessage {
  id: string;
  conversationId: string;
  userId: string;
  role: GardenChatRole;
  content: string;
  imageUrl: string | null;
  isGardening: boolean | null;
  createdAt: string;
}

interface GardenChatRow {
  id: string;
  conversation_id: string;
  user_id: string;
  role: GardenChatRole;
  content: string;
  image_url: string | null;
  is_gardening: boolean | null;
  created_at: Date;
}

let gardenChatTableReady: Promise<void> | null = null;

/**
 * Ensures garden_chat_messages exists (idempotent).
 *
 * @returns {Promise<void>} Resolves when the table is ready.
 */
export async function ensureGardenChatTable(): Promise<void> {
  if (!gardenChatTableReady) {
    gardenChatTableReady = (async (): Promise<void> => {
      const db = getDB();
      await db.query(`
        CREATE EXTENSION IF NOT EXISTS "pgcrypto";

        CREATE TABLE IF NOT EXISTS garden_chat_messages (
          id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          conversation_id  UUID NOT NULL,
          user_id          UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
          role             VARCHAR(16) NOT NULL CHECK (role IN ('user', 'assistant')),
          content          TEXT NOT NULL,
          is_gardening     BOOLEAN,
          created_at       TIMESTAMPTZ NOT NULL DEFAULT now()
        );

        CREATE INDEX IF NOT EXISTS idx_garden_chat_user_created
          ON garden_chat_messages (user_id, created_at DESC);
        CREATE INDEX IF NOT EXISTS idx_garden_chat_conversation_created
          ON garden_chat_messages (conversation_id, created_at DESC);

        ALTER TABLE garden_chat_messages
          ADD COLUMN IF NOT EXISTS image_url TEXT;
      `);
    })().catch((err: unknown) => {
      gardenChatTableReady = null;
      throw err;
    });
  }
  await gardenChatTableReady;
}

/**
 * Finds the user's most recent conversation id, if any.
 *
 * @param userId - Authenticated user id
 * @returns Latest conversation id or null
 */
export async function findLatestConversationId(
  userId: string
): Promise<string | null> {
  await ensureGardenChatTable();
  const db = getDB();
  const result = await db.query<{ conversation_id: string }>(
    `SELECT conversation_id
       FROM garden_chat_messages
      WHERE user_id = $1
      ORDER BY created_at DESC
      LIMIT 1`,
    [userId]
  );
  return result.rows[0]?.conversation_id ?? null;
}

/**
 * Inserts one chat message.
 *
 * @param input - Message fields to persist
 * @param input.conversationId - Conversation thread id
 * @param input.userId - Owner user id
 * @param input.role - user or assistant
 * @param input.content - Message text
 * @param input.isGardening - Whether the user message was gardening related
 * @param input.imageUrl
 * @returns Inserted message
 */
export async function insertGardenChatMessage(input: {
  conversationId: string;
  userId: string;
  role: GardenChatRole;
  content: string;
  imageUrl?: string | null;
  isGardening?: boolean | null;
}): Promise<GardenChatMessage> {
  await ensureGardenChatTable();
  const db = getDB();
  const result = await db.query<{
    id: string;
    conversation_id: string;
    user_id: string;
    role: GardenChatRole;
    content: string;
    image_url: string | null;
    is_gardening: boolean | null;
    created_at: Date;
  }>(
    `INSERT INTO garden_chat_messages
       (conversation_id, user_id, role, content, image_url, is_gardening)
     VALUES ($1, $2, $3, $4, $5, $6)
     RETURNING id, conversation_id, user_id, role, content, image_url, is_gardening, created_at`,
    [
      input.conversationId,
      input.userId,
      input.role,
      input.content,
      input.imageUrl ?? null,
      input.isGardening ?? null,
    ]
  );

  const row = result.rows[0]!;
  return mapRow(row);
}

/**
 * Returns the latest messages for a conversation in chronological order.
 *
 * @param conversationId - Conversation thread id
 * @param userId - Owner user id
 * @param limit - Maximum messages to return (default 10)
 * @returns Chronological message list
 */
export async function findLatestGardenChatMessages(
  conversationId: string,
  userId: string,
  limit = 10
): Promise<GardenChatMessage[]> {
  await ensureGardenChatTable();
  const db = getDB();
  const result = await db.query<{
    id: string;
    conversation_id: string;
    user_id: string;
    role: GardenChatRole;
    content: string;
    image_url: string | null;
    is_gardening: boolean | null;
    created_at: Date;
  }>(
    `SELECT id, conversation_id, user_id, role, content, image_url, is_gardening, created_at
       FROM garden_chat_messages
      WHERE conversation_id = $1
        AND user_id = $2
      ORDER BY created_at DESC
      LIMIT $3`,
    [conversationId, userId, limit]
  );

  return result.rows.map(mapRow).reverse();
}

/**
 * Counts messages in a conversation for the user.
 *
 * @param conversationId - Conversation thread id
 * @param userId - Owner user id
 * @returns Total message count
 */
export async function countGardenChatMessages(
  conversationId: string,
  userId: string
): Promise<number> {
  await ensureGardenChatTable();
  const db = getDB();
  const result = await db.query<{ total: string }>(
    `SELECT COUNT(*) AS total
       FROM garden_chat_messages
      WHERE conversation_id = $1
        AND user_id = $2`,
    [conversationId, userId]
  );

  return parseInt(result.rows[0]?.total ?? "0", 10);
}

/**
 * Returns paginated messages for a conversation in chronological order.
 *
 * @param conversationId - Conversation thread id
 * @param userId - Owner user id
 * @param limit - Page size
 * @param offset - Number of rows to skip
 * @returns Chronological message list
 */
export async function findGardenChatMessagesPaginated(
  conversationId: string,
  userId: string,
  limit: number,
  offset: number
): Promise<GardenChatMessage[]> {
  await ensureGardenChatTable();
  const db = getDB();
  const result = await db.query<{
    id: string;
    conversation_id: string;
    user_id: string;
    role: GardenChatRole;
    content: string;
    image_url: string | null;
    is_gardening: boolean | null;
    created_at: Date;
  }>(
    `SELECT id, conversation_id, user_id, role, content, image_url, is_gardening, created_at
       FROM garden_chat_messages
      WHERE conversation_id = $1
        AND user_id = $2
      ORDER BY created_at ASC
      LIMIT $3 OFFSET $4`,
    [conversationId, userId, limit, offset]
  );

  return result.rows.map(mapRow);
}

/**
 * Maps a database row to the API message shape.
 *
 * @param row - Raw SQL row
 * @returns Garden chat message
 */
function mapRow(row: GardenChatRow): GardenChatMessage {
  return {
    id: row.id,
    conversationId: row.conversation_id,
    userId: row.user_id,
    role: row.role,
    content: row.content,
    imageUrl: row.image_url,
    isGardening: row.is_gardening,
    createdAt:
      row.created_at instanceof Date
        ? row.created_at.toISOString()
        : String(row.created_at),
  };
}
