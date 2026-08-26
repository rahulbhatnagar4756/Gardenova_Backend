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
 *       Scores recommended plants (from onboarding answers) against those answers.
 *       Uses Light / Water / Experience / Space / Growth fit with partial credit.
 *       If there is no survey or no recommended plants, every slice is 0%.
 *       `percent` is the pie share (sums to 100). `matchPercent` is how well
 *       the recommended plants match that metric.
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
 *                     plantCount:
 *                       type: integer
 *                       example: 3
 *                     hasPlants:
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
 *                           matchPercent:
 *                             type: integer
 *                             example: 67
 *                           matchedCount:
 *                             type: integer
 *                             example: 2
 *       401:
 *         description: Unauthorized
 */
router.get("/", auth, getGardenInsightsController);

export default router;
