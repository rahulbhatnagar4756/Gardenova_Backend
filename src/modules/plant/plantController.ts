import { Response, NextFunction } from "express";
import { ZodError } from "zod";
import {
  createPlantService,
  getAllPlantsService,
  getPlantByIdService,
  updatePlantService,
  deletePlantService,
} from "./plantService";
import {
  successResponse,
  errorResponse,
} from "../../core/utils/responseFormatter";
import { HTTP_STATUS } from "../../core/utils/constants";
import { findUserByEmail } from "../auth/authRepository";
import { error, warn } from "../../core/utils/logger";
import { CustomError } from "../../interface/Error";
import { IUser } from "../../interface/user";
import { identifyPlantService } from "./plantRepository";
import { AuthRequest } from "../../interface/auth";

/**
 * AUTH + ROLE CHECK HELPER (ADMIN ONLY)
 * @param {AuthRequest} req - Authenticated request containing user info
 * @param {Response} res - Express response object
 * @returns {Promise<IUser | null>} Returns user object if admin, otherwise null
 */
const validateAdminUser = async (
  req: AuthRequest,
  res: Response
): Promise<IUser | null> => {
  const userPayload = req.user as
    | { userEmail?: string; role?: string }
    | undefined;

  if (!userPayload?.userEmail) {
    res
      .status(HTTP_STATUS.UNAUTHORIZED)
      .json(errorResponse("Unauthorized request"));
    return null;
  }

  const user = await findUserByEmail(userPayload.userEmail);

  if (!user) {
    res.status(HTTP_STATUS.UNAUTHORIZED).json(errorResponse("User not found"));
    return null;
  }
  const allowedRoles = ["Admin", "User"];
  if (!allowedRoles.includes(userPayload.role!)) {
    res
      .status(HTTP_STATUS.UNAUTHORIZED)
      .json(errorResponse("Unauthorized Role"));
    return null;
  }

  return user;
};

/**
 * CREATE PLANT
 * @param {AuthRequest} req - Authenticated request object
 * @param {Response} res - Express response object
 * @param {NextFunction} next - Next middleware function
 * @returns {Promise<void>} No return value, sends JSON response
 */
export const createPlantController = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  const user = await validateAdminUser(req, res);
  if (!user) return;

  try {
    await createPlantService(req.body);

    res
      .status(HTTP_STATUS.CREATED)
      .json(successResponse(null, "Plant created successfully"));
  } catch (err: unknown) {
    // ZOD VALIDATION ERROR
    if (err instanceof ZodError) {
      const formatted = err.issues.map((e) => ({
        field: e.path.join("."),
        message: e.message,
      }));

      await warn(
        "Plant creation failed - validation errors",
        { errors: formatted },
        { userId: user.id!, source: "plant.create" }
      );

      res.status(HTTP_STATUS.BAD_REQUEST).json({
        success: false,
        message: "Validation failed",
        errors: formatted,
      });
      return;
    }

    // UNKNOWN ERROR
    const errorObj: CustomError =
      err instanceof Error
        ? err
        : {
            name: "UnknownError",
            message:
              typeof err === "string" ? err : "An unknown error occurred",
          };

    await error(
      "Plant creation failed with unexpected error",
      { error: errorObj.message, stack: errorObj.stack },
      { userId: user.id!, source: "plant.create" }
    );

    next(errorObj);
  }
};

/**
 * GET ALL PLANTS
 * @param {AuthRequest} req - Authenticated request object
 * @param {Response} res - Express response object
 * @param {NextFunction} next - Next middleware
 * @returns {Promise<void>} Sends the list of plants as JSON response
 */
export const getAllPlantsController = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  const user = await validateAdminUser(req, res);
  if (!user) return;

  try {
    const page = Number(req.query.page) || 1;
    const limit = Number(req.query.limit) || 6;
    const search = String(req.query.search || "");

    const data = await getAllPlantsService(page, limit, search);

    res
      .status(HTTP_STATUS.OK)
      .json(successResponse(data, "Plants fetched successfully"));
  } catch (err: unknown) {
    next(err);
  }
};

/**
 * GET PLANT BY ID
 * @param {AuthRequest} req - Authenticated request containing plant ID in params
 * @param {Response} res - Express response object
 * @param {NextFunction} next - Next middleware function
 * @returns {Promise<void>} Sends plant details or 404 if not found
 */
export const getPlantByIdController = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  const user = await validateAdminUser(req, res);
  if (!user) return;

  try {
    const plant = await getPlantByIdService(req.params.id!);

    if (!plant) {
      res.status(HTTP_STATUS.NOT_FOUND).json(errorResponse("Plant not found"));
      return;
    }

    res
      .status(HTTP_STATUS.OK)
      .json(successResponse(plant, "Plant fetched successfully"));
  } catch (err: unknown) {
    const errorObj: CustomError =
      err instanceof Error
        ? err
        : {
            name: "UnknownError",
            message:
              typeof err === "string" ? err : "An unknown error occurred",
          };

    await error(
      "Get plant by ID failed",
      { id: req.params.id, error: errorObj.message, stack: errorObj.stack },
      { userId: user.id!, source: "plant.getById" }
    );

    next(errorObj);
  }
};

/**
 * UPDATE PLANT
 * @param {AuthRequest} req - Authenticated request containing plant ID and update data
 * @param {Response} res - Express response object
 * @param {NextFunction} next - Next middleware function
 * @returns {Promise<void>} Sends confirmation after updating plant
 */
export const updatePlantController = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  const user = await validateAdminUser(req, res);
  if (!user) return;

  try {
    await updatePlantService(req.params.id!, req.body);

    res
      .status(HTTP_STATUS.OK)
      .json(successResponse(null, "Plant updated successfully"));
  } catch (err: unknown) {
    if (err instanceof ZodError) {
      const formatted = err.issues.map((e) => ({
        field: e.path.join("."),
        message: e.message,
      }));

      await warn(
        "Plant update failed - validation errors",
        { errors: formatted },
        { userId: user.id!, source: "plant.update" }
      );

      res.status(HTTP_STATUS.BAD_REQUEST).json({
        success: false,
        message: "Validation failed",
        errors: formatted,
      });
      return;
    }

    const errorObj: CustomError =
      err instanceof Error
        ? err
        : {
            name: "UnknownError",
            message:
              typeof err === "string" ? err : "An unknown error occurred",
          };

    await error(
      "Plant update failed",
      { id: req.params.id, error: errorObj.message, stack: errorObj.stack },
      { userId: user.id!, source: "plant.update" }
    );

    next(errorObj);
  }
};

/**
 * DELETE PLANT (SOFT DELETE)
 * @param {AuthRequest} req - Authenticated request containing plant ID to delete
 * @param {Response} res - Express response object
 * @param {NextFunction} next - Next middleware function
 * @returns {Promise<void>} Sends confirmation after plant is soft deleted
 */
export const deletePlantController = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  const user = await validateAdminUser(req, res);
  if (!user) return;

  try {
    await deletePlantService(req.params.id!);

    res
      .status(HTTP_STATUS.OK)
      .json(successResponse(null, "Plant deleted successfully"));
  } catch (err: unknown) {
    const errorObj: CustomError =
      err instanceof Error
        ? err
        : {
            name: "UnknownError",
            message:
              typeof err === "string" ? err : "An unknown error occurred",
          };

    await error(
      "Plant deletion failed",
      { id: req.params.id, error: errorObj.message, stack: errorObj.stack },
      { userId: user.id!, source: "plant.delete" }
    );

    next(errorObj);
  }
};

/**
 * Diagnose a plant based on uploaded images and geo-coordinates.
 *
 * @param req Express request object
 * @param res Express response object
 * @param next
 * @returns Sends a JSON diagnosis response
 */
export const diagnosePlantController = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  const userPayload = req.user as
    | { userEmail?: string; role?: string }
    | undefined;

  if (!userPayload?.userEmail) {
    res
      .status(HTTP_STATUS.UNAUTHORIZED)
      .json(errorResponse("Unauthorized request"));
    return;
  }

  const user = await findUserByEmail(userPayload.userEmail);

  if (!user) {
    res.status(HTTP_STATUS.UNAUTHORIZED).json(errorResponse("User not found"));
    return;
  }

  if (userPayload.role !== "Admin" && userPayload.role !== "User") {
    res
      .status(HTTP_STATUS.UNAUTHORIZED)
      .json(errorResponse("Unauthorized Role"));
    return;
  }
  try {
    const apiResponse = await identifyPlantService(req.body);

    res
      .status(HTTP_STATUS.OK)
      .json(successResponse(apiResponse, "Plant diagnosed successfully"));
  } catch (error: unknown) {
    const err = error instanceof Error ? error.message : "Unknown error";
    res.status(500).json({
      success: false,
      error: "Failed to diagnose plant",
      message: err,
    });
    next(error);
  }
};
