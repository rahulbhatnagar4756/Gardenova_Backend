import { Response, NextFunction } from "express";
import { ZodError } from "zod";
import { HTTP_STATUS, MESSAGES } from "../../../core/utils/constants";
import {
  errorResponse,
  successResponse,
} from "../../../core/utils/responseFormatter";
import {
  createValidatedRule,
  updateValidatedRule,
  getAllRules as getAllRulesFromDB,
  deleteRule as deleteRuleFromDB,
} from "./rulesModel";
import { findUserByEmail } from "../../auth/authRepository";
import { AuthUserPayload } from "../../../interface/user";
import { AuthRequest } from "../../../interface/auth";

/**
 * Get all rules
 * @param req
 * @param res
 * @param next
 * @returns All non-deleted rules with conditions
 */
export const getAllRules = async (
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
    const rules = await getAllRulesFromDB();

    res
      .status(HTTP_STATUS.OK)
      .json(successResponse({ rules }, MESSAGES.RULES_RETRIEVED));
  } catch (err) {
    next(err);
  }
};

/**
 * Create a new rule
 * @param req
 * @param res
 * @param next
 * @returns The created rule
 */
export const createRule = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  const userPayload = req.user as AuthUserPayload | undefined;

  if (!userPayload?.userEmail) {
    res.status(HTTP_STATUS.UNAUTHORIZED).json(errorResponse("Unauthorized"));
    return;
  }

  if (userPayload.role !== "Admin") {
    res
      .status(HTTP_STATUS.UNAUTHORIZED)
      .json(errorResponse("Unauthorized Role"));
    return;
  }

  const user = await findUserByEmail(userPayload.userEmail);
  if (!user) {
    res.status(HTTP_STATUS.UNAUTHORIZED).json(errorResponse("User not found"));
    return;
  }

  try {
    const payload = {
      ...req.body,
      isDeleted: false,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    const newRule = await createValidatedRule(payload);
    res
      .status(HTTP_STATUS.CREATED)
      .json(successResponse(newRule, MESSAGES.RULE_CREATED));
  } catch (err: unknown) {
    if (err instanceof ZodError) {
      res.status(HTTP_STATUS.BAD_REQUEST).json({ errors: err.issues });
      return;
    }
    next(err);
  }
};

/**
 * Update rule by ID
 * @param req
 * @param res
 * @param next
 * @returns Updated rule
 */
export const updateRule = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  const userPayload = req.user as AuthUserPayload | undefined;

  if (!userPayload?.userEmail) {
    res.status(HTTP_STATUS.UNAUTHORIZED).json(errorResponse("Unauthorized"));
    return;
  }

  if (userPayload.role !== "Admin") {
    res
      .status(HTTP_STATUS.UNAUTHORIZED)
      .json(errorResponse("Unauthorized Role"));
    return;
  }

  const user = await findUserByEmail(userPayload.userEmail);
  if (!user) {
    res.status(HTTP_STATUS.UNAUTHORIZED).json(errorResponse("User not found"));
    return;
  }

  try {
    const payload = {
      ...req.body,
      updatedAt: new Date(),
    };

    const updatedRule = await updateValidatedRule(req.params.id!, payload);

    if (!updatedRule) {
      res.status(HTTP_STATUS.NOT_FOUND).json(errorResponse("Rule not found"));
      return;
    }

    res
      .status(HTTP_STATUS.OK)
      .json(successResponse(updatedRule, MESSAGES.RULE_UPDATED));
  } catch (err: unknown) {
    if (err instanceof ZodError) {
      res.status(HTTP_STATUS.BAD_REQUEST).json({ errors: err.issues });
      return;
    }
    next(err);
  }
};

/**
 * Delete rule by ID (soft delete)
 * @param req
 * @param res
 * @param next
 * @returns Boolean indicating if deletion was successful
 */
export const deleteRule = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  const userPayload = req.user as AuthUserPayload | undefined;

  if (!userPayload?.userEmail) {
    res.status(HTTP_STATUS.UNAUTHORIZED).json(errorResponse("Unauthorized"));
    return;
  }

  if (userPayload.role !== "Admin") {
    res
      .status(HTTP_STATUS.UNAUTHORIZED)
      .json(errorResponse("Unauthorized Role"));
    return;
  }

  const user = await findUserByEmail(userPayload.userEmail);
  if (!user) {
    res.status(HTTP_STATUS.UNAUTHORIZED).json(errorResponse("User not found"));
    return;
  }

  try {
    const deleted = await deleteRuleFromDB(req.params.id!);

    if (!deleted) {
      res.status(HTTP_STATUS.NOT_FOUND).json(errorResponse("Rule not found"));
      return;
    }

    res
      .status(HTTP_STATUS.OK)
      .json(successResponse(null, MESSAGES.RULE_DELETED));
  } catch (err) {
    next(err);
  }
};
