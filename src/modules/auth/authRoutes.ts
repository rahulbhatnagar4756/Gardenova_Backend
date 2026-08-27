import { Router } from "express";
import {
  register,
  login,
  resetPassword,
  verifyPasswordResetToken,
  handlePasswordResetToken,
  refreshTokenLogin,
  logout,
  googleAuth,
  facebookAuth,
  appleAuth,
  resendEmailOtp,
  verifyEmailOtp,
} from "./authController";
import {
  registerValidation,
  loginValidation,
  resetPasswordValidation,
  verifyPasswordResetTokenValidation,
  handlePasswordResetTokenValidation,
  passwordChangeValidation,
  googleAuthValidation,
  facebookAuthValidation,
  appleAuthValidation,
  sendEmailOtpValidation,
  verifyEmailOtpValidation,
  refreshTokenValidation,
  logoutValidation,
} from "./authValidations";
import validateRequest from "../../core/middleware/validateRequest";
import auth from "../../core/middleware/authMiddleware";

const router = Router();

/**
 * @swagger
 * tags:
 *   name: Auth
 *   description: Authentication routes
 */

/**
 * @swagger
 * /api/v1/auth/register:
 *   post:
 *     summary: Register a new user
 *     description: |
 *       Creates a pending account and sends a 6-digit OTP to the email.
 *       Call `/email/verify-otp` to complete registration.
 *     tags:
 *       - Auth
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - name
 *               - email
 *               - password
 *               - phoneNumber
 *               - roleCode
 *             properties:
 *               name:
 *                 type: string
 *                 example: John Doe
 *               email:
 *                 type: string
 *                 format: email
 *                 example: john@example.com
 *               password:
 *                 type: string
 *                 example: Secret@123#
 *               phoneNumber:
 *                 type: string
 *                 example: "+919876543210"
 *               roleCode:
 *                 type: string
 *                 example: U
 *     responses:
 *       201:
 *         description: OTP sent to email
 *       400:
 *         description: Validation failed
 *       409:
 *         description: Email or phone already registered
 */
router.post("/register", validateRequest(registerValidation), register);

/**
 * @swagger
 * /api/v1/auth/email/send-otp:
 *   post:
 *     summary: Resend email verification OTP
 *     description: Resends OTP for an unverified registration email. 1-minute cooldown.
 *     tags: [Auth]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - email
 *             properties:
 *               email:
 *                 type: string
 *                 example: john@example.com
 *     responses:
 *       200:
 *         description: OTP sent successfully
 *       404:
 *         description: User not found
 *       429:
 *         description: Cooldown active
 */
router.post("/email/send-otp", validateRequest(sendEmailOtpValidation), resendEmailOtp);

/**
 * @swagger
 * /api/v1/auth/email/verify-otp:
 *   post:
 *     summary: Verify email OTP and complete registration
 *     description: Marks email as verified and returns a JWT token.
 *     tags: [Auth]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - email
 *               - otp
 *             properties:
 *               email:
 *                 type: string
 *                 example: john@example.com
 *               otp:
 *                 type: string
 *                 example: "123456"
 *     responses:
 *       200:
 *         description: Email verified; JWT returned
 *       400:
 *         description: Invalid or expired OTP
 */
router.post("/email/verify-otp", validateRequest(verifyEmailOtpValidation), verifyEmailOtp);

/**
 * @swagger
 * /api/v1/auth/login:
 *   post:
 *     summary: Login with email and password
 *     tags: [Auth]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - email
 *               - password
 *             properties:
 *               email:
 *                 type: string
 *                 example: john@example.com
 *               password:
 *                 type: string
 *                 example: Secret@123#
 *               loginType:
 *                 type: string
 *                 enum: [user, professional]
 *                 example: user
 *     responses:
 *       200:
 *         description: Login successful
 *       401:
 *         description: Invalid credentials
 *       403:
 *         description: Email not verified
 */
router.post("/login", validateRequest(loginValidation), login);

/**
 * @swagger
 * /api/v1/auth/refresh:
 *   post:
 *     summary: Refresh access token
 *     description: Exchange a valid refresh token for a new access + refresh token pair.
 *     tags: [Auth]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - refreshToken
 *             properties:
 *               refreshToken:
 *                 type: string
 *                 example: "a1b2c3d4e5f6..."
 *     responses:
 *       200:
 *         description: Token refreshed successfully
 *       401:
 *         description: Invalid or expired refresh token
 */
router.post("/refresh", validateRequest(refreshTokenValidation), refreshTokenLogin);

/**
 * @swagger
 * /api/v1/auth/logout:
 *   post:
 *     summary: Logout and revoke refresh token
 *     tags: [Auth]
 *     requestBody:
 *       required: false
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               refreshToken:
 *                 type: string
 *     responses:
 *       200:
 *         description: Logged out successfully
 */
router.post("/logout", validateRequest(logoutValidation), logout);

/**
 * @swagger
 * /api/v1/auth/resetPassword:
 *   patch:
 *     summary: Reset password
 *     tags: [Auth]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - email
 *               - password
 *               - token
 *             properties:
 *               email:
 *                 type: string
 *                 description: Registered email of the user
 *                 example: john@example.com
 *               password:
 *                 type: string
 *                 minLength: 6
 *                 description: New password for the user
 *                 example: newSecret123
 *               token:
 *                 type: string
 *                 example: "123456"
 *     responses:
 *       200:
 *         description: Password reset successful
 *       400:
 *         description: Invalid request
 *       404:
 *         description: User not found
 */
router.patch(
  "/resetPassword",
  validateRequest(resetPasswordValidation),
  resetPassword
);

/**
 * @swagger
 * /api/v1/auth/resetPassword/auth:
 *   patch:
 *     summary: Reset password using JWT (logged-in user)
 *     description: Allows authenticated users to reset their password using a valid JWT token. The user's email is automatically derived from the token.
 *     tags: [Auth]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - password
 *             properties:
 *               password:
 *                 type: string
 *                 minLength: 6
 *                 description: New password to set
 *                 example: SecurePass@2025
 *     responses:
 *       200:
 *         description: Password reset successful
 *       401:
 *         description: Unauthorized (missing or invalid JWT)
 *       404:
 *         description: User not found
 */
router.patch(
  "/resetPassword/auth",
  auth,
  validateRequest(passwordChangeValidation),
  resetPassword
);

/**
 * @swagger
 * /api/v1/auth/passwordResetToken:
 *   post:
 *     summary: Send or Resend password reset token
 *     tags: [Auth]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - email
 *             properties:
 *               email:
 *                 type: string
 *                 example: john@example.com
 *               isResend:
 *                 type: boolean
 *                 example: false
 *                 description: Pass true if you want to resend a new token
 *     responses:
 *       200:
 *         description: Token sent successfully
 *       404:
 *         description: User not found
 *       429:
 *         description: Rate limit exceeded (if resend too soon)
 *       500:
 *         description: Failed to send email
 */
router.post(
  "/passwordResetToken",
  validateRequest(handlePasswordResetTokenValidation),
  handlePasswordResetToken
);

/**
 * @swagger
 * /api/v1/auth/verifyToken:
 *   post:
 *     summary: Verify password reset token
 *     tags: [Auth]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - email
 *               - token
 *             properties:
 *               email:
 *                 type: string
 *                 example: john@example.com
 *               token:
 *                 type: string
 *                 example: "123456"
 *     responses:
 *       200:
 *         description: Token verified successfully
 *       400:
 *         description: Invalid or expired token
 *       404:
 *         description: User not found
 */
router.post(
  "/verifyToken",
  validateRequest(verifyPasswordResetTokenValidation),
  verifyPasswordResetToken
);

/**
 * @swagger
 * /api/v1/auth/google:
 *   post:
 *     summary: Sign in or sign up with Google
 *     tags: [Auth]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - googleAccessToken
 *             properties:
 *               googleAccessToken:
 *                 type: string
 *               roleCode:
 *                 type: string
 *                 example: U
 *     responses:
 *       200:
 *         description: Authentication successful. Includes tokens, role, and latest survey responseId.
 */
router.post("/google", validateRequest(googleAuthValidation), googleAuth);

/**
 * @swagger
 * /api/v1/auth/facebook:
 *   post:
 *     summary: Sign in or sign up with Facebook
 *     tags: [Auth]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             oneOf:
 *               - required: [facebookAccessToken]
 *               - required: [facebookIdToken]
 *             properties:
 *               facebookAccessToken:
 *                 type: string
 *               facebookIdToken:
 *                 type: string
 *               roleCode:
 *                 type: string
 *                 example: U
 *     responses:
 *       200:
 *         description: Authentication successful
 */
router.post("/facebook", validateRequest(facebookAuthValidation), facebookAuth);

/**
 * @swagger
 * /api/v1/auth/apple:
 *   post:
 *     summary: Sign in or sign up with Apple
 *     tags: [Auth]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - appleIdToken
 *             properties:
 *               appleIdToken:
 *                 type: string
 *               firstName:
 *                 type: string
 *               lastName:
 *                 type: string
 *               email:
 *                 type: string
 *               roleCode:
 *                 type: string
 *                 example: U
 *     responses:
 *       200:
 *         description: Authentication successful
 */
router.post(
  "/apple",
  validateRequest(appleAuthValidation),
  appleAuth
);

export default router;
