import { Router } from "express";
import auth from "../../core/middleware/authMiddleware";
import { getGardenInsightsController } from "./gardenInsightsController";

const router = Router();

/**
 * @swagger
 * /api/v1/garden-insights:
 *   get:
 *     summary: Get garden pie-chart insight scores
 *     description: >
 *       Derives five fitness scores from the user's onboarding answers only
 *       (no plant catalog and no My Plants).
 *       Light Fit = sunlight + space; Water Consistency = watering habit;
 *       Experience Readiness = experience; Space Utilization = space + goal;
 *       Growth Potential = climate + watering + sunlight.
 *       `score` is 0–100 for that dimension. `percent` is the pie share (sums to 100).
 *     tags: [Garden Insights]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Garden insight scores
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
 *                   example: Garden insight scores fetched successfully
 *                 data:
 *                   type: object
 *                   properties:
 *                     hasSurvey:
 *                       type: boolean
 *                       example: true
 *                     totalPercent:
 *                       type: integer
 *                       example: 100
 *                     chart:
 *                       type: array
 *                       items:
 *                         type: object
 *                         properties:
 *                           key:
 *                             type: string
 *                             example: lightFit
 *                           label:
 *                             type: string
 *                             example: Light Fit
 *                           percent:
 *                             type: integer
 *                             example: 18
 *                           score:
 *                             type: integer
 *                             example: 85
 *       401:
 *         description: Unauthorized
 */
router.get("/", auth, getGardenInsightsController);

export default router;
