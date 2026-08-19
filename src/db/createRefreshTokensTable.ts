import { connectDB } from "../core/config/db";

/**
 * Creates the refresh_tokens table for access/refresh token rotation.
 *
 * @returns {Promise<void>} Resolves when the table exists.
 */
export async function createRefreshTokensTable(): Promise<void> {
  try {
    const client = await connectDB();
    await client.query(`
      CREATE EXTENSION IF NOT EXISTS "pgcrypto";

      CREATE TABLE IF NOT EXISTS refresh_tokens (
        id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id     UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        token_hash  VARCHAR(128) NOT NULL UNIQUE,
        expires_at  TIMESTAMPTZ NOT NULL,
        revoked_at  TIMESTAMPTZ,
        created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
      );

      CREATE INDEX IF NOT EXISTS idx_refresh_tokens_user_id
        ON refresh_tokens (user_id);
      CREATE INDEX IF NOT EXISTS idx_refresh_tokens_expires_at
        ON refresh_tokens (expires_at);
    `);
  } catch (error: unknown) {
    if (error instanceof Error) {
      console.error("Error creating refresh_tokens table:", error.message);
    } else {
      console.error("Unknown error creating refresh_tokens table:", error);
    }
  }
}

if (require.main === module) {
  void createRefreshTokensTable().then(() => process.exit(0));
}
