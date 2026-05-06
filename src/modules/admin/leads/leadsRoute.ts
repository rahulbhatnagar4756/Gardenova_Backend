import express, { Router } from "express";
import auth from "../../../core/middleware/authMiddleware";
import validateRequest from "../../../core/middleware/validateRequest";
import {
  createLeadController,
  getAllLeads,
  getAllLeadsForAdmin,
  getAllLeadsForMonths,
  updateLeadStatusController} from "./leadsController";
import { leadValidation, updateLeadStatus } from "./leadsValidation";

const router: Router = express.Router();

/**
 * @swagger
 * tags:
 *   name: Leads
 *   description: API for managing leads
 */

/**
 * @swagger
 * components:
 *   schemas:
 *     Lead:
 *       type: object
 *       properties:
 *         leadId:
 *           type: string
 *           description: Unique ID of the lead
 *           example: "64f5a7b2c1234567890abcde"
 *         partnerId:
 *           type: string
 *           description: Reference ID of the partner profile associated with this lead
 *           example: "64f5a7b2c1234567890abcdf"
 *         createdAt:
 *           type: string
 *           format: date-time
 *           description: Date and time when the lead was created
 *           example: "2024-01-20T10:30:00Z"
 *         updatedAt:
 *           type: string
 *           format: date-time
 *           description: Date and time when the lead was last updated
 *           example: "2024-01-20T12:00:00Z"
 *
 *     LeadInput:
 *       type: object
 *       required:
 *         - partnerIds
 *       properties:
 *         partnerIds:
 *           type: array
 *           description: Array of partner profile IDs to create new leads
 *           items:
 *             type: string
 *           example:
 *             - "64f5a7b2c1234567890abcdf"
 *             - "64f5a7b2c1234567890abce1"
 */

/**
 * @swagger
 * /api/v1/admin/leads:
 *   get:
 *     summary: Get paginated leads
 *     description: Retrieve leads with pagination (default 5 per page)
 *     tags: [Leads]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           default: 1
 *         description: Page number
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 5
 *         description: Number of records per page
 *     responses:
 *       200:
 *         description: Leads retrieved successfully
 */

router.post(
  "/leads",
  auth,
  validateRequest(leadValidation),
  createLeadController
);

/**
 * @swagger
 * /api/v1/admin/leads:
 *   get:
 *     summary: Get all leads
 *     description: Retrieve all leads without pagination
 *     tags: [Leads]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Leads retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               allOf:
 *                 - $ref: '#/components/schemas/ApiResponse'
 *                 - type: object
 *                   properties:
 *                     data:
 *                       type: object
 *                       properties:
 *                         formattedLeads:
 *                           type: array
 *                           items:
 *                             $ref: '#/components/schemas/Lead'
 *             example:
 *               success: true
 *               message: "Leads retrieved successfully"
 *               data:
 *                 formattedLeads:
 *                   - leadId: "64f5a7b2c1234567890abcde"
 *                     partnerId: "64f5a7b2c1234567890abcdf"
 *                     userId: "64f5a7b2c1234567890abce0"
 *                     leadsStatus: "new"
 *                     createdAt: "2024-01-20T10:30:00Z"
 *                     updatedAt: "2024-01-20T10:30:00Z"
 *                   - leadId: "64f5a7b2c1234567890abce1"
 *                     partnerId: "64f5a7b2c1234567890abcdf"
 *                     userId: "64f5a7b2c1234567890abce2"
 *                     leadsStatus: "converted"
 *                     createdAt: "2024-01-20T11:15:00Z"
 *                     updatedAt: "2024-01-20T12:00:00Z"
 *       401:
 *         description: Unauthorized - Invalid or missing authentication token
 *       500:
 *         description: Internal server error
 */
router.get("/leads", auth, getAllLeads);

/**
 * @swagger
 * /api/v1/admin/leads/{id}/status:
 *   put:
 *     summary: Update lead status
 *     description: Update only the leads_status field of a lead entry
 *     tags: [Leads]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Lead ID
 *
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - leads_status
 *             properties:
 *               leads_status:
 *                 type: string
 *                 enum: [new, pending, contacted, converted, rejected]
 *                 example: "converted"
 *
 *     responses:
 *       200:
 *         description: Lead status updated successfully
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
 *                   example: "Lead status updated successfully"
 *                 data:
 *                   type: object
 *                   properties:
 *                     id:
 *                       type: string
 *                     leads_status:
 *                       type: string
 *                     updated_at:
 *                       type: string
 *
 *       400:
 *         description: Validation error
 *       404:
 *         description: Lead not found
 *       500:
 *         description: Internal server error
 */
router.put(
  "/leads/:id/status",
  auth,
  validateRequest(updateLeadStatus),
  updateLeadStatusController
);

/**
 * @swagger
 * /api/v1/admin/getLeadsForMonth:
 *   get:
 *     summary: Fetch leads data for the current month
 *     description: Retrieves total leads, closed leads, and contacted leads for the current month for a specific user.
 *     tags:
 *       - Leads
 *     security:
 *       - bearerAuth: [] # Ensure the user is authenticated
 *     responses:
 *       200:
 *         description: Successfully retrieved leads data for the month.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 totalLeads:
 *                   type: integer
 *                   description: Total number of leads for the current month
 *                 closedLeads:
 *                   type: integer
 *                   description: Number of leads marked as closed for the current month
 *                 contactedLeads:
 *                   type: integer
 *                   description: Number of leads marked as contacted for the current month
 *       401:
 *         description: Unauthorized, no user or invalid token provided.
 *       404:
 *         description: User not found in the database.
 *       500:
 *         description: Internal server error.
 */
router.get("/getLeadsForMonth", auth, getAllLeadsForMonths);

/**
 * @swagger
 * /api/v1/admin/admin/leads:
 *   get:
 *     summary: Fetch all leads for admin (paginated)
 *     description: Retrieves a paginated list of all leads for admin users, including total count and lead details.
 *     tags:
 *       - Leads
 *     security:
 *       - bearerAuth: [] # Ensure the user is authenticated
 *     parameters:
 *       - in: query
 *         name: page
 *         required: true
 *         schema:
 *           type: integer
 *           example: 1
 *         description: Page number for pagination
 *       - in: query
 *         name: limit
 *         required: true
 *         schema:
 *           type: integer
 *           example: 10
 *         description: Number of leads per page
 *     responses:
 *       200:
 *         description: Successfully retrieved paginated leads.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 total:
 *                   type: integer
 *                   description: Total number of leads
 *                 page:
 *                   type: integer
 *                   description: Current page number
 *                 limit:
 *                   type: integer
 *                   description: Number of leads per page
 *                 leads:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       id:
 *                         type: string
 *                         description: Unique identifier for the lead
 *                       name:
 *                         type: string
 *                         description: Name of the lead
 *                       email:
 *                         type: string
 *                         description: Email of the lead
 *                       phone:
 *                         type: string
 *                         description: Phone number of the lead
 *                       status:
 *                         type: string
 *                         description: Current status of the lead (e.g., new, contacted, closed)
 *                       createdAt:
 *                         type: string
 *                         format: date-time
 *                         description: Lead creation timestamp
 *       401:
 *         description: Unauthorized, no user or invalid token provided.
 *       500:
 *         description: Internal server error.
 */
router.get("/admin/leads", auth, getAllLeadsForAdmin);

export default router;
