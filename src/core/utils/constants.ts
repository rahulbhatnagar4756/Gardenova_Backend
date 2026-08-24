// src/constants/index.ts

export const HTTP_STATUS = {
  OK: 200,
  CREATED: 201,
  BAD_REQUEST: 400,
  UNAUTHORIZED: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  CONFLICT: 409,
  INTERNAL_SERVER_ERROR: 500,
  TOO_MANY_REQUESTS: 429,
  GONE: 410,
} as const;

export const MESSAGES = {
  //#region Authentication Messages
  USER_CREATED: "User registered successfully",
  USER_REGISTER_OTP_SENT: "Registration successful. Please verify the OTP sent to your email",
  LOGIN_SUCCESS: "Login successful",
  TOKEN_REFRESHED: "Token refreshed successfully",
  LOGOUT_SUCCESS: "Logged out successfully",
  INVALID_CREDENTIALS: "Invalid email or password",
  EMAIL_NOT_VERIFIED: "Please verify your email before logging in",
  USER_EXISTS: "User with this email already exists",
  USER_NOTFOUND: "Invalid email or password. Please try again.",
  USER_PHONE_EXISTS: "User with this phone number already exists",
  OTP_SENT: "OTP sent successfully",
  OTP_INVALID: "Invalid or expired OTP",
  // Token and Auth-related Messages
  TOKEN_INVALID: "Invalid token",
  TOKEN_EXPIRED: "Token has expired",
  TOKEN_MISSING: "Unauthorized: Missing authentication token",
  TOKEN_NOT_ACTIVE: "Token not active yet",
  JWT_UNKNOWN_ERROR: "Unexpected authentication error",
  UNAUTHORIZED: "Access denied. No token provided.",
  //#endregion

  //#region User Profile Messages
  PROFILE_SUCCESS: "Profile retrieved successfully",
  PROFILE_USER_NOTFOUND: "User not found",
  PROFILE_CREATED: "Profile created successfully",
  PROFILE_UPDATED: "Profile updated successfully",
  PROFILE_DELETED: "Profile deleted successfully",
  //#endregion

  //#region Role Messages
  ROLE_INVALID_ID: "Invalid role ID",
  ROLE_CREATED: "New role is added successfully",
  ROLE_UPDATED: "Role updated successfully",
  ROLE_NOT_EXIST: "Role not found",
  ROLE_EXIST: "Role already exists",
  ROLE_DELETED: "Role deleted successfully",
  //#endregion

  //#region Plant module
  PLANT_CREATED: "Plant created successfully",
  PLANT_UPDATED: "Plant updated successfully",
  PLANT_DELETED: "Plant deleted successfully",
  PLANT_NOT_FOUND: "Plant not found",
  PLANT_HISTORY_SAVED: "Plant history saved successfully",
  TIPS_RETRIEVED: "Personalized tips retrieved successfully",
  IDENTIFICATION_COMPLETED: "Plant identification completed",
  //#endregion

  CONVERSATION_COMPLETED: "Plant conversation completed successfully",
  CONVERSATION_FAILED: "Plant conversation failed",
  NO_ANSWER_RECEIVED:
    "No answer received from the plant identification service",
  GARDEN_CHAT_REPLY: "Gardening reply generated successfully",
  GARDEN_CHAT_NOT_RELATED:
    "This chat is not gardening related. Please ask a plant or garden question.",
  GARDEN_CHAT_HISTORY: "Garden chat history fetched successfully",
  GARDEN_CHAT_PAID_ONLY:
    "Garden chat is available for paid users only. Please upgrade your plan to continue.",
  GARDEN_INSIGHTS_FETCHED: "Garden insight scores fetched successfully",

  //#region Password Messages
  PASSWORD_RESET_SENT: "Password reset email sent successfully",
  PASSWORD_RESET_SUCCESS: "Password has been reset successfully",
  VERIFICATION_TOKEN_SENT: "Verification token sent to your email",
  EMAIL_VERIFICATION_SUCCESS: "Email verified successfully",
  PASSWORD_RESET_TOKEN_SENT: "Password reset token email sent successfully",
  PASSWORD_RESET_TOKEN_VERIFIED: "Password reset token verified successfully",
  //#endregion

  //#region Question Messages
  QUESTION_CREATED: "Question created successfully",
  QUESTION_UPDATED: "Question updated successfully",
  QUESTION_DELETED: "Question deleted successfully",
  QUESTIONS_RETRIEVED: "Question retreived successfully",
  //#endregion

  //#region Rules Messages
  RULES_RETRIEVED: "Rules retrieved successfully",
  RULE_CREATED: "Rule created successfully",
  RULE_UPDATED: "Rule updated successfully",
  RULE_DELETED: "Rule deleted successfully",
  RULE_NOT_FOUND: "Rule not found",
  //#endregion
} as const;

// Types for stronger typing in services/controllers
export type HttpStatusCode = (typeof HTTP_STATUS)[keyof typeof HTTP_STATUS];
export type MessageKey = keyof typeof MESSAGES;
export type MessageValue = (typeof MESSAGES)[MessageKey];
