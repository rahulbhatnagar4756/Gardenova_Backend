import express, { Router } from "express";
import auth from "../../../core/middleware/authMiddleware";
import { getAdminUserById, getAdminUsers } from "./usersController";

const router: Router = express.Router();

/**
 * @swagger
 * /api/v1/admin/users:
 *   get:
 *     summary: Admin user list with search, filters, and subscription history
 *     tags: [Admin Users]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           default: 1
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 20
 *           maximum: 100
 *       - in: query
 *         name: search
 *         schema:
 *           type: string
 *         description: Match name, email, or phone
 *       - in: query
 *         name: tier
 *         schema:
 *           type: string
 *           enum: [free, starter, plus, pro]
 *         description: Current subscription tier (users without a row count as free)
 *       - in: query
 *         name: accountStatus
 *         schema:
 *           type: string
 *           enum: [active, inactive]
 *         description: active = not soft-deleted; inactive = isdeleted
 *       - in: query
 *         name: signupFrom
 *         schema:
 *           type: string
 *           format: date-time
 *         description: Inclusive signup start (ISO)
 *       - in: query
 *         name: signupTo
 *         schema:
 *           type: string
 *           format: date-time
 *         description: Inclusive signup end (ISO)
 *       - in: query
 *         name: subscriptionStatus
 *         schema:
 *           type: string
 *           enum: [active, pending, canceled, expired, on_hold, in_grace, paused, none]
 *     responses:
 *       200:
 *         description: Paginated users with subscription + purchase history
 *       401:
 *         description: Unauthorized / not Admin
 */
router.get("/users", auth, getAdminUsers);

/**
 * @swagger
 * /api/v1/admin/users/{id}:
 *   get:
 *     summary: Admin user detail with subscription history
 *     tags: [Admin Users]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *     responses:
 *       200:
 *         description: User detail
 *       404:
 *         description: User not found
 *       401:
 *         description: Unauthorized / not Admin
 */
router.get("/users/:id", auth, getAdminUserById);

export default router;
