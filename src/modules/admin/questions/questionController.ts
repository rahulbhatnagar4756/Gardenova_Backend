import { Request, Response, NextFunction } from "express";
import { ZodError } from "zod";
import { HTTP_STATUS, MESSAGES } from "../../../core/utils/constants";
import {
  errorResponse,
  successResponse,
} from "../../../core/utils/responseFormatter";
import { findUserById } from "../../auth/authRepository";
import {
  createQuestion,
  createQuestionOption,
  deleteQuestionOption,
  findAllQuestions,
  findQuestionById,
  reorderQuestionOptions,
  reorderQuestions,
  softDeleteQuestion,
  updateQuestion,
  updateQuestionOption,
} from "./questionModel";
import {
  getCachedQuestions,
  invalidateQuestionsCache,
  setCachedQuestions,
} from "./questionCache";
import { AuthUserPayload } from "../../../interface/user";
import { AuthRequest } from "../../../interface/auth";

/**
 * Ensures the caller is an authenticated Admin.
 *
 * @param {AuthRequest} req - Authenticated request.
 * @param {Response} res - Express response.
 * @returns {Promise<boolean>} True when Admin.
 */
async function assertAdmin(
  req: AuthRequest,
  res: Response
): Promise<boolean> {
  const userPayload = req.user as AuthUserPayload | undefined;

  if (!userPayload?.userId) {
    res.status(HTTP_STATUS.UNAUTHORIZED).json(errorResponse("Unauthorized"));
    return false;
  }

  const user = await findUserById(userPayload.userId);
  if (!user) {
    res.status(HTTP_STATUS.UNAUTHORIZED).json(errorResponse("User not found"));
    return false;
  }

  if (userPayload.role !== "Admin") {
    res
      .status(HTTP_STATUS.UNAUTHORIZED)
      .json(errorResponse("Unauthorized Role"));
    return false;
  }

  return true;
}

/**
 * Retrieves all active survey questions (public / mobile). Cache invalidated on admin edits.
 *
 * @param {Request} req - Express request.
 * @param {Response} res - Express response.
 * @param {NextFunction} next - Error middleware.
 * @returns {Promise<void>} Sends questions JSON.
 */
export const getAllQuestions = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const cached = getCachedQuestions();

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

    const questions = await findAllQuestions();
    setCachedQuestions(questions);

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
 * @returns {string | null} Matched category key or null.
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
 * Retrieves grouped options for survey keyword categories.
 *
 * @param {Request} req - Express request.
 * @param {Response} res - Express response.
 * @param {NextFunction} next - Error middleware.
 * @returns {Promise<void>} Sends grouped options JSON.
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
 * Creates a new survey question with options (Admin).
 *
 * @param {AuthRequest} req - Admin request with question body.
 * @param {Response} res - Express response.
 * @param {NextFunction} next - Error middleware.
 * @returns {Promise<void>} Sends create result.
 */
export const createQuestionController = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    if (!(await assertAdmin(req, res))) return;

    const { question_text, options, order } = req.body;
    const created = await createQuestion({
      question_text,
      order,
      options,
      is_deleted: false,
    });

    invalidateQuestionsCache();

    res
      .status(HTTP_STATUS.CREATED)
      .json(successResponse(created, MESSAGES.QUESTION_CREATED));
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
 * Updates an existing question and its options (Admin).
 *
 * @param {AuthRequest} req - Admin request with question id + body.
 * @param {Response} res - Express response.
 * @param {NextFunction} next - Error middleware.
 * @returns {Promise<void>} Sends update result.
 */
export const updateQuestionController = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    if (!(await assertAdmin(req, res))) return;

    const questionId = req.params.id;
    const { question_text, options, order, is_deleted } = req.body;

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

    invalidateQuestionsCache();

    res
      .status(HTTP_STATUS.OK)
      .json(successResponse(updated, MESSAGES.QUESTION_UPDATED));
  } catch (err: unknown) {
    const error = err instanceof Error ? err : new Error(String(err));

    if (error instanceof ZodError) {
      res.status(HTTP_STATUS.BAD_REQUEST).json({ errors: error.issues });
      return;
    }

    console.error("Failed to update question:", error);
    next(error);
  }
};

/**
 * Soft-deletes a question (Admin).
 *
 * @param {AuthRequest} req - Admin request with question id.
 * @param {Response} res - Express response.
 * @param {NextFunction} next - Error middleware.
 * @returns {Promise<void>} Sends delete result.
 */
export const deleteQuestionController = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    if (!(await assertAdmin(req, res))) return;

    const questionId = req.params.id;
    const deleted = await softDeleteQuestion(questionId!);

    if (!deleted) {
      res
        .status(HTTP_STATUS.NOT_FOUND)
        .json(errorResponse("Question not found"));
      return;
    }

    invalidateQuestionsCache();

    res
      .status(HTTP_STATUS.OK)
      .json(successResponse(null, MESSAGES.QUESTION_DELETED));
  } catch (err) {
    console.error("Failed to delete question:", err);
    next(err);
  }
};

/**
 * GET /api/v1/admin/question/:id — single question with options (Admin).
 *
 * @param {AuthRequest} req - Admin request.
 * @param {Response} res - Express response.
 * @param {NextFunction} next - Error middleware.
 * @returns {Promise<void>} Sends question detail.
 */
export const getQuestionByIdController = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    if (!(await assertAdmin(req, res))) return;

    const question = await findQuestionById(String(req.params.id));
    if (!question) {
      res
        .status(HTTP_STATUS.NOT_FOUND)
        .json(errorResponse("Question not found"));
      return;
    }

    res
      .status(HTTP_STATUS.OK)
      .json(successResponse(question, MESSAGES.QUESTIONS_RETRIEVED));
  } catch (err) {
    next(err);
  }
};

/**
 * PUT /api/v1/admin/question/reorder — bulk reorder questions.
 *
 * @param {AuthRequest} req - Body: { items: [{ id, order }] }.
 * @param {Response} res - Express response.
 * @param {NextFunction} next - Error middleware.
 * @returns {Promise<void>} Sends reorder result.
 */
export const reorderQuestionsController = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    if (!(await assertAdmin(req, res))) return;

    const items = req.body.items as Array<{ id: string; order: number }>;
    const updated = await reorderQuestions(items);
    invalidateQuestionsCache();

    res
      .status(HTTP_STATUS.OK)
      .json(
        successResponse(
          { updated },
          "Questions reordered successfully"
        )
      );
  } catch (err) {
    next(err);
  }
};

/**
 * POST /api/v1/admin/question/:id/options — add one option.
 *
 * @param {AuthRequest} req - Option body.
 * @param {Response} res - Express response.
 * @param {NextFunction} next - Error middleware.
 * @returns {Promise<void>} Sends created option.
 */
export const createOptionController = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    if (!(await assertAdmin(req, res))) return;

    const questionId = String(req.params.id);
    const { option_text, order } = req.body as {
      option_text: string;
      order?: number;
    };

    const created =
      typeof order === "number"
        ? await createQuestionOption(questionId, option_text, order)
        : await createQuestionOption(questionId, option_text);

    if (!created) {
      res
        .status(HTTP_STATUS.NOT_FOUND)
        .json(errorResponse("Question not found"));
      return;
    }

    invalidateQuestionsCache();
    res
      .status(HTTP_STATUS.CREATED)
      .json(successResponse(created, "Option created successfully"));
  } catch (err) {
    next(err);
  }
};

/**
 * PUT /api/v1/admin/question/options/:optionId — edit one option.
 *
 * @param {AuthRequest} req - Option body.
 * @param {Response} res - Express response.
 * @param {NextFunction} next - Error middleware.
 * @returns {Promise<void>} Sends updated option.
 */
export const updateOptionController = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    if (!(await assertAdmin(req, res))) return;

    const optionId = String(req.params.optionId);
    const { option_text, order } = req.body as {
      option_text?: string;
      order?: number;
    };

    const patch: { option_text?: string; order?: number } = {};
    if (typeof option_text === "string") patch.option_text = option_text;
    if (typeof order === "number") patch.order = order;

    const updated = await updateQuestionOption(optionId, patch);
    if (!updated) {
      res.status(HTTP_STATUS.NOT_FOUND).json(errorResponse("Option not found"));
      return;
    }

    invalidateQuestionsCache();
    res
      .status(HTTP_STATUS.OK)
      .json(successResponse(updated, "Option updated successfully"));
  } catch (err) {
    next(err);
  }
};

/**
 * DELETE /api/v1/admin/question/options/:optionId — delete one option.
 *
 * @param {AuthRequest} req - Option id param.
 * @param {Response} res - Express response.
 * @param {NextFunction} next - Error middleware.
 * @returns {Promise<void>} Sends delete result.
 */
export const deleteOptionController = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    if (!(await assertAdmin(req, res))) return;

    const deleted = await deleteQuestionOption(String(req.params.optionId));
    if (!deleted) {
      res.status(HTTP_STATUS.NOT_FOUND).json(errorResponse("Option not found"));
      return;
    }

    invalidateQuestionsCache();
    res
      .status(HTTP_STATUS.OK)
      .json(successResponse(null, "Option deleted successfully"));
  } catch (err) {
    next(err);
  }
};

/**
 * PUT /api/v1/admin/question/:id/options/reorder — reorder options for a question.
 *
 * @param {AuthRequest} req - Body: { items: [{ id, order }] }.
 * @param {Response} res - Express response.
 * @param {NextFunction} next - Error middleware.
 * @returns {Promise<void>} Sends reorder result.
 */
export const reorderOptionsController = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    if (!(await assertAdmin(req, res))) return;

    const questionId = String(req.params.id);
    const items = req.body.items as Array<{ id: string; order: number }>;

    const question = await findQuestionById(questionId);
    if (!question) {
      res
        .status(HTTP_STATUS.NOT_FOUND)
        .json(errorResponse("Question not found"));
      return;
    }

    const updated = await reorderQuestionOptions(questionId, items);
    invalidateQuestionsCache();

    res
      .status(HTTP_STATUS.OK)
      .json(
        successResponse({ updated }, "Options reordered successfully")
      );
  } catch (err) {
    next(err);
  }
};
