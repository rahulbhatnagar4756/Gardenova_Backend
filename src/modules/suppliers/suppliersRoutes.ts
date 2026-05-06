import express, { Router } from "express";
import auth from "../../core/middleware/authMiddleware";
import { uploadCsv } from "../../core/middleware/uploadCsv";
import { extractUsersFromCsv } from "../../core/middleware/extractUserFromCsv";
import { getAllSuppliersController, getSortedSuppliersController, importSuppliersController } from "./suppliersController";
const router: Router = express.Router();



/**
 * @swagger
 * /api/v1/suppliers/upload:
 *   post:
 *     summary: Upload CSV file and import suppliers
 *     description: Upload a CSV file containing supplier data. The file is processed and suppliers are imported into the system.
 *     tags:
 *       - Suppliers
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             properties:
 *               file:
 *                 type: string
 *                 format: binary
 *                 description: CSV file containing supplier data
 *     responses:
 *       200:
 *         description: Suppliers imported successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 inserted:
 *                   type: integer
 *                   example: 25
 *                 failed:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       row:
 *                         type: integer
 *                         example: 3
 *                       error:
 *                         type: string
 *                         example: Invalid email format
 *       400:
 *         description: Invalid file or bad request
 *       401:
 *         description: Unauthorized
 *       500:
 *         description: Internal server error
 */
router.post(
    "/upload",
    auth,
    uploadCsv.single("file"),
    extractUsersFromCsv,
    importSuppliersController
);

/**
 * @swagger
 * /api/v1/suppliers/:
 *   get:
 *     summary: Get all suppliers
 *     description: Fetch a paginated list of all suppliers.
 *     tags:
 *       - Suppliers
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           example: 1
 *         description: Page number for pagination
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           example: 10
 *         description: Number of records per page
 *     responses:
 *       200:
 *         description: Suppliers fetched successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 total:
 *                   type: integer
 *                   example: 100
 *                 page:
 *                   type: integer
 *                   example: 1
 *                 limit:
 *                   type: integer
 *                   example: 10
 *                 data:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       id:
 *                         type: string
 *                         format: uuid
 *                         example: 9d379091-776e-40c3-ab6c-47444944970d
 *                       name:
 *                         type: string
 *                         example: ABC Suppliers
 *                       email:
 *                         type: string
 *                         example: abc@example.com
 *                       created_at:
 *                         type: string
 *                         format: date-time
 *       401:
 *         description: Unauthorized
 *       500:
 *         description: Internal server error
 */
router.get("/", auth, getAllSuppliersController);


/**
 * @swagger
 * /api/v1/suppliers/getSortedsuppliers:
 *   get:
 *     summary: Get professionals sorted by distance, subscription priority, and rating
 *     description: >
 *       Returns a list of professionals sorted primarily by nearest distance 
 *       (based on user latitude and longitude), then by subscription priority,
 *       and finally by rating. Supports optional category filtering and pagination.
 *     tags:
 *       - Suppliers
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: lat
 *         required: true
 *         schema:
 *           type: number
 *           format: float
 *         description: User latitude
 *         example: 12.9716
 *       - in: query
 *         name: lng
 *         required: true
 *         schema:
 *           type: number
 *           format: float
 *         description: User longitude
 *         example: 77.5946
 *       - in: query
 *         name: category
 *         required: false
 *         schema:
 *           type: string
 *         description: Filter professionals by category
 *         example: plumber
 *       - in: query
 *         name: limit
 *         required: false
 *         schema:
 *           type: integer
 *           default: 50
 *           maximum: 100
 *         description: Number of results to return (max 100)
 *         example: 20
 *       - in: query
 *         name: offset
 *         required: false
 *         schema:
 *           type: integer
 *           default: 0
 *         description: Pagination offset
 *         example: 0
 *     responses:
 *       200:
 *         description: Sorted professionals retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 count:
 *                   type: integer
 *                   example: 20
 *                 data:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       id:
 *                         type: string
 *                         format: uuid
 *                       company_name:
 *                         type: string
 *                       category:
 *                         type: string
 *                       city:
 *                         type: string
 *                       state:
 *                         type: string
 *                       assessment:
 *                         type: number
 *                         format: float
 *                       distance:
 *                         type: number
 *                         format: float
 *                         description: Distance in kilometers
 *       400:
 *         description: Invalid or missing latitude/longitude
 *       401:
 *         description: Unauthorized (Bearer token required)
 *       500:
 *         description: Internal server error
 */
router.get("/getSortedSuppliers",auth, getSortedSuppliersController);


export default router;