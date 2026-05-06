import express, { Router } from "express";
import auth from "../../../core/middleware/authMiddleware";
import { getDashboardData } from "./dashboardController";

const router: Router = express.Router();

/**
 * @swagger
 * /api/v1/admin/dashboard:
 *   get:
 *     summary: Fetch dashboard statistics
 *     tags: [Dashboard]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Dashboard statistics retrieved successfully
 */
router.get("/dashboard", auth, getDashboardData);

export default router;
