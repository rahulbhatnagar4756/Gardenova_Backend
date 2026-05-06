import { Response, NextFunction } from "express";
import {
  successResponse,
  errorResponse,
} from "../../core/utils/responseFormatter";
import { HTTP_STATUS, MESSAGES } from "../../core/utils/constants";
import { error, warn } from "../../core/utils/logger";
import { CustomError } from "../../interface/Error";
import { findUserByEmail } from "../auth/authRepository";
import { getDB } from "../../core/config/db";
import { IFullUserProfile, IUserProfileRow } from "../../interface/userProfile";
import {
  getUserProfileById,
  updateValidatedUserProfile,
} from "./userProfileModel";
import {
  deleteFileFromS3,
  getSignedFileUrl,
  uploadBase64ToS3,
} from "../../core/services/s3UploadService";
import { AuthRequest } from "../../interface/auth";

/**
 * Retrieves the currently authenticated user's profile.
 *
 * Validates the user's email from the request, ensures the user exists,
 * and fetches their profile from the database. If no profile is found,
 * responds with appropriate error messages. Otherwise, returns the
 * profile data in the response.
 *
 * @param req - Express request object extended with authenticated user data.
 * @param res - Express response object used to send HTTP responses.
 * @param next - Express next function for passing errors to error-handling middleware.
 * @returns A promise that resolves to void.
 */
export const getCurrentUserProfile = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  const userPayload = req.user as { userEmail?: string } | undefined;

  if (!userPayload?.userEmail) {
    res
      .status(HTTP_STATUS.UNAUTHORIZED)
      .json(errorResponse("Unauthorized request"));
    return;
  }

  try {
    // 1. Get user basic details
    const user = await findUserByEmail(userPayload.userEmail);
    if (!user) {
      await error("Profile retrieval failed - User not found", {
        email: userPayload.userEmail,
        action: "getCurrentUserProfile",
        req,
      });
      res
        .status(HTTP_STATUS.NOT_FOUND)
        .json(errorResponse(MESSAGES.PROFILE_USER_NOTFOUND));
      return;
    }

    const client = getDB();

    // 2. Run both queries in parallel
    //  const client = getDB();

    const { rows: profileRows } = await client.query<IUserProfileRow>(
      `
      SELECT
        profile_image,
        date_of_birth,
        gender,
        bio,
        street,
        city,
        state,
        country,
        zip_code,
        occupation,
        company
      FROM userprofiles
      WHERE user_id = $1
      `,
      [user.id]
    );

    const userProfile: IUserProfileRow | null = profileRows[0] ?? null;

    const fullProfile: IFullUserProfile = {
      name: user.name ?? null,
      email: user.email ?? null,
      contactNumber: user.phone_number ?? null,
      profileImage: userProfile?.profile_image
        ? (await getSignedFileUrl(userProfile.profile_image)) ?? null
        : null,
      dateOfBirth: userProfile?.date_of_birth
        ? new Date(userProfile.date_of_birth).toISOString().split("T")[0]
        : null,
      gender: (userProfile?.gender ?? null) as "male" | "female" | "other" | null,
      bio: userProfile?.bio ?? null,
      address: {
        street: userProfile?.street ?? null,
        city: userProfile?.city ?? null,
        state: userProfile?.state ?? null,
        country: userProfile?.country ?? null,
        zipCode: userProfile?.zip_code ?? null,
      },
      occupation: userProfile?.occupation ?? null,
      company: userProfile?.company ?? null,
    };

    res.status(HTTP_STATUS.OK).json(successResponse(
      fullProfile,
      "User profile retrieved successfully"
    ));
  } catch (err: unknown) {
    const errorObj: CustomError =
      err instanceof Error
        ? (err as CustomError)
        : ({
          name: "UnknownError",
          message:
            typeof err === "string" ? err : "An unknown error occurred",
        } as CustomError);

    await error("Profile retrieval error", {
      email: userPayload?.userEmail,
      error: errorObj.message,
      stack: errorObj.stack,
      action: "getCurrentUserProfile",
      req,
    });

    next(errorObj);
  }
};
/**
 * Updates the authenticated user's profile.
 *
 * Validates the user from the request, checks if the profile exists,
 * and updates the profile with the provided data. If the profile or
 * user is not found, responds with an error. Otherwise, updates the
 * profile and returns a success response.
 *
 * @param req - Express request object extended with authenticated user data and update fields.
 * @param res - Express response object used to send HTTP responses.
 * @param next - Express next function for forwarding errors to middleware.
 * @returns A promise that resolves to void.
 */
export const updateUserProfile = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  const userPayload = req.user as { userEmail?: string } | undefined;

  if (!userPayload?.userEmail) {
    res
      .status(HTTP_STATUS.UNAUTHORIZED)
      .json(errorResponse("Unauthorized request"));
    return;
  }

  try {
    //  Find user
    const user = await findUserByEmail(userPayload.userEmail);
    if (!user) {
      await error("Profile update failed - User not found", {
        email: userPayload.userEmail,
        action: "updateUserProfile",
        req,
      });
      res
        .status(HTTP_STATUS.NOT_FOUND)
        .json(errorResponse(MESSAGES.PROFILE_USER_NOTFOUND));
      return;
    }

    const client = getDB();

    //  Find existing profile
    const { rows: existingProfileRows } = await client.query(
      `SELECT id FROM userprofiles WHERE user_id = $1`,
      [user.id]
    );

    if (existingProfileRows.length === 0) {
      await warn("Profile update failed - Profile not found", {
        email: userPayload.userEmail,
        userId: user.id,
        action: "updateUserProfile",
        req,
      });
      res
        .status(HTTP_STATUS.NOT_FOUND)
        .json(errorResponse("User profile not found"));
      return;
    }

    const profileId = existingProfileRows[0].id;

    // Handle base64 image upload
    if (req.body.profileImage && typeof req.body.profileImage === "string") {
      const isBase64 = /^data:image\/[a-zA-Z]+;base64,/.test(
        req.body.profileImage
      );
      if (isBase64) {
        try {
          const plantName = `${Date.now()}.jpg`; // or `${user.id}_${Date.now()}.jpg`
          const folder = "Users/ProfileImages"; // or any folder name you prefer
          // Fetch old profile image from DB
          const oldProfile = await getUserProfileById(profileId);
          const oldFileKey = oldProfile?.profile_image || null;

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

    // Validate and update using your service method
    const updatedProfile = await updateValidatedUserProfile(
      profileId,
      req.body
    );

    if (!updatedProfile) {
      await warn("Profile update failed - No record updated", {
        email: userPayload.userEmail,
        userId: user.id,
        req,
      });
      res
        .status(HTTP_STATUS.NOT_FOUND)
        .json(errorResponse("User profile not found"));
      return;
    }
    res
      .status(HTTP_STATUS.OK)
      .json(successResponse(null, MESSAGES.PROFILE_UPDATED));
  } catch (err: unknown) {
    const errorObj: CustomError =
      err instanceof Error
        ? (err as CustomError)
        : ({
          name: "UnknownError",
          message: "An unknown error occurred",
        } as CustomError);

    await error("Profile updation error", {
      email: userPayload?.userEmail,
      error: errorObj.message,
      stack: errorObj.stack,
      action: "updateUserProfile",
      req,
    });

    next(errorObj);
  }
};


/**
 * Soft deletes the current user's profile by setting `is_deleted = true`.
 * 
 * This endpoint:
 * - Requires authentication (retrieves user's email from JWT in `req.user`).
 * - Marks the user's profile as deleted without removing the record from the database.
 * - Handles cases where the user or profile is not found.
 * - Returns appropriate HTTP status codes based on the operation result.
 *
 * @param {AuthRequest} req - Express request object with `user` payload from authentication middleware.
 * @param {Response} res - Express response object used to send HTTP responses.
 * @param {NextFunction} next - Express next function for error handling middleware.
 * 
 * @returns {Promise<void>} - Sends HTTP response directly; does not return a value.
 * 
 * @throws {CustomError} - Passes unknown errors to the next middleware.
 * 
 * @example
 * // Using Express route
 * router.delete('/api/v1/userProfile/soft-delete', softDeleteUserProfile);
 *
 * Responses:
 *  - 200 OK: Profile soft deleted successfully
 *  - 401 Unauthorized: Missing or invalid authentication token
 *  - 404 Not Found: User or profile not found
 *  - 410 Gone: Profile already soft deleted
 *  - 500 Internal Server Error: Unexpected server error
 */
export const softDeleteUserProfile = async (
  req: AuthRequest,
  res: Response,

  next: NextFunction
): Promise<void> => {
  const userPayload = req.user as { userEmail?: string } | undefined;

  if (!userPayload?.userEmail) {
    res
      .status(HTTP_STATUS.UNAUTHORIZED)
      .json(errorResponse("Unauthorized request"));
    return;
  }

  try {

    //  Find user

    const user = await findUserByEmail(userPayload.userEmail);

    if (!user) {
      await error("Profile soft delete failed - User not found", {
        email: userPayload.userEmail,
        action: "softDeleteUserProfile",
        req,
      });
      res
        .status(HTTP_STATUS.NOT_FOUND)
        .json(errorResponse(MESSAGES.PROFILE_USER_NOTFOUND));
      return;
    }

    const client = getDB();
    //  Find existing profile

    const checkProfileResult = await client.query(
      `SELECT isdeleted FROM users WHERE id = $1`,
      [user.id]
    );


    if (checkProfileResult.rowCount === 0) {
      await warn("Profile soft delete failed - Profile not found", {
        email: userPayload.userEmail,
        userId: user.id,
        action: "softDeleteUserProfile",
        req,
      });
        res.status(HTTP_STATUS.NOT_FOUND).json(errorResponse("User profile not found"));

    }
    if (checkProfileResult.rows[0]?.isdeleted) {
      res
        .status(HTTP_STATUS.GONE)
        .json(errorResponse("User profile already deleted"));
      return;
    }


    const result = await client.query(
      `UPDATE users SET isdeleted = true WHERE id  = $1 RETURNING id`,
      [user.id]
    );
    if (result.rowCount === 0) {
      await warn("Profile soft delete failed - Profile not found", {
        email: userPayload.userEmail,
        userId: user.id,
        action: "softDeleteUserProfile",
        req,
      });
    }
    res
      .status(HTTP_STATUS.OK)
      .json(successResponse(null, "User profile soft deleted successfully"));
  }

  catch (err: unknown) {

    const errorObj: CustomError =
      err instanceof Error
        ? (err as CustomError)
        : ({
          name: "UnknownError",
          message: "An unknown error occurred",
        }

        );

    await error("Profile soft deletion error", {
      email: userPayload?.userEmail,
      error: errorObj.message,
      stack: errorObj.stack,
      action: "softDeleteUserProfile",
      req,
    });

    next(errorObj);
  }
}