import { Response, NextFunction } from "express";
import { ZodError } from "zod";
import { HTTP_STATUS, MESSAGES } from "../../../core/utils/constants";
import {
  errorResponse,
  successResponse,
} from "../../../core/utils/responseFormatter";
import { findUserByEmail } from "../../auth/authRepository";
import {
  createQuestion,
  findAllQuestions,
  softDeleteQuestion,
  updateQuestion,
} from "./questionModel";
import NodeCache from "node-cache";
import { QuestionWithOptions } from "../../../interface/question";
import { AuthUserPayload } from "../../../interface/user";
import { AuthRequest } from "../../../interface/auth";

// Cache questions for 10 minutes (they rarely change)
const questionsCache = new NodeCache({ stdTTL: 600, checkperiod: 120 });
const QUESTIONS_CACHE_KEY = "all_questions";

/**
 * Retrieves all questions from the database.
 * Validates the authenticated user and returns all questions.
 *
 * @param req - Express request object
 * @param res - Express response object for sending the API response
 * @param next - Express next middleware function for error handling
 * @returns Promise<void>
 */
export const getAllQuestions = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    // Check cache first
    const cached =
      questionsCache.get<QuestionWithOptions[]>(QUESTIONS_CACHE_KEY);

    if (cached) {
      const formattedQuestions = cached.map(({ id, ...rest }) => ({
        question_id: id,
        ...rest,
      }));

      res
        .status(HTTP_STATUS.OK)
        .json(
          successResponse(
            { questions: formattedQuestions },
            MESSAGES.QUESTIONS_RETRIEVED
          )
        );
      return;
    }

    // Retrieve from database (optimized query below)
    const questions = await findAllQuestions();

    // Cache the raw data
    questionsCache.set(QUESTIONS_CACHE_KEY, questions);

    // Format data
    const formattedQuestions = questions.map(({ id, ...rest }) => ({
      question_id: id,
      ...rest,
    }));

    res
      .status(HTTP_STATUS.OK)
      .json(
        successResponse(
          { questions: formattedQuestions },
          MESSAGES.QUESTIONS_RETRIEVED
        )
      );
  } catch (err: unknown) {
    if (err instanceof ZodError) {
      res.status(HTTP_STATUS.BAD_REQUEST).json({ errors: err.issues });
      return;
    }
    console.error("Error fetching questions:", err);
    next(err);
  }
};

/**
 * Detects a category based on keywords inside a question's text.
 *
 * @param {string} questionText - The text of the question.
 * @returns {string | null} - The matched category key or null if no match.
 */
function detectCategory(questionText: string): string | null {
  const text = questionText.toLowerCase();

  if (
    text.includes("space") &&
    !text.includes("area") &&
    !text.includes("challenge")
  )
    return "space_types";
  if (text.includes("area") && text.includes("space")) return "area_sizes";
  if (text.includes("challenge") || text.includes("desire"))
    return "challenges";
  if (text.includes("technology") || text.includes("tech"))
    return "tech_preferences";

  return null;
}

/**
 * Retrieves grouped options for the first 4 questions
 * based on keyword-category mapping.
 *
 * @param {Request} req - Express request object.
 * @param {Response} res - Express response object.
 * @param {NextFunction} next - Express next middleware handler.
 * @returns {Promise<void>} - Returns no value, sends JSON response.
 */
export const getQuestionOptionsGrouped = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const questions = await findAllQuestions();

    const grouped: Record<string, string[]> = {
      space_types: [],
      area_sizes: [],
      challenges: [],
      tech_preferences: [],
    };

    questions.forEach((q) => {
      const category = detectCategory(q.question_text);
      if (!category) return;

      grouped[category] = q.options.map((o) => o.option_text);
    });

    res
      .status(200)
      .json(successResponse(grouped, "Options retrieved successfully"));
  } catch (err) {
    console.error(err);
    next(err);
  }
};

/**
 * Handles the creation of a new question.
 * Validates the authenticated user, checks for duplicate questions,
 * and saves the new question to the database if valid.
 *
 * @param req - Express request object containing question data in the body
 * @param res - Express response object for sending the API response
 * @param next - Express next middleware function for error handling
 * @returns Promise<void>
 */
export const createQuestionController = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  const userPayload = req.user as AuthUserPayload | undefined;

  if (!userPayload?.userEmail) {
    res.status(HTTP_STATUS.UNAUTHORIZED).json(errorResponse("Unauthorized"));
    return;
  }

  const user = await findUserByEmail(userPayload.userEmail);
  if (!user) {
    res.status(HTTP_STATUS.UNAUTHORIZED).json(errorResponse("User not found"));
    return;
  }

  if (userPayload.role !== "Admin") {
    res
      .status(HTTP_STATUS.UNAUTHORIZED)
      .json(errorResponse("Unauthorized Role"));
    return;
  }

  try {
    const { question_text, options, order } = req.body;

    // create expects options as array of strings
    await createQuestion({
      question_text,
      order,
      options, // array of strings
      is_deleted: false,
    });

    //  Invalidate cache
    questionsCache.del(QUESTIONS_CACHE_KEY);

    res
      .status(HTTP_STATUS.CREATED)
      .json(successResponse(null, MESSAGES.QUESTION_CREATED));
  } catch (err: unknown) {
    if (err instanceof ZodError) {
      res.status(HTTP_STATUS.BAD_REQUEST).json({ errors: err.issues });
      return;
    }
    console.error("Failed to create question:", err);
    next(err);
  }
};

/**
 * Updates an existing question by its ID.
 * Validates the provided data against the schema before applying changes,
 * and returns the updated question if found.
 *
 * @param req - Express request object containing question ID in params and updated data in the body
 * @param res - Express response object for sending the API response
 * @param next - Express next middleware function for error handling
 * @returns Promise<void>
 */
export const updateQuestionController = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  const userPayload = req.user as AuthUserPayload | undefined;

  if (!userPayload?.userEmail) {
    res.status(HTTP_STATUS.UNAUTHORIZED).json(errorResponse("Unauthorized"));
    return;
  }

  const user = await findUserByEmail(userPayload.userEmail);
  if (!user) {
    res.status(HTTP_STATUS.UNAUTHORIZED).json(errorResponse("User not found"));
    return;
  }

  try {
    const questionId = req.params.id;
    const { question_text, options, order, is_deleted } = req.body;

    // validate: options must be an array of objects { id?: string, option_text: string }
    // We enforce Option C: payload must include ALL existing option ids (if they exist).
    const updated = await updateQuestion(questionId!, {
      question_text,
      order,
      is_deleted: is_deleted ?? false,
      options,
    });

    if (!updated) {
      res
        .status(HTTP_STATUS.NOT_FOUND)
        .json(errorResponse("Question not found"));
      return;
    }

    // Invalidate cache
    questionsCache.del(QUESTIONS_CACHE_KEY);

    res
      .status(HTTP_STATUS.OK)
      .json(successResponse(null, MESSAGES.QUESTION_UPDATED));
  } catch (err: unknown) {
    const error = err instanceof Error ? err : new Error(String(err));

    if (
      error.name === "InvalidOptionError" ||
      error.name === "MissingOptionsError"
    ) {
      res.status(HTTP_STATUS.BAD_REQUEST).json(errorResponse(error.message));
      return;
    }

    if (error instanceof ZodError) {
      res.status(HTTP_STATUS.BAD_REQUEST).json({ errors: error.issues });
      return;
    }

    console.error("Failed to update question:", error);
    next(error);
  }
};

/**
 * Deletes an existing question by its ID.
 * If the question does not exist, responds with a not found error.
 *
 * @param req - Express request object containing the question ID in params
 * @param res - Express response object for sending the API response
 * @param next - Express next middleware function for error handling
 * @returns Promise<void>
 */
export const deleteQuestionController = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const userPayload = req.user as { userEmail?: string } | undefined;
    if (!userPayload?.userEmail) {
      res.status(HTTP_STATUS.UNAUTHORIZED).json(errorResponse("Unauthorized"));
      return;
    }

    const user = await findUserByEmail(userPayload.userEmail);
    if (!user) {
      res
        .status(HTTP_STATUS.UNAUTHORIZED)
        .json(errorResponse("User not found"));
      return;
    }

    const questionId = req.params.id;

    const deleted = await softDeleteQuestion(questionId!);

    if (!deleted) {
      res
        .status(HTTP_STATUS.NOT_FOUND)
        .json(errorResponse("Question not found"));
      return;
    }

    //  Invalidate cache
    questionsCache.del(QUESTIONS_CACHE_KEY);

    res
      .status(HTTP_STATUS.OK)
      .json(successResponse(null, MESSAGES.QUESTION_DELETED));
  } catch (err) {
    console.error("Failed to delete question:", err);
    next(err);
  }
};
