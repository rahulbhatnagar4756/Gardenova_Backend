import { AuthRequest,  ProfessionalProfileResponse } from "../../interface/auth";
import { NextFunction, Response } from "express";
import { AuthUserPayload } from "../../interface/user";
import { HTTP_STATUS } from "../../core/utils/constants";
import { errorResponse, successResponse } from "../../core/utils/responseFormatter";
import { findUserByEmail } from "../auth/authRepository";
import {
  fetchSortedProfessionals,
  getAllLeadsForUser,
  getAllProfessionalProfilesDb,
  getProfessionalDataById, getProfessionalProfileByIdByAdminService, getProfessionalProfileByIdService,
  importProfessionalsFromCsv,
  leadCreatedByProfessionalService, leadForwholesalerService, professionalProfileById, registerProfessionalService,
  updateFounderStatusService,
  updateLeadStatusService,
  updateProfessionalByAdminService,
  updateRatingByAdminService
} from "./professionalRepositry";
import { getProfessionalProfileById } from "../userProfile/userProfileModel";
import { deleteFileFromS3, uploadBase64ToS3 } from "../../core/services/s3UploadService";
import { error } from "../../core/utils/logger";
import { getDB } from "../../core/config/db";


/**
 * Bulk create professional accounts (Admin only).
 *
 * - Validates authenticated user
 * - Ensures user has Admin role
 * - Reads professionals data from request (parsed CSV)
 * - Calls service to register professionals
 * - Returns summary of successful and failed registrations
 *
 * @route POST /professionals/bulk
 * @access Private (Admin only)
 *
 * @param req - Authenticated request containing:
 *   - user (JWT payload)
 *   - professional (array of parsed CSV users)
 * @param res - Express response object
 * @param next - Express next middleware function
 *
 * @returns 201 - Professionals registered successfully
 * 
 */
export const createProfessionals = async (
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
    res.status(HTTP_STATUS.UNAUTHORIZED).json(errorResponse("Unauthorized Role"));
    return;
  }

  const filePath = req.file?.path;
  if (!filePath) {
    res.status(HTTP_STATUS.BAD_REQUEST).json(errorResponse("No file uploaded"));
    return;
  }

  try {
    const result = await importProfessionalsFromCsv(filePath);
    // console.log(`Import result: ${result.inserted} inserted, ${result.failed.length} failed`);
    res.status(HTTP_STATUS.CREATED).json(
      successResponse(result, "Professionals import complete")
    );
    return;
  } catch (error) {
    console.error("Error in createProfessionals:", error);
    res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json(
      errorResponse("Import failed", {
        message: error instanceof Error ? error.message : String(error),
      })
    );
    next();
  }
};
/**
 * Get paginated list of all professional profiles (Admin only).
 *
 * - Validates authenticated user
 * - Ensures Admin role
 * - Supports pagination via query params:
 *   - page (default: 1)
 *   - limit (default: 5)
 * - Returns professional profiles with pagination metadata
 *
 * @route GET /professionals
 * @access Private (Admin only)
 *
 * @query page - Page number (optional)
 * @query limit - Number of records per page (optional)
 *
 * @param req - Authenticated request containing JWT payload + query params
 * @param res - Express response object
 * @param next - Express next middleware function
 *
 * @returns 200 - Paginated professional profiles

 */
export const getAllProfessionalProfiles = async (
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
    // Pagination params
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 5;
    const offset = (page - 1) * limit;

    // Fetch paginated professionals + total count
    const { professionals, totalCount } =
      await getAllProfessionalProfilesDb(limit, offset);

    const totalPages = Math.ceil(totalCount / limit);

    res.status(HTTP_STATUS.OK).json(
      successResponse({
        currentPage: page,
        totalPages,
        totalCount,
        limit,
        professionals,
      })
    );
  } catch (err) {
    next(err);
  }
};


/**
 * Registers a professional user account (Admin only).
 *
 * Workflow:
 * 1. Validates JWT authentication.
 * 2. Ensures the requesting user has the "Admin" role.
 * 3. Verifies the requesting user still exists in the database.
 * 4. Validates request body (professionalId, email).
 * 5. Fetches and validates the professional profile record.
 * 6. Delegates account creation to registerProfessionalService.
 *
 * Business Rules:
 * - Only Admin users can register professionals.
 * - Email must match the professional profile record.
 * - Email must be unique in the users table.
 *
 * Possible Responses:
 * - 201 Created → Professional successfully registered.
 * - 400 Bad Request → Validation errors.
 * - 401 Unauthorized → Invalid or missing authentication.
 * - 403 Forbidden → User is not an Admin.
 * - 404 Not Found → Professional profile not found.
 * - 409 Conflict → Email already exists.
 * - 500 Internal Server Error → Unexpected system failure.
 *
 * @async
 * @function registerProfessionals
 *
 * @param {AuthRequest} req - Express request object with authenticated user payload.
 * @param {Response} res - Express response object.
 *
 * @returns {Promise<void>} Sends a JSON response with success or error message.
 */
export const registerProfessionals = async (
  req: AuthRequest,
  res: Response
): Promise<void> => {

  // ─── 1. Auth guard ─────────────────────────────────────────────────────────
  const userPayload = req.user as AuthUserPayload | undefined;

  if (!userPayload?.userEmail) {
    res.status(HTTP_STATUS.UNAUTHORIZED).json(errorResponse("Unauthorized"));
    return;
  }

  // ─── 2. Role guard ─────────────────────────────────────────────────────────
  if (userPayload.role !== "Admin") {
    res.status(HTTP_STATUS.FORBIDDEN).json(errorResponse("Access denied: Admins only"));
    return;
  }

  // ─── 3. Verify requesting user still exists ────────────────────────────────
  try {
    const user = await findUserByEmail(userPayload.userEmail);
    if (!user) {
      res.status(HTTP_STATUS.UNAUTHORIZED).json(errorResponse("Requesting user no longer exists"));
      return;
    }
  } catch (error) {
    console.error("Error verifying requesting user:", error);
    res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json(
      errorResponse("Failed to verify user identity. Please try again.")
    );
    return;
  }

  // ─── 4. Validate request body ──────────────────────────────────────────────
  const { professionalId, email } = req.body;

  if (!professionalId) {
    res.status(HTTP_STATUS.BAD_REQUEST).json(errorResponse("Professional ID is required"));
    return;
  }

  if (!email) {
    res.status(HTTP_STATUS.BAD_REQUEST).json(errorResponse("Email is required"));
    return;
  }

  // ─── 5. Fetch & validate professional record ───────────────────────────────
  let professionalData: ProfessionalProfileResponse | null = null;

  try {
    professionalData = await getProfessionalDataById(professionalId);
  } catch (error) {
    console.error("Error fetching professional data:", error);
    res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json(
      errorResponse("Failed to fetch professional record. Please try again.")
    );
    return;
  }

  if (!professionalData) {
    res.status(HTTP_STATUS.NOT_FOUND).json(errorResponse("Professional not found"));
    return;
  }

  if (professionalData.email !== email) {
    res.status(HTTP_STATUS.BAD_REQUEST).json(
      errorResponse("Email does not match professional record")
    );
    return;
  }

  // ─── 6. Register professional ──────────────────────────────────────────────
  try {
    const result = await registerProfessionalService(professionalId, professionalData);

    if (!result.success) {
      const isConflict = result.message === "Email already exists";
      res
        .status(isConflict ? HTTP_STATUS.CONFLICT : HTTP_STATUS.BAD_REQUEST)
        .json(errorResponse(result.message));
      return;
    }

    res
      .status(HTTP_STATUS.CREATED)
      .json(successResponse(result, "Professional registered successfully"));

  } catch (error) {
    // console.error("Unexpected error in registerProfessionals:", error);
    res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json(
      errorResponse("An unexpected error occurred while registering the professional.", error instanceof Error ? { message: error.message } : undefined)
    );
  }
};





/**
 * Retrieves a list of professionals sorted by:
 *  1. Distance from the user's location (ascending)
 *  2. Subscription priority (higher plans first)
 *  3. Rating/assessment (higher first)
 *
 * Supports optional category filtering and pagination.
 *
 * @async
 * @function getSortedProfessionals
 *
 * @param {AuthRequest} req - Express request object containing:
 *   @param {string} req.query.lat - User latitude (required)
 *   @param {string} req.query.lng - User longitude (required)
 *   @param {string} [req.query.category] - Optional category filter
 *   @param {string} [req.query.limit=50] - Number of results to return (max 100)
 *   @param {string} [req.query.offset=0] - Pagination offset
 *
 * @param {Response} res - Express response object
 *
 * @returns {Promise<void>} Sends a JSON response containing:
 *   - Sorted professionals list
 *   - Or error response (400 / 500)
 *
 * @throws {Error} Returns 500 if an unexpected server error occurs.
 */
export async function getSortedProfessionals(
  req: AuthRequest,
  res: Response
): Promise<void> {
  try {
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


    const { lat, lng, category, limit = "20", page = "0" } = req.query;

    // --- Validate required params ---
    if (!lat || !lng) {
      res.status(400).json({ error: "User location (lat, lng) is required." });
      return;
    }
    

    const userLat = parseFloat(lat as string);
    const userLng = parseFloat(lng as string);

    if (isNaN(userLat) || isNaN(userLng)) {
      res.status(400).json({ error: "Invalid lat/lng values." });
      return;
    }

    const pageLimit = Math.min(parseInt(limit as string) || 50, 100);
    const pageNumber = Math.max(parseInt(page as string) || 1, 1);
    const pageOffset = (pageNumber - 1) * pageLimit;
    // --- Delegate to service ---
    const result = await fetchSortedProfessionals({
      userId: user.id!,
      userLat,
      userLng,
      category: category as string | undefined,
      limit: pageLimit,
      offset: pageOffset,
     
    });
    // res.status(200).json(successResponse(result, "Professionals retrieved successfully"));
    const filteredData = result.data.filter((pro) => pro.userid !== user.id);
    res.status(200).json(
      successResponse(
        {
          total: filteredData.length,
          limit: result.limit,
          offset: result.offset,
          user_location: result.user_location,
          data: filteredData,
        },
        "Professionals retrieved successfully"
      )
    );
    return;
  } catch (error: unknown) {
    if (error instanceof Error) {
      console.error("getSortedProfessionals error:", error.message);
      res.status(500).json({ error: error.message });
    } else {
      res.status(500).json({ error: "Unknown server error." });
    }
  }
}

/**
 * Retrieves the authenticated professional's profile.
 *
 * This endpoint:
 * 1. Extracts the authenticated user's email from the request.
 * 2. Validates the user exists in the system.
 * 3. Fetches the professional profile associated with the user's ID.
 * 4. Returns the professional profile details if found.
 *
 * Authentication:
 * - Requires a valid JWT token.
 * - The token must contain `userEmail`.
 *
 * @async
 * @function getprofessionalsProfile
 * @param {AuthRequest} req - Express request object containing authenticated user payload.
 * @param {Response} res - Express response object used to send the response.
 *
 * @returns {Promise<void>} Sends:
 * - 200: Professional profile retrieved successfully.
 * - 401: Unauthorized (missing/invalid user).
 * - 404: Professional profile not found.
 * - 500: Internal server error.
 *
 * @throws {Error} Logs unexpected errors and returns a 500 response.
 */
export async function getprofessionalsProfile(req: AuthRequest, res: Response): Promise<void> {
  try {
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
    if (!user.id) {
      res.status(HTTP_STATUS.UNAUTHORIZED).json(errorResponse("Invalid user ID"));
      return;
    }

    const professionalProfile = await professionalProfileById(user.id);
    if (!professionalProfile) {
      res.status(HTTP_STATUS.NOT_FOUND).json(errorResponse("Professional profile not found"));
      return;
    }

    res.status(HTTP_STATUS.OK).json(successResponse(professionalProfile, "Professional profile retrieved successfully"));
  } catch (error) {
    console.error("Error in professionalsProfile:", error);
    res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json(
      errorResponse(
        "Failed to retrieve professional profile",
        {
          message: error instanceof Error ? error.message : String(error),
        }
      )
    );
  }
}

// eslint-disable-next-line
/**
 * @function updateProfessionalProfile
 * @description
 * Updates the authenticated professional user's profile information.
 * 
 * This API performs the following operations:
 * 1. Validates the authenticated user.
 * 2. Verifies that the user exists in the database.
 * 3. Uploads a new profile image to S3 (if provided as base64).
 * 4. Deletes the previous profile image from S3 (if exists).
 * 5. Updates basic user details (name, email) in the `users` table.
 * 6. Updates profile image in the `professional_accounts` table.
 * 
 * @async
 * @param {AuthRequest} req - Express request object containing authenticated user info and profile update data.
 * @param {Response} res - Express response object used to send API responses.
 * 
 * @body
 * @property {string} [name] - Updated name of the professional.
 * @property {string} [email] - Updated email (must be unique).
 * @property {string} [profileImage] - Base64 encoded image string or existing image key.
 * 
 * @returns {Promise<void>} Sends a JSON response:
 * - 200: Professional profile updated successfully.
 * - 400: Email already in use.
 * - 401: Unauthorized / Invalid user.
 * - 404: User profile not found.
 * - 500: Internal server error.
 * 
 * @throws Will log errors internally and return 500 response if any unexpected failure occurs.
 */
export async function updateProfessionalProfile(req: AuthRequest, res: Response): Promise<void> {
  try {
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

    if (!user.id) {
      res.status(HTTP_STATUS.UNAUTHORIZED).json(errorResponse("Invalid user ID"));
      return;
    }

    const client = getDB();
    await client.query("BEGIN");

    const userId = user.id;
    const { rows: profRows } = await client.query(
      `SELECT id, image_url FROM professional WHERE user_id = $1`,
      [userId]
    );

    const professionalExists = profRows.length > 0;


    if (req.body.profileImage && typeof req.body.profileImage === "string") {
      const isBase64 = /^data:image\/[a-zA-Z]+;base64,/.test(
        req.body.profileImage
      );
      if (isBase64) {
        try {
          const plantName = `${Date.now()}.jpg`; // or `${user.id}_${Date.now()}.jpg`
          const folder = "professional/ProfileImages"; // or any folder name you prefer
          // Fetch old profile image from DB
          const profile_image_url = await getProfessionalProfileById(userId);
          const oldFileKey = profile_image_url || null;

          // Upload new image
          const uploadedFileKey = await uploadBase64ToS3(
            req.body.profileImage,
            plantName,
            folder
          );

          // Delete old image (if exists)
          if (oldFileKey) {
            await deleteFileFromS3(oldFileKey);
          }

          // Assign new file key to request body
          req.body.profileImage = uploadedFileKey;
        } catch (uploadErr: unknown) {
          await error("Image upload to S3 Bucket failed", {
            email: userPayload.userEmail,
            userId: user.id,
            error: (uploadErr as Error).message,
            req,
          });
          res
            .status(HTTP_STATUS.INTERNAL_SERVER_ERROR)
            .json(errorResponse("Failed to upload profile image"));
          return;
        }
      }
    }
    if (req.body.name || req.body.email) {
      if (req.body.email) {
        const { rows: emailCheck } = await client.query(
          `SELECT * FROM users WHERE email = $1 AND id != $2`,
          [req.body.email, userId]
        );

        if (emailCheck.length > 0) {
          res.status(HTTP_STATUS.BAD_REQUEST).json(errorResponse("Email already in use"));
          return;
        }
      }

      await client.query(
        `UPDATE users
         SET name       = COALESCE($1, name),
             email      = COALESCE($2, email),
             updated_at = NOW()
         WHERE id = $3`,
        [req.body.name ?? null, req.body.email ?? null, user.id]
      );
    }

    // ── 3. Update professional_accounts (profile image) ──────────────────────
    const newImage = typeof req.body.profileImage === "string" ? req.body.profileImage : null;
    if (newImage) {
      await client.query(
        `UPDATE professional
         SET image_url = $1::text,
             updated_at    = NOW()
         WHERE user_id = $2`,
        [newImage, userId]
      );
    }

    // ── 4. Update professional_profiles ( category / address) ────
    const { category, address ,description} = req.body;


    if (category || address || description) {

      if (professionalExists) {
        await client.query(
          `UPDATE professional
         SET 
           
           category  = COALESCE($1, category),
           address   = COALESCE($2, address),
          description = COALESCE($3, description),
           updated_at = NOW()
         WHERE user_id = $4`,
          [category ?? null, address ?? null,description ?? null, userId]
        );
      } else {
        res.status(HTTP_STATUS.NOT_FOUND).json(errorResponse("Professional profile not found"));
        return;
      }
    }

    await client.query("COMMIT"); // ✅ SUCCESS

    res
      .status(HTTP_STATUS.OK)
      .json(successResponse(null, "Professional profile updated successfully"));
    return;
  } catch (error) {
    console.error("Error in updateProfessionalProfile:", error);
    res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json(
      errorResponse(
        "Failed to update professional profile",
        {
          message: error instanceof Error ? error.message : String(error),
        }
      )
    );
  }
}

/**
 * Creates a new lead for a professional by the authenticated user.
 *
 * This controller:
 * - Validates the authenticated user from JWT payload
 * - Fetches the user from database using email
 * - Validates user ID
 * - Calls service layer to create a lead entry
 *
 * @async
 * @function leadCreatedByProfessional
 * @param {AuthRequest} req - Express request object containing authenticated user and request body.
 * @param {Response} res - Express response object used to send HTTP responses.
 *
 * @returns {Promise<void>} Sends JSON response with:
 * - 201: If lead is created successfully
 * - 401: If user is unauthorized, not found, or has invalid ID
 * - 500: If an internal server error occurs
 *
 * @throws {Error} Returns 500 status if lead creation fails.
 */
export async function leadCreatedByProfessional(req: AuthRequest, res: Response): Promise<void> {
  try {
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
    if (!user.id) {
      res.status(HTTP_STATUS.UNAUTHORIZED).json(errorResponse("Invalid user ID"));
      return;
    }

    const { professionalIds,description, category, size } = req.body;

    if (!Array.isArray(professionalIds) || professionalIds.length === 0) {
      res.status(HTTP_STATUS.BAD_REQUEST).json(
        errorResponse("professionalIds must be a non-empty array")
      );
      return;
    }

    await leadCreatedByProfessionalService(req.body.professionalIds, user.id, user.email, user.name, description, category, size);
    

    res.status(HTTP_STATUS.CREATED).json(successResponse(null, "Lead created successfully"));
  } catch (error) {
    // console.error("Error in leadCreatedByProfessional:", error);
    // console.error("Error in leadCreatedByProfessional:", error);

    res.status(HTTP_STATUS.OK).json(
      errorResponse(
        error instanceof Error ? error.message : "Failed to create lead"
      )
    );
  }
}


/**
 * Retrieves all leads associated with the authenticated user.
 *
 * This endpoint performs the following steps:
 * 1. Extracts the authenticated user's email from the request payload.
 * 2. Verifies that the user exists in the system.
 * 3. Fetches all leads associated with the user's ID.
 * 4. Returns the leads in a standardized success response.
 *
 * If authentication fails or the user is not found, an `UNAUTHORIZED` response is returned.
 * If an unexpected error occurs, an `INTERNAL_SERVER_ERROR` response is returned.
 *
 * @async
 * @function getAllLeads
 * @param {AuthRequest} req - Express request object containing the authenticated user payload.
 * @param {Response} res - Express response object used to return the API response.
 * @returns {Promise<void>} Resolves when the response is sent.
 *
 * @throws Will return a 401 status if the user is not authenticated or not found.
 * @throws Will return a 500 status if an internal error occurs while retrieving leads.
 */
export async function getAllLeads(req: AuthRequest, res: Response): Promise<void> {
  try {
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
    if (!user.id) {
      res.status(HTTP_STATUS.UNAUTHORIZED).json(errorResponse("Invalid user ID"));
      return;
    }
    const searchQuery = req.query.search as string | undefined;
    const leads = await getAllLeadsForUser(user.id, searchQuery);

    res.status(HTTP_STATUS.OK).json(successResponse(leads, "Leads retrieved successfully"));
  } catch (error) {
    console.error("Error in getAllLeads:", error);
    res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json(
      errorResponse(
        "Failed to retrieve leads",
        {
          message: error instanceof Error ? error.message : String(error),
        }
      )
    );
  }
}

/**
 * Retrieves a professional profile by its ID.
 *
 * This function expects the request to be authenticated. It will:
 *   1. Check if the user is authenticated via `req.user`.
 *   2. Verify the authenticated user exists in the database.
 *   3. Retrieve the professional profile corresponding to the `id` parameter.
 *
 * @async
 * @function getprofessionalsById
 * @param {AuthRequest} req - The request object containing user info and route parameters.
 * @param {Response} res - The response object used to send the API response.
 *
 * @returns {Promise<void>} - Sends a JSON response with either:
 *   - 200 OK: the professional profile if found.
 *   - 400 Bad Request: if `id` is missing.
 *   - 401 Unauthorized: if user is not authenticated or not found.
 *   - 404 Not Found: if professional profile is not found.
 *   - 500 Internal Server Error: if any unexpected error occurs.
 *
 * @example
 * // Example usage in Express
 * router.get("/getProfessionalsById/:id", auth, getprofessionalsById);
 */
export async function getprofessionalsById(req: AuthRequest, res: Response): Promise<void> {
  try {
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

    const professionalId = req.params.id;
    if (!professionalId) {
      res.status(HTTP_STATUS.BAD_REQUEST).json(errorResponse("Professional ID is required"));
      return;
    }

    const professionalProfile = await getProfessionalProfileByIdService(professionalId);
    if (!professionalProfile) {
      res.status(HTTP_STATUS.NOT_FOUND).json(errorResponse("Professional profile not found"));
      return;
    }

    res.status(HTTP_STATUS.OK).json(successResponse(professionalProfile, "Professional profile retrieved successfully"));
  } catch (error) {
    console.error("Error in getprofessionalsById:", error);
    res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json(
      errorResponse(
        "Failed to retrieve professional profile",
        {
          message: error instanceof Error ? error.message : String(error),
        }
      )
    );
  }
}


/**
 * Handles the process of sending leads to wholesalers for a user.
 * 
 * This function verifies the user's authentication, checks for valid input, 
 * and then passes the lead data to the `leadForwholesalerService` to send to 
 * the specified wholesalers.
 * 
 * @param {AuthRequest} req - The request object containing the user's info and lead data.
 * @param {Response} res - The response object used to send the response to the client.
 * @returns {Promise<void>} A promise that resolves to nothing.
 * 
 * @throws {Error} Will return a `400` status with an error message if the request is invalid.
 * Will return a `401` status if the user is not authorized.
 */
export async function leadForWholesaler(req: AuthRequest, res: Response): Promise<void> {
  try {
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
    if (!user.id) {
      res.status(HTTP_STATUS.UNAUTHORIZED).json(errorResponse("Invalid user ID"));
      return;
    }
    const { wholesalerIds } = req.body;

    if (!Array.isArray(wholesalerIds) || wholesalerIds.length === 0) {
      res.status(HTTP_STATUS.BAD_REQUEST).json(
        errorResponse("professionalIds must be a non-empty array")
      );
      return;
    }

    await leadForwholesalerService(user.id, wholesalerIds);

    res.status(HTTP_STATUS.CREATED).json(successResponse(null, "Leads sent to wholesalers successfully"));
  } catch (error) {
    console.error("Error in leadForWholesaler:", error);
    res.status(HTTP_STATUS.BAD_REQUEST).json(
      errorResponse(
        error instanceof Error ? error.message : "Failed to create lead for wholesaler"
      )
    );
  }

}

/**
 * Updates the professional profile by an admin.
 * 
 * This function is responsible for allowing an admin to update a professional's profile.
 * It first verifies the user's authentication and authorization status, then checks 
 * if the professional ID is provided, and finally updates the professional profile 
 * using the `updateProfessionalByAdminService`.
 * 
 * @param {AuthRequest} req - The request object that contains user information in the `req.user` payload.
 * @param {Response} res - The response object used to send the HTTP response.
 * 
 * @returns {Promise<void>} - Resolves to void, but sends a response back to the client indicating success or failure.
 * 
 * @throws {Error} - If an unexpected error occurs during the process, an internal server error is sent.
 */
export async function updateProfessionalByAdmin(req: AuthRequest, res: Response): Promise<void> {
  try {
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
      res.status(HTTP_STATUS.FORBIDDEN).json(errorResponse("Access denied: Admins only"));
      return;
    }
    const professionalId = Number(req.params.id);

    if(isNaN(professionalId)) {
      res.status(HTTP_STATUS.BAD_REQUEST).json(errorResponse("Invalid professional ID"));
      return;
    }

    if (!professionalId) {
      res.status(HTTP_STATUS.BAD_REQUEST).json(errorResponse("Professional ID is required"));
      return;
    }
    //  console.log("and data:", req.body);
    await updateProfessionalByAdminService(professionalId, req.body);

    res.status(HTTP_STATUS.OK).json(successResponse(null, "Professional profile updated successfully by admin"));
  } catch (error) {
    console.error("Error in updateProfessionalByAdmin:", error);
    res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json(
      errorResponse(
        "Failed to update professional profile",
        {
          message: error instanceof Error ? error.message : String(error),
        }
      )
    );
  }
};
/**
 * Updates the professional rating by an admin.
 * 
 * This function allows an admin to update the rating of a professional. It first ensures 
 * that the user is authenticated and has an admin role. It then validates the provided 
 * professional ID and rating before calling the service to update the professional's rating.
 * 
 * @param {AuthRequest} req - The request object containing user information (in `req.user`) and the rating data in `req.body`.
 * @param {Response} res - The response object used to send the HTTP response back to the client.
 * 
 * @returns {Promise<void>} - Resolves to void but sends an appropriate response to the client indicating success or failure.
 * 
 * @throws {Error} - If an unexpected error occurs, an internal server error is returned to the client.
 */
export async function updateRatingByAdmin(req: AuthRequest, res: Response): Promise<void> {
  try {
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
      res.status(HTTP_STATUS.FORBIDDEN).json(errorResponse("Access denied: Admins only"));
      return;
    }
    const { professionalId, rating } = req.body;
    if (!professionalId) {
      res.status(HTTP_STATUS.BAD_REQUEST).json(errorResponse("Professional ID is required"));
      return;
    }
    if (typeof rating !== "number" || rating < 0 || rating > 5) {
      res.status(HTTP_STATUS.BAD_REQUEST).json(errorResponse("Rating must be a number between 0 and 5"));
      return;
    }

    await updateRatingByAdminService(professionalId, rating);
    res.status(HTTP_STATUS.OK).json(successResponse(null, "Professional rating updated successfully by admin"));
  } catch (error) {
    console.error("Error in updateRatingByAdmin:", error);
    res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json(
      errorResponse(
        "Failed to update professional rating",
        {
          message: error instanceof Error ? error.message : String(error),
        }
      )
    );
  }
};


/**
 * Controller to update the status of a lead based on the provided ID.
 * It first verifies the user's authentication and finds the user by email,
 * then calls the service to update the lead's status.
 * 
 * @param {AuthRequest} req - The request object, which contains the user and lead ID.
 * @param {Response} res - The response object to send the result back to the client.
 * @param {NextFunction} next - The next middleware function to handle any errors.
 * @returns {Promise<Response | void>} A promise that resolves to a response, or void if an error occurs.
 */
export const updateStatusOfLeadsController = async (
  req: AuthRequest,
  res: Response,
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
    const { id } = req.params;
    await updateLeadStatusService(id!);

    res.status(200).json(successResponse(null, "Lead status updated successfully"));

  } catch (error) {
    const err = error as Error;
    return res.status(500).json({
      success: false,
      message: err.message || "Something went wrong",
    });
  }
};


/**
 * Get professional profile by ID (Admin only)
 * 
 * This controller retrieves a professional's profile using their ID.
 * Access is restricted to users with the Admin role.
 *
 * @async
 * @function getprofessionalsByIdByAdmin
 * @param {AuthRequest} req - Express request object containing:
 *   - user: Authenticated user payload (email, role)
 *   - params.id: ID of the professional (string)
 * @param {Response} res - Express response object
 *
 * @returns {Promise<void>} Sends JSON response with professional data or error message
 *
 * @throws {401} Unauthorized - If user is not authenticated or not found
 * @throws {403} Forbidden - If user is not an Admin
 * @throws {400} Bad Request - If professional ID is invalid or missing
 * @throws {404} Not Found - If professional profile does not exist
 * @throws {500} Internal Server Error - If an unexpected error occurs
 */
export const getprofessionalsByIdByAdmin = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
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
      res.status(HTTP_STATUS.FORBIDDEN).json(errorResponse("Access denied: Admins only"));
      return;
    }

    const professionalId = Number(req.params.id);

if (isNaN(professionalId)) {
     res.status(400).json({ message: "Invalid professional ID" });
     return;
}
    if (!professionalId) {
      res.status(HTTP_STATUS.BAD_REQUEST).json(errorResponse("Professional ID is required"));
      return;
    }

    const professionalProfile = await getProfessionalProfileByIdByAdminService(professionalId);
    if (!professionalProfile) {
      res.status(HTTP_STATUS.NOT_FOUND).json(errorResponse("Professional profile not found"));
      return;
    }

    res.status(HTTP_STATUS.OK).json(successResponse(professionalProfile, "Professional profile retrieved successfully"));
  }
    catch (error) {
      console.error("Error in getprofessionalsByIdByAdmin:", error);
      res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json(
        errorResponse(
          "Failed to retrieve professional profile",
          {
            message: error instanceof Error ? error.message : String(error),
          }
        )
      );
    }
}

/**
 * Updates the founder status of a professional.
 *
 * This endpoint is restricted to Admin users only. It validates:
 * - Authentication (user must be logged in)
 * - Authorization (must have Admin role)
 * - Valid professional ID
 * - Normalizes `is_founder` input from request body
 *
 * @route PATCH /professionals/:id/founder-status
 *
 * @param {AuthRequest} req - Express request object containing authenticated user and input data
 * @param {Response} res - Express response object
 *
 * @returns {Promise<void>} Sends appropriate HTTP response:
 * - 200: Founder status updated successfully
 * - 400: Invalid or missing professional ID
 * - 401: Unauthorized or user not found
 * - 403: Access denied (non-admin)
 * - 500: Internal server error
 */
export const updateFounderStatus = async (req:AuthRequest, res: Response): Promise<void> => {
  try {
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
      res.status(HTTP_STATUS.FORBIDDEN).json(errorResponse("Access denied: Admins only"));
      return;
    }
    const professionalId = Number(req.params.id);
    if (isNaN(professionalId)) {
      res.status(HTTP_STATUS.BAD_REQUEST).json(errorResponse("Invalid professional ID"));
      return;
    }
   const rawValue = req.body.is_founder;

    const is_founder =
      rawValue === true ||
      rawValue === "true" ||
      rawValue === 1 ||
      rawValue === "1";
    

    if (!professionalId) {
      res.status(HTTP_STATUS.BAD_REQUEST).json(errorResponse("Professional ID is required"));
      return;
    }
    await updateFounderStatusService(professionalId, is_founder);
    res.status(HTTP_STATUS.OK).json(successResponse(null, "Professional founder status updated successfully by admin"));
  } catch (error) {
    console.error("Error in updateFounderStatus:", error);
    res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json(
      errorResponse(
        "Failed to update professional founder status",
        {
          message: error instanceof Error ? error.message : String(error),
        }
      )
    );
  } 
};
