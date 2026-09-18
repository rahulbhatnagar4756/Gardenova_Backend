import { connectDB } from "../core/config/db";

/**
 * Creates gamification tables (points, daily challenges, ledger, activity).
 *
 * @returns {Promise<void>}
 */
export async function createGamificationTables(): Promise<void> {
  try {
    const client = await connectDB();
    await client.query(`
      CREATE EXTENSION IF NOT EXISTS "pgcrypto";

      CREATE TABLE IF NOT EXISTS user_gamification (
        user_id UUID PRIMARY KEY,
        total_points INTEGER NOT NULL DEFAULT 0,
        care_streak INTEGER NOT NULL DEFAULT 0,
        last_care_date DATE,
        landscape_count INTEGER NOT NULL DEFAULT 0,
        created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
      );

      CREATE TABLE IF NOT EXISTS user_daily_challenges (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id UUID NOT NULL,
        challenge_code TEXT NOT NULL,
        challenge_date DATE NOT NULL,
        title TEXT NOT NULL,
        description TEXT,
        category TEXT NOT NULL,
        points INTEGER NOT NULL,
        target_count INTEGER NOT NULL DEFAULT 1,
        progress_count INTEGER NOT NULL DEFAULT 0,
        status TEXT NOT NULL DEFAULT 'active',
        metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
        completed_at TIMESTAMPTZ,
        created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
        CONSTRAINT user_daily_challenges_status_chk
          CHECK (status IN ('active', 'completed', 'expired')),
        UNIQUE (user_id, challenge_code, challenge_date)
      );

      CREATE INDEX IF NOT EXISTS idx_user_daily_challenges_user_date
        ON user_daily_challenges (user_id, challenge_date);

      CREATE TABLE IF NOT EXISTS user_challenge_completions (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id UUID NOT NULL,
        challenge_code TEXT NOT NULL,
        points_awarded INTEGER NOT NULL,
        challenge_date DATE,
        daily_challenge_id UUID,
        completed_at TIMESTAMPTZ NOT NULL DEFAULT now()
      );

      CREATE INDEX IF NOT EXISTS idx_user_challenge_completions_user
        ON user_challenge_completions (user_id, challenge_code);

      CREATE TABLE IF NOT EXISTS points_ledger (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id UUID NOT NULL,
        points INTEGER NOT NULL,
        reason TEXT NOT NULL,
        challenge_code TEXT,
        daily_challenge_id UUID,
        created_at TIMESTAMPTZ NOT NULL DEFAULT now()
      );

      CREATE INDEX IF NOT EXISTS idx_points_ledger_user
        ON points_ledger (user_id, created_at DESC);

      CREATE TABLE IF NOT EXISTS gamification_activity (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id UUID NOT NULL,
        activity_type TEXT NOT NULL,
        payload JSONB NOT NULL DEFAULT '{}'::jsonb,
        created_at TIMESTAMPTZ NOT NULL DEFAULT now()
      );

      CREATE INDEX IF NOT EXISTS idx_gamification_activity_user_type
        ON gamification_activity (user_id, activity_type, created_at DESC);
    `);
    console.error("Gamification tables ready");
  } catch (error: unknown) {
    if (error instanceof Error) {
      console.error("Error creating gamification tables:", error.message);
    } else {
      console.error("Unknown error creating gamification tables:", error);
    }
  }
}

if (require.main === module) {
  void createGamificationTables().then(() => process.exit(0));
}
