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
 *       Builds five pie-chart slices from the user's onboarding answers
 *       and the plants added to their account.
 *       If the user has no plants, every slice is 0%.
 *       When plants exist, percents always sum to 100.
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
 *       401:
 *         description: Unauthorized
 */
router.get("/", auth, getGardenInsightsController);

export default router;
