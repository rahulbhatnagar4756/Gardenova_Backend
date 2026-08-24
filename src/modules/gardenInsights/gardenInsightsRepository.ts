import { getDB } from "../../core/config/db";

export interface SurveyAnswerRow {
  question: string;
  answer: string;
  order: number;
}

export interface UserPlantInsightRow {
  userPlantId: string;
  commonName: string | null;
  sunlight: string | null;
  watering: string | null;
  careLevel: string | null;
  maintenance: string | null;
  indoor: boolean | null;
  type: string | null;
  growthRate: string | null;
  droughtTolerant: boolean | null;
  tropical: boolean | null;
  flowers: boolean | null;
  edibleFruit: boolean | null;
  edibleLeaf: boolean | null;
  leaf: boolean | null;
  dimensionMaxValue: string | null;
  wateringNotificationEnabled: boolean | null;
  wateringReminderFrequency: number | null;
  lastWateredAt: Date | null;
  nextWateredAt: Date | null;
}

/**
 * Loads the user's latest onboarding survey answers, ordered by question order.
 *
 * @param userId - Authenticated user id
 * @returns Question/answer pairs for scoring
 */
export async function findLatestSurveyAnswers(
  userId: string
): Promise<SurveyAnswerRow[]> {
  const db = getDB();

  const latest = await db.query<{ response_id: string }>(
    `SELECT response_id
       FROM survey_answers
      WHERE user_id = $1
      ORDER BY created_at DESC
      LIMIT 1`,
    [userId]
  );

  const responseId = latest.rows[0]?.response_id;
  if (!responseId) {
    return [];
  }

  const result = await db.query<{
    question_text: string;
    selected_option: string | null;
    question_order: number;
  }>(
    `SELECT
        q.question_text,
        sa.selected_option,
        q."order" AS question_order
       FROM survey_answers sa
       JOIN questions q ON q.id = sa.question_id
      WHERE sa.response_id = $1
        AND q.is_deleted = false
      ORDER BY q."order" ASC NULLS LAST, q.id ASC`,
    [responseId]
  );

  return result.rows
    .filter((row) => (row.selected_option ?? "").trim().length > 0)
    .map((row) => ({
      question: row.question_text,
      answer: (row.selected_option ?? "").trim(),
      order: row.question_order,
    }));
}

/**
 * Loads all plants on the user's account with catalog traits needed for scoring.
 *
 * @param userId - Authenticated user id
 * @returns User plants joined to catalog attributes
 */
export async function findUserPlantsForInsights(
  userId: string
): Promise<UserPlantInsightRow[]> {
  const db = getDB();

  const result = await db.query<{
    user_plant_id: string;
    common_name: string | null;
    sunlight: string | null;
    watering: string | null;
    care_level: string | null;
    maintenance: string | null;
    indoor: boolean | null;
    type: string | null;
    growth_rate: string | null;
    drought_tolerant: boolean | null;
    tropical: boolean | null;
    flowers: boolean | null;
    edible_fruit: boolean | null;
    edible_leaf: boolean | null;
    leaf: boolean | null;
    dimension_max_value: string | null;
    watering_notification_enabled: boolean | null;
    watering_reminder_frequency: number | null;
    last_watered_at: Date | null;
    next_watered_at: Date | null;
  }>(
    `SELECT
        up.id AS user_plant_id,
        pc.common_name,
        pc.sunlight::text AS sunlight,
        pc.watering,
        pc.care_level,
        pc.maintenance,
        pc.indoor,
        pc.type,
        pc.growth_rate,
        pc.drought_tolerant,
        pc.tropical,
        pc.flowers,
        pc.edible_fruit,
        pc.edible_leaf,
        pc.leaf,
        pc.dimension_max_value::text AS dimension_max_value,
        up.watering_notification_enabled,
        up.watering_reminder_frequency,
        up.last_watered_at,
        up.next_watered_at
       FROM user_plants up
       JOIN plant_table_final pc ON pc.id = up.plant_id
      WHERE up.user_id = $1`,
    [userId]
  );

  return result.rows.map((row) => ({
    userPlantId: row.user_plant_id,
    commonName: row.common_name,
    sunlight: row.sunlight,
    watering: row.watering,
    careLevel: row.care_level,
    maintenance: row.maintenance,
    indoor: row.indoor,
    type: row.type,
    growthRate: row.growth_rate,
    droughtTolerant: row.drought_tolerant,
    tropical: row.tropical,
    flowers: row.flowers,
    edibleFruit: row.edible_fruit,
    edibleLeaf: row.edible_leaf,
    leaf: row.leaf,
    dimensionMaxValue: row.dimension_max_value,
    wateringNotificationEnabled: row.watering_notification_enabled,
    wateringReminderFrequency: row.watering_reminder_frequency,
    lastWateredAt: row.last_watered_at,
    nextWateredAt: row.next_watered_at,
  }));
}
