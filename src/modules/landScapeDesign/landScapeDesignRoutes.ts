import { Router} from "express";
import auth from "../../core/middleware/authMiddleware";
import { getLandScapeDesign, getLandScapeDesignWithLocation, getLandScapeDesignWithSurvey } from "./landScapeDesignController";

const router = Router();
/**
 * @swagger
 * /api/v1/landscape/:
 *   post:
 *     summary: Generate landscape design
 *     description: Accepts a base64 image. Garden style is inferred from the detected space.
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
router.post("/", auth, getLandScapeDesign);

/**
 * @swagger
 * /api/v1/landscape/with-location:
 *   post:
 *     summary: Generate location-aware landscape design
 *     description: >
 *       Accepts a base64 image plus GPS coordinates (latitude/longitude).
 *       In a single call the pipeline:
 *       (1) detects the space type, (2) describes the scene, (3) looks up native/
 *       climate-appropriate plants for the location, (4) creates a design plan,
 *       and (5) generates the final garden image.
 *     tags:
 *       - Landscape
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - image_base64
 *               - latitude
 *               - longitude
 *             properties:
 *               image_base64:
 *                 type: string
 *                 description: Base64 encoded image (data URI or raw base64)
 *                 example: "data:image/jpeg;base64,/9j/4AAQSkZJRgAB..."
 *               latitude:
 *                 type: number
 *                 description: GPS latitude (-90 to 90)
 *                 example: 28.6139
 *               longitude:
 *                 type: number
 *                 description: GPS longitude (-180 to 180)
 *                 example: 77.2090
 *     responses:
 *       200:
 *         description: Location-aware landscape design generated successfully
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
 *                   example: Location-aware landscape design generated successfully
 *                 data:
 *                   type: object
 *                   properties:
 *                     originalUrl:
 *                       type: string
 *                       example: "https://api.example.com/uploads/design-uploads/design-loc-1234.jpg"
 *                     gardenUrl:
 *                       type: string
 *                       example: "https://api.example.com/uploads/design-outputs/design-loc-1234-result.jpg"
 *                     description:
 *                       type: string
 *                       example: "FLOOR: concrete tiles..."
 *                     detectedSpace:
 *                       type: object
 *                     nativePlants:
 *                       type: object
 *                       properties:
 *                         region:
 *                           type: string
 *                           example: "New Delhi, India"
 *                         climate:
 *                           type: string
 *                           example: "semi-arid subtropical"
 *                         plants:
 *                           type: array
 *                           items:
 *                             type: object
 *       400:
 *         description: Missing or invalid input
 *       403:
 *         description: Monthly landscape limit reached
 *       500:
 *         description: Server error
 */
router.post("/with-location", auth, getLandScapeDesignWithLocation);

/**
 * @swagger
 * /api/v1/landscape/with-survey:
 *   post:
 *     summary: Generate landscape design from onboarding answers
 *     description: >
 *       Accepts a base64 image and uses the authenticated user's onboarding
 *       survey answers (not GPS) to choose plants, then generates a garden.
 *       Optional responseId selects a specific survey; otherwise the latest
 *       answers are used.
 *     tags:
 *       - Landscape
 *     security:
 *       - bearerAuth: []
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
 *                 description: Base64 encoded image (data URI or raw base64)
 *               responseId:
 *                 type: string
 *                 description: Optional survey response id. Defaults to the user's latest answers.
 *     responses:
 *       200:
 *         description: Survey-based landscape design generated successfully
 *       400:
 *         description: Missing image or no onboarding answers found
 *       403:
 *         description: Monthly landscape limit reached
 *       500:
 *         description: Server error
 */
router.post("/with-survey", auth, getLandScapeDesignWithSurvey);

export default router;
