import { Router } from "express";
import auth from "../../core/middleware/authMiddleware";
import {
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
