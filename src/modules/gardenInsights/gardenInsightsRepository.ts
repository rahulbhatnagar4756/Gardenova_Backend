import { getDB } from "../../core/config/db";

export interface SurveyAnswerRow {
  question: string;
  answer: string;
  order: number;
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
