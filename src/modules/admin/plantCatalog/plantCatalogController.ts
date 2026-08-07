import { Response, NextFunction } from "express";
import { HTTP_STATUS } from "../../../core/utils/constants";
import {
  errorResponse,
  successResponse,
} from "../../../core/utils/responseFormatter";
import { findUserByEmail } from "../../auth/authRepository";
import { AuthRequest } from "../../../interface/auth";
import { AuthUserPayload } from "../../../interface/user";
import {
  findPlantCatalog,
  findPlantCatalogById,
} from "./plantCatalogModule";

/**
 * Ensures the caller is an authenticated Admin user.
 *
 * @param {AuthRequest} req - Authenticated request.
 * @param {Response} res - Express response used for auth errors.
 * @returns {Promise<boolean>} True when the caller is an Admin.
 */
async function assertAdmin(
  req: AuthRequest,
  res: Response
): Promise<boolean> {
  const userPayload = req.user as AuthUserPayload | undefined;

  if (!userPayload?.userEmail) {
    res.status(HTTP_STATUS.UNAUTHORIZED).json(errorResponse("Unauthorized"));
    return false;
  }

  const user = await findUserByEmail(userPayload.userEmail);
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
 * GET /api/v1/admin/plant-catalog
 * Plant master data: name, species, care instructions, images.
 *
 * @param {AuthRequest} req - Authenticated admin request.
 * @param {Response} res - Express response.
 * @param {NextFunction} next - Error middleware.
 * @returns {Promise<void>} Sends paginated plant catalog JSON.
 */
export const getPlantCatalog = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    if (!(await assertAdmin(req, res))) return;

    const page = Math.max(1, Number(req.query.page) || 1);
    const limit = Math.min(100, Math.max(1, Number(req.query.limit) || 20));
    const search =
      typeof req.query.search === "string" ? req.query.search : undefined;

    const filters: Parameters<typeof findPlantCatalog>[0] = { page, limit };
    if (search) filters.search = search;

    const { plants, total } = await findPlantCatalog(filters);

    res.status(HTTP_STATUS.OK).json(
      successResponse(
        {
          currentPage: page,
          totalPages: Math.ceil(total / limit) || 0,
          totalCount: total,
          limit,
          plants,
        },
        "Plant catalog fetched successfully"
      )
    );
  } catch (err) {
    next(err);
  }
};

/**
 * GET /api/v1/admin/plant-catalog/:id
 * Single plant master record.
 *
 * @param {AuthRequest} req - Authenticated admin request with plant id.
 * @param {Response} res - Express response.
 * @param {NextFunction} next - Error middleware.
 * @returns {Promise<void>} Sends plant detail JSON.
 */
export const getPlantCatalogById = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    if (!(await assertAdmin(req, res))) return;

    const id = Number(req.params.id);
    if (!Number.isFinite(id) || id <= 0) {
      res
        .status(HTTP_STATUS.BAD_REQUEST)
        .json(errorResponse("Valid plant id is required"));
      return;
    }

    const plant = await findPlantCatalogById(id);
    if (!plant) {
      res.status(HTTP_STATUS.NOT_FOUND).json(errorResponse("Plant not found"));
      return;
    }

    res
      .status(HTTP_STATUS.OK)
      .json(successResponse(plant, "Plant catalog item fetched successfully"));
  } catch (err) {
    next(err);
  }
};
