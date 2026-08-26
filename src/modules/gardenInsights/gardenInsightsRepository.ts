import { getDB } from "../../core/config/db";
import { IUserAnswer } from "../answers/answerController";
import {
  FieldIndex,
  TOTAL_QUESTIONS,
  getRecommendedPlants,
} from "../answers/answerRepository";

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
 * Loads onboarding-recommended plants and maps them into the insight row shape.
 *
 * @param answers - Latest survey answers
 * @returns Recommended plants with catalog traits used for scoring
 */
export async function findRecommendedPlantsForInsights(
  answers: SurveyAnswerRow[]
): Promise<UserPlantInsightRow[]> {
  if (answers.length === 0) {
    return [];
  }

  const quizAnswers: (IUserAnswer | null)[] = new Array(TOTAL_QUESTIONS).fill(
    null
  ) as (IUserAnswer | null)[];

  for (const row of answers) {
    const fieldIndex = Number(row.order) - 1;
    if (fieldIndex < FieldIndex.space_type || fieldIndex > FieldIndex.experience) {
      continue;
    }
    quizAnswers[fieldIndex] = {
      selectedOption: row.answer,
    };
  }

  const recommended = await getRecommendedPlants(quizAnswers);

  return recommended.map((plant) => ({
    userPlantId: String(plant.id),
    commonName: plant.commonName,
    sunlight: plant.sunlight,
    watering: plant.watering,
    careLevel: plant.careLevel,
    maintenance: plant.maintenance,
    indoor: plant.indoor,
    type: plant.type,
    growthRate: plant.growthRate,
    droughtTolerant: plant.droughtTolerant,
    tropical: plant.tropical,
    flowers: plant.flowers,
    edibleFruit: plant.edibleFruit,
    edibleLeaf: plant.edibleLeaf,
    leaf: plant.leaf,
    dimensionMaxValue: null,
    wateringNotificationEnabled: null,
    wateringReminderFrequency: null,
    lastWateredAt: null,
    nextWateredAt: null,
  }));
}
