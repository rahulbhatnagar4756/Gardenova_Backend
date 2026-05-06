import express, { Router } from "express";
import auth from "../../core/middleware/authMiddleware";
import {  validateCsvUpload } from "../../core/middleware/extractUserFromCsv";
import { createProfessionals,   
    getAllLeads,  
    getAllProfessionalProfiles, 
    getprofessionalsById, 
    getprofessionalsByIdByAdmin, 
    getprofessionalsProfile, 
    getSortedProfessionals,  
    leadCreatedByProfessional,  
    leadForWholesaler,  
    registerProfessionals, 
    updateFounderStatus, 
    updateProfessionalByAdmin, 
    updateProfessionalProfile, 
    updateRatingByAdmin, 
    updateStatusOfLeadsController  } from "./professionalController";
import validateRequest from "../../core/middleware/validateRequest";
import { updateProfessionalProfileValidation } from "./professionalValidation";
import { uploadCsv } from "../../core/middleware/uploadCsv";
const router: Router = express.Router();

/**
 * @swagger
 * /api/v1/professional/import:
 *   post:
 *     summary: Register professionals via CSV upload
 *     description: Upload a CSV file to create multiple professionals at once. Requires authentication.
 *     tags:
 *       - Professionals
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             required:
 *               - file
 *             properties:
 *               file:
 *                 type: string
 *                 format: binary
 *                 description: CSV file containing professionals data
 *     responses:
 *       201:
 *         description: Professionals created successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: Professionals registered successfully
 *                 data:
 *                   type: array
 *                   items:
 *                     type: object
 *       400:
 *         description: Invalid file or validation error
 *       401:
 *         description: Unauthorized - Authentication required
 *       500:
 *         description: Server error
 */
router.post(
    "/import",
    auth,
    uploadCsv.single("file"),
    validateCsvUpload,       
    createProfessionals      // renamed + simplified
);
// router.post("/import", auth,   uploadCsv.single("file"), extractUsersFromCsv, createProfessionlals);
/**
 * @swagger
 * /api/v1/professional:
 *   get:
 *     summary: Get all professional profiles (Admin only)
 *     description: Retrieve a paginated list of all professional profiles. Requires Admin authentication.
 *     tags:
 *       - Professionals
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: page
 *         required: false
 *         schema:
 *           type: integer
 *           default: 1
 *         description: Page number for pagination
 *       - in: query
 *         name: limit
 *         required: false
 *         schema:
 *           type: integer
 *           default: 5
 *         description: Number of professionals per page
 *     responses:
 *       200:
 *         description: Professional profiles retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 currentPage:
 *                   type: integer
 *                   example: 1
 *                 totalPages:
 *                   type: integer
 *                   example: 10
 *                 totalCount:
 *                   type: integer
 *                   example: 50
 *                 limit:
 *                   type: integer
 *                   example: 5
 *                 professionals:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       id:
 *                         type: string
 *                         example: b3bf7ac3-7724-40ff-b998-c353f231412f
 *                       companyName:
 *                         type: string
 *                         example: ABC Landscaping
 *                       email:
 *                         type: string
 *                         example: contact@abclandscaping.com
 *                       category:
 *                         type: string
 *                         example: Gardening
 *                       image_url:
 *                         type: string
 *                         example: https://example.com/profile.jpg
 *                       description:
 *                         type: string
 *                         example: Professional gardening services
 *       401:
 *         description: Unauthorized - Authentication required or invalid role
 *       500:
 *         description: Internal server error
 */
router.get("/", auth, getAllProfessionalProfiles);


/**
 * @swagger
 * /api/v1/professional/register:
 *   post:
 *     summary: Register a professional
 *     description: Allows an Admin user to register a professional by professionalId and email.
 *     tags:
 *       - Professionals
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - professionalId
 *               - email
 *             properties:
 *               professionalId:
 *                 type: string
 *                 example: "PROF12345"
 *               email:
 *                 type: string
 *                 format: email
 *                 example: "professional@example.com"
 *     responses:
 *       200:
 *         description: Professional registered successfully
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
 *                   example: Professional registered successfully
 *                 data:
 *                   type: object
 *                   example:
 *                     professionalId: "PROF12345"
 *                     status: "Registered"
 *       400:
 *         description: Bad request (Missing fields or email mismatch)
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       401:
 *         description: Unauthorized (Invalid token or role not Admin)
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       404:
 *         description: Professional not found
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       500:
 *         description: Internal server error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 */
router.post("/register", auth, registerProfessionals);

/**
 * @swagger
 * /api/v1/professional/getSortedProfessionals:
 *   get:
 *     summary: Get professionals sorted by distance, subscription priority, and rating
 *     description: >
 *       Returns a list of professionals sorted primarily by nearest distance 
 *       (based on user latitude and longitude), then by subscription priority,
 *       and finally by rating. Supports optional category filtering and pagination.
 *     tags:
 *       - Professionals
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
 *
 *       - in: query
 *         name: lng
 *         required: true
 *         schema:
 *           type: number
 *           format: float
 *         description: User longitude
 *         example: 77.5946
 *
 *       - in: query
 *         name: category
 *         required: false
 *         schema:
 *           type: string
 *         description: Filter professionals by category
 *         example: plumber
 *
 *       - in: query
 *         name: limit
 *         required: false
 *         schema:
 *           type: integer
 *           default: 20
 *           maximum: 100
 *         description: Number of results per page
 *         example: 20
 *
 *       - in: query
 *         name: page
 *         required: false
 *         schema:
 *           type: integer
 *           default: 1
 *         description: Page number (starts from 1)
 *         example: 1
 *
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
 *
 *                 total:
 *                   type: integer
 *                   example: 120
 *
 *                 limit:
 *                   type: integer
 *                   example: 20
 *
 *                 page:
 *                   type: integer
 *                   example: 1
 *
 *                 user_location:
 *                   type: object
 *                   properties:
 *                     lat:
 *                       type: number
 *                     lng:
 *                       type: number
 *
 *                 data:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       id:
 *                         type: string
 *                         format: uuid
 *
 *                       company_name:
 *                         type: string
 *
 *                       category:
 *                         type: string
 *
 *                       city:
 *                         type: string
 *
 *                       state:
 *                         type: string
 *
 *                       rating:
 *                         type: number
 *                         format: float
 *
 *                       distance_km:
 *                         type: number
 *                         format: float
 *                         description: Distance in kilometers
 *
 *       400:
 *         description: Invalid or missing latitude/longitude
 *
 *       401:
 *         description: Unauthorized (Bearer token required)
 *
 *       500:
 *         description: Internal server error
 */
router.get("/getSortedProfessionals",auth, getSortedProfessionals);
/**
 * @swagger
 * /api/v1/professional/ProfessionalsProfile:
 *   get:
 *     summary: Get authenticated professional profile
 *     description: Retrieves the professional profile details of the currently authenticated user.
 *     tags:
 *       - Professionals
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Professional profile retrieved successfully
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
 *                   example: Professional profile retrieved successfully
 *                 data:
 *                   type: object
 *                   properties:
 *                     name:
 *                       type: string
 *                       example: John Doe
 *                     email:
 *                       type: string
 *                       example: johndoe@example.com
 *                     imageUrl:
 *                       type: string
 *                       example: https://example.com/profile.jpg
 *                     subscriptionPlan:
 *                       type: string
 *                       example: trial
 *                     StartDate:
 *                       type: string
 *                       format: date
 *                       example: 2026-01-01
 *                     EndDate:
 *                       type: string
 *                       format: date
 *                       example: 2026-01-31
 *                     AccountStatus:
 *                       type: string
 *                       example: active
 *                     description:
 *                       type: string
 *                       nullable: true
 *                       example: Experienced web developer specializing in Node.js
 *                     region:
 *                       type: string
 *                       nullable: true
 *                       example: North America
 *                     category:
 *                       type: string
 *                       nullable: true
 *                       example: Software Development
 *       401:
 *         description: Unauthorized (Invalid token, user not found, or invalid user ID)
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
 *                   example: Unauthorized
 *       404:
 *         description: Professional profile not found
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
 *                   example: Professional profile not found
 *       500:
 *         description: Internal server error
 */
router.get("/ProfessionalsProfile", auth, getprofessionalsProfile);


/**
 * @swagger
 * /api/v1/professional/update:
 *   patch:
 *     summary: Update professional profile
 *     description: Allows an authenticated professional to update their name, email, profile image, description, category, and region. Any field can be updated individually.
 *     tags: [Professionals]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: false
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               name:
 *                 type: string
 *                 example: John Doe
 *               email:
 *                 type: string
 *                 format: email
 *                 example: johndoe@example.com
 *               profileImage:
 *                 type: string
 *                 description: Base64 encoded image string (data:image/...;base64,...)
 *                 example: data:image/jpeg;base64,/9j/4AAQSkZJRgABAQE...
 *               description:
 *                 type: string
 *                 maxLength: 1000
 *                 example: Experienced software engineer specializing in full-stack development.
 *               category:
 *                 type: string
 *                 maxLength: 100
 *                 example: Technology
 *               region:
 *                 type: string
 *                 maxLength: 100
 *                 example: São Paulo
 *     responses:
 *       200:
 *         description: Professional profile updated successfully
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
 *                   example: Professional profile updated successfully
 *       400:
 *         description: Invalid input or email already exists
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
 *                   example: Email already in use
 *                 errors:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       field:
 *                         type: string
 *                         example: email
 *                       message:
 *                         type: string
 *                         example: Must be a valid email address
 *       401:
 *         description: Unauthorized
 *       404:
 *         description: User or profile not found
 *       500:
 *         description: Internal server error
 */
router.patch("/update",validateRequest(updateProfessionalProfileValidation), auth,  updateProfessionalProfile);

/**
 * @swagger
 * /api/v1/professional/createLeads:
 *   post:
 *     summary: Create new leads for multiple professionals
 *     tags:
 *       - Professionals
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - professionalIds
 *             properties:
 *               professionalIds:
 *                 type: array
 *                 items:
 *                   type: string
 *                   format: uuid
 *                 example:
 *                   - b3bf7ac3-7724-40ff-b998-c353f231412f
 *                   - a2cd7ac3-1111-40ff-b998-c353f2314999
 *               description:
 *                 type: string
 *                 description: Lead description or details
 *                 example: "Looking for home renovation services"
 *               category:
 *                 type: string
 *                 description: Service category requested
 *                 example: "Home Renovation"
 *               size:
 *                 type: string
 *                 description: Size of the project or lead (e.g., small, medium, large)
 *                 example: "medium"
 *     responses:
 *       201:
 *         description: Leads created successfully
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
 *                   example: Leads created successfully
 *       401:
 *         description: Unauthorized or User not found
 *       500:
 *         description: Failed to create leads
 */
router.post("/createLeads", auth , leadCreatedByProfessional);
/**
 * @swagger
 * /api/v1/professional/getLeads:
 *   get:
 *     summary: Get all leads for the authenticated user
 *     description: Fetch all leads associated with the logged-in user including professional or user details.
 *     tags:
 *       - Professionals
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: search
 *         schema:
 *           type: string
 *         required: false
 *         description: Search leads by company name, city, state, address, name, or email.
 *     responses:
 *       200:
 *         description: Leads retrieved successfully
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
 *                   example: Leads retrieved successfully
 *                 data:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       userId:
 *                         type: string
 *                         format: uuid
 *                       role:
 *                         type: string
 *                         example: professional
 *                       company_name:
 *                         type: string
 *                         nullable: true
 *                         example: ABC Construction
 *                       name:
 *                         type: string
 *                         nullable: true
 *                         example: John Doe
 *                       email:
 *                         type: string
 *                         nullable: true
 *                         example: john@example.com
 *                       leads_status:
 *                         type: string
 *                         example: new
 *                       created_at:
 *                         type: string
 *                         format: date-time
 *                       location:
 *                         type: object
 *                         nullable: true
 *                         properties:
 *                           city:
 *                             type: string
 *                             example: New York
 *                           state:
 *                             type: string
 *                             example: NY
 *                           address:
 *                             type: string
 *                             example: 123 Main Street
 *                           latitude:
 *                             type: number
 *                             example: 40.7128
 *                           longitude:
 *                             type: number
 *                             example: -74.0060
 *                       requestingUser:
 *                         type: object
 *                         properties:
 *                           userId:
 *                             type: string
 *                             format: uuid
 *                           professionalProfileId:
 *                             type: string
 *                             format: uuid
 *                             nullable: true
 *                           description:
 *                             type: string
 *                             nullable: true
 *                             example: Experienced contractor
 *       401:
 *         description: Unauthorized – Invalid or missing token
 *       500:
 *         description: Internal server error
 */
router.get("/getLeads",auth, getAllLeads);


/**
 * @swagger
 * /api/v1/professional/getProfessionalsById/{id}:
 *   get:
 *     summary: Get a professional by ID
 *     description: Retrieves the details of a professional using their unique ID. Authentication is required.
 *     tags:
 *       - Professionals
 *     security:
 *       - bearerAuth: [] 
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         description: Unique identifier of the professional
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Professional details retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 id:
 *                   type: string
 *                 name:
 *                   type: string
 *                 profession:
 *                   type: string
 *                 email:
 *                   type: string
 *                 phone:
 *                   type: string
 *       401:
 *         description: Unauthorized – missing or invalid token
 *       404:
 *         description: Professional not found
 *       500:
 *         description: Internal server error
 */
router.get("/getProfessionalsById/:id", auth, getprofessionalsById);

/**
 * @swagger
 * /api/v1/professional/admin/getProfessionalsById/{id}:
 *   get:
 *     summary: Get a professional by ID (Admin only)
 *     description: Retrieves details of a professional using their unique ID. Accessible only by admins.
 *     tags:
 *       - Professionals
 *     security:
 *       - bearerAuth: []  # assuming you are using JWT Bearer token for auth
 *     parameters:
 *       - name: id
 *         in: path
 *         description: ID of the professional to retrieve
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Professional retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   type: object
 *                   example:
 *                     id: "12345"
 *                     name: "John Doe"
 *                     profession: "Electrician"
 *       401:
 *         description: Unauthorized – admin access required
 *       404:
 *         description: Professional not found
 */
router.get("/admin/getProfessionalsById/:id", auth, getprofessionalsByIdByAdmin);

/**
 * @swagger
 * /api/v1/professional/updateProfessionalProfile/{id}:
 *   put:
 *     summary: Update professional profile by admin
 *     tags: [Professional Profiles]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - name: id
 *         in: path
 *         required: true
 *         description: Professional profile ID
 *         schema:
 *           type: string
 *           format: uuid
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               company_name:
 *                 type: string
 *                 example: "ABC Plumbing Services"
 *               email:
 *                 type: string
 *                 example: "contact@abcplumbing.com"
 *               category:
 *                 type: string
 *                 example: "Plumber"
 *               description:
 *                 type: string
 *                 example: "Professional plumbing services for homes and businesses"
 *               city:
 *                 type: string
 *                 example: "São Paulo"
 *               state:
 *                 type: string
 *                 example: "SP"
 *               address:
 *                 type: string
 *                 example: "123 Main Street"
 *               latitude:
 *                 type: number
 *                 example: -23.5505
 *               longitude:
 *                 type: number
 *                 example: -46.6333
 *               telefone:
 *                 type: string
 *                 example: "+5511999999999"
 *               whatsapp:
 *                 type: string
 *                 example: "+5511999999999"
 *               website:
 *                 type: string
 *                 example: "https://abcplumbing.com"
 *               instagram:
 *                 type: string
 *                 example: "abcplumbing"
 *               assessment:
 *                 type: number
 *                 format: float
 *                 example: 4.75
 *               num_avaliacoes:
 *                 type: integer
 *                 example: 120
 *               verified_source:
 *                 type: string
 *                 example: "Google Reviews"
 *     responses:
 *       200:
 *         description: Professional profile updated successfully
 *       400:
 *         description: Invalid request data
 *       401:
 *         description: Unauthorized
 *       404:
 *         description: Professional profile not found
 *       500:
 *         description: Internal server error
 */
router.put("/updateProfessionalProfile/:id", auth, updateProfessionalByAdmin);


/**
 * @swagger
 * /api/v1/professional/createLeadsForWholesaler:
 *   post:
 *     summary: Create new leads for multiple wholesalers
 *     description: This endpoint allows a user to create leads for multiple wholesalers and send them emails.
 *     tags:
 *       - Professionals
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - wholesalerIds
 *             properties:
 *               wholesalerIds:
 *                 type: array
 *                 items:
 *                   type: string
 *                   format: uuid
 *                 example:
 *                   - 8a92f4a1-11b2-4d2e-b6e1-dff05ef84ef8
 *                   - 9bda7f52-07a4-49f8-9233-38bb64b51da2
 *     responses:
 *       201:
 *         description: Leads created successfully and emails sent to wholesalers
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
 *                   example: "Leads created successfully and emails sent to wholesalers."
 *       400:
 *         description: Bad request, invalid or missing wholesalerIds
 *       401:
 *         description: Unauthorized, user not authenticated or invalid token
 *       500:
 *         description: Internal server error, failed to create leads
 */
router.post("/createLeadsForWholesaler",auth, leadForWholesaler);

/**
 * @swagger
 * /api/v1/professional/updateRating:
 *   patch:
 *     summary: Update the professional rating by admin
 *     description: This endpoint allows an admin to update the rating of a professional.
 *     tags:
 *       - Professionals
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               professionalId:
 *                 type: string
 *                 description: The ID of the professional whose rating is being updated.
 *                 example: "12345"
 *               rating:
 *                 type: number
 *                 description: The rating to assign to the professional (should be a number between 0 and 5).
 *                 example: 4.5
 *     responses:
 *       200:
 *         description: Professional rating updated successfully by admin
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: "Professional rating updated successfully by admin"
 *       400:
 *         description: Bad request, invalid data in request body
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: "Rating must be a number between 0 and 5"
 *       401:
 *         description: Unauthorized, user is not logged in or token is missing
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: "Unauthorized"
 *       403:
 *         description: Forbidden, user is not an admin
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: "Access denied: Admins only"
 *       500:
 *         description: Internal server error, failed to update professional rating
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: "Failed to update professional rating"
 *       404:
 *         description: Not found, the professional ID does not exist
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: "Professional profile not found"
 *     operationId: updateRatingByAdmin
 */

/**
 * @swagger
 * components:
 *   securitySchemes:
 *     bearerAuth:
 *       type: http
 *       scheme: bearer
 *       bearerFormat: JWT
 */
router.patch("/updateRating", auth, updateRatingByAdmin);
 

/**
 * @swagger
 * /api/v1/professional/updateStatus/{id}:
 *   patch:
 *     summary: Update lead status cycle
 *     description: Updates the lead status based on the given lead ID. Status cycles as **new → contacted → closed → new**.
 *     tags:
 *       - Professionals
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         description: Lead ID
 *         schema:
 *           type: string
 *           example: "9d379091-776e-40c3-ab6c-47444944970d"
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
 *                   example: Lead status updated successfully
 *                 data:
 *                   type: object
 *                   nullable: true
 *                   example: null
 *       401:
 *         description: Unauthorized or user not found
 *       500:
 *         description: Internal server error
 */
router.patch("/updateStatus/:id", auth, updateStatusOfLeadsController);

/**
 * @swagger
 * /api/v1/professional/updateFounderStatus/{id}:
 *   patch:
 *     summary: Update founder status of a partner
 *     description: Toggle or set the is_founder status (true/false) for a specific partner.
 *     tags:
 *       - Professionals
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         description: Unique ID of the partner
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               is_founder:
 *                 type: string
 *                 enum: ["true", "false"]
 *                 example: "true"
 *     responses:
 *       200:
 *         description: Founder status updated successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: Founder status updated successfully
 *       400:
 *         description: Invalid input
 *       401:
 *         description: Unauthorized (missing or invalid token)
 *       404:
 *         description: Partner not found
 *       500:
 *         description: Internal server error
 */
router.patch("/updateFounderStatus/:id", auth, updateFounderStatus);
export default router;