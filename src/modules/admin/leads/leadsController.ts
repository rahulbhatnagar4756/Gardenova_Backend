import { Response, NextFunction } from "express";
import { ZodError } from "zod";
import { HTTP_STATUS } from "../../../core/utils/constants";
import {
  errorResponse,
  successResponse,
} from "../../../core/utils/responseFormatter";
import { error } from "../../../core/utils/logger";
import { createLead, findAllLeads,  findAllLeadsForAdmin, findAllLeadsForMonths, updateLeadStatus } from "./leadsModule";
import { sendLeadEmails } from "../../../core/services/emailService";
import config from "../../../core/config/env";
import { getDB } from "../../../core/config/db";
import { findUserByEmail } from "../../auth/authRepository";
import { dashboardCache } from "../dashboard/dashboardController";
import { AuthRequest } from "../../../interface/auth";
import { PartnerData, PartnerProfile } from "../../../interface/partnerProfile";
import { AuthUserPayload } from "../../../interface/user";

/**
 * Get all leads (PostgreSQL version)
 *
 * @param {AuthRequest} req - The authenticated request object.
 * @param {Response} res - The response object.
 * @param {NextFunction} next - Express next function.
 * @returns {Promise<Response>} The API response containing leads or an error.
 */
export const getAllLeads = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<Response | void> => {
  const userPayload = req.user as AuthUserPayload | undefined;

  if (!userPayload?.userEmail) {
    return res.status(401).json(errorResponse("Unauthorized"));
  }

  const user = await findUserByEmail(userPayload.userEmail);
  if (!user) {
    return res.status(401).json(errorResponse("User not found"));
  }

  if (userPayload.role !== "Admin") {
    return res.status(401).json(errorResponse("Unauthorized Role"));
  }

  try {
    // Pagination parameters
    const page = Number(req.query.page) || 1;
    const limit = Number(req.query.limit) || 5;

    const { leads, total } = await findAllLeads(page, limit);

    return res.status(HTTP_STATUS.OK).json(
      successResponse(
        {
          currentPage: page,
          totalPages: Math.ceil(total / limit),
          totalCount: total,
          limit,
          leads,
        },
        "All leads fetched successfully"
      )
    );
  } catch (err: unknown) {
    if (err instanceof ZodError) {
      return res.status(400).json({ errors: err.issues });
    }

    return next(err);
  }
};

/**
 * Create a new lead (PostgreSQL version)
 * @param req
 * @param res
 * @param next
 */
export const createLeadController = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const userPayload = req.user as
      | { userEmail?: string; role?: string; userId?: string }
      | undefined;

    // Fast validation checks
    if (!userPayload?.userEmail || userPayload?.role !== "User") {
      res.status(HTTP_STATUS.UNAUTHORIZED).json(errorResponse("Unauthorized"));
      return;
    }

    const { partnerIds, message, service } = req.body;

    if (!Array.isArray(partnerIds) || partnerIds.length === 0) {
      res
        .status(HTTP_STATUS.BAD_REQUEST)
        .json(errorResponse("partnerIds must be a non-empty array"));
      return;
    }

    // ONLY validate and insert lead - no other DB calls
    const createdLead = await createLead({
      partnerIds,
      userId: userPayload.userId,
      leadsStatus: "new",
      isDeleted: false,
    });

    if (!createdLead) {
      res
        .status(HTTP_STATUS.INTERNAL_SERVER_ERROR)
        .json(errorResponse("Lead could not be created"));
      return;
    }
    // Invalidate dashboard cache
    dashboardCache.del("dashboard");

    // IMMEDIATELY respond - don't wait for anything else
    res
      .status(HTTP_STATUS.CREATED)
      .json(
        successResponse({ leadId: createdLead.id }, "Lead created successfully")
      );

    // Process everything else asynchronously (fire-and-forget)
    setImmediate(() => {
      processLeadEmailsAsync(
        userPayload.userEmail!,
        partnerIds,
        createdLead.id!,
        message,
        service
      ).catch((emailError) => {
        error("Background email processing failed", {
          message:
            emailError instanceof Error
              ? emailError.message
              : String(emailError),
          leadId: createdLead.id,
        });
      });
    });
  } catch (err: unknown) {
    if (err instanceof ZodError) {
      res.status(HTTP_STATUS.BAD_REQUEST).json({ errors: err.issues });
      return;
    }
    next(err);
  }
};

/**
 * Processes and sends lead-related emails to partners asynchronously.
 *
 * This function handles the background task of notifying multiple partners
 * when a new lead is created, including user email, message, and service details.
 *
 * @param {string} userEmail - The email address of the user who submitted the lead.
 * @param {string[]} partnerIds - The IDs of the partners to whom the email will be sent.
 * @param {string} leadId - The unique identifier of the generated lead.
 * @param {string} message - The message content sent by the user.
 * @param {string} service - The type of service related to the lead.
 * @returns {Promise<void>} Resolves when all emails have been processed.
 */
async function processLeadEmailsAsync(
  userEmail: string,
  partnerIds: string[],
  leadId: string,
  message: string,
  service: string
): Promise<void> {
  try {
    const userRecord = await findUserByEmail(userEmail);
    const userData = {
      email: userEmail,
      name: userRecord?.name ?? "User",
    };

    const db = getDB();
    const query = `
      SELECT id, email, company_name, project_image_url
      FROM public.partner_profiles
      WHERE id = ANY($1::uuid[])
      ORDER BY id ASC;
    `;

    const { rows } = await db.query<PartnerProfile>(query, [partnerIds]);

    const partnersData: PartnerData[] = rows.map((row) => ({
      email: row.email,
      name: row.company_name,
      logoUrl: row.projectimageurl || "",
    }));

    const leadDetails = {
      phone: userRecord?.phone_number ?? "N/A",
      message,
      service,
      leadId,
      timestamp: new Date().toLocaleString(),
    };

    await sendLeadEmails(
      userData,
      partnersData,
      config.ADMIN_EMAIL,
      leadDetails
    );
  } catch (err) {
    throw err; // Caught by caller
  }
}

/**
 * Controller to update the status of a lead.
 *
 * @param {AuthRequest} req - The authenticated request object.
 * @param {Response} res - The response object.
 * @returns {Promise<Response>} Returns the API response containing success/failure status.
 */
export const updateLeadStatusController = async (
  req: AuthRequest,
  res: Response
): Promise<Response> => {
  const userPayload = req.user as AuthUserPayload | undefined;

  // Authentication checks
  if (!userPayload?.userEmail) {
    return res
      .status(HTTP_STATUS.UNAUTHORIZED)
      .json(errorResponse("Unauthorized"));
  }

  const user = await findUserByEmail(userPayload.userEmail);
  if (!user) {
    return res
      .status(HTTP_STATUS.UNAUTHORIZED)
      .json(errorResponse("User not found"));
  }

  if (userPayload.role !== "Admin") {
    return res
      .status(HTTP_STATUS.UNAUTHORIZED)
      .json(errorResponse("Unauthorized Role"));
  }

  try {
    const { id } = req.params;
    const { leads_status } = req.body;

    const updated = await updateLeadStatus(id!, leads_status);

    if (!updated) {
      return res.status(404).json({
        success: false,
        message: "Lead not found",
      });
    }
    // Invalidate dashboard cache
    dashboardCache.del("dashboard");
    // Successful update response
    return res.status(200).json({
      success: true,
      message: "Lead status updated successfully",
      data: null,
    });
  } catch (error) {
    const err = error as Error;

    return res.status(500).json({
      success: false,
      message: err.message || "Something went wrong",
    });
  }
};

/**
 * Fetches leads for the current month for a user, based on their email.
 * The function first checks for a valid user email, finds the user in the database,
 * and fetches the lead data for that user. Returns an error if the user is not authenticated 
 * or the leads cannot be fetched.
 * 
 * @param {AuthRequest} req - The request object, containing the user information in the payload.
 * @param {Response} res - The response object to send the result back to the client.
 * @param {NextFunction} next - The next middleware function to handle errors.
 * @returns {Promise<Response | void>} A promise that resolves to a response or void if an error occurs.
 */
export const getAllLeadsForMonths = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<Response | void> => {
  const userPayload = req.user as AuthUserPayload | undefined;
  
  if (!userPayload?.userEmail) {
    return res.status(401).json(errorResponse("Unauthorized"));
  }

  const user = await findUserByEmail(userPayload.userEmail);
  if (!user) {
    return res.status(401).json(errorResponse("User not found"));
  }

  try {
    const leadsData = await findAllLeadsForMonths(user.id!);
    return res.status(HTTP_STATUS.OK).json(
      successResponse(leadsData, "Leads for the month fetched successfully")
    );
  } catch (err: unknown) {
    if (err instanceof ZodError) {
      return res.status(400).json({ errors: err.issues });
    } 
    return next(err);
  }
} 

/**
 * Controller to fetch paginated leads for admin users.
 *
 * Performs authentication and role-based authorization before fetching data.
 *
 * Query Parameters:
 * - `page` (optional): Page number, defaults to 1
 * - `limit` (optional): Number of leads per page, defaults to 10
 *
 * Responses:
 * - 200: Returns paginated leads with a success message
 * - 400: Validation errors from Zod
 * - 401: Unauthorized (missing or invalid user)
 * - 403: Forbidden (user does not have Admin role)
 *
 * @param {AuthRequest} req  Express request object with authenticated user
 * @param {Response} res  Express response object
 * @param {NextFunction} next  Express next middleware function
 * @returns {Promise<Response | void>} JSON response or passes error to next middleware
 */
export const getAllLeadsForAdmin = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<Response | void> => {
  const userPayload = req.user as AuthUserPayload | undefined;
  if (!userPayload?.userEmail) {
    return res.status(401).json(errorResponse("Unauthorized"));
  }

  if (userPayload.role !== "Admin") {
    return res.status(403).json(errorResponse("Unauthorized Role"));
  }

  const page  = Math.max(1, parseInt(req.query.page  as string) || 1);
  const limit = Math.max(1, parseInt(req.query.limit as string) || 10);

  try {
    const data = await findAllLeadsForAdmin(page, limit);
     res.status(HTTP_STATUS.OK).json(
      successResponse(data, "All leads fetched successfully")
    );
  } catch (err: unknown) {
    if (err instanceof ZodError) {
      return res.status(400).json({ errors: err.issues });
    }
    return next(err);
  }
};
