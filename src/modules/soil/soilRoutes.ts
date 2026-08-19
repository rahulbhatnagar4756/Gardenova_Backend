import { Router } from "express";
import auth from "../../core/middleware/authMiddleware";
import validateRequest from "../../core/middleware/validateRequest";
import { soilTypeValidation } from "./soilValidation";
import { getSoilType } from "./soilController";

const router = Router();

/**
 * @swagger
 * /api/v1/soil/type:
 *   post:
 *     summary: Get soil type for a location
 *     description: >
 *       Accepts optional latitude and longitude. When provided, coordinates are saved
 *       for the authenticated user and GPT classifies soil as organic, salt, clay, or sand.
 *       When omitted, the user's last saved coordinates are used.
 *     tags: [Soil]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: false
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               latitude:
 *                 type: number
 *                 minimum: -90
 *                 maximum: 90
 *                 example: 19.076
 *               longitude:
 *                 type: number
 *                 minimum: -180
 *                 maximum: 180
 *                 example: 72.8777
 *     responses:
 *       200:
 *         description: Soil type classified
 *       400:
 *         description: Missing coordinates and no saved location
 *       401:
 *         description: Unauthorized
 */
router.post("/type", auth, validateRequest(soilTypeValidation), getSoilType);

export default router;
