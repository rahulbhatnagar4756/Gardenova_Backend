import { getDB } from "../../core/config/db";
import {
  UserDailyChallengeRow,
  UserGamificationRow,
} from "./gamificationTypes";

let tableReady: Promise<void> | null = null;

/**
 * Ensures gamification tables exist (idempotent).
 *
 * @returns {Promise<void>}
 */
export async function ensureGamificationTables(): Promise<void> {
  if (!tableReady) {
    tableReady = (async (): Promise<void> => {
      const db = getDB();
      await db.query(`
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
    })().catch((err: unknown) => {
      tableReady = null;
      throw err;
    });
  }
  await tableReady;
}

/**
 * Returns today's date string in Asia/Kolkata (YYYY-MM-DD).
 *
 * @param date
 * @returns {string}
 */
export function getIstDateString(date = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Kolkata",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}

/**
 * Ensures a gamification profile row exists for the user.
 *
 * @param {string} userId
 * @returns {Promise<UserGamificationRow>}
 */
export async function ensureUserGamification(
  userId: string
): Promise<UserGamificationRow> {
  await ensureGamificationTables();
  const db = getDB();
  const existing = await db.query<UserGamificationRow>(
    `SELECT user_id, total_points, care_streak, last_care_date::text, landscape_count
       FROM user_gamification WHERE user_id = $1`,
    [userId]
  );
  if (existing.rows[0]) return existing.rows[0];

  const inserted = await db.query<UserGamificationRow>(
    `INSERT INTO user_gamification (user_id)
     VALUES ($1)
     ON CONFLICT (user_id) DO UPDATE SET updated_at = now()
     RETURNING user_id, total_points, care_streak, last_care_date::text, landscape_count`,
    [userId]
  );
  const row = inserted.rows[0];
  if (!row) {
    throw new Error("Failed to create user gamification profile");
  }
  return row;
}

/**
 * Lists assigned challenges for a user on a given IST date.
 *
 * @param {string} userId
 * @param {string} challengeDate
 * @returns {Promise<UserDailyChallengeRow[]>}
 */
export async function listDailyChallenges(
  userId: string,
  challengeDate: string
): Promise<UserDailyChallengeRow[]> {
  await ensureGamificationTables();
  const db = getDB();
  const result = await db.query<UserDailyChallengeRow>(
    `SELECT id, user_id, challenge_code, challenge_date::text, title, description,
            category, points, target_count, progress_count, status,
            COALESCE(metadata, '{}'::jsonb) AS metadata,
            completed_at::text, created_at::text
       FROM user_daily_challenges
      WHERE user_id = $1 AND challenge_date = $2::date
      ORDER BY created_at ASC`,
    [userId, challengeDate]
  );
  return result.rows.map((row) => ({
    ...row,
    metadata:
      typeof row.metadata === "string"
        ? (JSON.parse(row.metadata) as Record<string, unknown>)
        : (row.metadata ?? {}),
  }));
}

/**
 * Inserts a daily challenge assignment.
 * @param input
 * @param input.userId
 * @param input.challengeCode
 * @param input.challengeDate
 * @param input.title
 * @param input.description
 * @param input.category
 * @param input.points
 * @param input.targetCount
 * @param input.metadata
 * @returns {unknown}
 */
export async function insertDailyChallenge(input: {
  userId: string;
  challengeCode: string;
  challengeDate: string;
  title: string;
  description: string;
  category: string;
  points: number;
  targetCount: number;
  metadata?: Record<string, unknown>;
}): Promise<UserDailyChallengeRow> {
  await ensureGamificationTables();
  const db = getDB();
  const result = await db.query<UserDailyChallengeRow>(
    `INSERT INTO user_daily_challenges (
        user_id, challenge_code, challenge_date, title, description,
        category, points, target_count, metadata
     ) VALUES ($1,$2,$3::date,$4,$5,$6,$7,$8,$9::jsonb)
     ON CONFLICT (user_id, challenge_code, challenge_date) DO UPDATE
       SET title = EXCLUDED.title
     RETURNING id, user_id, challenge_code, challenge_date::text, title, description,
               category, points, target_count, progress_count, status,
               COALESCE(metadata, '{}'::jsonb) AS metadata,
               completed_at::text, created_at::text`,
    [
      input.userId,
      input.challengeCode,
      input.challengeDate,
      input.title,
      input.description,
      input.category,
      input.points,
      input.targetCount,
      JSON.stringify(input.metadata ?? {}),
    ]
  );
  const row = result.rows[0];
  if (!row) {
    throw new Error("Failed to insert daily challenge");
  }
  return {
    ...row,
    metadata:
      typeof row.metadata === "string"
        ? (JSON.parse(row.metadata) as Record<string, unknown>)
        : (row.metadata ?? {}),
  };
}

/**
 * Returns lifetime once-challenge codes already completed by the user.
 * @param userId
 * @returns {Promise<Set<string>>}
 */
export async function listCompletedOnceCodes(
  userId: string
): Promise<Set<string>> {
  await ensureGamificationTables();
  const db = getDB();
  const result = await db.query<{ challenge_code: string }>(
    `SELECT DISTINCT challenge_code
       FROM user_challenge_completions
      WHERE user_id = $1`,
    [userId]
  );
  return new Set(result.rows.map((r) => r.challenge_code));
}

/**
 * Logs a raw gamification activity event.
 * @param userId
 * @param activityType
 * @param payload
 * @returns {unknown}
 */
export async function logActivity(
  userId: string,
  activityType: string,
  payload: Record<string, unknown> = {}
): Promise<void> {
  await ensureGamificationTables();
  const db = getDB();
  await db.query(
    `INSERT INTO gamification_activity (user_id, activity_type, payload)
     VALUES ($1, $2, $3::jsonb)`,
    [userId, activityType, JSON.stringify(payload)]
  );
}

/**
 * Finds a daily challenge by id for a specific user.
 * @param userId
 * @param challengeId
 * @returns {Promise<UserDailyChallengeRow | null>}
 */
export async function findDailyChallengeById(
  userId: string,
  challengeId: string
): Promise<UserDailyChallengeRow | null> {
  await ensureGamificationTables();
  const db = getDB();
  const result = await db.query<UserDailyChallengeRow>(
    `SELECT id, user_id, challenge_code, challenge_date::text, title, description,
            category, points, target_count, progress_count, status,
            COALESCE(metadata, '{}'::jsonb) AS metadata,
            completed_at::text, created_at::text
       FROM user_daily_challenges
      WHERE id = $1 AND user_id = $2
      LIMIT 1`,
    [challengeId, userId]
  );
  const row = result.rows[0];
  if (!row) return null;
  return {
    ...row,
    metadata:
      typeof row.metadata === "string"
        ? (JSON.parse(row.metadata) as Record<string, unknown>)
        : (row.metadata ?? {}),
  };
}

/**
 * Marks an active daily challenge as fully completed (progress = target).
 * @param challengeId
 * @param userId
 * @returns {Promise<UserDailyChallengeRow | null>}
 */
export async function markChallengeCompleted(
  challengeId: string,
  userId: string
): Promise<UserDailyChallengeRow | null> {
  await ensureGamificationTables();
  const db = getDB();
  const result = await db.query<UserDailyChallengeRow>(
    `UPDATE user_daily_challenges
        SET progress_count = target_count,
            status = 'completed',
            completed_at = COALESCE(completed_at, now())
      WHERE id = $1
        AND user_id = $2
        AND status = 'active'
      RETURNING id, user_id, challenge_code, challenge_date::text, title, description,
                category, points, target_count, progress_count, status,
                COALESCE(metadata, '{}'::jsonb) AS metadata,
                completed_at::text, created_at::text`,
    [challengeId, userId]
  );
  const row = result.rows[0];
  if (!row) return null;
  return {
    ...row,
    metadata:
      typeof row.metadata === "string"
        ? (JSON.parse(row.metadata) as Record<string, unknown>)
        : (row.metadata ?? {}),
  };
}

/**
 * Merges metadata JSON onto an active daily challenge row.
 * @param challengeId
 * @param metadata
 * @returns {Promise<void>}
 */
export async function updateChallengeMetadata(
  challengeId: string,
  metadata: Record<string, unknown>
): Promise<void> {
  await ensureGamificationTables();
  const db = getDB();
  await db.query(
    `UPDATE user_daily_challenges
        SET metadata = COALESCE(metadata, '{}'::jsonb) || $2::jsonb
      WHERE id = $1`,
    [challengeId, JSON.stringify(metadata)]
  );
}

/**
 * Increments progress on an active daily challenge and completes it when target is met.
 * @param challengeId
 * @param amount
 * @returns {Promise<UserDailyChallengeRow | null>}
 */
export async function incrementChallengeProgress(
  challengeId: string,
  amount = 1
): Promise<UserDailyChallengeRow | null> {
  await ensureGamificationTables();
  const db = getDB();
  const result = await db.query<UserDailyChallengeRow>(
    `UPDATE user_daily_challenges
        SET progress_count = LEAST(target_count, progress_count + $2),
            status = CASE
              WHEN progress_count + $2 >= target_count THEN 'completed'
              ELSE status
            END,
            completed_at = CASE
              WHEN progress_count + $2 >= target_count AND completed_at IS NULL
                THEN now()
              ELSE completed_at
            END
      WHERE id = $1
        AND status = 'active'
      RETURNING id, user_id, challenge_code, challenge_date::text, title, description,
                category, points, target_count, progress_count, status,
                COALESCE(metadata, '{}'::jsonb) AS metadata,
                completed_at::text, created_at::text`,
    [challengeId, amount]
  );
  const row = result.rows[0];
  if (!row) return null;
  return {
    ...row,
    metadata:
      typeof row.metadata === "string"
        ? (JSON.parse(row.metadata) as Record<string, unknown>)
        : (row.metadata ?? {}),
  };
}

/**
 * Awards points for a completed daily challenge (idempotent via completion row).
 * @param input
 * @param input.userId
 * @param input.challengeCode
 * @param input.points
 * @param input.challengeDate
 * @param input.dailyChallengeId
 * @returns {unknown}
 */
export async function awardChallengePoints(input: {
  userId: string;
  challengeCode: string;
  points: number;
  challengeDate: string;
  dailyChallengeId: string;
}): Promise<boolean> {
  await ensureGamificationTables();
  const db = getDB();
  const client = await db.connect();
  try {
    await client.query("BEGIN");

    const already = await client.query(
      `SELECT id FROM user_challenge_completions
        WHERE daily_challenge_id = $1
        LIMIT 1`,
      [input.dailyChallengeId]
    );
    if (already.rows[0]) {
      await client.query("COMMIT");
      return false;
    }

    await client.query(
      `INSERT INTO user_challenge_completions
         (user_id, challenge_code, points_awarded, challenge_date, daily_challenge_id)
       VALUES ($1, $2, $3, $4::date, $5)`,
      [
        input.userId,
        input.challengeCode,
        input.points,
        input.challengeDate,
        input.dailyChallengeId,
      ]
    );

    await client.query(
      `INSERT INTO points_ledger
         (user_id, points, reason, challenge_code, daily_challenge_id)
       VALUES ($1, $2, $3, $4, $5)`,
      [
        input.userId,
        input.points,
        `Completed challenge: ${input.challengeCode}`,
        input.challengeCode,
        input.dailyChallengeId,
      ]
    );

    await client.query(
      `INSERT INTO user_gamification (user_id, total_points)
       VALUES ($1, $2)
       ON CONFLICT (user_id) DO UPDATE
         SET total_points = user_gamification.total_points + EXCLUDED.total_points,
             updated_at = now()`,
      [input.userId, input.points]
    );

    await client.query("COMMIT");
    return true;
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }
}

/**
 * Updates care streak based on IST calendar dates.
 * @param userId
 * @param todayIst
 * @returns {Promise<number>}
 */
export async function updateCareStreak(
  userId: string,
  todayIst: string
): Promise<number> {
  await ensureGamificationTables();
  const profile = await ensureUserGamification(userId);
  const db = getDB();

  let nextStreak = 1;
  if (profile.last_care_date === todayIst) {
    return profile.care_streak;
  }

  if (profile.last_care_date) {
    const last = new Date(`${profile.last_care_date}T00:00:00+05:30`);
    const today = new Date(`${todayIst}T00:00:00+05:30`);
    const diffDays = Math.round(
      (today.getTime() - last.getTime()) / (24 * 60 * 60 * 1000)
    );
    nextStreak = diffDays === 1 ? profile.care_streak + 1 : 1;
  }

  const result = await db.query<{ care_streak: number }>(
    `UPDATE user_gamification
        SET care_streak = $2,
            last_care_date = $3::date,
            updated_at = now()
      WHERE user_id = $1
      RETURNING care_streak`,
    [userId, nextStreak, todayIst]
  );
  return result.rows[0]?.care_streak ?? nextStreak;
}

/**
 * Increments landscape design counter for the user.
 * @param userId
 * @returns {Promise<number>}
 */
export async function incrementLandscapeCount(userId: string): Promise<number> {
  await ensureGamificationTables();
  await ensureUserGamification(userId);
  const db = getDB();
  const result = await db.query<{ landscape_count: number }>(
    `UPDATE user_gamification
        SET landscape_count = landscape_count + 1,
            updated_at = now()
      WHERE user_id = $1
      RETURNING landscape_count`,
    [userId]
  );
  return result.rows[0]?.landscape_count ?? 0;
}

/**
 * Points earned today (IST) and challenges completed today.
 * @param userId
 * @param todayIst
 * @returns {Promise<}
 */
export async function getTodayStats(
  userId: string,
  todayIst: string
): Promise<{ pointsEarnedToday: number; challengesCompletedToday: number }> {
  await ensureGamificationTables();
  const db = getDB();
  const points = await db.query<{ total: string }>(
    `SELECT COALESCE(SUM(points), 0)::text AS total
       FROM points_ledger
      WHERE user_id = $1
        AND (created_at AT TIME ZONE 'Asia/Kolkata')::date = $2::date`,
    [userId, todayIst]
  );
  const completed = await db.query<{ count: string }>(
    `SELECT COUNT(*)::text AS count
       FROM user_daily_challenges
      WHERE user_id = $1
        AND challenge_date = $2::date
        AND status = 'completed'`,
    [userId, todayIst]
  );
  return {
    pointsEarnedToday: Number(points.rows[0]?.total ?? 0),
    challengesCompletedToday: Number(completed.rows[0]?.count ?? 0),
  };
}

/**
 * Counts activity rows for a user/type since start of IST day.
 * @param userId
 * @param activityType
 * @param todayIst
 * @returns {Promise<number>}
 */
export async function countActivityToday(
  userId: string,
  activityType: string,
  todayIst: string
): Promise<number> {
  await ensureGamificationTables();
  const db = getDB();
  const result = await db.query<{ count: string }>(
    `SELECT COUNT(*)::text AS count
       FROM gamification_activity
      WHERE user_id = $1
        AND activity_type = $2
        AND (created_at AT TIME ZONE 'Asia/Kolkata')::date = $3::date`,
    [userId, activityType, todayIst]
  );
  return Number(result.rows[0]?.count ?? 0);
}

/**
 * Counts all-time activity rows for a user/type.
 * @param userId
 * @param activityType
 * @returns {Promise<number>}
 */
export async function countActivityTotal(
  userId: string,
  activityType: string
): Promise<number> {
  await ensureGamificationTables();
  const db = getDB();
  const result = await db.query<{ count: string }>(
    `SELECT COUNT(*)::text AS count
       FROM gamification_activity
      WHERE user_id = $1 AND activity_type = $2`,
    [userId, activityType]
  );
  return Number(result.rows[0]?.count ?? 0);
}
