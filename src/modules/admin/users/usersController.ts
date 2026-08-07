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
  AdminAccountStatus,
  findAdminUserById,
  findAdminUsers,
} from "./usersModule";

const VALID_TIERS = new Set(["free", "starter", "plus", "pro"]);
const VALID_SUB_STATUSES = new Set([
  "active",
  "pending",
  "canceled",
  "expired",
  "on_hold",
  "in_grace",
  "paused",
  "none",
]);

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
 * GET /api/v1/admin/users
 * Paginated user list with search/filters and subscription history.
 *
 * @param {AuthRequest} req - Authenticated admin request with query filters.
 * @param {Response} res - Express response.
 * @param {NextFunction} next - Error middleware.
 * @returns {Promise<void>} Sends paginated users JSON.
 */
export const getAdminUsers = async (
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
    const tierRaw =
      typeof req.query.tier === "string"
        ? req.query.tier.trim().toLowerCase()
        : undefined;
    const accountStatusRaw =
      typeof req.query.accountStatus === "string"
        ? req.query.accountStatus.trim().toLowerCase()
        : typeof req.query.account_status === "string"
          ? req.query.account_status.trim().toLowerCase()
          : undefined;
    const signupFrom =
      typeof req.query.signupFrom === "string"
        ? req.query.signupFrom
        : typeof req.query.signup_from === "string"
          ? req.query.signup_from
          : undefined;
    const signupTo =
      typeof req.query.signupTo === "string"
        ? req.query.signupTo
        : typeof req.query.signup_to === "string"
          ? req.query.signup_to
          : undefined;
    const subscriptionStatusRaw =
      typeof req.query.subscriptionStatus === "string"
        ? req.query.subscriptionStatus.trim().toLowerCase()
        : typeof req.query.subscription_status === "string"
          ? req.query.subscription_status.trim().toLowerCase()
          : undefined;

    if (tierRaw && !VALID_TIERS.has(tierRaw)) {
      res
        .status(HTTP_STATUS.BAD_REQUEST)
        .json(
          errorResponse(
            "Invalid tier. Use free | starter | plus | pro"
          )
        );
      return;
    }

    if (
      accountStatusRaw &&
      accountStatusRaw !== "active" &&
      accountStatusRaw !== "inactive"
    ) {
      res
        .status(HTTP_STATUS.BAD_REQUEST)
        .json(errorResponse("Invalid accountStatus. Use active | inactive"));
      return;
    }

    if (
      subscriptionStatusRaw &&
      !VALID_SUB_STATUSES.has(subscriptionStatusRaw)
    ) {
      res
        .status(HTTP_STATUS.BAD_REQUEST)
        .json(
          errorResponse(
            "Invalid subscriptionStatus. Use active | pending | canceled | expired | on_hold | in_grace | paused | none"
          )
        );
      return;
    }

    const listFilters: Parameters<typeof findAdminUsers>[0] = { page, limit };
    if (search) listFilters.search = search;
    if (tierRaw) listFilters.tier = tierRaw;
    if (accountStatusRaw === "active" || accountStatusRaw === "inactive") {
      listFilters.accountStatus = accountStatusRaw as AdminAccountStatus;
    }
    if (signupFrom) listFilters.signupFrom = signupFrom;
    if (signupTo) listFilters.signupTo = signupTo;
    if (subscriptionStatusRaw) {
      listFilters.subscriptionStatus = subscriptionStatusRaw;
    }

    const { users, total } = await findAdminUsers(listFilters);

    res.status(HTTP_STATUS.OK).json(
      successResponse(
        {
          currentPage: page,
          totalPages: Math.ceil(total / limit) || 0,
          totalCount: total,
          limit,
          users,
        },
        "Users fetched successfully"
      )
    );
  } catch (err) {
    next(err);
  }
};

/**
 * GET /api/v1/admin/users/:id
 * Single user with current subscription and full purchase history.
 *
 * @param {AuthRequest} req - Authenticated admin request with user id param.
 * @param {Response} res - Express response.
 * @param {NextFunction} next - Error middleware.
 * @returns {Promise<void>} Sends user detail JSON.
 */
export const getAdminUserById = async (
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
        .json(errorResponse("User id is required"));
      return;
    }

    const user = await findAdminUserById(id);
    if (!user) {
      res.status(HTTP_STATUS.NOT_FOUND).json(errorResponse("User not found"));
      return;
    }

    res
      .status(HTTP_STATUS.OK)
      .json(successResponse(user, "User fetched successfully"));
  } catch (err) {
    next(err);
  }
};
