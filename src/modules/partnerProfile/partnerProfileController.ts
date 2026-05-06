import { Response, NextFunction } from "express";
import {
  successResponse,
  errorResponse,
} from "../../core/utils/responseFormatter";
import { HTTP_STATUS, MESSAGES } from "../../core/utils/constants";
import { error } from "../../core/utils/logger";
import {
  createPartnerProfile,
  deletePartnerProfileDb,
  findPartnerProfileByEmail,
  getAllPartnerProfilesDb,
  getPartnerProfileById,
  updatePartnerProfileDb,
  updatePartnerStatus,
  updateRating,
} from "./partnerProfileModel";
import { findUserByEmail } from "../auth/authRepository";
import { AuthUserPayload } from "../../interface/user";
import {
  getSignedFileUrl,
  uploadBase64ToS3,
} from "../../core/services/s3UploadService";
import { AuthRequest } from "../../interface/auth";

/**
 * Handles the creation of a new partner profile.
 * Extracts the authenticated user payload, validates request data,
 * and inserts the partner profile into the database.
 *
 * @param req - The authenticated request object containing user data and profile payload.
 * @param res - The response object used to send the result to the client.
 * @param next - The Next.js middleware function used for error handling.
 */
export const createPartnerProfileController = async (
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
    const existing = await findPartnerProfileByEmail(req.body.email);
    if (existing) {
      res
        .status(HTTP_STATUS.CONFLICT)
        .json(errorResponse("Partner profile already exists"));
      return;
    }

    let projectImageUrl = req.body.projectImageUrl;

    // Handle optional base64 image upload to S3
    if (projectImageUrl) {
      const isBase64Image = /^data:image\/[a-zA-Z]+;base64,/.test(
        projectImageUrl
      );

      if (isBase64Image) {
        try {
          const s3Key = await uploadBase64ToS3(
            projectImageUrl,
            `partnerprofile_${Date.now()}.png`,
            "Admin/PartnerImages/ProfileImages"
          );
          projectImageUrl = s3Key; // store S3 key or URL
        } catch (err) {
          console.error("S3 Upload failed:", err);
          res
            .status(HTTP_STATUS.BAD_REQUEST)
            .json(errorResponse("Image upload failed"));
          return;
        }
      } else if (
        !/^https?:\/\/.+\.(jpg|jpeg|png|webp|gif)$/i.test(projectImageUrl)
      ) {
        // Not base64 and not a valid image URL
        res
          .status(HTTP_STATUS.BAD_REQUEST)
          .json(
            errorResponse("Invalid image format. Must be base64 or image URL.")
          );
        return;
      }
    }

    await createPartnerProfile({
      ...req.body,
      projectImageUrl,
    });

    res
      .status(HTTP_STATUS.CREATED)
      .json(successResponse(null, MESSAGES.PROFILE_CREATED));
  } catch (err) {
    next(err);
  }
};

/**
 * Retrieves all partner profiles from the database and returns them in the response.
 *
 * @param req - The incoming request object.
 * @param res - The response object used to send back the list of partner profiles.
 * @param next - The next middleware function for handling errors.
 */
export const getAllPartnerProfiles = async (
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
    // Extract pagination params from query
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 5;
    const offset = (page - 1) * limit;

    // Fetch paginated data + total count
    const { profiles, totalCount } = await getAllPartnerProfilesDb(
      limit,
      offset
    );

    const totalPages = Math.ceil(totalCount / limit);

    res.status(HTTP_STATUS.OK).json(
      successResponse({
        currentPage: page,
        totalPages,
        totalCount,
        limit,
        profiles,
      })
    );
  } catch (err) {
    next(err);
  }
};

/**
 * Updates an existing partner profile based on the provided request data.
 *
 * @param req - The request object containing profile update data and user authentication.
 * @param res - The response object used to return the update result to the client.
 * @param next - The middleware function used to handle errors.
 */
export const updatePartnerProfile = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const userPayload = req.user as AuthUserPayload | undefined;

    // 🔒 Authorization checks
    if (!userPayload?.userEmail) {
      res.status(HTTP_STATUS.UNAUTHORIZED).json(errorResponse("Unauthorized"));
      return;
    }

    const user = await findUserByEmail(userPayload.userEmail);
    if (!user || userPayload.role !== "Admin") {
      res
        .status(HTTP_STATUS.UNAUTHORIZED)
        .json(errorResponse("Unauthorized Role"));
      return;
    }

    const { id } = req.params;
    const profile = await getPartnerProfileById(id!);
    if (!profile) {
      res
        .status(HTTP_STATUS.NOT_FOUND)
        .json(errorResponse("Partner profile not found"));
      return;
    }

    // Handle image upload (S3)
    let projectImageUrl = req.body.projectImageUrl;

    if (projectImageUrl) {
      const isBase64Image = /^data:image\/[a-zA-Z]+;base64,/.test(
        projectImageUrl
      );

      if (isBase64Image) {
        try {
          const s3Key = await uploadBase64ToS3(
            projectImageUrl,
            `partnerprofile_${Date.now()}.png`,
            "Admin/PartnerImages/ProfileImages"
          );
          projectImageUrl = s3Key;
        } catch (err) {
          console.error("S3 Upload failed:", err);
          res
            .status(HTTP_STATUS.BAD_REQUEST)
            .json(errorResponse("Image upload failed"));
          return;
        }
      } else {
        projectImageUrl = profile.project_image_url;
      }
    }

    // Call DB update
    await updatePartnerProfileDb(id!, req.body, projectImageUrl);

    res
      .status(HTTP_STATUS.OK)
      .json(successResponse(null, "Profile updated successfully"));
  } catch (err: unknown) {
    const errorObj =
      err instanceof Error ? err : new Error("Unknown error occurred");
    await error("Partner profile update error", { error: errorObj.message });
    next(errorObj);
  }
};

/**
 * Updates the rating of a specific partner profile by their partnerId.
 * Accepts partnerId and rating in the request body.
 *
 * @param req Express request object
 * @param res Express response object
 * @param next Express next middleware function
 */
export const updatePartnerRating = async (
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
  const { partnerId, rating } = req.body;
  try {
    const updatedProfile = await updateRating(partnerId, rating);

    if (!updatedProfile) {
      await error("Partner rating update failed - Profile not found", {
        partnerId,
      });
      res
        .status(HTTP_STATUS.NOT_FOUND)
        .json(errorResponse("Partner profile not found"));
      return;
    }

    res
      .status(HTTP_STATUS.OK)
      .json(successResponse(null, "Rating updated successfully"));
    return;
  } catch (err: unknown) {
    const errorObj = err instanceof Error ? err : new Error("Unknown error");
    await error("Partner rating update error", {
      partnerId,
      error: errorObj.message,
      stack: errorObj.stack,
    });

    next(errorObj);
  }
};

/**
 * Updates the status of a specific partner profile by their partnerId.
 * Accepts partnerId and status in the request body.
 *
 * @param req Express request object
 * @param res Express response object
 * @param next Express next middleware function
 */
export const updatePartnerStatusController = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  const userPayload = req.user as AuthUserPayload | undefined;

  // Check for authentication
  if (!userPayload?.userEmail) {
    res.status(HTTP_STATUS.UNAUTHORIZED).json(errorResponse("Unauthorized"));
    return;
  }

  // Check if user exists
  const user = await findUserByEmail(userPayload.userEmail);
  if (!user) {
    res.status(HTTP_STATUS.UNAUTHORIZED).json(errorResponse("User not found"));
    return;
  }

  // Only Admins can update partner status
  if (userPayload.role !== "Admin") {
    res
      .status(HTTP_STATUS.UNAUTHORIZED)
      .json(errorResponse("Unauthorized Role"));
    return;
  }

  const { partnerId, status } = req.body;

  // Validate input
  if (!partnerId || !status) {
    res
      .status(HTTP_STATUS.BAD_REQUEST)
      .json(errorResponse("partnerId and status are required"));
    return;
  }

  try {
    // Update partner status in DB
    const updatedProfile = await updatePartnerStatus(partnerId, status);

    if (!updatedProfile) {
      await error("Partner status update failed - Profile not found", {
        partnerId,
      });
      res
        .status(HTTP_STATUS.NOT_FOUND)
        .json(errorResponse("Partner profile not found"));
      return;
    }

    // Success response
    res
      .status(HTTP_STATUS.OK)
      .json(successResponse(null, "Status updated successfully"));
  } catch (err: unknown) {
    const errorObj = err instanceof Error ? err : new Error("Unknown error");

    // Log internal error
    await error("Partner status update error", {
      partnerId,
      error: errorObj.message,
      stack: errorObj.stack,
    });

    next(errorObj);
  }
};

/**
 * Deletes a partner profile based on the provided ID in the request parameters.
 *
 * @param req - The request object containing the partner profile ID to delete.
 * @param res - The response object used to send back the deletion result.
 * @param next - The middleware function for passing errors to the global handler.
 */
export const deletePartnerProfile = async (
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
  const { id } = req.params;

  try {
    const deleted = await deletePartnerProfileDb(id!);

    if (deleted === 0) {
      await error("Partner profile deletion failed - Profile not found", {
        id,
      });
      res
        .status(HTTP_STATUS.NOT_FOUND)
        .json(errorResponse("Partner profile not found"));
      return;
    }

    res
      .status(HTTP_STATUS.OK)
      .json(successResponse(null, MESSAGES.PROFILE_DELETED));
    return;
  } catch (err: unknown) {
    const errorObj =
      err instanceof Error ? err : new Error("An unknown error occurred");

    await error("Partner profile deletion error", {
      id,
      error: errorObj.message,
      stack: errorObj.stack,
    });

    next(errorObj);
  }
};

/**
 * Retrieves a specific partner profile by ID and returns it in the response.
 *
 * @param req - The incoming request object containing the partner profile ID in the params.
 * @param res - The response object used to send back the partner profile data.
 * @param next - The next middleware function for error handling.
 */
export const getPartnerProfileByIdController = async (
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
    const { id } = req.params;

    if (!id) {
      res
        .status(HTTP_STATUS.BAD_REQUEST)
        .json(errorResponse("Partner profile ID is required"));
      return;
    }

    const profile = await getPartnerProfileById(id);

    const formatted = {
      id: profile?.id,
      email: profile?.email,
      mobileNumber: profile?.mobile_number,
      companyName: profile?.company_name,
      speciality: [
        profile?.speciality_1,
        profile?.speciality_2,
        profile?.speciality_3,
      ].filter(Boolean),
      address: {
        street: profile?.street,
        city: profile?.city,
        state: profile?.state,
        country: profile?.country,
        zipCode: profile?.zip_code,
      },
      website: profile?.website,
      contactPerson: profile?.contact_person,
      projectImageUrl:
        (await getSignedFileUrl(profile?.project_image_url!)) || "",
      status: profile?.status,
      rating: profile?.rating,
    };

    if (!profile) {
      res
        .status(HTTP_STATUS.NOT_FOUND)
        .json(errorResponse("Partner profile not found"));
      return;
    }

    res.status(HTTP_STATUS.OK).json(successResponse(formatted));
  } catch (err) {
    next(err);
  }
};
