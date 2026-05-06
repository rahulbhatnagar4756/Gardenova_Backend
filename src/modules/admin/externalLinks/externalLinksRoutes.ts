import { Router } from "express";
import {
  createExternalLinksTable,
  getExternalLinks,
  updateLinks,
  deleteExternalLink,
  updateStatusById
} from "./externalLinksController";
import validateRequest from "../../../core/middleware/validateRequest";
import { externalLinkCreateValidation, externalLinkUpdateValidation } from "./externalLinksValidation";
import auth from "../../../core/middleware/authMiddleware";
const router = Router();


/**
 * @swagger
 * /api/v1/externalLinks:
 *   post:
 *     summary: Create an external link (WebView menu configuration)
 *     tags:
 *       - Admin External Links
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - title
 *               - url
 *               - key
 *               - is_active
 *             properties:
 *               title:
 *                 type: string
 *                 example: Shop
 *               url:
 *                 type: string
 *                 format: uri
 *                 example: https://shop.kasagarden.com
 *               key:
 *                 type: string
 *                 example: SHOP
 *               is_active:
 *                 type: boolean
 *                 example: true
 *     responses:
 *       201:
 *         description: External link created successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: External link created successfully
 *       400:
 *         description: Validation error
 *       401:
 *         description: Unauthorized
 *       500:
 *         description: Internal server error
 */
router.post("/", auth, validateRequest(externalLinkCreateValidation), createExternalLinksTable);

/**
 * @swagger
 * /api/v1/externalLinks:
 *   get:
 *     summary: Get all external links for WebView menu
 *     description: >
 *       Returns all configured external links.  
 *       Only active links with valid URLs should be displayed in the app menu.
 *     tags:
 *       - Admin External Links
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: External links retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 data:
 *                   type: object
 *                   properties:
 *                     links:
 *                       type: array
 *                       items:
 *                         type: object
 *                         properties:
 *                           id:
 *                             type: string
 *                             format: uuid
 *                             example: "9d5c4b3e-8d3a-4a0b-9b4f-12a9c1f7a321"
 *                           title:
 *                             type: string
 *                             example: Shop
 *                           key:
 *                             type: string
 *                             example: SHOP
 *                           url:
 *                             type: string
 *                             format: uri
 *                             example: https://shop.kasagarden.com
 *                           is_active:
 *                             type: boolean
 *                             example: true
 *                           created_at:
 *                             type: string
 *                             format: date-time
 *                             example: "2026-02-03T10:15:30Z"
 *       401:
 *         description: Unauthorized
 *       500:
 *         description: Internal server error
 */
router.get("/", auth, getExternalLinks);

/**
 * @swagger
 * /api/v1/externalLinks:
 *   put:
 *     summary: Update an external link (WebView menu configuration)
 *     description: >
 *       Updates an existing external link configuration.
 *       Used to enable/disable links or change URLs without updating the app.
 *     tags:
 *       - Admin External Links
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - id
 *             properties:
 *               id:
 *                 type: string
 *                 format: uuid
 *                 example: "9d5c4b3e-8d3a-4a0b-9b4f-12a9c1f7a321"
 *               title:
 *                 type: string
 *                 example: Shop
 *               url:
 *                 type: string
 *                 format: uri
 *                 example: https://shop.kasagarden.com
 *               key:
 *                 type: string
 *                 example: SHOP
 *               is_active:
 *                 type: boolean
 *                 example: true
 *     responses:
 *       200:
 *         description: External link updated successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: External link updated successfully
 *       400:
 *         description: Validation error
 *       401:
 *         description: Unauthorized
 *       404:
 *         description: External link not found
 *       500:
 *         description: Internal server error
 */
router.put("/", auth, validateRequest(externalLinkUpdateValidation), updateLinks);


/**
 * @swagger
 * /api/v1/externalLinks/{id}:
 *   delete:
 *     summary: Delete an external link
 *     description: >
 *       Deletes an external link configuration by ID.
 *       Once deleted, the link will no longer appear in the app menu.
 *     tags:
 *       - Admin External Links
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         description: External link ID
 *         schema:
 *           type: string
 *           format: uuid
 *           example: "9d5c4b3e-8d3a-4a0b-9b4f-12a9c1f7a321"
 *     responses:
 *       200:
 *         description: External link deleted successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: External link deleted successfully
 *       401:
 *         description: Unauthorized
 *       404:
 *         description: External link not found
 *       500:
 *         description: Internal server error
 */
router.delete("/:id", auth, deleteExternalLink);


/**
 * @swagger
 * /api/v1/externalLinks:
 *   patch:
 *     summary: Update status by ID
 *     description: Updates the status value for a given status record. Admin access required.
 *     tags:
 *       - External Links
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - id
 *               - status
 *             properties:
 *               id:
 *                 type: string
 *                 format: uuid
 *                 example: "d290f1ee-6c54-4b01-90e6-d701748f0851"
 *               status:
 *                 type: string
 *                 example: "active"
 *     responses:
 *       200:
 *         description: Status updated successfully
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
 *                   example: Status updated successfully
 *                 data:
 *                   type: object
 *                   properties:
 *                     id:
 *                       type: string
 *                       format: uuid
 *                     status:
 *                       type: string
 *                     updated_at:
 *                       type: string
 *                       format: date-time
 *       400:
 *         description: Invalid request data
 *       401:
 *         description: Unauthorized
 *       404:
 *         description: Status not found
 */
router.patch("/", auth, updateStatusById);

export default router;  