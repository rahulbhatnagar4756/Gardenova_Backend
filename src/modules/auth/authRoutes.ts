import { Router } from "express";
import {
  register,
  login,
  resetPassword,
  verifyPasswordResetToken,
  handlePasswordResetToken,
  refreshTokenLogin,
  googleAuth,
  facebookAuth,
  appleAuth,
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
 *     tags: [Auth]
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
 *               - roleId
 *             properties:
 *               name:
 *                 type: string
 *                 example: John Doe
 *               email:
 *                 type: string
 *                 example: john@example.com
 *               password:
 *                 type: string
 *                 example: Secret@123#
 *               roleCode:
 *                 type: string
 *                 description: Code of the role assigned to the user
 *                 example: U
 *               phoneNumber:
 *                 type: string
 *                 description: User's phone number (optional)
 *                 example: +91 9876543210
 *     responses:
 *       201:
 *         description: User registered successfully
 *       409:
 *         description: Email or Phone Number already exists
 */
router.post("/register", validateRequest(registerValidation), register);

/**
 * @swagger
 * /api/v1/auth/login:
 *   post:
 *     summary: Login user
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
 *               - loginType
 *             properties:
 *               email:
 *                 type: string
 *                 format: email
 *                 example: john@example.com
 *               password:
 *                 type: string
 *                 example: secret123
 *               loginType:
 *                 type: string
 *                 description: Type of login (e.g., 'user', 'professional', 'admin')
 *                 example: professional
 *     responses:
 *       200:
 *         description: Login successful
 *       401:
 *         description: Invalid credentials
 */
router.post("/login", validateRequest(loginValidation), login);

/**
 * @swagger
 * /api/v1/auth/refresh:
 *   get:
 *     summary: Refresh user token
 *     tags: [Auth]
 *     responses:
 *       200:
 *         description: Refresh Login successful
 *       401:
 *         description: Invalid credentials
 */
router.get("/refresh", auth, refreshTokenLogin);

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
 *         content:
 *           application/json:
 *             example:
 *               success: true
 *               data:
 *                 message: "Password has been reset successfully"
 *                 email: "john@example.com"
 *               message: "Password reset successful"
 *       401:
 *         description: Unauthorized (missing or invalid JWT)
 *         content:
 *           application/json:
 *             example:
 *               success: false
 *               message: "Unauthorized access"
 *       404:
 *         description: User not found
 *         content:
 *           application/json:
 *             example:
 *               success: false
 *               message: "User not found"
 *       500:
 *         description: Server error
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
  validateRequest(handlePasswordResetTokenValidation), // you can merge validations if needed
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
 *                 description: Google Access token obtained from Google Sign-In
 *                 example: eyJhbGciOiJSUzI1NiIsImtpZCI6IjFkYzBmM...
 *               roleCode:
 *                 type: string
 *                 description: Optional role code for new users.
 *                 example: U
 *     responses:
 *       200:
 *         description: Authentication successful
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 message:
 *                   type: string
 *                   example: Login successful
 *                 data:
 *                   type: object
 *                   properties:
 *                     token:
 *                       type: string
 *                       description: Your backend JWT token for API authentication
 *                       example: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9... *
 *       400:
 *         description: Validation error or invalid Google token
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: false
 *                 message:
 *                   type: string
 *                   example: Google Access token is required
 *       401:
 *         description: Invalid or expired Google token
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: false
 *                 message:
 *                   type: string
 *                   example: Invalid or expired Google token
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
 *                 description: >
 *                   Facebook access token obtained from Facebook Login.
 *                   Typically used by Android or web clients.
 *                 example: EAAJZCZA7C5wB0BAKZAyZA7ZCZAyZA7CZA...
 *               facebookIdToken:
 *                 type: string
 *                 description: >
 *                   Facebook ID token (JWT) obtained from Facebook Login.
 *                   Typically used by iOS clients.
 *                 example: eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCJ9...
 *               roleCode:
 *                 type: string
 *                 description: Optional role code for new users
 *                 example: U
 *     responses:
 *       200:
 *         description: Authentication successful
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 message:
 *                   type: string
 *                   example: Login successful
 *                 data:
 *                   type: object
 *                   properties:
 *                     token:
 *                       type: string
 *                       description: Backend JWT token for API authentication
 *                       example: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
 *       400:
 *         description: Validation error or missing Facebook token
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: false
 *                 message:
 *                   type: string
 *                   example: Either Facebook access token or Facebook ID token is required
 *       401:
 *         description: Invalid or expired Facebook token
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: false
 *                 message:
 *                   type: string
 *                   example: Invalid or expired Facebook token
 */
router.post("/facebook", validateRequest(facebookAuthValidation), facebookAuth);


/**
 * @swagger
 * /api/v1/auth/apple:
 *   post:
 *     summary: Sign in or sign up with Apple
 *     description: >
 *       Authenticates a user using Apple Sign-In.
 *       Verifies the Apple identity token, creates a new user on first login,
 *       or logs in an existing user.
 *       Apple provides firstName and lastName **only on the first authorization**.
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
 *                 description: Apple identity token (JWT) obtained from Apple Sign-In
 *                 example: eyJraWQiOiJBMkJDM0QiLCJhbGciOiJSUzI1NiJ9...
 *               firstName:
 *                 type: string
 *                 description: Optional first name (returned only once by Apple on first login)
 *                 example: John
 *               lastName:
 *                 type: string
 *                 description: Optional last name (returned only once by Apple on first login)
 *                 example: Doe
 *               email:
 *                 type: string
 *                 description: Optional email (returned by Apple or provided by frontend)
 *                 example: john.doe@example.com
 *               roleCode:
 *                 type: string
 *                 description: Optional role code for new users
 *                 example: U
 *     responses:
 *       200:
 *         description: Authentication successful
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 message:
 *                   type: string
 *                   example: Login successful
 *                 data:
 *                   type: object
 *                   properties:
 *                     token:
 *                       type: string
 *                       description: Backend JWT token for API authentication
 *                       example: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
 *       400:
 *         description: Validation error or missing Apple identity token
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: false
 *                 message:
 *                   type: string
 *                   example: Apple identity token is required
 *       401:
 *         description: Invalid or expired Apple identity token
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: false
 *                 message:
 *                   type: string
 *                   example: Invalid or expired Apple token
 *       500:
 *         description: Internal server error
 */
router.post(
  "/apple",
  validateRequest(appleAuthValidation),
  appleAuth
);


export default router;
