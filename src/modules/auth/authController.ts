import { Request, Response, NextFunction } from "express";
import {
  successResponse,
  errorResponse,
} from "../../core/utils/responseFormatter";
import { HTTP_STATUS, MESSAGES } from "../../core/utils/constants";
import {
  downloadImageAsBuffer,
  generateToken,
} from "../../core/utils/usableMethods";
import { error, warn } from "../../core/utils/logger";
import { CustomError } from "../../interface/Error";
import { ZodError, ZodIssue } from "zod";
import { sendPasswordResetEmail } from "../../core/services/emailService";
import crypto from "crypto";
import { RoleCodeMap } from "../../interface/role";
import {
  decodeGoogleAccessToken,
  verifyFacebookToken as verifyFacebookAccessToken,
} from "../../core/services/firebaseAdmin";
import {
  comparePassword,
  createUserFromOAuth,
  createUserProfile,
  createUserProfileWithImage,
  createValidatedUser,
  findRoleByName,
  findUserByAppleId,
  findUserByEmail,
  findUserByEmailOrPhone,
  findUserById,
  getRoleById,
  getRoleByName,
  resetPasswordResetFields,
  updatePasswordResetToken,
  updateUserFromOAuth,
  updateUserPassword,
  verifyAppleIdToken,
  verifyFacebookIdToken,
} from "./authRepository";
import bcrypt from "bcryptjs";
import { uploadBufferToS3 } from "../../core/services/s3UploadService";
import { AuthRequest } from "../../interface/auth";
import { AppError } from "../../interface";
import { handleProfessionalLogin } from "../professional/professionalRepositry";

/**
 * Registers a new user in the system.
 *
 * @param {Request} req - Express request object containing user registration data.
 * @param {Response} res - Express response object used to send responses.
 * @param {NextFunction} next - Express next middleware function for error handling.
 * @returns {Promise<void>} Returns a promise that resolves when the operation is complete.
 */
export const register = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { name, email, password, roleCode, phoneNumber } = req.body;

    // Validate role code
    const roleName = RoleCodeMap[roleCode];
    if (!roleName) {
      await warn(
        "Invalid role code",
        { email, roleCode },
        { source: "auth.register", req }
      );
      res
        .status(HTTP_STATUS.BAD_REQUEST)
        .json(errorResponse(MESSAGES.ROLE_INVALID_ID));
      return;
    }

    // Fetch role by name (PostgreSQL)
    const role = await getRoleByName(roleName);

    if (!role) {
      await warn(
        "Role not found in database",
        { email, roleName },
        { source: "auth.register", req }
      );
      res
        .status(HTTP_STATUS.BAD_REQUEST)
        .json(errorResponse(MESSAGES.ROLE_INVALID_ID));
      return;
    }

    // Check if email OR phone already exists
    const existingUserResult = await findUserByEmailOrPhone(
      email.toLowerCase(),
      phoneNumber
    );

    if (existingUserResult.user) {
      await warn(
        "User already exists",
        { email, phoneNumber, conflict: existingUserResult.conflictField },
        { source: "auth.register", req }
      );

      if (existingUserResult.conflictField === "email") {
        res
          .status(HTTP_STATUS.CONFLICT)
          .json(errorResponse(MESSAGES.USER_EXISTS));
        return;
      }

      if (existingUserResult.conflictField === "phone") {
        res
          .status(HTTP_STATUS.CONFLICT)
          .json(errorResponse(MESSAGES.USER_PHONE_EXISTS));
        return;
      }
    }

    //  Create user with validation
    const newUser = await createValidatedUser({
      name,
      email: email.toLowerCase(),
      password,
      roleId: role.id,
      phoneNumber,
    });

    //  Create empty user profile (if you have a `user_profiles` table)
    await createUserProfile(newUser.id!);

    res
      .status(HTTP_STATUS.CREATED)
      .json(successResponse(null, MESSAGES.USER_CREATED));
  } catch (err: unknown) {
    // 🔹 Handle validation errors (Zod)
    if (err instanceof ZodError) {
      const formattedErrors = err.issues.map((e: ZodIssue) => ({
        field: e.path.join("."),
        message: e.message,
      }));

      await warn(
        "Validation failed",
        { errors: formattedErrors },
        { source: "auth.register", req }
      );

      res.status(HTTP_STATUS.BAD_REQUEST).json({
        success: false,
        message: "Validation failed",
        errors: formattedErrors,
      });
      return;
    }

    // Use type narrowing for `Error`
    let errorMessage = "An unknown error occurred";
    let errorStack: string | undefined;

    if (err instanceof Error) {
      errorMessage = err.message;
      errorStack = err.stack;
    }

    // Handle PostgreSQL unique constraint violation (email already taken)
    if (
      errorMessage.includes("duplicate key") &&
      errorMessage.includes("email")
    ) {
      await warn(
        "Duplicate email constraint violation",
        { error: errorMessage },
        { source: "auth.register", req }
      );
      res
        .status(HTTP_STATUS.CONFLICT)
        .json(errorResponse(MESSAGES.USER_EXISTS));
      return;
    }

    // Log unexpected error
    await error(
      "Unexpected error during user registration",
      { error: errorMessage, stack: errorStack },
      { source: "auth.register", req }
    );

    next(err);
  }
};

/**
 * Authenticates a user and returns a JWT token.
 *
 * @param {Request} req - Express request object containing login credentials (email, password).
 * @param {Response} res - Express response object used to send the response.
 * @param {NextFunction} next - Express next middleware function for error handling.
 * @returns {Promise<void>} Returns a promise that resolves when authentication is complete.
 */
export const login = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { email, password, loginType } = req.body;

    //  Find user by email
    const user = await findUserByEmail(email.toLowerCase());


    if (!user || !user.password) {
      await warn(
        "Login failed - user not found or missing password",
        { email },
        { source: "auth.login", req }
      );
      res.status(HTTP_STATUS.OK).json(errorResponse(MESSAGES.USER_NOTFOUND));
      return;
    }

    if (user.isdeleted) {
      await warn(
        "Login failed - user profile is deleted",
        { email, userId: user.id },
        { source: "auth.login", req }
      );

      await error(
        "Login attempt for deleted user profile",
        { email, userId: user.id },
        { userId: user.id!, source: "auth.login", req }
      );
      res.status(HTTP_STATUS.OK).json(errorResponse("User profile is deleted"));
      return;
    }


    // Validate password
    const isPasswordValid = await comparePassword(password, user.password);
    if (!isPasswordValid) {
      await warn(
        "Login failed - invalid password",
        { email, userId: user.id },
        { userId: user.id!, source: "auth.login", req }
      );
      res
        .status(HTTP_STATUS.OK)
        .json(errorResponse(MESSAGES.INVALID_CREDENTIALS));
      return;
    }

    // Fetch role from roles table
    const role = await getRoleById(user.role_id);

    if (!role) {
      await error(
        "Login failed - role not found",
        { email, userId: user.id, roleId: user.role_id },
        { userId: user.id!, source: "auth.login", req }
      );
      res.status(HTTP_STATUS.OK).json(errorResponse("Role not found"));
      return;
    }

    const roleName = role.name.toLowerCase();

    // ── Role vs loginType gate ──────────────────────────────
    if (loginType === "professional" && roleName !== "professional") {
      res.status(HTTP_STATUS.OK).json(
        errorResponse("Access denied. This login is for professionals only.")
      );
      return;
    }

    if (loginType === "user" && roleName !== "user") {
      res.status(HTTP_STATUS.OK).json(
        errorResponse("Access denied. This login is for users only.")
      );
      return;
    }

    //  Generate JWT
    if (loginType === "professional" && roleName === "professional") {
      let professionalStatus;

      try {
        professionalStatus = await handleProfessionalLogin(user.id!);
      } catch (professionalError) {
        console.error("[login] Failed to handle professional login:", {
          userId: user.id,
          email,
          error: professionalError instanceof Error
            ? professionalError.message
            : String(professionalError),
        });
        res.status(HTTP_STATUS.OK).json(
          errorResponse("Failed to process professional account. Please try again.")
        );
        return;
      }

      // Block if trial expired or account issue
      if (!professionalStatus.success) {
        await warn(
          "Professional login blocked",
          { email, userId: user.id, accountStatus: professionalStatus.accountStatus },
          { userId: user.id!, source: "auth.login", req }
        );
        res.status(HTTP_STATUS.FORBIDDEN).json(
          errorResponse(professionalStatus.message)
        );
        return;
      }

      const token = generateToken(user.email.toLowerCase(), role.name, user.id!);

      res.status(HTTP_STATUS.OK).json(
        successResponse(
          {
            token,
            role: role.name,
            accountStatus: professionalStatus.accountStatus,
            statusMessage: professionalStatus.message,
          },
          MESSAGES.LOGIN_SUCCESS
        )
      );
      return;
    }

    // ─── 6. Standard user login ────────────────────────────────────────────
    const token = generateToken(user.email.toLowerCase(), role.name, user.id!);

    res.status(HTTP_STATUS.OK).json(
      successResponse(
        {
          token,
          role: role.name,
        },
        MESSAGES.LOGIN_SUCCESS
      )
    );

  } catch (err: unknown) {
    const errorObj =
      err instanceof Error
        ? { ...err }
        : {
          name: "UnknownError",
          message:
            typeof err === "string" ? err : "An unknown error occurred",
        };

    await error(
      "Login failed with unexpected error",
      { error: errorObj.message, stack: errorObj.stack },
      { source: "auth.login", req }
    );

    next(errorObj);
  }
};

/**
 * Authenticates a user and returns a refresh JWT token.
 *
 * @param {AuthRequest} req - Express Auth Request.
 * @param {Response} res - Express response object used to send the response.
 * @param {NextFunction} next - Express next middleware function for error handling.
 * @returns {Promise<void>} Returns a promise that resolves when authentication is complete.
 */
export const refreshTokenLogin = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  // Extract user info from JWT (populated by auth middleware)
  const userPayload = req.user as { userId?: string; exp?: number } | undefined;

  if (!userPayload?.userId) {
    res
      .status(HTTP_STATUS.UNAUTHORIZED)
      .json(errorResponse("Unauthorized request"));
    return;
  }

  // Validate token expiry
  const currentTimestamp = Math.floor(Date.now() / 1000);
  if (!userPayload.exp || userPayload.exp <= currentTimestamp) {
    res.status(HTTP_STATUS.UNAUTHORIZED).json(
      errorResponse("Token has expired or is invalid", {
        code: "TOKEN_EXPIRED_OR_INVALID",
        statusCode: HTTP_STATUS.UNAUTHORIZED,
      })
    );
    return;
  }

  try {
    //  Fetch user by ID
    const user = await findUserById(userPayload.userId);

    if (!user) {
      await warn(
        "Refresh Login failed - user not found",
        { userId: userPayload.userId },
        { source: "auth.refresh", req }
      );
      res
        .status(HTTP_STATUS.OK)
        .json(errorResponse(MESSAGES.INVALID_CREDENTIALS));
      return;
    }

    //  Fetch user role
    const role = await getRoleById(user.role_id);

    if (!role) {
      await error(
        "Refresh Login failed - role not found",
        { userId: user.id, roleId: user.role_id },
        { userId: user.id!, source: "auth.refresh", req }
      );
      res.status(HTTP_STATUS.OK).json(errorResponse("Role not found"));
      return;
    }

    //  Generate new JWT
    const token = generateToken(user.email, role.name, user.id!);

    //  Return refreshed token
    res
      .status(HTTP_STATUS.OK)
      .json(successResponse({ token }, MESSAGES.LOGIN_SUCCESS));
  } catch (err: unknown) {
    const errorObj: CustomError =
      err instanceof Error
        ? { ...err }
        : {
          name: "UnknownError",
          message:
            typeof err === "string" ? err : "An unknown error occurred",
        };

    await error(
      "Refresh Login failed with unexpected error",
      { error: errorObj.message, stack: errorObj.stack },
      { source: "auth.refresh", req }
    );

    next(errorObj);
  }
};

/**
 * Sends a password reset token to user's email.
 *
 * @param {Request} req - Express request object containing user email.
 * @param {Response} res - Express response object used to send the response.
 * @param {NextFunction} next - Express next middleware function for error handling.
 * @returns {Promise<void>} Returns a promise that resolves when reset email is sent.
 */
export const handlePasswordResetToken = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  const { email, isResend = false } = req.body;

  try {
    //Find user by email
    const user = await findUserByEmail(email);

    if (!user) {
      await warn(
        "Password reset failed - user not found",
        { email },
        { source: "auth.handlePasswordResetToken", req }
      );
      res
        .status(HTTP_STATUS.OK)
        .json(errorResponse("User not found with this email address"));
      return;
    }

    // If resend and token still valid -> block
    if (
      isResend &&
      user.password_reset_expires &&
      new Date(user.password_reset_expires) > new Date()
    ) {
      const timeLeft = Math.ceil(
        (new Date(user.password_reset_expires).getTime() - Date.now()) /
        (60 * 1000)
      );
      res
        .status(HTTP_STATUS.OK)
        .json(
          errorResponse(
            `Please wait ${timeLeft} minute(s) before requesting a new token`
          )
        );
      return;
    }

    // Generate secure reset token
    const resetToken = Math.floor(100000 + Math.random() * 900000).toString();

    // Hash before saving
    const hashedToken = crypto
      .createHash("sha256")
      .update(resetToken)
      .digest("hex");

    // Expiry (5 minutes)
    const resetTokenExpiry = new Date(Date.now() + 5 * 60 * 1000);

    // Update DB
    await updatePasswordResetToken(user.id!, hashedToken, resetTokenExpiry);

    //  Send email
    try {
      await sendPasswordResetEmail(user.email!, resetToken, user.name);

      res.status(HTTP_STATUS.OK).json(
        successResponse(
          {
            message: `Password reset token ${isResend ? "resent" : "sent"
              } to your email`,
            expiresIn: "5 minutes",
          },
          MESSAGES.PASSWORD_RESET_TOKEN_SENT
        )
      );
    } catch (emailError) {
      await resetPasswordResetFields(user.id!);

      await error(
        "Failed to send password reset token email",
        { email, userId: user.id, error: emailError },
        { userId: user.id!, source: "auth.handlePasswordResetToken", req }
      );

      res
        .status(HTTP_STATUS.INTERNAL_SERVER_ERROR)
        .json(errorResponse("Failed to send password reset email"));
      return;
    }
  } catch (err: unknown) {
    const errorObj = err as AppError;
    await error(
      "Password reset token request failed with unexpected error",
      {
        email,
        error: errorObj.message,
        stack: errorObj.stack,
        code: errorObj.code,
      },
      { source: "auth.handlePasswordResetToken", req }
    );
    next(errorObj);
  }
};

/**
 * Verifies the password reset token sent to user's email.
 *
 * @param {Request} req - Express request object containing email and reset token.
 * @param {Response} res - Express response object used to send the response.
 * @param {NextFunction} next - Express next middleware function for error handling.
 * @returns {Promise<void>} Returns a promise that resolves when token verification is complete.
 */
export const verifyPasswordResetToken = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  const { email, token } = req.body;

  try {
    //  Find user by email
    const user = await findUserByEmail(email);

    if (!user) {
      await warn(
        "Token verification failed - user not found",
        { email },
        { source: "auth.verifyPasswordResetToken", req }
      );
      res
        .status(HTTP_STATUS.OK)
        .json(errorResponse("Invalid or expired password reset token"));
      return;
    }

    // Hash the provided token for comparison
    const hashedToken = crypto.createHash("sha256").update(token).digest("hex");

    // Compare hashed token and expiry
    if (
      user.password_reset_token !== hashedToken ||
      !user.password_reset_expires ||
      new Date(user.password_reset_expires) <= new Date()
    ) {
      await warn(
        "Password reset token verification failed - invalid or expired token",
        { email },
        { source: "auth.verifyPasswordResetToken", req }
      );
      res
        .status(HTTP_STATUS.OK)
        .json(errorResponse("Invalid or expired password reset token"));
      return;
    }

    res.status(HTTP_STATUS.OK).json(
      successResponse(
        {
          message: "Password reset token verified successfully",
          email: user.email,
          userId: user.id,
        },
        MESSAGES.PASSWORD_RESET_TOKEN_VERIFIED
      )
    );
  } catch (err: unknown) {
    const errorObj = err as AppError;

    await error(
      "Password reset token verification failed with unexpected error",
      {
        email,
        error: errorObj.message,
        stack: errorObj.stack,
        code: errorObj.code,
      },
      { source: "auth.verifyPasswordResetToken", req }
    );

    next(errorObj);
  }
};

/**
 * Resets user password after token verification.
 *
 * @param {Request} req - Express request object containing email, token, and new password.
 * @param {Response} res - Express response object used to send the response.
 * @param {NextFunction} next - Express next middleware function for error handling.
 * @returns {Promise<void>} Returns a promise that resolves when password reset is complete.
 */
export const resetPassword = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  const source = "auth.resetPassword";
  const { email, password, token, old_password } = req.body;

  // if (!old_password) {
  //   res.status(HTTP_STATUS.BAD_REQUEST)
  //     .json(errorResponse("Current password is required"));
  //   return;
  // }

  try {
    let user = null;

    //OTP-based reset (via email + token)
    if (token) {
      const hashedToken = crypto
        .createHash("sha256")
        .update(token)
        .digest("hex");

      user = await findUserByEmail(email);

      if (
        !user ||
        user.password_reset_token !== hashedToken ||
        !user.password_reset_expires ||
        new Date(user.password_reset_expires) <= new Date()
      ) {
        await warn(
          "Invalid or expired password reset token",
          { email },
          { source, req }
        );
        res
          .status(HTTP_STATUS.OK)
          .json(errorResponse("Invalid or expired password reset token"));
        return;
      }
    }
    else if (req.user && typeof req.user === "object" && "userId" in req.user) {
      const { userId } = req.user as { userId: string };
      user = await findUserById(userId);

      if (!user) {
        await warn(
          "User not found during JWT-based password reset",
          { userId },
          { source, req }
        );
        res.status(HTTP_STATUS.NOT_FOUND).json(errorResponse("User not found"));
        return;
      }
    } else {
      // Missing OTP or JWT
      await warn(
        "Password reset failed - missing OTP or JWT",
        { email },
        { source, req }
      );
      res
        .status(HTTP_STATUS.UNAUTHORIZED)
        .json(errorResponse(MESSAGES.UNAUTHORIZED));
      return;
    }
    if (old_password) {
      const passwordCompareResult = await comparePassword(old_password, user?.password || "");
      if (!passwordCompareResult) {
        await warn(
          "Password reset failed - current password does not match",
          { email, userId: user?.id },
          { source, req }
        );
        res
          .status(HTTP_STATUS.OK)
          .json(errorResponse("current password is incorrect"));
        return;
      }

      const isSamePassword = await bcrypt.compare(password, user?.password!);
      if (isSamePassword) {
        await warn(
          "Password reset failed - new password is the same as current password",
          { email, userId: user?.id },
          { source, req }
        );
        res
          .status(HTTP_STATUS.OK)
          .json(errorResponse("New password cannot be the same as current password"));
        return;
      }
    }
    // Hash new password
    const hashedPassword = await bcrypt.hash(password, 10);

    // Update password and clear reset fields
    await updateUserPassword(user.id!, hashedPassword);

    res.status(HTTP_STATUS.OK).json(
      successResponse(
        {
          message: "Password has been reset successfully",
          email: user.email,
        },
        MESSAGES.PASSWORD_RESET_SUCCESS
      )
    );
  } catch (err: unknown) {
    const errorObj = err as AppError;

    await error(
      "Password reset failed with unexpected error",
      {
        email,
        error: errorObj.message,
        stack: errorObj.stack,
        code: errorObj.code,
      },
      { source, req }
    );

    next(errorObj);
  }
};

/**
 * Google Sign-In/Sign-Up handler
 * Verifies Google token and creates or logs in user
 *
 * @param {Request} req - Express request object containing Google id Token
 * @param {Response} res - Express response object
 * @param {NextFunction} next - Express next middleware function
 * @returns {Promise<void>}
 */
export const googleAuth = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  const source = "auth.googleAuth";

  try {
    const { googleAccessToken, roleCode } = req.body;

    if (!googleAccessToken) {
      res
        .status(HTTP_STATUS.BAD_REQUEST)
        .json(errorResponse("Google ID token is required"));
      return;
    }

    // Decode Google token
    const decoded = await decodeGoogleAccessToken(googleAccessToken);

    if (!decoded) {
      res
        .status(HTTP_STATUS.UNAUTHORIZED)
        .json(errorResponse("Invalid Google token"));
      return;
    }

    const { sub: uid, email, name, picture, email_verified } = decoded;

    if (!email) {
      res
        .status(HTTP_STATUS.BAD_REQUEST)
        .json(errorResponse("Email not found in Google account"));
      return;
    }

    let user = await findUserByEmail(email);
    let isNewUser = false;

    // New User Registration
    if (!user) {
      isNewUser = true;

      // Determine role
      let roleName = "user";
      if (roleCode) {
        const mappedRole = RoleCodeMap[roleCode];
        if (!mappedRole) {
          await warn(
            "Google auth failed - invalid role code",
            { email, roleCode },
            { source, req }
          );
          res
            .status(HTTP_STATUS.BAD_REQUEST)
            .json(errorResponse(MESSAGES.ROLE_INVALID_ID));
          return;
        }
        roleName = mappedRole;
      }

      const role = await findRoleByName(roleName);
      if (!role) {
        await warn(
          "Google auth failed - role not found",
          { email },
          { source, req }
        );
        res
          .status(HTTP_STATUS.BAD_REQUEST)
          .json(errorResponse("Valid role is required for registration"));
        return;
      }

      // Create new user
      const userData = await createUserFromOAuth(
        name!,
        email,
        uid,
        role.id!,
        email_verified === true,
        true,
        false,
        false
      );

      //  Download image
      const buffer = await downloadImageAsBuffer(picture!);
      // Upload image
      const uploadedFileKey = await uploadBufferToS3(
        buffer,
        `${Date.now()}.jpg`,
        "Users/ProfileImages"
      );
      // Save S3 key to DB
      await createUserProfileWithImage(userData?.id!, uploadedFileKey);
      // Bind updated user data to user
      user = userData;
    } else {
      // Update Google uid if any register user google uid changes..
      await updateUserFromOAuth(
        user.id!,
        user.google_uid ? undefined : uid,
        true,
        false,
        false
      );
    }
    // Generate JWT token
    const token = generateToken(user?.email!, "User", user?.id!);
    // Send Final Response
    res.status(HTTP_STATUS.OK).json(
      successResponse(
        {
          token,
        },
        isNewUser ? MESSAGES.USER_CREATED : MESSAGES.LOGIN_SUCCESS
      )
    );
  } catch (err: unknown) {
    const errorObj = err as AppError;

    await error(
      "Google authentication failed with unexpected error",
      { error: errorObj.message, stack: errorObj.stack, code: errorObj.code },
      { source, req }
    );

    next(errorObj);
  }
};

/**
 * Handles Facebook Sign-In/Sign-Up.
 * Validates the Facebook access token, retrieves the user's profile,
 * creates a new user if necessary, or logs in an existing user.
 *
 * @param {Request} req - Express request object containing the Facebook access token.
 * @param {Response} res - Express response object used to send the result.
 * @param {NextFunction} next - Express next middleware function for error handling.
 * @returns {Promise<void>}
 */
export const facebookAuth = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  const source = "auth.facebookAuth";

  try {
    const { facebookAccessToken, roleCode, facebookIdToken } = req.body;

    if (!facebookAccessToken && !facebookIdToken) {
      res
        .status(HTTP_STATUS.BAD_REQUEST)
        .json(errorResponse("Facebook token is required"));
      return;
    }

    // Decode + Verify Facebook Token
    // const fbUser = await verifyFacebookToken(facebookAccessToken);

    /**
 * Checks if a token string is in JWT format.
 *
 * A JWT has three parts separated by dots: header.payload.signature
 *
 * @param token - The token string to check
 * @returns True if the string looks like a JWT, false otherwise
 */
    const isJwt = (token: string): boolean => token.split(".").length === 3;


    let fbUser;

    if (facebookIdToken) {
      // iOS: explicit ID token
      fbUser = await verifyFacebookIdToken(facebookIdToken);

    } else if (facebookAccessToken && isJwt(facebookAccessToken)) {
      // Misnamed JWT sent as access token
      fbUser = await verifyFacebookIdToken(facebookAccessToken);

    } else if (facebookAccessToken) {
      // Android: real access token
      fbUser = await verifyFacebookAccessToken(facebookAccessToken);

    } else {
      res
        .status(HTTP_STATUS.UNAUTHORIZED)
        .json(errorResponse("Invalid Facebook token"));
      return;
    }

    if (!fbUser) {
      res
        .status(HTTP_STATUS.UNAUTHORIZED)
        .json(errorResponse("Invalid Facebook token"));
      return;
    }

    const { id: fbUid, email, name, picture } = fbUser;

    if (!email) {
      res
        .status(HTTP_STATUS.BAD_REQUEST)
        .json(errorResponse("Email not found in Facebook account"));
      return;
    }

    let user = await findUserByEmail(email);
    let isNewUser = false;

    // New User Registration
    if (!user) {
      isNewUser = true;

      // Determine role (same as Google)
      let roleName = "user";
      if (roleCode) {
        const mappedRole = RoleCodeMap[roleCode];
        if (!mappedRole) {
          await warn(
            "Facebook auth failed - invalid role code",
            { email, roleCode },
            { source, req }
          );
          res
            .status(HTTP_STATUS.BAD_REQUEST)
            .json(errorResponse(MESSAGES.ROLE_INVALID_ID));
          return;
        }
        roleName = mappedRole;
      }

      const role = await findRoleByName(roleName);
      if (!role) {
        res
          .status(HTTP_STATUS.BAD_REQUEST)
          .json(errorResponse("Valid role is required for registration"));
        return;
      }

      // Create new user
      const userData = await createUserFromOAuth(
        name!,
        email,
        fbUid,
        role.id!,
        true, // Facebook does not provide email_verified by default making true
        false,
        true,
        false
      );

      // Download Facebook picture
      const buffer = await downloadImageAsBuffer(picture!);
      // Upload image
      const uploadedFileKey = await uploadBufferToS3(
        buffer,
        `${Date.now()}.jpg`,
        "Users/ProfileImages"
      );

      // Save profile image
      await createUserProfileWithImage(userData.id!, uploadedFileKey);

      user = userData;
    } else {
      // Update Facebook UID if newly linked
      await updateUserFromOAuth(user.id!, fbUid, false, true, false);
    }

    // Generate JWT token
    const token = generateToken(user.email!, "User", user.id!);

    res.status(HTTP_STATUS.OK).json(
      successResponse(
        {
          token,
        },
        isNewUser ? MESSAGES.USER_CREATED : MESSAGES.LOGIN_SUCCESS
      )
    );
  } catch (err: unknown) {
    const errorObj = err as AppError;

    await error(
      "Facebook authentication failed",
      { error: errorObj.message, stack: errorObj.stack },
      { source, req }
    );

    next(errorObj);
  }
};


/**
 * Handles Apple Sign-In / Sign-Up.
 * Verifies the Apple identity token (JWT), validates the token signature
 * using Apple public keys, extracts the user's Apple profile information,
 * creates a new user if necessary, or logs in an existing user.
 *
 * @param {Request} req - Express request object containing the Apple identity token
 * and optional authorization code.
 * @param {Response} res - Express response object used to send the authentication result.
 * @param {NextFunction} next - Express next middleware function for error handling.
 * @returns {Promise<void>}
 */
export const appleAuth = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  const source = "auth.appleAuth";

  try {
    const { appleIdToken, roleCode, firstName, lastName, email } = req.body;

    if (!appleIdToken) {
      res
        .status(HTTP_STATUS.BAD_REQUEST)
        .json(errorResponse("apple access token is required"));
      return;
    }

    // Decode + Verify Facebook Token
    const appleUser = await verifyAppleIdToken(appleIdToken);


    if (!appleUser) {
      res
        .status(HTTP_STATUS.UNAUTHORIZED)
        .json(errorResponse("Invalid apple  token"));
      return;
    }

    let appleId = appleUser.sub;

    let existingUser = await findUserByAppleId(appleId);
    let isNewUser
    if (!existingUser) {
      isNewUser = true;
      // Determine role 
      let roleName = "user";
      if (roleCode) {
        const mappedRole = RoleCodeMap[roleCode];
        if (!mappedRole) {
          await warn(
            "Apple auth failed - invalid role code",
            { email, roleCode },
            { source, req }
          );
          res
            .status(HTTP_STATUS.BAD_REQUEST)
            .json(errorResponse(MESSAGES.ROLE_INVALID_ID));
          return;
        }
        roleName = mappedRole;
      }

      const role = await findRoleByName(roleName);
      if (!role) {
        res
          .status(HTTP_STATUS.BAD_REQUEST)
          .json(errorResponse("Valid role is required for registration"));
        return;
      }

      const name = `${firstName ?? ""} ${lastName ?? ""}`.trim() || "User";
      // Create new user
      const userData = await createUserFromOAuth(
        name!,
        email,
        appleId,
        role.id!,
        true,
        false,
        false,
        true
      );
      const picture = `https://ui-avatars.com/api/?background=9CA3AF&color=ffffff&size=256&name=${encodeURIComponent(
        name
      )}`;
      // Download avatar picture
      const buffer = await downloadImageAsBuffer(picture);
      // Upload image
      const uploadedFileKey = await uploadBufferToS3(
        buffer,
        `${Date.now()}.jpg`,
        "Users/ProfileImages"
      );

      // Save profile image
      await createUserProfileWithImage(userData.id!, uploadedFileKey);

      existingUser = userData;
    } else {
      // Update Google uid if any register user google uid changes..
      await updateUserFromOAuth(existingUser.id!, appleId, false, false, true);
    }

    const token = generateToken(existingUser.email!, "User", existingUser.id!);

    res.status(HTTP_STATUS.OK).json(
      successResponse(
        {
          token,
        },
        isNewUser ? MESSAGES.USER_CREATED : MESSAGES.LOGIN_SUCCESS
      )
    );

  } catch (err: unknown) {
    const errorObj = err as AppError;

    await error(
      "apple authentication failed",
      { error: errorObj.message, stack: errorObj.stack },
      { source, req }
    );
    next(errorObj);
  }
};

