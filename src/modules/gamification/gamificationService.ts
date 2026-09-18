import logger from "../../core/config/logger";
import { getDB } from "../../core/config/db";
import {
  applyEventToDailyChallenges,
  ensureDailyChallengesAssigned,
} from "./challengeEngine";
import {
  awardChallengePoints,
  ensureUserGamification,
  findDailyChallengeById,
  getIstDateString,
  getTodayStats,
  incrementLandscapeCount,
  logActivity,
  markChallengeCompleted,
  updateCareStreak,
} from "./gamificationRepository";
import {
  AssignedChallengeView,
  GamificationEvent,
  GamificationSummary,
  PlanQuotaView,
} from "./gamificationTypes";
import { buildUserChallengeContext } from "./userContextService";

/**
 * Maps a challenge row to the API response view.
 * @param row
 * @param row.id
 * @param row.challenge_code
 * @param row.title
 * @param row.description
 * @param row.category
 * @param row.points
 * @param row.target_count
 * @param row.progress_count
 * @param row.status
 * @param row.completed_at
 * @param row.metadata
 * @returns {AssignedChallengeView}
 */
function toChallengeView(row: {
  id: string;
  challenge_code: string;
  title: string;
  description: string | null;
  category: string;
  points: number;
  target_count: number;
  progress_count: number;
  status: "active" | "completed" | "expired";
  completed_at: string | null;
  metadata: Record<string, unknown>;
}): AssignedChallengeView {
  return {
    id: row.id,
    code: row.challenge_code,
    title: row.title,
    description: row.description,
    category: row.category as AssignedChallengeView["category"],
    points: row.points,
    targetCount: row.target_count,
    progressCount: row.progress_count,
    status: row.status,
    completedAt: row.completed_at,
    metadata: row.metadata,
  };
}

/**
 * Returns today's challenges, assigning a personalized set when missing.
 * @param userId
 * @returns {Promise<AssignedChallengeView[]>}
 */
export async function getDailyChallengesService(
  userId: string
): Promise<AssignedChallengeView[]> {
  return ensureDailyChallengesAssigned(userId);
}

/**
 * Returns plan quota flags used when building / explaining daily challenges.
 * @param userId
 * @returns {Promise<PlanQuotaView>}
 */
export async function getPlanQuotaViewService(
  userId: string
): Promise<PlanQuotaView> {
  const ctx = await buildUserChallengeContext(userId);
  return {
    isPaid: ctx.isPaid,
    diagnosisLimit: ctx.diagnosisLimit,
    diagnosisRemaining: ctx.diagnosisRemaining,
    canDiagnose: ctx.canDiagnose,
    landscapeLimit: ctx.landscapeLimit,
    landscapeRemaining: ctx.landscapeRemaining,
    canLandscape: ctx.canLandscape,
  };
}

/**
 * Returns points / streak summary for the user.
 * @param userId
 * @returns {Promise<GamificationSummary>}
 */
export async function getGamificationSummaryService(
  userId: string
): Promise<GamificationSummary> {
  const profile = await ensureUserGamification(userId);
  const today = getIstDateString();
  const stats = await getTodayStats(userId, today);
  return {
    totalPoints: profile.total_points,
    careStreak: profile.care_streak,
    landscapeCount: profile.landscape_count,
    challengesCompletedToday: stats.challengesCompletedToday,
    pointsEarnedToday: stats.pointsEarnedToday,
  };
}

export interface CompleteChallengeResult {
  challenge: AssignedChallengeView;
  pointsAwarded: number;
  alreadyCompleted: boolean;
  summary: GamificationSummary;
}

/**
 * Marks a daily challenge activity as complete and awards points once.
 *
 * @param {string} userId - Authenticated user id.
 * @param {string} challengeId - Daily challenge assignment id.
 * @returns {Promise<CompleteChallengeResult>}
 */
export async function completeDailyChallengeService(
  userId: string,
  challengeId: string
): Promise<CompleteChallengeResult> {
  await ensureUserGamification(userId);

  const existing = await findDailyChallengeById(userId, challengeId);
  if (!existing) {
    throw new Error("Challenge not found");
  }

  if (existing.status === "expired") {
    throw new Error("Challenge has expired");
  }

  if (existing.status === "completed") {
    const summary = await getGamificationSummaryService(userId);
    return {
      challenge: toChallengeView(existing),
      pointsAwarded: 0,
      alreadyCompleted: true,
      summary,
    };
  }

  const completed = await markChallengeCompleted(challengeId, userId);
  if (!completed) {
    const again = await findDailyChallengeById(userId, challengeId);
    if (again?.status === "completed") {
      const summary = await getGamificationSummaryService(userId);
      return {
        challenge: toChallengeView(again),
        pointsAwarded: 0,
        alreadyCompleted: true,
        summary,
      };
    }
    throw new Error("Unable to complete challenge");
  }

  const awarded = await awardChallengePoints({
    userId,
    challengeCode: completed.challenge_code,
    points: completed.points,
    challengeDate: completed.challenge_date,
    dailyChallengeId: completed.id,
  });

  await logActivity(userId, "challenge_marked_complete", {
    challengeId: completed.id,
    challengeCode: completed.challenge_code,
    points: completed.points,
  });

  const summary = await getGamificationSummaryService(userId);
  return {
    challenge: toChallengeView(completed),
    pointsAwarded: awarded ? completed.points : 0,
    alreadyCompleted: false,
    summary,
  };
}

/**
 * Core event processor used by product hooks.
 * @param userId
 * @param event
 * @returns {Promise<AssignedChallengeView[]>}
 */
export async function recordGamificationEvent(
  userId: string,
  event: GamificationEvent
): Promise<AssignedChallengeView[]> {
  await ensureUserGamification(userId);
  await logActivity(userId, event.type, { ...event });

  if (event.type === "care_completed") {
    await updateCareStreak(userId, getIstDateString());
  }
  if (event.type === "landscape_created") {
    await incrementLandscapeCount(userId);
  }

  return applyEventToDailyChallenges(userId, event);
}

/**
 * Fire-and-forget tracker so product flows never fail on gamification errors.
 * @param userId
 * @param event
 * @returns {void}
 */
export function trackGamification(
  userId: string,
  event: GamificationEvent
): void {
  void recordGamificationEvent(userId, event).catch((err: unknown) => {
    logger.error("Gamification tracking failed", {
      userId,
      eventType: event.type,
      error: err instanceof Error ? err.message : String(err),
    });
  });
}

/**
 * Loads plant attributes used to personalize plant_added challenges.
 * @param plantId
 * @returns {Promise<}
 */
export async function getPlantAttrsForGamification(
  plantId: string | number
): Promise<{
  indoor: boolean | null;
  flowers: boolean | null;
  leaf: boolean | null;
  maintenance: string | null;
  growthForm: string | null;
}> {
  const db = getDB();
  const result = await db.query<{
    indoor: boolean | null;
    flowers: boolean | null;
    leaf: boolean | null;
    maintenance: string | null;
    plant_type: string | null;
  }>(
    `SELECT indoor, flowers, leaf, maintenance, type AS plant_type
       FROM plant_table_final
      WHERE id = $1
      LIMIT 1`,
    [plantId]
  );
  const row = result.rows[0];
  return {
    indoor: row?.indoor ?? null,
    flowers: row?.flowers ?? null,
    leaf: row?.leaf ?? null,
    maintenance: row?.maintenance ?? null,
    growthForm: row?.plant_type ?? null,
  };
}

/**
 * Best-effort check whether a scanned plant name matches an owned plant.
 * @param userId
 * @param plantName
 * @returns {Promise<boolean>}
 */
export async function doesScanMatchOwnedPlant(
  userId: string,
  plantName?: string | null
): Promise<boolean> {
  if (!plantName?.trim()) return false;
  const db = getDB();
  const result = await db.query(
    `SELECT 1
       FROM user_plants up
       JOIN plant_table_final p ON p.id = up.plant_id
      WHERE up.user_id = $1
        AND (
          LOWER(COALESCE(p.common_name, '')) LIKE $2
          OR LOWER(COALESCE(p.scientific_name, '')) LIKE $2
        )
      LIMIT 1`,
    [userId, `%${plantName.trim().toLowerCase()}%`]
  );
  return Boolean(result.rows[0]);
}
