import express, { Router } from "express";
import auth from "../../../core/middleware/authMiddleware";
import {
  getPlantCatalog,
  getPlantCatalogById,
} from "./plantCatalogController";

const router: Router = express.Router();

/**
 * @swagger
 * /api/v1/admin/plant-catalog:
 *   get:
 *     summary: Admin plant master catalog from live plant_table_final
 *     description: Returns name, species/taxonomy, care fields, images, plus plant_care_table instructions.
 *     tags: [Admin Plant Catalog]
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
 *         description: Search common name, scientific name, genus, species
 *     responses:
 *       200:
 *         description: Paginated plant master data
 *       401:
 *         description: Unauthorized / not Admin
 */
router.get("/plant-catalog", auth, getPlantCatalog);

/**
 * @swagger
 * /api/v1/admin/plant-catalog/{id}:
 *   get:
 *     summary: Admin plant master detail by id
 *     tags: [Admin Plant Catalog]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: Plant master record
 *       404:
 *         description: Plant not found
 *       401:
 *         description: Unauthorized / not Admin
 */
router.get("/plant-catalog/:id", auth, getPlantCatalogById);

export default router;
