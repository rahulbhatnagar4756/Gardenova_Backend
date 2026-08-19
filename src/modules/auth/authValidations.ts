import Joi, { CustomHelpers } from "joi";
import { RoleCodeMap } from "../../interface/role";

/**
 * Validates password complexity against specific rules.
 * Ensures the password contains at least:
 *  - one lowercase letter
 *  - one uppercase letter
 *  - one number
 *  - one special character
 *
 * @param {string} value - The password string to validate.
 * @param {import("joi").CustomHelpers} helpers - Joi custom helpers for returning errors.
 * @returns {string | import("joi").ErrorReport} The validated password string if valid,
 * or a Joi.ErrorReport if validation fails.
 */
const passwordComplexity = (
  value: string,
  helpers: CustomHelpers
): string | Joi.ErrorReport => {
  const errors: string[] = [];

  if (!/[a-z]/.test(value))
    errors.push("Password must include at least one lowercase letter");
  // if (!/[A-Z]/.test(value))
  //   errors.push("Password must include at least one uppercase letter");
  if (!/[0-9]/.test(value))
    errors.push("Password must include at least one number");
  if (!/[\W_]/.test(value))
    errors.push("Password must include at least one special character");

  if (errors.length) {
    // helpers.message returns a Joi.ErrorReport, not a string
    return helpers.message({ custom: errors.join(", ") });
  }

  return value;
};

export const registerValidation = Joi.object({
  name: Joi.string().min(2).max(50).required(),
  roleCode: Joi.string()
    .length(1)
    .valid(...Object.keys(RoleCodeMap))
    .required(),
  email: Joi.string().email().required(),
  password: Joi.string()
    .min(6)
    .required()
    .custom(passwordComplexity, "Password complexity validation"),
  phoneNumber: Joi.string()
    .pattern(/^\+[1-9]\d{7,14}$/)
    .required()
    .messages({
      "string.pattern.base": "Phone number must be in E.164 format (e.g. +919876543210)",
    }),
});

export const loginValidation = Joi.object({
  email: Joi.string().email().required(),
  password: Joi.string().required(),
  loginType: Joi.string()
                  .valid("professional", "user")
                  .optional(),
});

export const sendEmailOtpValidation = Joi.object({
  email: Joi.string().email().required(),
});

export const verifyEmailOtpValidation = Joi.object({
  email: Joi.string().email().required(),
  otp: Joi.string().length(6).pattern(/^\d+$/).required(),
});

export const refreshTokenValidation = Joi.object({
  refreshToken: Joi.string().min(20).required().messages({
    "any.required": "Refresh token is required",
    "string.empty": "Refresh token is required",
  }),
});

export const logoutValidation = Joi.object({
  refreshToken: Joi.string().min(20).optional(),
});

// Unified Validation for Send/Resend Password Reset Token
export const handlePasswordResetTokenValidation = Joi.object({
  email: Joi.string()
    .email({ tlds: { allow: false } })
    .required()
    .messages({
      "string.email": "Please provide a valid email address",
      "string.empty": "Email is required",
      "any.required": "Email is required",
    }),
  isResend: Joi.boolean().default(false).messages({
    "boolean.base": "isResend must be a boolean value",
  }),
});

// Reset Password Validation (final step)
export const resetPasswordValidation = Joi.object({
  email: Joi.string()
    .email({ tlds: { allow: false } })
    .required()
    .messages({
      "string.email": "Please provide a valid email address",
      "string.empty": "Email is required",
      "any.required": "Email is required",
    }),
  password: Joi.string()
    .min(6)
    .required()
    .custom(passwordComplexity, "Password complexity validation"),
  token: Joi.string()
    .length(6)
    .pattern(/^\d{6}$/)
    .required()
    .messages({
      "string.length": "Password reset token must be exactly 6 digits",
      "string.pattern.base": "Password reset token must contain only numbers",
      "string.empty": "Password reset token is required",
      "any.required": "Password reset token is required",
    }),
});

// Resend Password Reset Token Validation (same as send)
export const resendPasswordResetTokenValidation = Joi.object({
  email: Joi.string()
    .email({ tlds: { allow: false } })
    .required()
    .messages({
      "string.email": "Please provide a valid email address",
      "string.empty": "Email is required",
      "any.required": "Email is required",
    }),
});

// Verify Password Reset Token Validation
export const verifyPasswordResetTokenValidation = Joi.object({
  email: Joi.string()
    .email({ tlds: { allow: false } })
    .required()
    .messages({
      "string.email": "Please provide a valid email address",
      "string.empty": "Email is required",
      "any.required": "Email is required",
    }),
  token: Joi.string()
    .length(6)
    .pattern(/^\d{6}$/)
    .required()
    .messages({
      "string.length": "Password reset token must be exactly 6 digits",
      "string.pattern.base": "Password reset token must contain only numbers",
      "string.empty": "Password reset token is required",
      "any.required": "Password reset token is required",
    }),
});

// Password Change Validation (JWT-based)
export const passwordChangeValidation = Joi.object({
  password: Joi.string()
    .min(6)
    .required()
    .custom(passwordComplexity, "Password complexity validation")
    .messages({
      "string.min": "Password must be at least 6 characters long",
      "string.empty": "Password is required",
      "any.required": "Password is required",
    }),
    old_password: Joi.string()
    .min(6)
    .required()
    // .custom(passwordComplexity, "Password complexity validation")
    .messages({
      "string.min": "Password must be at least 6 characters long",
      "string.empty": "Password is required",
      "any.required": "Password is required",
    }),
});

/**
 * Validation schema for Google OAuth authentication
 */
export const googleAuthValidation = Joi.object({
  googleAccessToken: Joi.string().min(1).required().messages({
    "string.empty": "Google access token is required",
    "any.required": "Google access token is required",
    "string.min": "Google access token cannot be empty",
  }),

  roleCode: Joi.string().optional().messages({
    "string.base": "Role code must be a string",
  }),
}).messages({
  "object.unknown": "Unknown field provided in request body",
});

/**
 * Validation schema for Facebook OAuth authentication
 */
export const facebookAuthValidation = Joi.object({
  facebookAccessToken: Joi.string()
    .min(1)
    .allow(null),

  facebookIdToken: Joi.string()
    .min(1)
    .allow(null),

  roleCode: Joi.string().optional(),
})
.custom((value, helpers) => {
  const hasAccessToken =
    typeof value.facebookAccessToken === "string" &&
    value.facebookAccessToken.length > 0;

  const hasIdToken =
    typeof value.facebookIdToken === "string" &&
    value.facebookIdToken.length > 0;

  if (!hasAccessToken && !hasIdToken) {
    return helpers.error("any.custom");
  }

  return value;
})
.messages({
  "any.custom":
    "Either Facebook access token or Facebook ID token is required",
});


/**
 * Validation schema for Apple OAuth authentication
 */
export const appleAuthValidation = Joi.object({
  appleIdToken: Joi.string().min(1).required().messages({
    "string.empty": "Apple access token is required",
    "any.required": "Apple access token is required",
    "string.min": "Apple access token cannot be empty",
  }),

  firstName: Joi.string().optional().allow("", null),

  lastName: Joi.string().optional().allow("", null),

  roleCode: Joi.string().optional(),

  email: Joi.string().email().optional().allow("", null).messages({
    "string.email": "Email must be a valid email address",
  }),
})

