import { Request, Response, NextFunction } from "express";
import { ZodError } from "zod";
import { sendContactUsEmail } from "../../core/services/emailService";

/**
 * Handles submission of the contact form.
 *
 * Validates incoming request data (name, email, message), sends a contact
 * email to the admin, and returns an appropriate JSON response.
 *
 * If validation fails, responds with HTTP 400.
 * If email sending succeeds, responds with HTTP 200.
 *
 * Any unexpected errors are passed to the Express error handler.
 *
 * @async
 * @function submitContactForm
 * @param {Request} req - Express request object containing contact form data in `body`.
 * @param {Response} res - Express response object used to send HTTP responses.
 * @param {NextFunction} next - Express next middleware function for error handling.
 * @returns {Promise<void>} Sends an HTTP response and does not return a value.
 *
 * @throws {ZodError} If validation fails using Zod schema (if applied elsewhere).
 * @throws {Error} For any unexpected runtime or email service errors.
 */
export const submitContactForm = async (req:Request, res: Response, next:NextFunction): Promise<void> => {
    try {
        const { name, email, message } = req.body;

        // Basic validation
        if (!name || !email || !message) {
             res.status(400).json({ success: false, message: "All fields are required." });
             return;
        }

        // Here you would typically save the contact form data to a database
        // For this example, we'll just log it to the console
       await sendContactUsEmail(email, name, message);

        // Respond with success
        res.status(200).json({ success: true, message: "Your message has been received. We'll get back to you shortly!" });
    }
    catch (error) {
    if (error instanceof ZodError) {
         res.status(400).json({ success: false, message: "Invalid input", errors: error });
    }
    next(error);
    }
};