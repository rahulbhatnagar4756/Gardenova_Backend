import { getDB } from "../../../core/config/db";
import {
  QuestionOption,
  QuestionWithOptions,
} from "../../../interface/question";

/**
 * Get all active (non-deleted) questions with their options
 * @returns {Promise<QuestionWithOptions[]>} A promise that resolves to a list of all active questions and their associated options.
 */
export async function findAllQuestions(): Promise<QuestionWithOptions[]> {
  const pool = getDB();

  try {
    // OPTIMIZED: Use array_agg instead of json_agg for better performance
    const query = `
      SELECT 
        q.id,
        q.question_text,
        q."order",
        COALESCE(
          array_agg(
            json_build_object(
              'id', qo.id,
              'option_text', qo.option_text
            ) ORDER BY qo.id
          ) FILTER (WHERE qo.id IS NOT NULL),
          '{}'::json[]
        ) AS options
      FROM questions q
      LEFT JOIN question_options qo ON q.id = qo.question_id
      WHERE q.is_deleted = FALSE
      GROUP BY q.id, q.question_text, q."order"
      ORDER BY q."order" ASC, q.id ASC;
    `;

    const result = await pool.query(query);

    return result.rows.map((row) => ({
      id: row.id,
      question_text: row.question_text,
      order: row.order,
      options: row.options || [],
    }));
  } catch (err) {
    throw new Error(`Failed to fetch questions: ${(err as Error).message}`);
  }
}

/**
 * Create a new question with options
 * @param data - The input data to create the question and its options.
 * @param data.question_text
 * @param data.order
 * @param data.options
 * @param data.is_deleted
 * @returns {Promise<QuestionWithOptions>} A promise that resolves to the created question with its options.
 */
export async function createQuestion(data: {
  question_text: string;
  order: number;
  options: { id?: string; option_text: string }[];
  is_deleted?: boolean;
}): Promise<QuestionWithOptions> {
  const client = await getDB();

  try {
    await client.query("BEGIN");

    const qRes = await client.query(
      `INSERT INTO questions (question_text, "order", is_deleted)
       VALUES ($1, $2, $3) RETURNING *;`,
      [data.question_text, data.order ?? null, data.is_deleted ?? false]
    );

    const question = qRes.rows[0];

    const options: QuestionOption[] = [];

    if (data.options && data.options.length > 0) {
      for (const opt of data.options) {
        const oRes = await client.query(
          `INSERT INTO question_options (question_id, option_text)
           VALUES ($1, $2) RETURNING *;`,
          [question.id, opt.option_text] // <-- FIXED
        );
        options.push(oRes.rows[0]);
      }
    }

    await client.query("COMMIT");

    return {
      ...question,
      options,
    };
  } catch (err) {
    await client.query("ROLLBACK");
    throw new Error(`❌ Failed to create question: ${(err as Error).message}`);
  }
}

/**
 * Update an existing question and its options by ID
 * @param {string} questionId - The ID of the question to update.
 * @param {unknown} data - The updated question data including options.
 * @param data.question_text
 * @param data.order
 * @param data.is_deleted
 * @param data.options
 * @returns {Promise<QuestionWithOptions | null>} A promise that resolves to the updated question with its options, or null if not found.
 */
export async function updateQuestion(
  questionId: string,
  data: {
    question_text?: string;
    order?: number;
    is_deleted?: boolean;
    options?: Array<{ id?: string; option_text: string }>;
  }
): Promise<QuestionWithOptions | null> {
  const client = await getDB();

  try {
    await client.query("BEGIN");

    // #region Check if question exists
    const qRes = await client.query(`SELECT * FROM questions WHERE id=$1`, [
      questionId,
    ]);

    if (qRes.rows.length === 0) {
      await client.query("ROLLBACK");
      return null;
    }
    // #endregion

    // #region Update question fields
    await client.query(
      `UPDATE questions
       SET question_text = COALESCE($1, question_text),
           "order" = COALESCE($2, "order"),
           is_deleted = COALESCE($3, is_deleted),
           updated_at = CURRENT_TIMESTAMP
       WHERE id = $4`,
      [
        data.question_text ?? null,
        data.order ?? null,
        data.is_deleted ?? null,
        questionId,
      ]
    );
    // #endregion

    // #region Handle options update logic
    if (data.options) {
      // fetch existing option ids
      const existingRes = await client.query(
        `SELECT id FROM question_options WHERE question_id=$1`,
        [questionId]
      );
      const existingIds = existingRes.rows.map((r) => r.id);

      const incomingIds = data.options.filter((o) => o.id).map((o) => o.id);

      // 1) DELETE OPTIONS NOT SENT IN PAYLOAD
      const idsToDelete = existingIds.filter((id) => !incomingIds.includes(id));

      if (idsToDelete.length > 0) {
        await client.query(
          `DELETE FROM question_options
           WHERE question_id=$1 AND id = ANY($2)`,
          [questionId, idsToDelete]
        );
      }

      // 2) PROCESS INCOMING OPTIONS
      for (const opt of data.options) {
        if (!opt.id) {
          // INSERT NEW OPTION
          await client.query(
            `INSERT INTO question_options (question_id, option_text)
             VALUES ($1, $2)`,
            [questionId, opt.option_text]
          );
        } else {
          // UPDATE EXISTING OPTION
          await client.query(
            `UPDATE question_options
             SET option_text=$1
             WHERE id=$2 AND question_id=$3`,
            [opt.option_text, opt.id, questionId]
          );
        }
      }
    }
    // #endregion

    await client.query("COMMIT");

    // return updated question with options
    const updatedQuestion = await client.query(
      `SELECT * FROM questions WHERE id=$1`,
      [questionId]
    );
    const options = await getOptionsByQuestionId(questionId);

    return {
      ...updatedQuestion.rows[0],
      options,
    };
  } catch (err) {
    await client.query("ROLLBACK");
    throw new Error(`❌ Failed to update question: ${(err as Error).message}`);
  }
}

/**
 * Retrieves all options belonging to a specific question.
 *
 * @param questionId - The ID of the question whose options should be fetched.
 * @returns A list of option objects associated with the given question.
 */
export async function getOptionsByQuestionId(
  questionId: string
): Promise<QuestionOption[]> {
  const client = await getDB();
  const res = await client.query(
    `SELECT id, option_text FROM question_options WHERE question_id = $1 ORDER BY id;`,
    [questionId]
  );
  return res.rows;
}

/**
 * 🔍 Get a single question by ID with its options
 * @param {string} questionId - The ID of the question to retrieve.
 * @returns {Promise<QuestionWithOptions | null>} A promise that resolves to the question with its options, or null if not found.
 */
export async function findQuestionById(
  questionId: string
): Promise<QuestionWithOptions | null> {
  const client = await getDB();

  try {
    const query = `
      SELECT 
        q.*,
        json_agg(
          json_build_object(
            'id', qo.id,
            'question_id', qo.question_id,
            'option_text', qo.option_text,
            'created_at', qo.created_at,
            'updated_at', qo.updated_at
          ) ORDER BY qo.created_at
        ) FILTER (WHERE qo.id IS NOT NULL) as options
      FROM questions q
      LEFT JOIN question_options qo ON q.id = qo.question_id
      WHERE q.id = $1 AND q.is_deleted = FALSE
      GROUP BY q.id;
    `;

    const result = await client.query(query, [questionId]);

    if (result.rows.length === 0) return null;

    const row = result.rows[0];
    return {
      ...row,
      options: row.options || [],
    };
  } catch (err) {
    throw new Error(`❌ Failed to fetch question: ${(err as Error).message}`);
  }
}

/**
 * Soft delete a question (set is_deleted = true)
 * Options are preserved but the question becomes inactive.
 * @param {string} id - The ID of the question to soft delete.
 * @returns {Promise<boolean>} A promise that resolves to true if the question was successfully soft deleted, or false otherwise.
 */
export async function softDeleteQuestion(id: string): Promise<boolean> {
  const client = await getDB();

  try {
    const result = await client.query(
      `
      UPDATE questions
      SET is_deleted = TRUE, updated_at = CURRENT_TIMESTAMP
      WHERE id = $1;
      `,
      [id]
    );
    return result.rowCount !== null && result.rowCount > 0;
  } catch (err) {
    throw new Error(`❌ Failed to delete question: ${(err as Error).message}`);
  }
}

/**
 * Hard delete a question (permanently removes the question and all its options)
 * @param {string} id - The ID of the question to permanently delete.
 * @returns {Promise<boolean>} A promise that resolves to true if the question and its options were successfully deleted, or false otherwise.
 */
export async function hardDeleteQuestion(id: string): Promise<boolean> {
  const client = await getDB();

  try {
    await client.query("BEGIN");

    // Delete options first (or rely on CASCADE)
    await client.query("DELETE FROM question_options WHERE question_id = $1", [
      id,
    ]);

    // Delete question
    const result = await client.query("DELETE FROM questions WHERE id = $1", [
      id,
    ]);

    await client.query("COMMIT");

    return result.rowCount !== null && result.rowCount > 0;
  } catch (err) {
    await client.query("ROLLBACK");
    throw new Error(
      `❌ Failed to hard delete question: ${(err as Error).message}`
    );
  }
}
