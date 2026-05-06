import { Response, NextFunction } from "express";
import { HTTP_STATUS } from "../../../core/utils/constants";
import {
  errorResponse,
  successResponse,
} from "../../../core/utils/responseFormatter";
import {
  getActiveProfessionalsCount,
  getClosedLeadsCount,
  getLeadStatusCounts,
  getLeadTrendData,
  getTotalLeadsCount,
} from "./dashboardModel";
import { findUserByEmail } from "../../auth/authRepository";
import NodeCache from "node-cache";
import { AuthRequest } from "../../../interface/auth";
import { DashboardData } from "../../../interface/dashboard";
import { AuthUserPayload } from "../../../interface/user";

export const dashboardCache = new NodeCache({ stdTTL: 150 }); // 2.5 minutes TTL

/**
 * Retrieves complete dashboard analytics including:
 * - Total leads count
 * - Active professionals count
 * - Lead status aggregated counts
 * - Lead generation trend data for charts
 *
 * @param {AuthRequest} req - Authenticated request containing user payload
 * @param {Response} res - Express response object used to send JSON output
 * @param {NextFunction} next - Next middleware for error handling
 * @returns {Promise<void>} Resolves when the response has been sent
 */
export const getDashboardData = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  const userPayload = req.user as AuthUserPayload | undefined;

  if (!userPayload?.userEmail) {
    res.status(401).json(errorResponse("Unauthorized"));
    return;
  }

  const user = await findUserByEmail(userPayload.userEmail);
  if (!user) {
    res.status(401).json(errorResponse("User not found"));
    return;
  }

  if (userPayload.role !== "Admin") {
    res.status(401).json(errorResponse("Unauthorized Role"));
    return;
  }

  try {
    const cachedDashboard = dashboardCache.get<DashboardData>("dashboard");

    if (cachedDashboard) {
      res
        .status(HTTP_STATUS.OK)
        .json(successResponse(cachedDashboard, "Dashboard cache hit"));
      return;
    }

    const [leadCounts, professionals, leadStatuses, leadTrend, closedLeads] =
      await Promise.all([
        getTotalLeadsCount(),
        getActiveProfessionalsCount(),
        getLeadStatusCounts(),
        getLeadTrendData(),
        getClosedLeadsCount(),
      ]);

    const todayMessage =
      leadCounts.today > 0
        ? `Today we will receive ${leadCounts.today} leads`
        : "No leads created today";

    const professionalsMessage =
      professionals.today > 0
        ? `Today, ${professionals.today} professionals joined us.`
        : "No professionals joined today.";

    const dashboard = {
      total_leads: {
        count: leadCounts.total,
        today: leadCounts.today,
        message: todayMessage,
      },
      active_professionals: {
        count: professionals.total,
        today: professionals.today,
        message: professionalsMessage,
      },
      closed_leads: {
        total: closedLeads.total,
        this_month: closedLeads.this_month,
        message:
          closedLeads.this_month > 0
            ? `${closedLeads.this_month} leads closed this month`
            : "No leads closed this month",
      },
      lead_status_counts: leadStatuses,
      lead_trend: leadTrend,
    };

    dashboardCache.set("dashboard", dashboard);

    res
      .status(HTTP_STATUS.OK)
      .json(successResponse(dashboard, "All data retrieved successfully"));
    return;
  } catch (error) {
    next(error);
  }
};
