import { Response, NextFunction } from "express";
import {
  successResponse,
  errorResponse,
} from "../../core/utils/responseFormatter";
import { HTTP_STATUS, MESSAGES } from "../../core/utils/constants";
import { error, warn } from "../../core/utils/logger";
import { CustomError } from "../../interface/Error";
import { findUserByEmail, findUserById, getRoleById, hashPassword } from "../auth/authRepository";
import { getDB } from "../../core/config/db";
import { IFullUserProfile, IUserProfileRow } from "../../interface/userProfile";
import {
  getUserProfileById,
  saveEmailVerificationCode,
  updateValidatedUserProfile,
} from "./userProfileModel";
import env from "../../core/config/env";
import { AuthRequest } from "../../interface/auth";
import fs from "fs";
import path from "path";
import crypto from "crypto";
import { sendVerificationEmail } from "../../core/services/emailService";
import { generateToken } from "../../core/utils/usableMethods";


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

    const answerResponse = await client.query(
      `
    SELECT response_id
    FROM survey_answers
    WHERE user_id = $1
    ORDER BY created_at DESC
    LIMIT 1
  `,
      [user.id]
    );
    const responseId = answerResponse.rows[0]?.response_id ?? null;

    // Build the base URL from the incoming request (e.g. http://localhost:3000)
    // const baseUrl = `${req.protocol}://${req.get("host")}`;
    const baseUrl = env.APPDEV_URL || `${req.protocol}://${req.get("host")}`;

    const fullProfile: IFullUserProfile = {
      name: user.name ?? null,
      email: user.email ?? null,
      contactNumber: user.phone_number ?? null,
      is_email_verified: user.is_email_verified ?? false,
      // eslint-disable-next-line eqeqeq
      is_sso_user: user.password == null, // If password is null, it's likely an SSO user

      // Convert stored relative path → accessible URL
      // e.g. "uploads/Users/ProfileImages/123.jpg"
      //   → "http://localhost:3000/uploads/Users/ProfileImages/123.jpg"
      profileImage: userProfile?.profile_image
        ? `${baseUrl}/${userProfile.profile_image.replace(/\\/g, "/")}`
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
      responseId: responseId,
    };

    res
      .status(HTTP_STATUS.OK)
      .json(successResponse(fullProfile, "User profile retrieved successfully"));
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
// export const getCurrentUserProfile = async (
//   req: AuthRequest,
//   res: Response,
//   next: NextFunction
// ): Promise<void> => {
//   const userPayload = req.user as { userEmail?: string } | undefined;

//   if (!userPayload?.userEmail) {
//     res
//       .status(HTTP_STATUS.UNAUTHORIZED)
//       .json(errorResponse("Unauthorized request"));
//     return;
//   }

//   try {
//     // 1. Get user basic details
//     const user = await findUserByEmail(userPayload.userEmail);
//     if (!user) {
//       await error("Profile retrieval failed - User not found", {
//         email: userPayload.userEmail,
//         action: "getCurrentUserProfile",
//         req,
//       });
//       res
//         .status(HTTP_STATUS.NOT_FOUND)
//         .json(errorResponse(MESSAGES.PROFILE_USER_NOTFOUND));
//       return;
//     }

//     const client = getDB();

//     // 2. Run both queries in parallel
//     //  const client = getDB();

//     const { rows: profileRows } = await client.query<IUserProfileRow>(
//       `
//       SELECT
//         profile_image,
//         date_of_birth,
//         gender,
//         bio,
//         street,
//         city,
//         state,
//         country,
//         zip_code,
//         occupation,
//         company
//       FROM userprofiles
//       WHERE user_id = $1
//       `,
//       [user.id]
//     );

//     const userProfile: IUserProfileRow | null = profileRows[0] ?? null;

//     const fullProfile: IFullUserProfile = {
//       name: user.name ?? null,
//       email: user.email ?? null,
//       contactNumber: user.phone_number ?? null,
//       profileImage: userProfile?.profile_image
//         ? (await getSignedFileUrl(userProfile.profile_image)) ?? null
//         : null,
//       dateOfBirth: userProfile?.date_of_birth
//         ? new Date(userProfile.date_of_birth).toISOString().split("T")[0]
//         : null,
//       gender: (userProfile?.gender ?? null) as "male" | "female" | "other" | null,
//       bio: userProfile?.bio ?? null,
//       address: {
//         street: userProfile?.street ?? null,
//         city: userProfile?.city ?? null,
//         state: userProfile?.state ?? null,
//         country: userProfile?.country ?? null,
//         zipCode: userProfile?.zip_code ?? null,
//       },
//       occupation: userProfile?.occupation ?? null,
//       company: userProfile?.company ?? null,
//     };

//     res.status(HTTP_STATUS.OK).json(successResponse(
//       fullProfile,
//       "User profile retrieved successfully"
//     ));
//   } catch (err: unknown) {
//     const errorObj: CustomError =
//       err instanceof Error
//         ? (err as CustomError)
//         : ({
//           name: "UnknownError",
//           message:
//             typeof err === "string" ? err : "An unknown error occurred",
//         } as CustomError);

//     await error("Profile retrieval error", {
//       email: userPayload?.userEmail,
//       error: errorObj.message,
//       stack: errorObj.stack,
//       action: "getCurrentUserProfile",
//       req,
//     });

//     next(errorObj);
//   }
// };
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
    if (!user.id) {
      await error("Profile update failed - User ID missing", {
        email: userPayload.userEmail,
        action: "updateUserProfile",
        req,
      });
      res
        .status(HTTP_STATUS.INTERNAL_SERVER_ERROR)
        .json(errorResponse("User ID is missing for the authenticated user"));
      return;
    }

    const client = await getDB();

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

    // Handle base64 image upload locally
    if (req.body.profileImage && typeof req.body.profileImage === "string") {
      const isBase64 = /^data:image\/[a-zA-Z]+;base64,/.test(
        req.body.profileImage
      );

      if (isBase64) {
        try {
          // Strip the base64 header and get the raw data
          const matches = req.body.profileImage.match(
            /^data:image\/([a-zA-Z]+);base64,(.+)$/
          );

          if (!matches || matches.length !== 3) {
            res
              .status(HTTP_STATUS.BAD_REQUEST)
              .json(errorResponse("Invalid base64 image format"));
            return;
          }

          const imageBuffer = Buffer.from(matches[2], "base64");

          // Define upload directory and file path
          const uploadDir = path.join(
            process.cwd(),
            "uploads",
            "Users",
            "ProfileImages"
          );
          const fileName = `${Date.now()}.jpg`;
          const newFilePath = path.join(uploadDir, fileName);

          // Relative path to store in DB (acts like a "file key")
          const newFileKey = path.join(
            "uploads",
            "Users",
            "ProfileImages",
            fileName
          );

          // Ensure the upload directory exists
          fs.mkdirSync(uploadDir, { recursive: true });

          // Delete old image if it exists
          const oldProfile = await getUserProfileById(profileId);
          const oldFileKey = oldProfile?.profile_image || null;

          if (oldFileKey) {
            const oldFilePath = path.join(process.cwd(), oldFileKey);
            if (fs.existsSync(oldFilePath)) {
              fs.unlinkSync(oldFilePath);
            }
          }

          // Write new image to disk
          fs.writeFileSync(newFilePath, imageBuffer);

          // Store the relative path in DB (same role as S3 file key)
          req.body.profileImage = newFileKey;
        } catch (uploadErr: unknown) {
          await error("Local image save failed", {
            email: userPayload.userEmail,
            userId: user.id,
            error: (uploadErr as Error).message,
            req,
          });
          res
            .status(HTTP_STATUS.INTERNAL_SERVER_ERROR)
            .json(errorResponse("Failed to save profile image"));
          return;
        }
      }
    }

    const updatedProfile = await updateValidatedUserProfile(
      profileId,
      req.body,
      user.id
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
        } );

    await error("Profile updation error", {
      email: userPayload?.userEmail,
      error: errorObj.message,
      stack: errorObj.stack,
      action: "updateUserProfile",
      req,
    });

    next(errorObj);
    // console.log("Error in updateUserProfile:", err);
    next(err);
  }
};

/**
 * Generates a secure random 4-digit verification code.
 *
 * Uses Node.js crypto module to generate a cryptographically
 * secure random integer between 1000 and 9999.
 *
 * @function generate4DigitCode
 *
 * @returns {string} A randomly generated 4-digit code as a string.
 *
 * @example
 * const code = generate4DigitCode();
 * console.log(code); // "4831"
 */
const generate4DigitCode = (): string => {
  return crypto.randomInt(1000, 10000).toString(); // 1000–9999
};

/**
 * Sends an email verification OTP to the authenticated user.
 *
 * This endpoint:
 * - Validates the authenticated user
 * - Updates the user's email address
 * - Marks the email as unverified
 * - Generates a secure 4-digit OTP
 * - Saves the OTP with expiration time
 * - Sends the OTP to the provided email address
 *
 * @async
 * @function sendEmailVerification
 *
 * @param {AuthRequest} req - Express authenticated request object.
 * @param {Response} res - Express response object.
 * @param {NextFunction} next - Express next middleware function.
 *
 * @returns {Promise<void>} Sends JSON response to client.
 *
 * @throws Will pass errors to Express error middleware.
 */
export const sentEmailVarification = async (
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
    const user = await findUserByEmail(userPayload.userEmail);
    if (!user) {
      await error("Email verification failed - User not found", {
        email: userPayload.userEmail,
        action: "emailVerification",
        req,
      });

      res
        .status(HTTP_STATUS.NOT_FOUND)
        .json(errorResponse(MESSAGES.PROFILE_USER_NOTFOUND));
      return;
    }
    if (!user.id) {
      await error("Email verification failed - User ID missing", {
        email: userPayload.userEmail,
        action: "emailVerification",
        req,
      });
      res
        .status(HTTP_STATUS.INTERNAL_SERVER_ERROR)
        .json(errorResponse("User ID is missing for the authenticated user"));
      return;
    }
    const existingUser = await findUserByEmail(req.body.email);

    if (existingUser) {
      res
        .status(HTTP_STATUS.BAD_REQUEST)
        .json(errorResponse("Email is already in use by another account"));
      return;
    }

    if (user.is_email_verified && user.email === req.body.email) {
      res
        .status(HTTP_STATUS.OK)
        .json(errorResponse("Email is already verified"));
      return;
    }
    const client = await getDB();

    const userQuery = `
    UPDATE users
    SET is_email_verified = false, email = $1
    WHERE id = $2
    RETURNING *
    `;

    await client.query(userQuery, [
      req.body.email,
      user.id,
    ]);

    const verificationCode = generate4DigitCode();

    // optionally set expiry (e.g., 10 minutes)
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000);

    // TODO: save code to DB (recommended)
    await saveEmailVerificationCode(user.id, {
      code: verificationCode,
      expiresAt,
    });
    sendVerificationEmail(req.body.email, verificationCode, expiresAt);
    res.status(HTTP_STATUS.CREATED).json(
      successResponse(null, "Verification code sent to email")
    );
    return;
  } catch (err: unknown) {
    // console.log("Error in sentEmailVarification:", err);
    const errorObj: CustomError =
      err instanceof Error
        ? (err as CustomError)
        : ({
          name: "UnknownError",
          message: "An unknown error occurred",
        } as CustomError);

    await error("Email verification error", {
      email: userPayload?.userEmail,
      error: errorObj.message,
      stack: errorObj.stack,
      action: "emailVerification",
      req,
    });
    next(errorObj);
  }
};

/**
 * Verifies the email verification OTP for the authenticated user.
 *
 * This endpoint:
 * - Validates the provided OTP
 * - Ensures the OTP is not expired or already used
 * - Marks the OTP as used
 * - Marks the user's email as verified
 * - Generates a new authentication token
 *
 * @async
 * @function verifyCode
 *
 * @param {AuthRequest} req - Express authenticated request object.
 * @param {Response} res - Express response object.
 * @param {NextFunction} next - Express next middleware function.
 *
 * @returns {Promise<void>} Sends JSON response with authentication token.
 *
 * @throws Will pass errors to Express error middleware.
 */
export const verifyCode = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  // Implementation for verifying the code goes here
  // const userPayload = req.user as { userEmail?: string } | undefined;
  const userId = (req.user as { userId?: string } | undefined)?.userId;

  // const user = await findUserByEmail(userPayload?.userEmail!);
  // if(!userId || !user) {
  //   res
  //     .status(HTTP_STATUS.UNAUTHORIZED)

  //     .json(errorResponse("Unauthorized request"));
  //   return;
  // }
  const user = await findUserById(userId!);
  const role = await getRoleById(userId!)
  // if (!userPayload?.userEmail) {
  //   res
  //     .status(HTTP_STATUS.UNAUTHORIZED)
  //     .json(errorResponse("Unauthorized request"));
  //   return;
  // }
  try {
    const { otp } = req.body;
    // 1. Validate OTP and mark email as verified if correct

    const client = await getDB();
    const userQuery = `
    select * from email_verifications
     where user_id = $1 and code = $2 and expires_at > now() and is_used = false
    `;
    const { rows } = await client.query(userQuery, [
      userId,
      otp,
    ]);
    if (rows.length === 0) {
      res
        .status(HTTP_STATUS.BAD_REQUEST)
        .json(errorResponse("Invalid or expired verification code"));
      return;
    }
    // Mark code as used
    const markUsedQuery = `
    UPDATE email_verifications
    SET is_used = true
      WHERE user_id = $1 AND code = $2
    `;
    await client.query(markUsedQuery, [userId, otp]);
    // Update user's email verification status
    const updateUserQuery = `
    UPDATE users
    SET is_email_verified = true
    WHERE id = $1
    `;
    await client.query(updateUserQuery, [userId]);
    const token = generateToken(user?.email!, role?.name || "user", userId!);
    res
      .status(HTTP_STATUS.OK)
      .json(successResponse(token, "Email verified successfully"));
  } catch (err: unknown) {
    const errorObj: CustomError =
      err instanceof Error
        ? (err as CustomError)
        : ({
          name: "UnknownError",
          message: "An unknown error occurred",
        }
        );

    // await error("Email verification error", {
    //   email: userPayload?.userEmail,
    //   error: errorObj.message,
    //   stack: errorObj.stack,
    //   action: "verifyCode",
    //   req,
    // });
    next(errorObj);
  }
};














// export const updateUserProfile = async (
//   req: AuthRequest,
//   res: Response,
//   next: NextFunction
// ): Promise<void> => {
//   const userPayload = req.user as { userEmail?: string } | undefined;

//   if (!userPayload?.userEmail) {
//     res
//       .status(HTTP_STATUS.UNAUTHORIZED)
//       .json(errorResponse("Unauthorized request"));
//     return;
//   }

//   try {
//     //  Find user
//     const user = await findUserByEmail(userPayload.userEmail);
//     if (!user) {
//       await error("Profile update failed - User not found", {
//         email: userPayload.userEmail,
//         action: "updateUserProfile",
//         req,
//       });
//       res
//         .status(HTTP_STATUS.NOT_FOUND)
//         .json(errorResponse(MESSAGES.PROFILE_USER_NOTFOUND));
//       return;
//     }

//     const client = getDB();

//     //  Find existing profile
//     const { rows: existingProfileRows } = await client.query(
//       `SELECT id FROM userprofiles WHERE user_id = $1`,
//       [user.id]
//     );

//     if (existingProfileRows.length === 0) {
//       await warn("Profile update failed - Profile not found", {
//         email: userPayload.userEmail,
//         userId: user.id,
//         action: "updateUserProfile",
//         req,
//       });
//       res
//         .status(HTTP_STATUS.NOT_FOUND)
//         .json(errorResponse("User profile not found"));
//       return;
//     }

//     const profileId = existingProfileRows[0].id;

//     // Handle base64 image upload
//     if (req.body.profileImage && typeof req.body.profileImage === "string") {
//       const isBase64 = /^data:image\/[a-zA-Z]+;base64,/.test(
//         req.body.profileImage
//       );
//       if (isBase64) {
//         try {
//           const plantName = `${Date.now()}.jpg`; // or `${user.id}_${Date.now()}.jpg`
//           const folder = "Users/ProfileImages"; // or any folder name you prefer
//           // Fetch old profile image from DB
//           const oldProfile = await getUserProfileById(profileId);
//           const oldFileKey = oldProfile?.profile_image || null;

//           // Upload new image
//           const uploadedFileKey = await uploadBase64ToS3(
//             req.body.profileImage,
//             plantName,
//             folder
//           );

//           // Delete old image (if exists)
//           if (oldFileKey) {
//             await deleteFileFromS3(oldFileKey);
//           }

//           // Assign new file key to request body
//           req.body.profileImage = uploadedFileKey;
//         } catch (uploadErr: unknown) {
//           await error("Image upload to S3 Bucket failed", {
//             email: userPayload.userEmail,
//             userId: user.id,
//             error: (uploadErr as Error).message,
//             req,
//           });
//           res
//             .status(HTTP_STATUS.INTERNAL_SERVER_ERROR)
//             .json(errorResponse("Failed to upload profile image"));
//           return;
//         }
//       }
//     }

//     // Validate and update using your service method
//     const updatedProfile = await updateValidatedUserProfile(
//       profileId,
//       req.body
//     );

//     if (!updatedProfile) {
//       await warn("Profile update failed - No record updated", {
//         email: userPayload.userEmail,
//         userId: user.id,
//         req,
//       });
//       res
//         .status(HTTP_STATUS.NOT_FOUND)
//         .json(errorResponse("User profile not found"));
//       return;
//     }
//     res
//       .status(HTTP_STATUS.OK)
//       .json(successResponse(null, MESSAGES.PROFILE_UPDATED));
//   } catch (err: unknown) {
//     const errorObj: CustomError =
//       err instanceof Error
//         ? (err as CustomError)
//         : ({
//           name: "UnknownError",
//           message: "An unknown error occurred",
//         } as CustomError);

//     await error("Profile updation error", {
//       email: userPayload?.userEmail,
//       error: errorObj.message,
//       stack: errorObj.stack,
//       action: "updateUserProfile",
//       req,
//     });

//     next(errorObj);
//   }
// };


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

/**
 * Adds a password for an authenticated SSO user who does not already
 * have a password set in the system.
 *
 * This controller:
 * - Validates the authenticated user
 * - Checks whether the user exists
 * - Ensures the user has no existing password
 * - Validates the new password input
 * - Hashes the password securely
 * - Updates the user's password in the database
 * - Logs errors and warnings for debugging and monitoring
 *
 * @async
 * @function addPasswordForSSOUser
 *
 * @param {AuthRequest} req - Express request object containing authenticated user data and request body.
 * @param {Response} res - Express response object used to send API responses.
 * @param {NextFunction} next - Express middleware next function for error handling.
 *
 * @returns {Promise<void>} Sends a success or error response.
 *
 * @throws {Error} Passes unexpected errors to Express error middleware.
 */
export const addPasswordForSSOUser = async (
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
    const user = await findUserByEmail(userPayload.userEmail);
    if (!user) {
      await error("Add password failed - User not found", {
        email: userPayload.userEmail,
        action: "addPasswordForSSOUser",
        req,
      });
      res
        .status(HTTP_STATUS.NOT_FOUND)
        .json(errorResponse(MESSAGES.PROFILE_USER_NOTFOUND));
      return;
    }
    if (!user.id) {
      await error("Add password failed - User ID missing", {
        email: userPayload.userEmail,
        action: "addPasswordForSSOUser",
        req,
      });
      res
        .status(HTTP_STATUS.INTERNAL_SERVER_ERROR)
        .json(errorResponse("User ID is missing for the authenticated user"));
      return;
    }
    if (user.password) {
      res
        .status(HTTP_STATUS.BAD_REQUEST)
        .json(errorResponse("Password already exists for this user"));
      return;
    }

    const {new_password} = req.body;
    if (!new_password || typeof new_password !== "string" || new_password.length < 6) {
      res        .status(HTTP_STATUS.BAD_REQUEST)
        .json(errorResponse("New password must be at least 6 characters long"));
      return;
    }

    const pawwsordhashed = await hashPassword(new_password);

    const client = await getDB();
    const updateQuery = `
    UPDATE users
    SET password = $1
    WHERE id = $2
    RETURNING id
    `;
    const { rowCount } = await client.query(updateQuery, [
      pawwsordhashed,
      user.id,
    ]);
    if (rowCount === 0) {
      await warn("Add password failed - User not found during update", {
        email: userPayload.userEmail,
        userId: user.id,
        action: "addPasswordForSSOUser",
        req,
      });
      res
        .status(HTTP_STATUS.NOT_FOUND)
        .json(errorResponse("User not found during password update"));
      return;
    }
    res
      .status(HTTP_STATUS.OK)
      .json(successResponse(null, "Password added successfully"));
  } catch (err: unknown) {
    const errorObj: CustomError =
      err instanceof Error
        ? (err as CustomError)
        : ({
          name: "UnknownError",
          message: "An unknown error occurred",
        } as CustomError);
    await error("Add password error", {
      email: userPayload?.userEmail,
      error: errorObj.message,
      stack: errorObj.stack,
      action: "addPasswordForSSOUser",  
      req,
    });
    next(errorObj);
  }
};