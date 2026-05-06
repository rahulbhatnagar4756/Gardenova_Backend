import { AuthRequest } from "../../interface/auth";
import { Response, NextFunction } from "express";
import { processDesign } from "./landScapeDesignService";


/**
 * Controller to generate a landscape design from an uploaded image.
 *
 * This endpoint:
 * 1. Validates the presence of a base64 image in the request body
 * 2. Passes the image and user preferences to the design processing pipeline
 * 3. Returns the generated garden/landscape design result
 *
 * @route POST /landscape/design
 *
 * @param {AuthRequest} req - Express request object (authenticated)
 * @param {string} req.body.image_base64 - Base64 encoded input image
 * @param {Record<string, any>} [req.body.prefs] - Optional user preferences (e.g., style, space_type)
 *
 * @param {Response} res - Express response object
 * @param {NextFunction} next - Express next middleware function
 *
 * @returns {Promise<void>} Sends JSON response:
 *  - success {boolean}
 *  - message {string}
 *  - data {DesignResult} Generated landscape design output
 *
 * @throws Returns 400 if image is missing
 * @throws Returns 500 if processing fails
 */
export const getLandScapeDesign = async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
        const { image_base64, prefs } = req.body;
        if (!image_base64) {
            res.status(400).json({
                success: false,
                message: "Image is required for landscape design",
            });
            return;
        }
        const result = await processDesign({
            image_base64,
            prefs
        });

        res.status(200).json({
            success: true,
            message: "Landscape design generated successfully",
            data: result, // <-- Return the design result here
            // In a real implementation, you would return the designed landscape data here
        });
        return;
    } catch (error) {
        console.error("Error generating landscape design:", error);
        res.status(500).json({
            success: false,
            message: "An error occurred while generating landscape design",
        });
        next(error);
    }
};
