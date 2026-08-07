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
  findDiagnosisScanById,
  findDiagnosisScans,
} from "./diagnosisScansModule";

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
 * GET /api/v1/admin/diagnosis-scans
 * Paginated log of plant disease scan requests.
 *
 * @param {AuthRequest} req - Authenticated admin request with query filters.
 * @param {Response} res - Express response.
 * @param {NextFunction} next - Error middleware.
 * @returns {Promise<void>} Sends paginated scan logs JSON.
 */
export const getDiagnosisScans = async (
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
    const disease =
      typeof req.query.disease === "string" ? req.query.disease : undefined;
    const userId =
      typeof req.query.userId === "string"
        ? req.query.userId
        : typeof req.query.user_id === "string"
          ? req.query.user_id
          : undefined;
    const from =
      typeof req.query.from === "string" ? req.query.from : undefined;
    const to = typeof req.query.to === "string" ? req.query.to : undefined;

    const filters: Parameters<typeof findDiagnosisScans>[0] = { page, limit };
    if (search) filters.search = search;
    if (disease) filters.disease = disease;
    if (userId) filters.userId = userId;
    if (from) filters.from = from;
    if (to) filters.to = to;

    const { scans, total } = await findDiagnosisScans(filters);

    res.status(HTTP_STATUS.OK).json(
      successResponse(
        {
          currentPage: page,
          totalPages: Math.ceil(total / limit) || 0,
          totalCount: total,
          limit,
          scans,
        },
        "Diagnosis scans fetched successfully"
      )
    );
  } catch (err) {
    next(err);
  }
};

/**
 * GET /api/v1/admin/diagnosis-scans/:id
 * Single scan log detail.
 *
 * @param {AuthRequest} req - Authenticated admin request with scan id.
 * @param {Response} res - Express response.
 * @param {NextFunction} next - Error middleware.
 * @returns {Promise<void>} Sends scan detail JSON.
 */
export const getDiagnosisScanById = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    if (!(await assertAdmin(req, res))) return;

    const id = String(req.params.id ?? "").trim();
    if (!id) {
      res
        .status(HTTP_STATUS.BAD_REQUEST)
        .json(errorResponse("Scan id is required"));
      return;
    }

    const scan = await findDiagnosisScanById(id);
    if (!scan) {
      res.status(HTTP_STATUS.NOT_FOUND).json(errorResponse("Scan not found"));
      return;
    }

    res
      .status(HTTP_STATUS.OK)
      .json(successResponse(scan, "Diagnosis scan fetched successfully"));
  } catch (err) {
    next(err);
  }
};
