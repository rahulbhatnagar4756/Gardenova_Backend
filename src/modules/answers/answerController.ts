import { Request, Response, NextFunction } from "express";
import { HTTP_STATUS } from "../../core/utils/constants";
import {
  errorResponse,
  successResponse,
} from "../../core/utils/responseFormatter";
import { z, ZodError } from "zod";
import {
  getRecommendedPlants,
} from "./answerRepository";
import { getDB } from "../../core/config/db";
// import { createSurveyResponse } from "./answerModel";

/**
 * Handles submission of answers for multiple questions.
 * Validates the authenticated user, and saves the answers to the database.
 *
 * Each answer can be:
 *   - type = "1" → selectedOption
 *   - type = "2" → selectedAddress (state & city)
 *
 * @param req - Express request object containing answer data in the body
 * @param res - Express response object for sending the API response
 * @param next - Express next middleware function for error handling
 * @returns Promise<void>
 */
export interface IUserAnswer {
  questionId?: string;
  type?: string;
  selectedOption?: string;
}
/**
 * Shape of a single answer sent by the client.
 * Every question in the new survey is a single-select with a plain string value.
 */
export interface ISurveyAnswerItem {
  questionId: string; // UUID of the question
  type: number; // answer_type (matches questions.answer_type column)
  selectedOption: string; // the option the user chose
}

// ─────────────────────────────────────────────────────────────────────────────
// VALIDATION SCHEMA
// ─────────────────────────────────────────────────────────────────────────────

const surveyAnswerDto = z.object({
  responseId: z.string().uuid(),
  questionId: z.string().uuid(),
  answerType: z.number().int(),
  selectedOption: z.string().min(1, "selectedOption must not be empty"),
});

const surveyAnswersDto = z.array(
  z.object({
    questionId: z.string().uuid("questionId must be a valid UUID"),
    type: z.number().int("type must be an integer"),
    selectedOption: z.string().min(1, "selectedOption must not be empty"),
  })
);

// ─────────────────────────────────────────────────────────────────────────────
// SUBMIT ANSWERS
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Submit survey answers.
 *
 * Validates the request payload, stores answers in the database,
 * and returns the generated response ID.
 *
 * @param req - Express request object
 * @param res - Express response object
 * @param next - Express next middleware function
 * @returns Promise<void>
 */
export const submitAnswer = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { answers } = req.body;

    if (!answers || !Array.isArray(answers) || answers.length === 0) {
      res.status(HTTP_STATUS.BAD_REQUEST).json({ message: "No answers provided" });
      return;
    }

    // Validate the incoming payload shape before touching the DB
    const parsed = surveyAnswersDto.parse(answers);

    const { responseId } = await createSurveyResponse(parsed);

    res
      .status(HTTP_STATUS.CREATED)
      .json(successResponse({ responseId }, "Answers submitted successfully"));
  } catch (err: unknown) {
    if (err instanceof ZodError) {
      res
        .status(HTTP_STATUS.BAD_REQUEST)
        .json(errorResponse("Validation failed", { issues: err.issues }));
      return;
    }

    res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json(
      errorResponse("Something went wrong", {
        details: (err as Error).message,
      })
    );
    next(err);
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// CREATE SURVEY RESPONSE
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Inserts a new survey_response row and bulk-inserts all answers in a single
 * transaction. Uses UNNEST for efficient batch insertion.
 *
 * @param answers - Validated answer items from the request body.
 * @returns The generated responseId (UUID).
 * @throws ZodError if answer mapping produces invalid data.
 * @throws Error on any DB failure (transaction is rolled back automatically).
 */
export async function createSurveyResponse(
  answers: ISurveyAnswerItem[]
): Promise<{ responseId: string }> {
  const pool = await getDB();

  try {
    await pool.query("BEGIN");

    // ── 1. Create the parent survey response row ────────────────────────────
    const responseResult = await pool.query<{ id: string }>(
      `INSERT INTO survey_responses (is_deleted) VALUES ($1) RETURNING id;`,
      [false]
    );
    const responseRow = responseResult.rows[0];

    if (!responseRow) {
      throw new Error("Failed to create survey response — no row returned");
    }

    const responseId = responseRow.id;

    // ── 2. Validate and map answers to DB shape ─────────────────────────────
    if (answers.length > 0) {
      const surveyAnswersArraySchema = z.array(surveyAnswerDto);

      const parsedAnswers = surveyAnswersArraySchema.parse(
        answers.map((ans) => ({
          responseId,
          questionId: ans.questionId,
          answerType: ans.type,
          selectedOption: ans.selectedOption,
        }))
      );

      // ── 3. Bulk insert with UNNEST ────────────────────────────────────────
      const questionIds = parsedAnswers.map((a) => a.questionId);
      const answerTypes = parsedAnswers.map((a) => a.answerType);
      const selectedOptions = parsedAnswers.map((a) => a.selectedOption);

      await pool.query(
        `INSERT INTO survey_answers (response_id, question_id, answer_type, selected_option)
         SELECT $1, * FROM UNNEST($2::uuid[], $3::integer[], $4::text[]);`,
        [responseId, questionIds, answerTypes, selectedOptions]
      );
    }

    await pool.query("COMMIT");
    return { responseId };
  } catch (err) {
    await pool.query("ROLLBACK");
    throw err; // let the controller handle ZodError vs generic Error
  }
}


const TOTAL_QUESTIONS = 6;
/**
 * Get recommended plants based on survey responses.
 *
 * Fetches survey answers using the provided responseId,
 * generates plant recommendations, and returns them.
 *
 * @param req - Express request object
 * @param res - Express response object
 * @param next - Express next middleware function
 * @returns Promise<void>
 */
export const getRecommendedPlantsController = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { responseId } = req.params;

    if (!responseId) {
      res.status(400).json({ message: "responseId is required" });
      return;
    }

    const client = await getDB();

    // ── Fetch survey answers for this response ────────────────────────────────
    const result = await client.query<{
      question_id: string;
      answer_type: string;
      selected_option: string;
      question_order: number;
    }>(
      `SELECT
         sa.question_id,
         sa.answer_type,
         sa.selected_option,
         q.order AS question_order
       FROM survey_answers sa
       JOIN questions q ON q.id = sa.question_id
       WHERE sa.response_id = $1
         AND q.is_deleted   = false
       ORDER BY q.order ASC`,
      [responseId]
    );

    if (result.rows.length === 0) {
      res.status(404).json({ message: "No answers found for this responseId" });
      return;
    }

    // ── Build answers array (0-indexed by question order) ─────────────────────
    // All questions in this survey return a plain selectedOption string.
    // (No address/JSON fields in the new question set.)
    const answers: (IUserAnswer | null)[] = new Array(TOTAL_QUESTIONS).fill(null);

    for (const row of result.rows) {
      const fieldIndex = row.question_order - 1; // convert 1-based order → 0-based index

      if (fieldIndex < 0 || fieldIndex >= TOTAL_QUESTIONS) {
        // Guard against unexpected question orders
        continue;
      }

      answers[fieldIndex] = {
        questionId: row.question_id,
        type: row.answer_type,
        selectedOption: row.selected_option ?? "",
      };
    }

    // ── Generate recommendations ───────────────────────────────────────────────
    const recommendedPlants = await getRecommendedPlants(answers);

    // ── Shape the API response ─────────────────────────────────────────────────
    const plantRecommendations = recommendedPlants.map((p) => ({
      speciesId: p.species_id,
      speciesName: p.species_name,
      genusName: p.genus_name,
      familyName: p.family_name,
      commonName: p.common_name,
      image: p.image_url,
      plantType: p.plant_type,
      growthHabit: p.growth_habit,
      edible: p.edible,
      ediblePart: p.edible_part,
      vegetable: p.vegetable,
      whyRecommended: p.whyRecommended,
      matchScore: p.matchScore,
    }));

    res.status(200).json(
      successResponse(
        { plantRecommendations },
        "Plant recommendations fetched successfully"
      )
    );
  } catch (err) {
    res.status(500).json(
      errorResponse("Failed to fetch plant recommendations", {
        details: (err as Error).message,
      })
    );
    next(err);
  }
};