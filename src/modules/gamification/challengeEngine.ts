import {
  CHALLENGE_BY_CODE,
  CHALLENGE_CATALOG,
  ChallengeDefinition,
  DAILY_CHALLENGE_COUNT,
} from "./challengeCatalog";
import {
  awardChallengePoints,
  getIstDateString,
  incrementChallengeProgress,
  insertDailyChallenge,
  listDailyChallenges,
  updateChallengeMetadata,
} from "./gamificationRepository";
import {
  AssignedChallengeView,
  GamificationEvent,
  UserChallengeContext,
  UserDailyChallengeRow,
} from "./gamificationTypes";
import { buildUserChallengeContext } from "./userContextService";

/**
 * Fills title placeholders from user context.
 * @param def
 * @param ctx
 * @returns {string}
 */
function renderTitle(
  def: ChallengeDefinition,
  ctx: UserChallengeContext
): string {
  return def.title
    .replace("{issue}", ctx.lastUnhealthyIssue ?? "a plant issue")
    .replace(
      "{PlantName}",
      ctx.lastUnhealthyPlantName ?? "your plant"
    )
    .replace("{spaceType}", ctx.spaceLabel ?? "garden space")
    .replace(
      "{wateringFrequency}",
      ctx.wateringLabel ?? "watering"
    );
}

/**
 * Whether a challenge is currently eligible for this user.
 * @param def
 * @param ctx
 * @returns {boolean}
 */
export function isChallengeEligible(
  def: ChallengeDefinition,
  ctx: UserChallengeContext
): boolean {
  if (def.repeat === "once" && ctx.completedOnceCodes.has(def.code)) {
    return false;
  }

  // Quota gates — never assign scan/landscape tasks users cannot complete
  if (def.category === "scan") {
    const needed = def.code === "SCAN_2_TODAY" ? 2 : 1;
    if (!ctx.canDiagnose) return false;
    if (
      ctx.diagnosisRemaining >= 0 &&
      ctx.diagnosisRemaining < needed
    ) {
      return false;
    }
  }
  if (def.category === "landscape" && def.code !== "DESIGN_TO_REAL_GARDEN") {
    if (!ctx.canLandscape) return false;
  }

  // Free users: deprioritize paid-heavy landscape/scan unless they still have quota
  // (quota already gated above). Free users can still get scan/landscape if remaining > 0.

  switch (def.code) {
    case "ADD_FIRST_PLANT":
      return ctx.plantCount === 0;
    case "ADD_2_PLANTS":
      return ctx.plantCount > 0 && ctx.plantCount < 2;
    case "ADD_5_PLANTS":
      return ctx.plantCount >= 2 && ctx.plantCount < 5;
    case "ADD_10_PLANTS":
      return ctx.plantCount >= 5 && ctx.plantCount < 10;
    case "ADD_INDOOR_PLANT":
      return ctx.isIndoorSpace;
    case "ADD_BALCONY_PLANT":
      return ctx.isBalconySpace;
    case "ADD_OUTDOOR_PLANT":
      return ctx.isOutdoorSpace;
    case "ADD_LOW_MAINTENANCE":
      return ctx.isBeginner;
    case "ADD_FLOWERING":
      return ctx.floweringPlantCount === 0;
    case "ADD_LEAFY":
      return ctx.leafyPlantCount === 0;
    case "MINI_GARDEN_3":
      return ctx.plantCount >= 1 && ctx.plantCount < 3;
    case "GARDEN_15":
      return ctx.plantCount >= 10 && ctx.plantCount < 15;
    case "GARDEN_25":
      return ctx.plantCount >= 15 && ctx.plantCount < 25;
    case "FIRST_SCAN":
      return ctx.scanCount === 0 && ctx.canDiagnose;
    case "SCAN_OWNED":
      return ctx.plantCount >= 1 && ctx.canDiagnose;
    case "SCAN_2_TODAY":
      return (
        ctx.canDiagnose &&
        (ctx.diagnosisRemaining < 0 || ctx.diagnosisRemaining >= 2)
      );
    case "SCAN_3_DIFFERENT":
      return ctx.distinctScanPlantNames < 3 && ctx.canDiagnose;
    case "CHECK_UNHEALTHY":
    case "FOLLOW_UP_ISSUE":
    case "CHECK_PLANT_IMPROVED":
      return ctx.hasUnhealthyDiagnosis && ctx.canDiagnose;
    case "RESCAN_AFTER_7_DAYS":
      return ctx.hasScanOlderThan7Days && ctx.canDiagnose;
    case "COMPARE_PROGRESS":
    case "SCAN_NOT_RECENT":
      return ctx.hasAnyPreviousScan && ctx.canDiagnose;
    case "SCAN_UNUSUAL_SYMPTOMS":
      return (
        (ctx.hasUnhealthyDiagnosis || ctx.scanCount >= 1) && ctx.canDiagnose
      );
    case "COMPLETE_5_SCANS":
      return ctx.scanCount > 0 && ctx.scanCount < 5 && ctx.canDiagnose;
    case "FIRST_CARE":
      return ctx.careCompletedCount === 0 && ctx.plantCount >= 1;
    case "CARE_2_TODAY":
    case "TODAYS_CARE":
    case "WATERING_ROUTINE":
      return ctx.plantCount >= 1;
    case "CHECK_CARE_ROUTINE":
      return true;
    case "CARE_5_TOTAL":
      return ctx.careCompletedCount > 0 && ctx.careCompletedCount < 5;
    case "CARE_OLDEST":
    case "CARE_NEWEST":
    case "CARE_NEGLECTED":
      return ctx.plantCount >= 1;
    case "FOLLOW_WATERING_FREQ":
      return ctx.plantCount >= 1 && Boolean(ctx.wateringLabel);
    case "ATTENTION_3_PLANTS":
      return ctx.plantCount >= 3;
    case "MAINTAIN_STREAK":
      return ctx.careStreak >= 1 && ctx.plantCount >= 1;
    case "FIRST_LANDSCAPE":
      return ctx.landscapeCount === 0 && ctx.canLandscape;
    case "DESIGN_SPACE_TYPE":
      return Boolean(ctx.spaceLabel) && ctx.canLandscape;
    case "DESIGN_OUTDOOR":
      return ctx.isOutdoorSpace && ctx.canLandscape;
    case "DESIGN_INDOOR":
      return ctx.isIndoorSpace && ctx.canLandscape;
    case "DESIGN_BALCONY":
      return ctx.isBalconySpace && ctx.canLandscape;
    case "DESIGN_TO_REAL_GARDEN":
      return ctx.landscapeCount >= 1 && ctx.plantCount === 0;
    case "IMPROVE_DESIGN":
      return ctx.landscapeCount >= 1 && ctx.canLandscape;
    case "EXPLORE_NEW_CATEGORY":
      return ctx.plantCount >= 1;
    default:
      return true;
  }
}

/**
 * Preferred category order differs for free vs paid users.
 * @param ctx
 * @returns Preferred category sequence for daily picks
 */
function preferredCategories(
  ctx: UserChallengeContext
): Array<ChallengeDefinition["category"]> {
  if (ctx.isPaid) {
    const cats: Array<ChallengeDefinition["category"]> = [
      "care",
      "collection",
    ];
    if (ctx.canDiagnose) cats.push("scan");
    if (ctx.canLandscape) cats.push("landscape");
    cats.push("explore");
    return cats;
  }

  // Free: care + collection first; scan/landscape only if quota remains
  const cats: Array<ChallengeDefinition["category"]> = [
    "collection",
    "care",
    "explore",
  ];
  if (ctx.canDiagnose) cats.push("scan");
  if (ctx.canLandscape) cats.push("landscape");
  return cats;
}

/**
 * Safe always-on fallbacks that respect plan quotas.
 * @param ctx
 * @returns Fallback challenge definitions
 */
function fallbackChallenges(ctx: UserChallengeContext): ChallengeDefinition[] {
  const codes: string[] = [
    "CHECK_CARE_ROUTINE",
    "ADD_FIRST_PLANT",
    "ADD_FLOWERING",
    "ADD_LEAFY",
    "TODAYS_CARE",
    "CARE_2_TODAY",
    "WATERING_ROUTINE",
    "ADD_LOW_MAINTENANCE",
  ];
  if (ctx.canDiagnose) {
    codes.push("FIRST_SCAN", "SCAN_OWNED");
  }
  if (ctx.canLandscape) {
    codes.push("FIRST_LANDSCAPE", "DESIGN_SPACE_TYPE");
  }

  return codes
    .map((code) => CHALLENGE_BY_CODE[code])
    .filter((def): def is ChallengeDefinition => Boolean(def))
    .filter((def) => isChallengeEligible(def, ctx));
}

/**
 * Picks up to N personalized challenges with category diversity.
 * Always tries to return a full set for free and paid users.
 * @param ctx
 * @param count
 * @param excludeCodes - Challenge codes already assigned today
 * @returns {ChallengeDefinition[]}
 */
export function selectDailyChallenges(
  ctx: UserChallengeContext,
  count = DAILY_CHALLENGE_COUNT,
  excludeCodes: Set<string> = new Set()
): ChallengeDefinition[] {
  const eligible = CHALLENGE_CATALOG.filter(
    (def) => isChallengeEligible(def, ctx) && !excludeCodes.has(def.code)
  ).sort((a, b) => {
    // Paid users boost scan/landscape slightly; free users boost care/collection
    const paidBoost =
      ctx.isPaid && (a.category === "scan" || a.category === "landscape")
        ? 8
        : 0;
    const freeBoost =
      !ctx.isPaid && (a.category === "care" || a.category === "collection")
        ? 8
        : 0;
    const paidBoostB =
      ctx.isPaid && (b.category === "scan" || b.category === "landscape")
        ? 8
        : 0;
    const freeBoostB =
      !ctx.isPaid && (b.category === "care" || b.category === "collection")
        ? 8
        : 0;
    return b.priority + paidBoostB + freeBoostB - (a.priority + paidBoost + freeBoost);
  });

  const selected: ChallengeDefinition[] = [];
  const usedCodes = new Set<string>();

  // Pass 1: one challenge per preferred category
  for (const category of preferredCategories(ctx)) {
    if (selected.length >= count) break;
    const pick = eligible.find(
      (d) => d.category === category && !usedCodes.has(d.code)
    );
    if (!pick) continue;
    selected.push(pick);
    usedCodes.add(pick.code);
  }

  // Pass 2: fill remaining with highest priority unused eligible
  for (const def of eligible) {
    if (selected.length >= count) break;
    if (usedCodes.has(def.code)) continue;
    selected.push(def);
    usedCodes.add(def.code);
  }

  // Pass 3: quota-safe fallbacks so every user gets a full daily set
  for (const def of fallbackChallenges(ctx)) {
    if (selected.length >= count) break;
    if (usedCodes.has(def.code) || excludeCodes.has(def.code)) continue;
    selected.push(def);
    usedCodes.add(def.code);
  }

  return selected.slice(0, count);
}

/**
 * Maps a daily challenge DB row to the API view shape.
 * @param row
 * @returns {AssignedChallengeView}
 */
function toView(row: UserDailyChallengeRow): AssignedChallengeView {
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
 * Ensures the user has today's personalized daily challenge assigned.
 * Assigns exactly one challenge per IST day.
 * @param userId
 * @returns {Promise<AssignedChallengeView[]>}
 */
export async function ensureDailyChallengesAssigned(
  userId: string
): Promise<AssignedChallengeView[]> {
  const today = getIstDateString();
  const existing = await listDailyChallenges(userId, today);
  if (existing.length >= DAILY_CHALLENGE_COUNT) {
    // Keep a single daily challenge even if older runs assigned more
    return existing.slice(0, DAILY_CHALLENGE_COUNT).map(toView);
  }

  const ctx = await buildUserChallengeContext(userId);
  const alreadyCodes = new Set(existing.map((e) => e.challenge_code));
  const needed = DAILY_CHALLENGE_COUNT - existing.length;
  const picks = selectDailyChallenges(ctx, needed, alreadyCodes);

  for (const def of picks) {
    await insertDailyChallenge({
      userId,
      challengeCode: def.code,
      challengeDate: today,
      title: renderTitle(def, ctx),
      description: def.description,
      category: def.category,
      points: def.points,
      targetCount: def.target,
      metadata: {
        issue: ctx.lastUnhealthyIssue,
        plantName: ctx.lastUnhealthyPlantName,
        spaceType: ctx.spaceLabel,
        wateringFrequency: ctx.wateringLabel,
        oldestUserPlantId: ctx.oldestUserPlantId,
        newestUserPlantId: ctx.newestUserPlantId,
        neglectedUserPlantId: ctx.neglectedUserPlantId,
        isPaid: ctx.isPaid,
        diagnosisRemaining: ctx.diagnosisRemaining,
        landscapeRemaining: ctx.landscapeRemaining,
      },
    });
  }

  const rows = await listDailyChallenges(userId, today);
  return rows.slice(0, DAILY_CHALLENGE_COUNT).map(toView);
}

/**
 * Whether a plant maintenance label counts as low-maintenance.
 * @param value
 * @returns {boolean}
 */
function isLowMaintenance(value?: string | null): boolean {
  const m = (value ?? "").toLowerCase();
  return m.includes("low") || m.includes("easy") || m.includes("minimal");
}

/**
 * Returns how much progress an event should add for a given assigned challenge.
 * @param challenge
 * @param event
 * @param ctx
 * @returns {number}
 */
export function progressDeltaForEvent(
  challenge: UserDailyChallengeRow,
  event: GamificationEvent,
  ctx: UserChallengeContext
): number {
  const def = CHALLENGE_BY_CODE[challenge.challenge_code];
  if (!def || challenge.status !== "active") return 0;
  if (!def.events.includes(event.type)) return 0;

  const meta = challenge.metadata ?? {};

  switch (challenge.challenge_code) {
    case "ADD_FIRST_PLANT":
    case "ADD_2_PLANTS":
    case "ADD_5_PLANTS":
    case "ADD_10_PLANTS":
    case "MINI_GARDEN_3":
    case "GARDEN_15":
    case "GARDEN_25": {
      if (event.type !== "plant_added") return 0;
      const thresholds: Record<string, number> = {
        ADD_FIRST_PLANT: 1,
        ADD_2_PLANTS: 2,
        ADD_5_PLANTS: 5,
        ADD_10_PLANTS: 10,
        MINI_GARDEN_3: 3,
        GARDEN_15: 15,
        GARDEN_25: 25,
      };
      return ctx.plantCount >= (thresholds[challenge.challenge_code] ?? 1)
        ? 1
        : 0;
    }
    case "ADD_INDOOR_PLANT":
      return event.type === "plant_added" && event.indoor === true ? 1 : 0;
    case "ADD_BALCONY_PLANT":
      return event.type === "plant_added" &&
        (event.indoor === true || event.indoor === false)
        ? 1
        : 0;
    case "ADD_OUTDOOR_PLANT":
      return event.type === "plant_added" && event.indoor === false ? 1 : 0;
    case "ADD_LOW_MAINTENANCE":
      return event.type === "plant_added" &&
        isLowMaintenance(event.maintenance)
        ? 1
        : 0;
    case "ADD_FLOWERING":
      return event.type === "plant_added" && event.flowers === true ? 1 : 0;
    case "ADD_LEAFY":
      return event.type === "plant_added" && event.leaf === true ? 1 : 0;
    case "EXPLORE_NEW_CATEGORY": {
      if (event.type !== "plant_added") return 0;
      const form = (event.growthForm ?? "").trim().toLowerCase();
      if (!form) return 1;
      return ctx.growthForms.includes(form) ? 0 : 1;
    }
    case "DESIGN_TO_REAL_GARDEN":
      return event.type === "plant_added" && ctx.landscapeCount >= 1 ? 1 : 0;

    case "FIRST_SCAN":
      return event.type === "scan_completed" ||
        event.type === "compare_scan_completed"
        ? 1
        : 0;
    case "SCAN_2_TODAY":
      return event.type === "scan_completed" ||
        event.type === "compare_scan_completed"
        ? 1
        : 0;
    case "SCAN_3_DIFFERENT":
      return (event.type === "scan_completed" ||
        event.type === "compare_scan_completed") &&
        ctx.distinctScanPlantNames >= 3
        ? 1
        : 0;
    case "COMPLETE_5_SCANS":
      return (event.type === "scan_completed" ||
        event.type === "compare_scan_completed") &&
        ctx.scanCount >= 5
        ? 1
        : 0;
    case "SCAN_UNUSUAL_SYMPTOMS":
      return event.type === "scan_completed" ||
        event.type === "compare_scan_completed"
        ? 1
        : 0;
    case "SCAN_OWNED":
      if (event.type === "compare_scan_completed") return 1;
      if (event.type === "scan_completed" && event.matchedOwnedPlant) return 1;
      return 0;
    case "CHECK_UNHEALTHY":
    case "FOLLOW_UP_ISSUE":
    case "CHECK_PLANT_IMPROVED":
    case "RESCAN_AFTER_7_DAYS":
    case "SCAN_NOT_RECENT":
      return event.type === "scan_completed" ||
        event.type === "compare_scan_completed"
        ? 1
        : 0;
    case "COMPARE_PROGRESS":
      return event.type === "compare_scan_completed" ? 1 : 0;

    case "FIRST_CARE":
    case "CARE_2_TODAY":
    case "TODAYS_CARE":
    case "MAINTAIN_STREAK":
    case "ATTENTION_3_PLANTS":
      return event.type === "care_completed" ? 1 : 0;
    case "CARE_5_TOTAL":
      return event.type === "care_completed" && ctx.careCompletedCount >= 5
        ? 1
        : 0;
    case "WATERING_ROUTINE":
    case "FOLLOW_WATERING_FREQ":
      return event.type === "care_completed" &&
        event.activityType.toLowerCase() === "water"
        ? 1
        : 0;
    case "CARE_OLDEST":
      return event.type === "care_completed" &&
        event.userPlantId === (meta.oldestUserPlantId as string)
        ? 1
        : 0;
    case "CARE_NEWEST":
      return event.type === "care_completed" &&
        event.userPlantId === (meta.newestUserPlantId as string)
        ? 1
        : 0;
    case "CARE_NEGLECTED":
      return event.type === "care_completed" &&
        event.userPlantId === (meta.neglectedUserPlantId as string)
        ? 1
        : 0;
    case "CHECK_CARE_ROUTINE":
      return event.type === "care_routine_viewed" ? 1 : 0;

    case "FIRST_LANDSCAPE":
    case "IMPROVE_DESIGN":
    case "DESIGN_SPACE_TYPE":
      return event.type === "landscape_created" ? 1 : 0;
    case "DESIGN_OUTDOOR":
      return event.type === "landscape_created" &&
        ((event.spaceCategory ?? event.spaceType ?? "")
          .toLowerCase()
          .includes("outdoor") ||
          ctx.isOutdoorSpace)
        ? 1
        : 0;
    case "DESIGN_INDOOR":
      return event.type === "landscape_created" &&
        ((event.spaceCategory ?? event.spaceType ?? "")
          .toLowerCase()
          .includes("indoor") ||
          ctx.isIndoorSpace)
        ? 1
        : 0;
    case "DESIGN_BALCONY":
      return event.type === "landscape_created" &&
        ((event.spaceCategory ?? event.spaceType ?? "")
          .toLowerCase()
          .includes("balcony") ||
          ctx.isBalconySpace)
        ? 1
        : 0;
    default:
      return 0;
  }
}

/**
 * Applies an activity event to today's challenges and awards points on completion.
 * @param userId
 * @param event
 * @returns {Promise<AssignedChallengeView[]>}
 */
export async function applyEventToDailyChallenges(
  userId: string,
  event: GamificationEvent
): Promise<AssignedChallengeView[]> {
  await ensureDailyChallengesAssigned(userId);
  const today = getIstDateString();
  const rows = await listDailyChallenges(userId, today);
  const ctx = await buildUserChallengeContext(userId);
  const completedNow: AssignedChallengeView[] = [];

  for (const row of rows) {
    const delta = progressDeltaForEvent(row, event, ctx);
    if (delta <= 0) continue;

    // For multi-plant attention, only count unique plant ids via metadata set
    if (
      row.challenge_code === "ATTENTION_3_PLANTS" &&
      event.type === "care_completed"
    ) {
      const cared = new Set<string>(
        Array.isArray(row.metadata.caredPlantIds)
          ? (row.metadata.caredPlantIds as string[])
          : []
      );
      if (cared.has(event.userPlantId)) continue;
      cared.add(event.userPlantId);
      await updateChallengeMetadata(row.id, {
        caredPlantIds: [...cared],
      });
    }

    const updated = await incrementChallengeProgress(row.id, delta);
    if (!updated) continue;

    if (updated.status === "completed") {
      await awardChallengePoints({
        userId,
        challengeCode: updated.challenge_code,
        points: updated.points,
        challengeDate: today,
        dailyChallengeId: updated.id,
      });
      completedNow.push(toView(updated));
    }
  }

  return completedNow;
}
