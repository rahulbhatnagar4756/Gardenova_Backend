import multer from "multer";
import path from "path";
import os from "os";

/**
 * Multer middleware configuration for handling CSV file uploads.
 *
 * This configuration:
 * - Stores uploaded files in the OS temporary directory.
 * - Generates a unique filename using a timestamp.
 * - Limits file size to 500 MB.
 * - Filters uploads to allow only CSV files (by MIME type or file extension).
 *
 * Notes:
 * - The uploaded file will be available on `req.file`.
 * - The file path (`req.file.path`) can be used downstream for streaming or processing.
 * - Suitable for large CSV files (e.g., ~400k rows).
 */
export const uploadCsv = multer({
     /**
     * Disk storage configuration for multer.
     */
    storage: multer.diskStorage({
        /**
         * Sets the destination directory for uploaded files to the OS temporary directory.
         *
         * @param {Express.Request} _req - Express request object (unused).
         * @param {Express.Multer.File} _file - Uploaded file metadata (unused).
         * @param {(error: Error | null, destination: string) => void} cb - Callback to set destination.
         *  @returns {void}
         */
        destination: (_req, _file, cb) => cb(null, os.tmpdir()),
         /**
         * Generates a unique filename for the uploaded file.
         *
         * @param {Express.Request} _req - Express request object (unused).
         * @param {Express.Multer.File} file - Uploaded file metadata.
         * @param {(error: Error | null, filename: string) => void} cb - Callback to set filename.
         * @returns {void}
         */
        filename: (_req, file, cb) =>
            cb(null, `csv-import-${Date.now()}${path.extname(file.originalname)}`),
    }),
      /**
     * Upload limits configuration.
     */
    limits: { fileSize: 500 * 1024 * 1024 }, // 500 MB — 400k rows easily fits
     /**
     * File filter to validate uploaded file type.
     *
     * Only allows files with:
     * - MIME type `text/csv`, OR
     * - `.csv` file extension
     *
     * @param {Express.Request} _req - Express request object (unused).
     * @param {Express.Multer.File} file - Uploaded file metadata.
     * @param {import("multer").FileFilterCallback} cb - Callback to accept or reject the file.
     * @returns {void}
     */
    fileFilter: (_req, file, cb) => {
        const isCsv =
            file.mimetype === "text/csv" ||
            file.originalname.toLowerCase().endsWith(".csv");
        if (!isCsv) return cb(new Error("Only CSV files are allowed"));
        cb(null, true);
    },
});