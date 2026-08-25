import { Router } from "express";
import auth from "../../core/middleware/authMiddleware";
import validateRequest from "../../core/middleware/validateRequest";
import { plantScanCompareValidation } from "./plantValidation";
import {
  comparePlantScanController,
  getPlantScanByIdController,
  listPlantScansController,
} from "./plantScanController";

const router = Router();

/**
 * @swagger
 * /api/v1/plant-scans:
 *   get:
 *     summary: List my scanned plants
 *     description: Returns paginated plant scans saved from identify/diagnose, newest first.
 *     tags: [Plant Scans]
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
 *           default: 10
 *           maximum: 50
 *     responses:
 *       200:
 *         description: Scan history fetched
 *       401:
 *         description: Unauthorized
 */
router.get("/", auth, listPlantScansController);

/**
 * @swagger
 * /api/v1/plant-scans/{id}/compare:
 *   post:
 *     summary: Compare a new plant photo with a saved scan
 *     description: >
 *       Diagnoses the new base64 image, saves it to the user's scan history,
 *       then returns two plants: the saved scan first, then the new scan.
 *     tags: [Plant Scans]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: History plant-scan id from the details page
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - image_base64
 *             properties:
 *               image_base64:
 *                 type: string
 *                 description: Base64 image or data URI of the plant to compare
 *               latitude:
 *                 type: number
 *               longitude:
 *                 type: number
 *     responses:
 *       200:
 *         description: Comparison result with two plant objects
 *       400:
 *         description: Validation error
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Monthly scan limit reached
 *       404:
 *         description: History scan not found
 */
router.post(
  "/:id/compare",
  auth,
  validateRequest(plantScanCompareValidation),
  comparePlantScanController
);

/**
 * @swagger
 * /api/v1/plant-scans/{id}:
 *   get:
 *     summary: Get one scanned plant's diagnosis details
 *     description: Returns the full diagnose payload stored when the plant was scanned.
 *     tags: [Plant Scans]
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
 *         description: Scan detail fetched
 *       401:
 *         description: Unauthorized
 *       404:
 *         description: Scan not found
 */
router.get("/:id", auth, getPlantScanByIdController);

export default router;
