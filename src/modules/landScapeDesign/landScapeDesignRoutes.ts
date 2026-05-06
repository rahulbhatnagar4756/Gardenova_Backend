import { Router} from "express";
import auth from "../../core/middleware/authMiddleware";
import { getLandScapeDesign } from "./landScapeDesignController";

const router = Router();
/**
 * @swagger
 * /api/v1/landscape/:
 *   post:
 *     summary: Generate landscape design
 *     description: Accepts a base64 image and optional preferences to generate a landscape design.
 *     tags:
 *       - Landscape
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
 *                 description: Base64 encoded image of the landscape
 *                 example: "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAA..."
 *               prefs:
 *                 type: object
 *                 description: Optional preferences for landscape design
 *                 example:
 *                   style: "modern"
 *                   
 *     responses:
 *       200:
 *         description: Landscape design generated successfully
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
 *                   example: Landscape design generated successfully
 *       400:
 *         description: Missing or invalid input (e.g., image not provided)
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: false
 *                 message:
 *                   type: string
 *                   example: Image is required for landscape design
 *       500:
 *         description: Server error while generating landscape design
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: false     
 *                 message:
 *                   type: string
 *                   example: An error occurred while generating landscape design
 */
router.post("/",auth, getLandScapeDesign);

export default router;
