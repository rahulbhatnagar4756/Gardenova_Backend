import express, { Router } from "express";
import auth from "../../../core/middleware/authMiddleware";
import {
  getDiagnosisScanById,
  getDiagnosisScans,
} from "./diagnosisScansController";

const router: Router = express.Router();

/**
 * @swagger
 * /api/v1/admin/diagnosis-scans:
 *   get:
 *     summary: Admin log of plant disease scan requests
 *     description: Returns image URL, predicted disease, confidence score, and user info for each scan.
 *     tags: [Admin Diagnosis Scans]
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
 *         description: Match disease, plant name, user email/name
 *       - in: query
 *         name: disease
 *         schema:
 *           type: string
 *         description: Filter by predicted disease (partial match)
 *       - in: query
 *         name: userId
 *         schema:
 *           type: string
 *           format: uuid
 *       - in: query
 *         name: from
 *         schema:
 *           type: string
 *           format: date-time
 *       - in: query
 *         name: to
 *         schema:
 *           type: string
 *           format: date-time
 *     responses:
 *       200:
 *         description: Paginated scan logs
 *       401:
 *         description: Unauthorized / not Admin
 */
router.get("/diagnosis-scans", auth, getDiagnosisScans);

/**
 * @swagger
 * /api/v1/admin/diagnosis-scans/{id}:
 *   get:
 *     summary: Admin diagnosis scan detail
 *     tags: [Admin Diagnosis Scans]
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
 *         description: Scan detail including raw_result summary
 *       404:
 *         description: Scan not found
 *       401:
 *         description: Unauthorized / not Admin
 */
router.get("/diagnosis-scans/:id", auth, getDiagnosisScanById);

export default router;
