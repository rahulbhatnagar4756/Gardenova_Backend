
import { Router } from "express";
import { submitContactForm } from "./contactCoontroller";

const router = Router(); 

/**
 * @swagger
 * /api/v1/contact/submit:
 *   post:
 *     summary: Submit contact form
 *     description: Receives contact form data from the frontend and processes it (e.g., save to DB or send email).
 *     tags:
 *       - Contact
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - name
 *               - email
 *               - message
 *             properties:
 *               name:
 *                 type: string
 *                 example: John Doe
 *               email:
 *                 type: string
 *                 example: john@example.com
 *               message:
 *                 type: string
 *                 example: Hello, I want to contact you.
 *     responses:
 *       200:
 *         description: Form submitted successfully
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
 *                   example: Message received successfully
 *       400:
 *         description: Invalid input data
 *       500:
 *         description: Server error
 */
router.post("/submit", submitContactForm);

export default router;