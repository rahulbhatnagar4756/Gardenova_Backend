import { Router } from "express";
import multer from "multer";
import path from "path";
import {
  createBlog,
  saveDraft,
  getAllBlogs,
  getBlogBySlug,
  updateBlog,
  deleteBlog,
} from "./blog.controller";
/**
 * Configures local disk storage for blog image uploads.
 *
 * Uploaded files are stored inside the `blog_image` directory
 * at the project root. Each file is renamed using a timestamp
 * and random number to prevent filename collisions.
 */
const storage = multer.diskStorage({
  /**
 * Defines the destination directory for uploaded blog images.
 *
 * Multer uses this callback to determine where uploaded files
 * should be stored on the local filesystem.
 *
 * @param {Express.Request} _req - Express request object.
 * @param {Express.Multer.File} _file - Uploaded file information.
 * @param {Function} cb - Callback used to provide the destination path.
 *
 * @returns {void}
 */
  destination: (_req, _file, cb) => {
    cb(null, path.join(process.cwd(), "blog_image"));
  },
/**
 * Generates a unique filename for uploaded blog images.
 *
 * The generated filename contains:
 * - Current timestamp
 * - Random number to reduce filename collisions
 * - Original file extension
 *
 * Example:
 * ```
 * 1718456789000-456789.webp
 * ```
 *
 * @param {Express.Request} _req - Express request object.
 * @param {Express.Multer.File} file - Uploaded file containing original filename.
 * @param {Function} cb - Callback used to provide the generated filename.
 *
 * @returns {void}
 */
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname);
    const name = `${Date.now()}-${Math.round(Math.random() * 1e6)}${ext}`;

    cb(null, name);
  },
});

/**
 * Multer upload middleware configuration for blog images.
 *
 * Features:
 * - Stores images using the local disk storage configuration.
 * - Limits uploaded file size to 10 MB.
 * - Allows only JPEG, PNG, and WebP image formats.
 *
 * @type {multer.Multer}
 */
const upload = multer({
  storage,

  limits: {
    fileSize: 10 * 1024 * 1024,
  },
  /**
 * Filters uploaded files and allows only supported image formats.
 *
 * This Multer filter validates the uploaded file MIME type before
 * saving it to the server.
 *
 * Allowed formats:
 * - JPEG (`image/jpeg`)
 * - PNG (`image/png`)
 * - WebP (`image/webp`)
 *
 * Files with unsupported MIME types will be rejected with an error.
 *
 * @param {Express.Request} _req - Express request object.
 * @param {Express.Multer.File} file - Uploaded file information including MIME type.
 * @param {Function} cb - Callback used to accept or reject the uploaded file.
 *
 * @returns {void}
 */
  fileFilter: (_req, file, cb) => {
    const allowed = [
      "image/jpeg",
      "image/png",
      "image/webp",
    ];

    if (allowed.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error("Only JPG, PNG, and WebP images are allowed"));
    }
  },
});
const fields = upload.fields([
  { name: "banner", maxCount: 1 },
  { name: "thumbnail", maxCount: 1 },
]);

const router = Router();

/**
 * @swagger
 * /api/blog:
 *   post:
 *     summary: Create a new blog
 *     tags:
 *       - Blogs
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             required:
 *               - title
 *               - content
 *             properties:
 *               title:
 *                 type: string
 *               content:
 *                 type: string
 *               slug:
 *                 type: string
 *               banner:
 *                 type: string
 *                 format: binary
 *               thumbnail:
 *                 type: string
 *                 format: binary
 *     responses:
 *       201:
 *         description: Blog created successfully
 *       400:
 *         description: Invalid request
 */
router.post("/", fields, createBlog);

/**
 * @swagger
 * /api/blog/draft:
 *   post:
 *     summary: Save a blog as draft
 *     tags:
 *       - Blogs
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             properties:
 *               title:
 *                 type: string
 *               content:
 *                 type: string
 *               slug:
 *                 type: string
 *               banner:
 *                 type: string
 *                 format: binary
 *               thumbnail:
 *                 type: string
 *                 format: binary
 *     responses:
 *       201:
 *         description: Draft saved successfully
 *       400:
 *         description: Invalid request
 */
router.post("/draft", fields, saveDraft);

/**
 * @swagger
 * /api/v1/blogs/:
 *   get:
 *     summary: Get all blogs
 *     tags:
 *       - Blogs
 *     responses:
 *       200:
 *         description: List of all blogs
 */
router.get("/", getAllBlogs);

/**
 * @swagger
 * /api/v1/blogs/{slug}:
 *   get:
 *     summary: Get blog by slug
 *     tags:
 *       - Blogs
 *     parameters:
 *       - in: path
 *         name: slug
 *         required: true
 *         schema:
 *           type: string
 *         description: Blog slug
 *     responses:
 *       200:
 *         description: Blog found
 *       404:
 *         description: Blog not found
 */
router.get("/:slug", getBlogBySlug);


router.put(   "/:id",    fields, updateBlog);
router.delete("/:id",            deleteBlog);

export default router;