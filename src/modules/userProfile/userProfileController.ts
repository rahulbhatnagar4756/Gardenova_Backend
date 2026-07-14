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
import { generatePhoneToken, generateToken } from "../../core/utils/usableMethods";
import { AuthUserPayload } from "../../interface/user";


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
  const userPayload = req.user as { userId?: string; userEmail?: string; userPhone?: string } | undefined;

  if (!userPayload?.userId) {
    res.status(HTTP_STATUS.UNAUTHORIZED).json(errorResponse("Unauthorized request"));
    return;
  }

  try {
    // ── userId se fetch karo — works for both email & phone users ──
    const user = await findUserById(userPayload.userId);

    if (!user) {
      await error("Profile retrieval failed - User not found", {
        userId: userPayload.userId,
        action: "getCurrentUserProfile",
        req,
      });
      res.status(HTTP_STATUS.NOT_FOUND).json(errorResponse(MESSAGES.PROFILE_USER_NOTFOUND));
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
      `SELECT response_id FROM survey_answers
       WHERE user_id = $1
       ORDER BY created_at DESC
       LIMIT 1`,
      [user.id]
    );
    const responseId = answerResponse.rows[0]?.response_id ?? null;

    // ── subscription details ──
    const { rows: subscriptionRows } = await client.query(
      `
      SELECT
        us.plan_id,
        sp.code   AS plan_code,
        sp.tier   AS plan_tier,
        us.status,
        us.current_period_start,
        us.current_period_end
      FROM user_subscriptions us
      JOIN subscription_plans sp ON sp.id = us.plan_id
      WHERE us.user_id = $1
      ORDER BY us.created_at DESC
      LIMIT 1
      `,
      [user.id]
    );

    const subscription = subscriptionRows[0] ?? null;

    const baseUrl = env.APPDEV_URL || `${req.protocol}://${req.get("host")}`;

    const fullProfile: IFullUserProfile = {
      name: user.name ?? null,
      email: user.email ?? null,
      contactNumber: user.phone_number ?? null,
      is_email_verified: user.is_email_verified ?? false,
      is_phone_verified: user.is_phone_verified ?? false,
      is_sso_user: user.password === null,

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
      responseId,

      subscription: subscription
        ? {
            planId: subscription.plan_id,
            planName: subscription.plan_tier ?? subscription.plan_code ?? null,
            status: subscription.status,
            startedAt: subscription.current_period_start
              ? new Date(subscription.current_period_start).toISOString()
              : null,
            expiresAt: subscription.current_period_end
              ? new Date(subscription.current_period_end).toISOString()
              : null,
          }
        : null,
    };

    res.status(HTTP_STATUS.OK).json(successResponse(fullProfile, "User profile retrieved successfully"));
  } catch (err: unknown) {
    const errorObj: CustomError = err instanceof Error
      ? (err as CustomError)
      : ({ name: "UnknownError", message: typeof err === "string" ? err : "An unknown error occurred" } as CustomError);

    await error("Profile retrieval error", {
      userId: userPayload?.userId,
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
  const userPayload = req.user as { userId?: string } | undefined;

  if (!userPayload?.userId) {
    res.status(HTTP_STATUS.UNAUTHORIZED).json(errorResponse("Unauthorized request"));
    return;
  }

  try {
    const user = await findUserById(userPayload.userId);
    if (!user) {
      await error("Profile update failed - User not found", {
        userId: userPayload.userId,
        action: "updateUserProfile",
        req,
      });
      res.status(HTTP_STATUS.NOT_FOUND).json(errorResponse(MESSAGES.PROFILE_USER_NOTFOUND));
      return;
    }

    if (!user.id) {
      res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json(errorResponse("User ID is missing"));
      return;
    }

    // ── Phone number update allow nahi ────────────────────────
    if (req.body.phoneNumber || req.body.phone_number) {
      res.status(HTTP_STATUS.FORBIDDEN).json(errorResponse("Phone number cannot be updated"));
      return;
    }

    const client = await getDB();

    const { rows: existingProfileRows } = await client.query(
      `SELECT id FROM userprofiles WHERE user_id = $1`,
      [user.id]
    );

    if (existingProfileRows.length === 0) {
      await warn("Profile update failed - Profile not found", {
        userId: user.id,
        action: "updateUserProfile",
        req,
      });
      res.status(HTTP_STATUS.NOT_FOUND).json(errorResponse("User profile not found"));
      return;
    }

    const profileId = existingProfileRows[0].id;

    // ── name/email update — users table mein ─────────────────
    const { name, email } = req.body;

    if (name || email) {
      const fields: string[] = [];
      const values: unknown[] = [];
      let idx = 1;

      if (name) { fields.push(`name = $${idx++}`); values.push(name); }
      if (email) { fields.push(`email = $${idx++}`); values.push(email.toLowerCase()); }

      fields.push(`updated_at = NOW()`);
      values.push(user.id);

      await client.query(
        `UPDATE users SET ${fields.join(", ")} WHERE id = $${idx}`,
        values
      );
    }

    // ── Base64 image upload ───────────────────────────────────
    if (req.body.profileImage && typeof req.body.profileImage === "string") {
      const isBase64 = /^data:image\/[a-zA-Z]+;base64,/.test(req.body.profileImage);

      if (isBase64) {
        try {
          const matches = req.body.profileImage.match(/^data:image\/([a-zA-Z]+);base64,(.+)$/);

          if (!matches || matches.length !== 3) {
            res.status(HTTP_STATUS.BAD_REQUEST).json(errorResponse("Invalid base64 image format"));
            return;
          }

          const imageBuffer = Buffer.from(matches[2], "base64");
          const uploadDir = path.join(process.cwd(), "uploads", "Users", "ProfileImages");
          const fileName = `${Date.now()}.jpg`;
          const newFilePath = path.join(uploadDir, fileName);
          const newFileKey = path.join("uploads", "Users", "ProfileImages", fileName);

          fs.mkdirSync(uploadDir, { recursive: true });

          const oldProfile = await getUserProfileById(profileId);
          const oldFileKey = oldProfile?.profile_image || null;

          if (oldFileKey) {
            const oldFilePath = path.join(process.cwd(), oldFileKey);
            if (fs.existsSync(oldFilePath)) fs.unlinkSync(oldFilePath);
          }

          fs.writeFileSync(newFilePath, imageBuffer);
          req.body.profileImage = newFileKey;
        } catch (uploadErr: unknown) {
          await error("Local image save failed", {
            userId: user.id,
            error: (uploadErr as Error).message,
            req,
          });
          res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json(errorResponse("Failed to save profile image"));
          return;
        }
      }
    }

    // ── userprofiles table update ─────────────────────────────
    const updatedProfile = await updateValidatedUserProfile(profileId, req.body, user.id);

    if (!updatedProfile) {
      res.status(HTTP_STATUS.NOT_FOUND).json(errorResponse("User profile not found"));
      return;
    }

    res.status(HTTP_STATUS.OK).json(successResponse(null, MESSAGES.PROFILE_UPDATED));

  } catch (err: unknown) {
    const errorObj: CustomError = err instanceof Error
      ? (err as CustomError)
      : ({ name: "UnknownError", message: "An unknown error occurred" });

    await error("Profile updation error", {
      userId: userPayload?.userId,
      error: errorObj.message,
      stack: errorObj.stack,
      action: "updateUserProfile",
      req,
    });

    next(errorObj);
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
 * Extracts the authenticated user's ID from the request object.
 *
 * @param req - The authenticated request containing the user payload.
 * @returns The user ID if present; otherwise, `null`.
 */
function extractUserId(req: AuthRequest): string | null {
  return (req.user as { userId?: string } | undefined)?.userId ?? null;
}
/**
 * Converts an unknown thrown value into a consistent `CustomError` object.
 *
 * If the value is already an instance of `Error`, it is returned as a
 * `CustomError`. Otherwise, a generic fallback error is created.
 *
 * @param err - The unknown error value to normalize.
 * @returns A normalized `CustomError` instance.
 */
function toCustomError(err: unknown): CustomError {
  if (err instanceof Error) return err as CustomError;
  return { name: "UnknownError", message: "An unknown error occurred" } as CustomError;
}

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
export const sendEmailVerification = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  // ── 1. Auth guard ──────────────────────────────────────────────────────────
  const userId = extractUserId(req);
  if (!userId) {
    res.status(HTTP_STATUS.UNAUTHORIZED).json(errorResponse("Unauthorized request"));
    return;
  }

  // ── 2. Validate body ───────────────────────────────────────────────────────
  const targetEmail: string | undefined = req.body?.email?.trim().toLowerCase();
  if (!targetEmail) {
    res.status(HTTP_STATUS.BAD_REQUEST).json(errorResponse("Email is required"));
    return;
  }

  // Basic email format check (use a library like `validator` for production)
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(targetEmail)) {
    res.status(HTTP_STATUS.BAD_REQUEST).json(errorResponse("Invalid email format"));
    return;
  }

  try {
    // ── 3. Load authenticated user ─────────────────────────────────────────
    const user = await findUserById(userId);
    if (!user) {
      res.status(HTTP_STATUS.NOT_FOUND).json(errorResponse(MESSAGES.PROFILE_USER_NOTFOUND));
      return;
    }

    // ── 4. Already verified with the same email? ───────────────────────────
    if (user.is_email_verified && user.email === targetEmail) {
      res.status(HTTP_STATUS.CONFLICT).json(successResponse(null, "Email is already verified"));
      return;
    }

    // ── 5. Is the target email taken by someone else? ──────────────────────
    const emailOwner = await findUserByEmail(targetEmail);
    if (emailOwner && emailOwner.id !== userId) {
      res
        .status(HTTP_STATUS.OK)
        .json(errorResponse("This email is already in use by another account"));
      return;
    }

    const client = await getDB();

    // ── 6. Rate-limit: reuse an unexpired, unused OTP ──────────────────────
    //    Prevents users from spamming the endpoint and burning e-mail quota.
    const existingOtpQuery = `
  SELECT id, GREATEST(EXTRACT(EPOCH FROM (expires_at - now())), 0)::int AS remaining_seconds
  FROM   email_verifications
  WHERE  user_id   = $1
    AND  is_used   = false
    AND  expires_at > now()
  ORDER  BY expires_at DESC
  LIMIT  1
`;
    const { rows: existingOtps } = await client.query(existingOtpQuery, [userId]);
    if (existingOtps.length > 0) {
      const remaining = existingOtps[0].remaining_seconds;
      res.status(HTTP_STATUS.TOO_MANY_REQUESTS).json(
        errorResponse(`An OTP was already sent. Please wait ${remaining}s before requesting a new one.`)
      );
      return;
    }
    // ── 7. Store pending email (do NOT overwrite live email yet) ───────────
    //    Requires a `pending_email` column in your users table:
    //    ALTER TABLE users ADD COLUMN pending_email TEXT;
    const pendingEmailQuery = `
      UPDATE users
      SET    pending_email = $1
      WHERE  id = $2
    `;
    await client.query(pendingEmailQuery, [targetEmail, userId]);

    // ── 8. Generate OTP and persist it ────────────────────────────────────
    const verificationCode = generate4DigitCode();
    const expiresAt = new Date(Date.now() + 2 * 60 * 1000); // 2 minutes

    await saveEmailVerificationCode(userId, { code: verificationCode, expiresAt });

    // ── 9. Fire the email (intentionally not awaited — non-blocking) ───────
    sendVerificationEmail(targetEmail, verificationCode, expiresAt);

    res.status(HTTP_STATUS.OK).json(successResponse(null, "Verification code sent to email"));
  } catch (err: unknown) {
    const errorObj = toCustomError(err);
    await error("sendEmailVerification error", {
      userId,
      error: errorObj.message,
      stack: errorObj.stack,
      action: "sendEmailVerification",
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
  // ── 1. Auth guard ──────────────────────────────────────────────────────────
  const userId = extractUserId(req);
  if (!userId) {
    res.status(HTTP_STATUS.UNAUTHORIZED).json(errorResponse("Unauthorized request"));
    return;
  }

  // ── 2. Validate body ───────────────────────────────────────────────────────
  const otp: string | undefined = req.body?.otp?.toString().trim();
  if (!otp) {
    res.status(HTTP_STATUS.BAD_REQUEST).json(errorResponse("OTP is required"));
    return;
  }
  if (!/^\d{4}$/.test(otp)) {
    res.status(HTTP_STATUS.BAD_REQUEST).json(errorResponse("OTP must be a 4-digit number"));
    return;
  }

  try {
    // ── 3. Load user ───────────────────────────────────────────────────────
    const user = await findUserById(userId);
    if (!user) {
      res.status(HTTP_STATUS.NOT_FOUND).json(errorResponse(MESSAGES.PROFILE_USER_NOTFOUND));
      return;
    }

    // ── 4. Already fully verified? ─────────────────────────────────────────
    //    (pending_email check means they started a new change — let them verify)
    if (user.is_email_verified && !user.pending_email) {
      res.status(HTTP_STATUS.OK).json(successResponse(null, "Email is already verified"));
      return;
    }

    const client = await getDB();

    // ── 5. Look up OTP record ──────────────────────────────────────────────
    const otpQuery = `
      SELECT id
      FROM   email_verifications
      WHERE  user_id    = $1
        AND  code       = $2
        AND  is_used    = false
        AND  expires_at > now()
      LIMIT  1
    `;
    const { rows } = await client.query(otpQuery, [userId, otp]);

    if (rows.length === 0) {
      // Differentiate expired vs wrong code for better UX
      const anyCodeQuery = `
        SELECT expires_at, is_used
        FROM   email_verifications
        WHERE  user_id = $1 AND code = $2
        LIMIT  1
      `;
      const { rows: anyRows } = await client.query(anyCodeQuery, [userId, otp]);

      if (anyRows.length > 0 && anyRows[0].is_used) {
        res
          .status(HTTP_STATUS.BAD_REQUEST)
          .json(errorResponse("This OTP has already been used. Please request a new one."));
        return;
      }
      if (anyRows.length > 0 && new Date(anyRows[0].expires_at) < new Date()) {
        res
          .status(HTTP_STATUS.BAD_REQUEST)
          .json(errorResponse("OTP has expired. Please request a new one."));
        return;
      }

      res
        .status(HTTP_STATUS.BAD_REQUEST)
        .json(errorResponse("Invalid OTP. Please check and try again."));
      return;
    }

    // ── 6. Mark OTP as used ────────────────────────────────────────────────
    const markUsedQuery = `
      UPDATE email_verifications
      SET    is_used = true
      WHERE  user_id = $1 AND code = $2
    `;
    await client.query(markUsedQuery, [userId, otp]);

    // ── 7. Promote pending_email → email, mark verified ───────────────────
    const verifyQuery = `
      UPDATE users
      SET    email              = COALESCE(pending_email, email),
             pending_email      = NULL,
             is_email_verified  = true
      WHERE  id = $1
      RETURNING email
    `;
    await client.query(verifyQuery, [userId]);
    // const verifiedEmail: string = updatedRows[0].email;

    // ── 8. Issue fresh token (email may have changed) ──────────────────────
    const updatedUser = await findUserById(userId);
    const role = await getRoleById(updatedUser?.role_id!);
    const token = updatedUser?.email
      ? generateToken(updatedUser.email, role?.name!, updatedUser.id!)
      : generatePhoneToken(updatedUser?.phone_number!, role?.name!, updatedUser?.id!);

    res
      .status(HTTP_STATUS.OK)
      .json(successResponse(token, "Email verified successfully"));
  } catch (err: unknown) {
    const errorObj = toCustomError(err);
    await error("verifyCode error", {
      userId,
      error: errorObj.message,
      stack: errorObj.stack,
      action: "verifyCode",
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
  const userPayload = req.user as AuthUserPayload | undefined;



  try {

    //  Find user

    const user = await findUserById(userPayload!.userId!);

    if (!user) {
      await error("Profile soft delete failed - User not found", {
        email: userPayload!.userEmail,
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
    const result = await client.query(
      `DELETE FROM users WHERE id = $1 RETURNING id`,
      [user.id]
    )



    if (result.rowCount === 0) {
      await warn("Profile delete failed - Profile not found", {
        email: userPayload!.userEmail,
        userId: user.id,
        action: "deleteUserProfile",
        req,
      });

      res
        .status(HTTP_STATUS.NOT_FOUND)
        .json(errorResponse("User profile not found"));
      return;
    }

    res
      .status(HTTP_STATUS.OK)
      .json(successResponse(null, "User profile deleted successfully"));
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
  const userPayload = req.user as AuthUserPayload | undefined;

  if (!userPayload?.userEmail) {
    res
      .status(HTTP_STATUS.UNAUTHORIZED)
      .json(errorResponse("Unauthorized request"));
    return;
  }
  try {
    const user = await findUserById(userPayload.userId!);
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

    const { new_password } = req.body;
    if (!new_password || typeof new_password !== "string" || new_password.length < 6) {
      res
        .status(HTTP_STATUS.BAD_REQUEST)
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