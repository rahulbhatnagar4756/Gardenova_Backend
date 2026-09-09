import { connectDB } from "../core/config/db";

/**
 * Creates the `feature_usage` table (plan limits counters) if missing.
 * Does not FK-cascade on user delete so usage survives re-registration
 * with the same user id.
 *
 * @returns {Promise<void>}
 */
export async function createFeatureUsageTable(): Promise<void> {
  try {
    const client = await connectDB();
    await client.query(`
      CREATE EXTENSION IF NOT EXISTS "pgcrypto";

      CREATE TABLE IF NOT EXISTS feature_usage (
        id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id      UUID NOT NULL,
        feature_type TEXT NOT NULL,
        period       TEXT NOT NULL,
        count        INTEGER NOT NULL DEFAULT 0,
        created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
        updated_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
        UNIQUE (user_id, feature_type, period)
      );

      CREATE INDEX IF NOT EXISTS idx_feature_usage_user_id
        ON feature_usage (user_id);

      -- Existing installs may have REFERENCES users(id) ON DELETE CASCADE
      ALTER TABLE feature_usage DROP CONSTRAINT IF EXISTS feature_usage_user_id_fkey;
    `);
    console.error("feature_usage table ready");
  } catch (error: unknown) {
    if (error instanceof Error) {
      console.error("Error creating feature_usage table:", error.message);
    } else {
      console.error("Unknown error creating feature_usage table:", error);
    }
  }
}

if (require.main === module) {
  void createFeatureUsageTable().then(() => process.exit(0));
}
