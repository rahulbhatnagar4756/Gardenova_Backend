import { Router } from "express";
import auth from "../../core/middleware/authMiddleware";
import validateRequest from "../../core/middleware/validateRequest";
import {
  completeDailyChallengeController,
  getDailyChallengesController,
  getGamificationMeController,
} from "./gamificationController";
import { completeDailyChallengeParamsValidation } from "./gamificationValidation";

const router = Router();

/**
 * @swagger
 * /api/v1/gamification/daily-challenges:
 *   get:
 *     summary: Get today's personalized daily challenges
 *     description: >
 *       Assigns and returns 1 daily challenge tailored to the user's
 *       garden activity, survey answers, scan history, care progress, and
 *       free/paid plan quotas (diagnosis / landscape limits).
 *       Completing the challenge awards points automatically when the related
 *       in-app action is performed, or via the mark-complete endpoint.
 *     tags: [Gamification]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Daily challenges retrieved
 *       401:
 *         description: Unauthorized
 */
router.get("/daily-challenges", auth, getDailyChallengesController);

/**
 * @swagger
 * /api/v1/gamification/daily-challenges/{challengeId}/complete:
 *   post:
 *     summary: Mark a daily challenge activity as complete
 *     description: >
 *       Marks one of the user's assigned daily challenges as complete and
 *       awards its points once. Safe to call again if already completed.
 *     tags: [Gamification]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: challengeId
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: Daily challenge assignment id from GET daily-challenges
 *     responses:
 *       200:
 *         description: Challenge completed (or already completed)
 *       400:
 *         description: Challenge expired or cannot be completed
 *       401:
 *         description: Unauthorized
 *       404:
 *         description: Challenge not found for this user
 */
router.post(
  "/daily-challenges/:challengeId/complete",
  auth,
  validateRequest(completeDailyChallengeParamsValidation, "params"),
  completeDailyChallengeController
);

/**
 * @swagger
 * /api/v1/gamification/me:
 *   get:
 *     summary: Get gamification profile
 *     description: >
 *       Returns total points, care streak, today's earned points, and the
 *       current daily challenge set for the authenticated user.
 *     tags: [Gamification]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Gamification profile retrieved
 *       401:
 *         description: Unauthorized
 */
router.get("/me", auth, getGamificationMeController);

export default router;
