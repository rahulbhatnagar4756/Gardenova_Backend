import { getDB } from "../../../core/config/db";
import {
  QuestionOption,
  QuestionWithOptions,
} from "../../../interface/question";

let optionOrderReady: Promise<void> | null = null;

/**
 * Ensures question_options."order" exists and backfills missing values.
 * Safe to call repeatedly against live DB.
 *
 * @returns {Promise<void>} Resolves when the column is ready.
 */
export async function ensureOptionOrderColumn(): Promise<void> {
  if (!optionOrderReady) {
    optionOrderReady = (async (): Promise<void> => {
      const db = getDB();
      await db.query(`
        ALTER TABLE question_options
          ADD COLUMN IF NOT EXISTS "order" INTEGER;

        UPDATE question_options qo
        SET "order" = sub.rn
        FROM (
          SELECT id,
                 ROW_NUMBER() OVER (
                   PARTITION BY question_id
                   ORDER BY created_at ASC NULLS LAST, id ASC
                 ) AS rn
          FROM question_options
        ) sub
        WHERE qo.id = sub.id
          AND (qo."order" IS NULL OR qo."order" < 1);
      `);
    })().catch((err: unknown) => {
      optionOrderReady = null;
      throw err;
    });
  }
  await optionOrderReady;
}

/**
 * Get all active (non-deleted) questions with their options.
 *
 * @returns {Promise<QuestionWithOptions[]>} Active questions ordered for the survey.
 */
export async function findAllQuestions(): Promise<QuestionWithOptions[]> {
  await ensureOptionOrderColumn();
  const pool = getDB();

  try {
    const query = `
      SELECT 
        q.id,
        q.question_text,
        q."order",
        COALESCE(
          array_agg(
            json_build_object(
              'id', qo.id,
              'option_text', qo.option_text,
              'order', qo."order"
            ) ORDER BY qo."order" ASC NULLS LAST, qo.id ASC
          ) FILTER (WHERE qo.id IS NOT NULL),
          '{}'::json[]
        ) AS options
      FROM questions q
      LEFT JOIN question_options qo ON q.id = qo.question_id
      WHERE q.is_deleted = FALSE
      GROUP BY q.id, q.question_text, q."order"
      ORDER BY q."order" ASC NULLS LAST, q.id ASC;
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
 * Create a new question with options.
 *
 * @param data - Question payload.
 * @param data.question_text - Question text.
 * @param data.order - Display order among questions.
 * @param data.options - Options to create (array order becomes option order).
 * @param data.is_deleted - Soft-delete flag.
 * @returns {Promise<QuestionWithOptions>} Created question with options.
 */
export async function createQuestion(data: {
  question_text: string;
  order: number;
  options: { id?: string; option_text: string }[];
  is_deleted?: boolean;
}): Promise<QuestionWithOptions> {
  await ensureOptionOrderColumn();
  const pool = getDB();
  const client = await pool.connect();

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
      for (let i = 0; i < data.options.length; i++) {
        const opt = data.options[i]!;
        const oRes = await client.query(
          `INSERT INTO question_options (question_id, option_text, "order")
           VALUES ($1, $2, $3) RETURNING *;`,
          [question.id, opt.option_text, i + 1]
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
    throw new Error(`Failed to create question: ${(err as Error).message}`);
  } finally {
    client.release();
  }
}

/**
 * Update an existing question and optionally sync its full options list.
 *
 * @param {string} questionId - Question UUID.
 * @param {object} data - Fields to update.
 * @param {string} [data.question_text] - New question text.
 * @param {number} [data.order] - New question order.
 * @param {boolean} [data.is_deleted] - Soft-delete flag.
 * @param {Array<{ id?: string; option_text: string }>} [data.options] - Full options list.
 * @returns {Promise<QuestionWithOptions | null>} Updated question or null.
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
  await ensureOptionOrderColumn();
  const pool = getDB();
  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    const qRes = await client.query(`SELECT * FROM questions WHERE id=$1`, [
      questionId,
    ]);

    if (qRes.rows.length === 0) {
      await client.query("ROLLBACK");
      return null;
    }

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

    if (data.options) {
      const existingRes = await client.query(
        `SELECT id FROM question_options WHERE question_id=$1`,
        [questionId]
      );
      const existingIds = existingRes.rows.map((r) => r.id as string);
      const incomingIds = data.options
        .filter((o) => o.id)
        .map((o) => o.id as string);

      const idsToDelete = existingIds.filter((id) => !incomingIds.includes(id));

      if (idsToDelete.length > 0) {
        await client.query(
          `DELETE FROM question_options
           WHERE question_id=$1 AND id = ANY($2::uuid[])`,
          [questionId, idsToDelete]
        );
      }

      for (let i = 0; i < data.options.length; i++) {
        const opt = data.options[i]!;
        const optOrder = i + 1;
        if (!opt.id) {
          await client.query(
            `INSERT INTO question_options (question_id, option_text, "order")
             VALUES ($1, $2, $3)`,
            [questionId, opt.option_text, optOrder]
          );
        } else {
          await client.query(
            `UPDATE question_options
             SET option_text=$1, "order"=$2, updated_at=CURRENT_TIMESTAMP
             WHERE id=$3 AND question_id=$4`,
            [opt.option_text, optOrder, opt.id, questionId]
          );
        }
      }
    }

    await client.query("COMMIT");

    return findQuestionById(questionId);
  } catch (err) {
    await client.query("ROLLBACK");
    throw new Error(`Failed to update question: ${(err as Error).message}`);
  } finally {
    client.release();
  }
}

/**
 * Bulk-reorder questions by id → order map.
 *
 * @param {Array<{ id: string; order: number }>} items - Desired question order.
 * @returns {Promise<number>} Number of rows updated.
 */
export async function reorderQuestions(
  items: Array<{ id: string; order: number }>
): Promise<number> {
  const pool = getDB();
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    let updated = 0;
    for (const item of items) {
      const res = await client.query(
        `UPDATE questions
         SET "order" = $1, updated_at = CURRENT_TIMESTAMP
         WHERE id = $2 AND is_deleted = FALSE`,
        [item.order, item.id]
      );
      updated += res.rowCount ?? 0;
    }
    await client.query("COMMIT");
    return updated;
  } catch (err) {
    await client.query("ROLLBACK");
    throw new Error(`Failed to reorder questions: ${(err as Error).message}`);
  } finally {
    client.release();
  }
}

/**
 * Adds one option to a question.
 *
 * @param {string} questionId - Parent question UUID.
 * @param {string} optionText - Option label.
 * @param {number} [order] - Optional explicit order; defaults to max+1.
 * @returns {Promise<QuestionOption | null>} Created option or null if question missing.
 */
export async function createQuestionOption(
  questionId: string,
  optionText: string,
  order?: number
): Promise<QuestionOption | null> {
  await ensureOptionOrderColumn();
  const db = getDB();

  const q = await db.query(
    `SELECT id FROM questions WHERE id=$1 AND is_deleted=FALSE`,
    [questionId]
  );
  if (!q.rows[0]) return null;

  let nextOrder = order;
  if (nextOrder === undefined) {
    const maxRes = await db.query<{ max: number | null }>(
      `SELECT MAX("order")::int AS max FROM question_options WHERE question_id=$1`,
      [questionId]
    );
    nextOrder = (maxRes.rows[0]?.max ?? 0) + 1;
  }

  const { rows } = await db.query<QuestionOption>(
    `INSERT INTO question_options (question_id, option_text, "order")
     VALUES ($1, $2, $3)
     RETURNING id, question_id, option_text, "order", created_at, updated_at`,
    [questionId, optionText, nextOrder]
  );
  return rows[0] ?? null;
}

/**
 * Updates one option's text and/or order.
 *
 * @param {string} optionId - Option UUID.
 * @param {object} data - Fields to update.
 * @param {string} [data.option_text] - New text.
 * @param {number} [data.order] - New order within the question.
 * @returns {Promise<QuestionOption | null>} Updated option or null.
 */
export async function updateQuestionOption(
  optionId: string,
  data: { option_text?: string; order?: number }
): Promise<QuestionOption | null> {
  await ensureOptionOrderColumn();
  const db = getDB();
  const { rows } = await db.query<QuestionOption>(
    `UPDATE question_options
     SET option_text = COALESCE($1, option_text),
         "order" = COALESCE($2, "order"),
         updated_at = CURRENT_TIMESTAMP
     WHERE id = $3
     RETURNING id, question_id, option_text, "order", created_at, updated_at`,
    [data.option_text ?? null, data.order ?? null, optionId]
  );
  return rows[0] ?? null;
}

/**
 * Deletes one option.
 *
 * @param {string} optionId - Option UUID.
 * @returns {Promise<boolean>} True when a row was deleted.
 */
export async function deleteQuestionOption(optionId: string): Promise<boolean> {
  const db = getDB();
  const result = await db.query(`DELETE FROM question_options WHERE id = $1`, [
    optionId,
  ]);
  return (result.rowCount ?? 0) > 0;
}

/**
 * Bulk-reorder options for a single question.
 *
 * @param {string} questionId - Parent question UUID.
 * @param {Array<{ id: string; order: number }>} items - Desired option order.
 * @returns {Promise<number>} Number of rows updated.
 */
export async function reorderQuestionOptions(
  questionId: string,
  items: Array<{ id: string; order: number }>
): Promise<number> {
  await ensureOptionOrderColumn();
  const client = await getDB();
  try {
    await client.query("BEGIN");
    let updated = 0;
    for (const item of items) {
      const res = await client.query(
        `UPDATE question_options
         SET "order" = $1, updated_at = CURRENT_TIMESTAMP
         WHERE id = $2 AND question_id = $3`,
        [item.order, item.id, questionId]
      );
      updated += res.rowCount ?? 0;
    }
    await client.query("COMMIT");
    return updated;
  } catch (err) {
    await client.query("ROLLBACK");
    throw new Error(`Failed to reorder options: ${(err as Error).message}`);
  }
}

/**
 * Retrieves all options belonging to a specific question.
 *
 * @param {string} questionId - Question UUID.
 * @returns {Promise<QuestionOption[]>} Options ordered for display.
 */
export async function getOptionsByQuestionId(
  questionId: string
): Promise<QuestionOption[]> {
  await ensureOptionOrderColumn();
  const client = await getDB();
  const res = await client.query(
    `SELECT id, question_id, option_text, "order", created_at, updated_at
     FROM question_options
     WHERE question_id = $1
     ORDER BY "order" ASC NULLS LAST, id ASC`,
    [questionId]
  );
  return res.rows;
}

/**
 * Get a single question by ID with its options.
 *
 * @param {string} questionId - Question UUID.
 * @returns {Promise<QuestionWithOptions | null>} Question or null.
 */
export async function findQuestionById(
  questionId: string
): Promise<QuestionWithOptions | null> {
  await ensureOptionOrderColumn();
  const client = await getDB();

  try {
    const query = `
      SELECT 
        q.*,
        COALESCE(
          json_agg(
            json_build_object(
              'id', qo.id,
              'question_id', qo.question_id,
              'option_text', qo.option_text,
              'order', qo."order",
              'created_at', qo.created_at,
              'updated_at', qo.updated_at
            ) ORDER BY qo."order" ASC NULLS LAST, qo.id ASC
          ) FILTER (WHERE qo.id IS NOT NULL),
          '[]'::json
        ) as options
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
    throw new Error(`Failed to fetch question: ${(err as Error).message}`);
  }
}

/**
 * Soft delete a question (set is_deleted = true).
 *
 * @param {string} id - Question UUID.
 * @returns {Promise<boolean>} True when updated.
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
    throw new Error(`Failed to delete question: ${(err as Error).message}`);
  }
}
