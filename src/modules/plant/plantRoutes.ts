import express, { Router } from "express";
import auth from "../../core/middleware/authMiddleware";
import validateRequest from "../../core/middleware/validateRequest";
import { plantIdentifyValidation, plantValidation } from "./plantValidation";

import {
  createPlantController,
  getAllPlantsController,
  getPlantByIdController,
  updatePlantController,
  deletePlantController,
  diagnosePlantController,
} from "./plantController";

const router: Router = express.Router();

/**
 * @swagger
 * tags:
 *   name: Plants
 *   description: API for managing luxury garden plants
 */

/**
 * @swagger
 * components:
 *   schemas:
 *     Location:
 *       type: object
 *       properties:
 *         location_type:
 *           type: string
 *           example: "climate_zone"
 *         location_value:
 *           type: string
 *           example: "Tropical"
 *
 *     Plant:
 *       type: object
 *       properties:
 *         scientific_name:
 *           type: string
 *           example: "Ficus lyrata"
 *
 *         common_name:
 *           type: string
 *           example: "Fiddle Leaf Fig"
 *
 *         image_search_url:
 *           type: string
 *           example: "https://mybucket.s3.amazonaws.com/plants/ficus.jpg"
 *
 *         description:
 *           type: string
 *           example: "A beautiful indoor plant with large violin-shaped leaves."
 *
 *         native:
 *           type: boolean
 *           example: false
 *
 *         light:
 *           type: string
 *           example: "Bright indirect light"
 *
 *         water_needs:
 *           type: string
 *           example: "Moderate"
 *
 *         maintenance_level:
 *           type: string
 *           example: "Medium"
 *
 *         growth_form:
 *           type: string
 *           example: "Tree"
 *
 *         space_types:
 *           type: array
 *           items:
 *             type: string
 *           example: ["indoor", "balcony"]
 *
 *         area_sizes:
 *           type: array
 *           items:
 *             type: string
 *           example: ["small", "medium"]
 *
 *         challenges:
 *           type: array
 *           items:
 *             type: string
 *           example: ["root rot", "low humidity"]
 *
 *         tech_preferences:
 *           type: array
 *           items:
 *             type: string
 *           example: ["smart sensors", "hydroponics"]
 *
 *         care_notes:
 *           type: array
 *           items:
 *             type: string
 *           example: ["Water weekly", "Use humidifier"]
 *
 *         locations:
 *           type: array
 *           items:
 *             $ref: '#/components/schemas/Location'
 *
 *
 *     PlantInput:
 *       allOf:
 *         - $ref: '#/components/schemas/Plant'
 *       required:
 *         - scientific_name
 *         - common_name
 */

/**
 * @swagger
 * /api/v1/admin/plants:
 *   post:
 *     summary: Create a new plant
 *     tags: [Plants]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/PlantInput'
 *     responses:
 *       201:
 *         description: Plant created successfully
 */
router.post(
  "/plants",
  auth,
  validateRequest(plantValidation),
  createPlantController
);

/**
 * @swagger
 * /api/v1/admin/plants:
 *   get:
 *     summary: Get all plants with pagination and search
 *     tags: [Plants]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           default: 1
 *         description: Page number for pagination
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 5
 *         description: Number of plants per page
 *       - in: query
 *         name: search
 *         schema:
 *           type: string
 *         description: Search by scientific name, common name, or description
 *     responses:
 *       200:
 *         description: Paginated list of plants
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 data:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/Plant'
 *                 pagination:
 *                   type: object
 *                   properties:
 *                     currentPage:
 *                       type: integer
 *                       example: 1
 *                     totalPages:
 *                       type: integer
 *                       example: 10
 *                     totalItems:
 *                       type: integer
 *                       example: 50
 *                     itemsPerPage:
 *                       type: integer
 *                       example: 5
 */
router.get("/plants", auth, getAllPlantsController);

/**
 * @swagger
 * /api/v1/admin/plants/{id}:
 *   get:
 *     summary: Get plant details by ID
 *     tags: [Plants]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Plant details
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Plant'
 *       404:
 *         description: Plant not found
 */
router.get("/plants/:id", auth, getPlantByIdController);

/**
 * @swagger
 * /api/v1/admin/plants/{id}:
 *   put:
 *     summary: Update plant
 *     tags: [Plants]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/PlantInput'
 *     responses:
 *       200:
 *         description: Updated successfully
 */
router.put(
  "/plants/:id",
  auth,
  validateRequest(plantValidation),
  updatePlantController
);

/**
 * @swagger
 * /api/v1/admin/plants/{id}:
 *   delete:
 *     summary: Soft delete a plant
 *     tags: [Plants]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Plant deleted successfully
 */
router.delete("/plants/:id", auth, deletePlantController);

/**
 * @swagger
 * /api/v1/admin/plants/identify:
 *   post:
 *     summary: Identify plant species and health in one unified request
 *     tags: [Plant Identification]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               images:
 *                 type: array
 *                 items:
 *                   type: string
 *                   example: "data:image/jpeg;base64,/9j/4AAQ..."
 *               latitude:
 *                 type: number
 *               longitude:
 *                 type: number
 *     responses:
 *       200:
 *         description: Identification successful
 *       400:
 *         description: Validation failed
 *       401:
 *         description: Unauthorized
 */
router.post(
  "/plants/identify",
  auth,
  validateRequest(plantIdentifyValidation),
  diagnosePlantController
);

export default router;
