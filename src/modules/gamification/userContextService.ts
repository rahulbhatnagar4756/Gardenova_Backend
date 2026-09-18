import { getDB } from "../../core/config/db";
import {
  getFeatureUsageSnapshot,
  hasFeatureQuota,
  isPaidUser,
} from "../../core/utils/planLimits";
import {
  countActivityToday,
  countActivityTotal,
  ensureUserGamification,
  getIstDateString,
  listCompletedOnceCodes,
} from "./gamificationRepository";
import { UserChallengeContext } from "./gamificationTypes";

/**
 * Loads the latest onboarding survey labels for personalization.
 * @param userId
 * @returns {Promise<}
 */
async function loadSurveyLabels(userId: string): Promise<{
  spaceLabel: string | null;
  wateringLabel: string | null;
  experienceLabel: string | null;
}> {
  const db = getDB();
  const response = await db.query<{ response_id: string }>(
    `SELECT response_id
       FROM survey_answers
      WHERE user_id = $1
      ORDER BY created_at DESC
      LIMIT 1`,
    [userId]
  );
  const responseId = response.rows[0]?.response_id;
  if (!responseId) {
    return { spaceLabel: null, wateringLabel: null, experienceLabel: null };
  }

  const answers = await db.query<{
    question_order: number;
    selected_option: string;
  }>(
    `SELECT q."order" AS question_order, sa.selected_option
       FROM survey_answers sa
       JOIN questions q ON q.id = sa.question_id
      WHERE sa.response_id = $1
        AND q.is_deleted = false
      ORDER BY q."order" ASC NULLS LAST`,
    [responseId]
  );

  const byOrder = new Map<number, string>();
  for (const row of answers.rows) {
    byOrder.set(Number(row.question_order), (row.selected_option ?? "").trim());
  }

  // Question order: 1 space, 2 sunlight, 3 goal, 4 watering, 5 climate, 6 experience
  // FieldIndex is 0-based; DB order may be 1-based — support both.
  const spaceLabel =
    byOrder.get(1) ?? byOrder.get(0) ?? null;
  const wateringLabel =
    byOrder.get(4) ?? byOrder.get(3) ?? null;
  const experienceLabel =
    byOrder.get(6) ?? byOrder.get(5) ?? null;

  return { spaceLabel, wateringLabel, experienceLabel };
}

/**
 * Builds a snapshot of the user's garden activity used to personalize challenges.
 *
 * @param {string} userId
 * @returns {Promise<UserChallengeContext>}
 */
export async function buildUserChallengeContext(
  userId: string
): Promise<UserChallengeContext> {
  const db = getDB();
  const todayIst = getIstDateString();
  const profile = await ensureUserGamification(userId);
  const completedOnceCodes = await listCompletedOnceCodes(userId);

  const plants = await db.query<{
    id: string;
    indoor: boolean | null;
    flowers: boolean | null;
    leaf: boolean | null;
    maintenance: string | null;
    plant_type: string | null;
    added_at: string;
    last_watered_at: string | null;
    last_fertilized_at: string | null;
    last_pruned_at: string | null;
    last_generic_care_at: string | null;
  }>(
    `SELECT
        up.id,
        p.indoor,
        p.flowers,
        p.leaf,
        p.maintenance,
        p.type AS plant_type,
        up.added_at::text,
        up.last_watered_at::text,
        up.last_fertilized_at::text,
        up.last_pruned_at::text,
        up.last_generic_care_at::text
       FROM user_plants up
       LEFT JOIN plant_table_final p ON p.id = up.plant_id
      WHERE up.user_id = $1
      ORDER BY up.added_at ASC`,
    [userId]
  );

  const plantRows = plants.rows;
  const plantCount = plantRows.length;
  const indoorPlantCount = plantRows.filter((p) => p.indoor === true).length;
  const outdoorPlantCount = plantRows.filter((p) => p.indoor === false).length;
  const floweringPlantCount = plantRows.filter((p) => p.flowers === true).length;
  const leafyPlantCount = plantRows.filter((p) => p.leaf === true).length;
  const lowMaintenancePlantCount = plantRows.filter((p) => {
    const m = (p.maintenance ?? "").toLowerCase();
    return m.includes("low") || m.includes("easy") || m.includes("minimal");
  }).length;
  const growthForms = [
    ...new Set(
      plantRows
        .map((p) => (p.plant_type ?? "").trim().toLowerCase())
        .filter(Boolean)
    ),
  ];

  const oldestUserPlantId = plantRows[0]?.id ?? null;
  const newestUserPlantId = plantRows[plantRows.length - 1]?.id ?? null;

  const neglected = [...plantRows]
    .map((p) => {
      const dates = [
        p.last_watered_at,
        p.last_fertilized_at,
        p.last_pruned_at,
        p.last_generic_care_at,
      ]
        .filter(Boolean)
        .map((d) => new Date(d as string).getTime());
      const lastCare = dates.length ? Math.max(...dates) : 0;
      return { id: p.id, lastCare };
    })
    .sort((a, b) => a.lastCare - b.lastCare);
  const neglectedUserPlantId = neglected[0]?.id ?? null;

  const scanStats = await db.query<{
    scan_count: string;
    scans_today: string;
    distinct_names: string;
    unhealthy_count: string;
    last_issue: string | null;
    last_unhealthy_plant: string | null;
    old_scan_count: string;
  }>(
    `SELECT
        COUNT(*)::text AS scan_count,
        COUNT(*) FILTER (
          WHERE (created_at AT TIME ZONE 'Asia/Kolkata')::date = $2::date
        )::text AS scans_today,
        COUNT(DISTINCT NULLIF(LOWER(TRIM(plant_name)), ''))::text AS distinct_names,
        COUNT(*) FILTER (WHERE is_healthy = false)::text AS unhealthy_count,
        (
          SELECT predicted_disease
            FROM diagnosis_scans
           WHERE user_id = $1
             AND is_healthy = false
             AND predicted_disease IS NOT NULL
             AND predicted_disease NOT IN ('Healthy', 'Not a plant')
           ORDER BY created_at DESC
           LIMIT 1
        ) AS last_issue,
        (
          SELECT plant_name
            FROM diagnosis_scans
           WHERE user_id = $1
             AND is_healthy = false
           ORDER BY created_at DESC
           LIMIT 1
        ) AS last_unhealthy_plant,
        COUNT(*) FILTER (
          WHERE created_at <= now() - INTERVAL '7 days'
        )::text AS old_scan_count
       FROM diagnosis_scans
      WHERE user_id = $1`,
    [userId, todayIst]
  );

  const scanRow = scanStats.rows[0];
  const survey = await loadSurveyLabels(userId);
  const space = (survey.spaceLabel ?? "").toLowerCase();
  const experience = (survey.experienceLabel ?? "").toLowerCase();

  const careCompletedToday = await countActivityToday(
    userId,
    "care_completed",
    todayIst
  );
  const careCompletedCount = await countActivityTotal(userId, "care_completed");
  const landscapeFromActivity = await countActivityTotal(
    userId,
    "landscape_created"
  );

  const [paid, diagnosisUsage, landscapeUsage] = await Promise.all([
    isPaidUser(userId),
    getFeatureUsageSnapshot(userId, "diagnosis"),
    getFeatureUsageSnapshot(userId, "landscape"),
  ]);

  return {
    plantCount,
    indoorPlantCount,
    outdoorPlantCount,
    floweringPlantCount,
    leafyPlantCount,
    lowMaintenancePlantCount,
    growthForms,
    oldestUserPlantId,
    newestUserPlantId,
    neglectedUserPlantId,
    scanCount: Number(scanRow?.scan_count ?? 0),
    scansToday: Number(scanRow?.scans_today ?? 0),
    distinctScanPlantNames: Number(scanRow?.distinct_names ?? 0),
    hasUnhealthyDiagnosis: Number(scanRow?.unhealthy_count ?? 0) > 0,
    lastUnhealthyIssue: scanRow?.last_issue ?? null,
    lastUnhealthyPlantName: scanRow?.last_unhealthy_plant ?? null,
    hasScanOlderThan7Days: Number(scanRow?.old_scan_count ?? 0) > 0,
    hasAnyPreviousScan: Number(scanRow?.scan_count ?? 0) > 0,
    careCompletedCount,
    careCompletedToday,
    careStreak: profile.care_streak,
    landscapeCount: Math.max(profile.landscape_count, landscapeFromActivity),
    spaceLabel: survey.spaceLabel,
    wateringLabel: survey.wateringLabel,
    experienceLabel: survey.experienceLabel,
    isBeginner:
      experience.includes("beginner") ||
      experience.includes("never") ||
      experience.includes("total"),
    isIndoorSpace:
      space.includes("indoor") ||
      space.includes("window") ||
      space.includes("shelf") ||
      space.includes("living"),
    isBalconySpace:
      space.includes("balcony") ||
      space.includes("terrace") ||
      space.includes("pot"),
    isOutdoorSpace:
      space.includes("outdoor") ||
      space.includes("garden") ||
      space.includes("yard") ||
      space.includes("corporate"),
    completedOnceCodes,
    isPaid: paid,
    diagnosisRemaining: diagnosisUsage.remaining,
    diagnosisLimit: diagnosisUsage.limit,
    landscapeRemaining: landscapeUsage.remaining,
    landscapeLimit: landscapeUsage.limit,
    canDiagnose: hasFeatureQuota(diagnosisUsage, 1),
    canLandscape: hasFeatureQuota(landscapeUsage, 1),
  };
}
