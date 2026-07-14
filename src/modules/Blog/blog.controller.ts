import { Request, Response } from "express";
import { createBlogPost, deleteBlogPost, getAllBlogPosts, getBlogPostBySlug, getPublishedBlogSlugs, updateBlogPost } from "./blog.service";

/**
 * Retrieves the uploaded image URL from Multer files.
 *
 * This function extracts a file from a specific field name when using
 * `multer.fields()` and converts the stored filename into a publicly
 * accessible URL path.
 *
 * Example:
 * - Multer field: `banner`
 * - Stored file: `1712345678-image.jpg`
 * - Returned URL: `/uploads/blogs/1712345678-image.jpg`
 *
 * @param {Express.Multer.File[] | undefined} files - Uploaded files object from Multer.
 * @param {string} field - The field name containing the image file (e.g. `banner`, `thumbnail`).
 *
 * @returns {string | undefined} The public image URL if a file exists, otherwise `undefined`.
 */
// function getImageUrl(files: Express.Multer.File[] | undefined, field: string): string | undefined {
//   const req = files as any;
//   if (!req) return undefined;
//   const file = req[field]?.[0] as Express.Multer.File | undefined;
//   if (!file) return undefined;
//   // Return a web-accessible path: /uploads/blogs/filename.jpg
//   return `/uploads/blogs/${file.filename}`;
// }
/**
 * Parses raw tag data into a string array.
 *
 * This function handles different input formats:
 * - Returns an empty array when no value is provided.
 * - Returns the value directly if it is already an array.
 * - Attempts to parse JSON string data into an array.
 * - Returns an empty array if JSON parsing fails.
 *
 * Example:
 * ```ts
 * parseTags('["javascript", "typescript"]')
 * // Returns: ["javascript", "typescript"]
 *
 * parseTags(["nodejs", "backend"])
 * // Returns: ["nodejs", "backend"]
 * ```
 *
 * @param {unknown} raw - Raw tag input received from request data.
 *
 * @returns {string[]} Parsed list of tags.
 */
function parseTags(raw: unknown): string[] {
  if (!raw) return [];
  if (Array.isArray(raw)) return raw;
  try { return JSON.parse(raw as string); } catch { return []; }
}

/**
 * Creates and publishes a new blog post.
 *
 * This controller handles:
 * - Validating required fields (`title` and `content`)
 * - Processing uploaded images from Multer (`banner` and `thumbnail`)
 * - Parsing blog tags from the request body
 * - Creating a new blog post with published status
 * - Returning the created blog post response
 *
 * Expected request:
 * - Content-Type: multipart/form-data
 * - Body fields:
 *   - title: string (required)
 *   - content: string (required)
 *   - excerpt?: string
 *   - category?: string
 *   - author?: string
 *   - tags?: string | string[]
 *
 * Uploaded files:
 * - banner?: Blog banner image
 * - thumbnail?: Blog thumbnail image
 *
 * @async
 * @param {Request} req - Express request object containing blog data and uploaded files.
 * @param {Response} res - Express response object used to send API responses.
 *
 * @returns {Promise<Response>} Returns:
 * - 201 with the created blog post on success.
 * - 400 when required fields are missing.
 * - 500 when an internal server error occurs.
 *
 * @throws {Error} Handles and logs unexpected database or server errors.
 */
export async function createBlog(req: Request, res: Response): Promise<Response> {
  try {
const { title, excerpt, content, category, author, tags, status } = req.body;
    const slug = String(req.body.slug ?? "");
    const meta_description = String(req.body.meta_description ?? "");

    if (!title?.trim()) return res.status(400).json({ error: "Title is required" });
    if (!content?.trim()) return res.status(400).json({ error: "Content is required" });

    const files = req.files as Record<string, Express.Multer.File[]>;
    const bannerUrl = files?.banner?.[0] ? `/blog_image/${files.banner[0].filename}` : undefined;
    const thumbnailUrl = files?.thumbnail?.[0] ? `/blog_image/${files.thumbnail[0].filename}` : undefined;

    const post = await createBlogPost({
  title: title.trim(),
  excerpt: excerpt?.trim(),
  content: content?.trim() ?? "",
  category: category?.trim(),
  author: author?.trim(),
  tags: parseTags(tags),
  status: status === "draft" ? "draft" : "published",
  ...(bannerUrl            && { bannerUrl }),
  ...(thumbnailUrl         && { thumbnailUrl }),
  ...(slug?.trim()         && { slug: slug.trim().toLowerCase() }),
  ...(meta_description?.trim() && { metaDescription: meta_description.trim() }),
});
    return res.status(201).json({ success: true, post });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } catch (err: any) {
    console.error("[createBlog]", err);
    return res.status(500).json({ error: "Failed to create blog post" });
  }
}

/**
 * Saves a blog post as a draft.
 *
 * This controller handles:
 * - Validating the required title field
 * - Processing optional uploaded images (`banner` and `thumbnail`)
 * - Parsing tags from the request body
 * - Creating a blog post with `draft` status
 * - Returning the saved draft response
 *
 * Expected request:
 * - Content-Type: multipart/form-data
 * - Body fields:
 *   - title: string (required)
 *   - content?: string
 *   - excerpt?: string
 *   - category?: string
 *   - author?: string
 *   - tags?: string | string[]
 *
 * Uploaded files:
 * - banner?: Blog banner image
 * - thumbnail?: Blog thumbnail image
 *
 * @async
 * @param {Request} req - Express request object containing draft data and uploaded files.
 * @param {Response} res - Express response object used to send API responses.
 *
 * @returns {Promise<Response>} Returns:
 * - 201 with the created draft post on success.
 * - 400 when the required title is missing.
 * - 500 when an internal server error occurs.
 *
 * @throws {Error} Handles unexpected database or server errors.
 */
export async function saveDraft(req: Request, res: Response): Promise<Response> {
  try {
const { title, excerpt, content, category, author, tags, slug, meta_description } = req.body;
    // console.log("req.body", req.body);           // ← here
    // console.log("meta_description:", meta_description);  // ← her
    if (!title?.trim()) return res.status(400).json({ error: "Title is required to save draft" });

    const files = req.files as Record<string, Express.Multer.File[]>;
    const bannerUrl = files?.banner?.[0] ? `/uploads/blogs/${files.banner[0].filename}` : undefined;
    const thumbnailUrl = files?.thumbnail?.[0] ? `/uploads/blogs/${files.thumbnail[0].filename}` : undefined;

    const post = await createBlogPost({
  title: title.trim(),
  excerpt: excerpt?.trim(),
  content: content?.trim() ?? "",
  category: category?.trim(),
  author: author?.trim(),
  tags: parseTags(tags),
  status: "draft",
  ...(bannerUrl            && { bannerUrl }),
  ...(thumbnailUrl         && { thumbnailUrl }),
  ...(slug?.trim()         && { slug: slug.trim().toLowerCase() }),  
  ...(meta_description?.trim() && { metaDescription: meta_description.trim() }),
});

    return res.status(201).json({ success: true, post });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } catch (err: any) {
    console.error("[saveDraft]", err);
    return res.status(500).json({ error: "Failed to save draft" });
  }
}

/**
 * Retrieves all blog posts.
 *
 * This controller handles:
 * - Reading an optional status filter from query parameters
 * - Fetching blog posts from the database
 * - Returning a list of blog posts in the response
 *
 * Supported query parameters:
 * - status?: Filter posts by status:
 *   - `draft`
 *   - `published`
 *
 * Example:
 * ```
 * GET /api/v1/blogs?status=published
 * ```
 *
 * @async
 * @param {Request} req - Express request object containing query parameters.
 * @param {Response} res - Express response object used to send API responses.
 *
 * @returns {Promise<Response>} Returns:
 * - 200 with a list of blog posts.
 * - 500 when an internal server error occurs.
 *
 * @throws {Error} Handles unexpected database or server errors.
 */
export async function getAllBlogs(req: Request, res: Response): Promise<Response> {
  try {
    const status = req.query.status as "draft" | "published" | undefined;
    const posts = await getAllBlogPosts(status);
    return res.json({ success: true, posts });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } catch (err: any) {
    console.error("[getAllBlogs]", err);
    return res.status(500).json({ error: "Failed to fetch blog posts" });
  }
}

/**
 * Retrieves a single blog post by its slug.
 *
 * This controller handles:
 * - Reading the blog slug from the route parameters
 * - Fetching the corresponding blog post from the database
 * - Returning the blog post if found
 * - Returning a 404 response when no matching post exists
 *
 * Route parameter:
 * - slug: Unique identifier of the blog post
 *
 * Example:
 * ```
 * GET /api/v1/blogs/my-first-blog-post
 * ```
 *
 * @async
 * @param {Request} req - Express request object containing the blog slug parameter.
 * @param {Response} res - Express response object used to send API responses.
 *
 * @returns {Promise<Response>} Returns:
 * - 200 with the requested blog post.
 * - 404 when the blog post does not exist.
 * - 500 when an internal server error occurs.
 *
 * @throws {Error} Handles unexpected database or server errors.
 */
export async function getBlogBySlug(req: Request, res: Response): Promise<Response> {
  try {
    const post = await getBlogPostBySlug(req.params.slug!);
    if (!post) return res.status(404).json({ error: "Blog post not found" });
    return res.json({ success: true, post });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } catch (err: any) {
    console.error("[getBlogBySlug]", err);
    return res.status(500).json({ error: "Failed to fetch blog post" });
  }
}
/**
 * Updates an existing blog post by its ID.
 *
 * This controller handles:
 * - Validating the blog post ID from request parameters.
 * - Extracting updated blog fields from the request body.
 * - Processing optional banner and thumbnail image uploads.
 * - Parsing tags before updating the blog post.
 * - Returning the updated blog post on success.
 *
 * @async
 * @function updateBlog
 * @param {Request} req - Express request object containing blog data and uploaded files.
 * @param {Response} res - Express response object used to send the update result.
 *
 * @returns {Promise<Response>} Returns a JSON response containing:
 * - `success: true` and the updated post on successful update.
 * - Error message with appropriate HTTP status code on failure.
 *
 * @throws {500} If an unexpected error occurs while updating the blog post.
 */
export async function updateBlog(req: Request, res: Response): Promise<Response> {
  try {
    const id = parseInt(req.params.id!);
    if (isNaN(id)) return res.status(400).json({ error: "Invalid post id" });

    const { title, excerpt, content, category, author, tags, status, slug, meta_description } = req.body;
    // console.log("req.body", req.body);           // ← here
    // console.log("meta_description:", meta_description);  // ← here  
    const files = req.files as Record<string, Express.Multer.File[]>;
    const bannerUrl = files?.banner?.[0] ? `/blog_image/${files.banner[0].filename}` : undefined;
    const thumbnailUrl = files?.thumbnail?.[0] ? `/blog_image/${files.thumbnail[0].filename}` : undefined;

    const post = await updateBlogPost(id, {
      title: title?.trim(),
      excerpt: excerpt?.trim(),
      content: content?.trim(),
      category: category?.trim(),
      author: author?.trim(),
      tags: parseTags(tags),
      status,
      ...(bannerUrl && { bannerUrl }),
      ...(thumbnailUrl && { thumbnailUrl }),
       ...(slug?.trim()            && { slug: slug.trim().toLowerCase() }),
  ...(meta_description && { metaDescription: String(meta_description).trim() }),
    });

    return res.json({ success: true, post });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } catch (err: any) {
    console.error("[updateBlog]", err);
    return res.status(500).json({ error: "Failed to update blog post" });
  }
}

/**
 * Deletes an existing blog post by its ID.
 *
 * This controller handles:
 * - Validating the blog post ID from request parameters.
 * - Removing the blog post using the delete service.
 * - Returning a success response when deletion is completed.
 * - Returning a not found response if the post does not exist.
 *
 * @async
 * @function deleteBlog
 * @param {Request} req - Express request object containing the blog post ID in params.
 * @param {Response} res - Express response object used to send the deletion result.
 *
 * @returns {Promise<Response>} Returns a JSON response containing:
 * - `success: true` and confirmation message when the post is deleted.
 * - Error message with appropriate HTTP status code on failure.
 *
 * @throws {500} If an unexpected error occurs while deleting the blog post.
 */
export async function deleteBlog(req: Request, res: Response): Promise<Response> {
  try {
    const id = parseInt(req.params.id!);
    if (isNaN(id)) return res.status(400).json({ error: "Invalid post id" });

    const deleted = await deleteBlogPost(id);
    if (!deleted) return res.status(404).json({ error: "Post not found" });

    return res.json({ success: true, message: "Post deleted" });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } catch (err: any) {
    console.error("[deleteBlog]", err);
    return res.status(500).json({ error: "Failed to delete post" });
  }
}






interface BlogSlugRow {
  slug: string;
  updated_at: Date | string;
}

interface StaticPage {
  loc: string;
  changefreq: string;
  priority: string;
}

let cachedXml: string | null = null;
let cachedAt: number = 0;
const CACHE_TTL_MS = 60*60* 1000; // 1 hour cache

const BASE_URL = "https://gardenova.ai";

const STATIC_PAGES: StaticPage[] = [
  { loc: "/", changefreq: "weekly", priority: "1.0" },
  { loc: "/pricing", changefreq: "monthly", priority: "0.8" },
  { loc: "/about-us", changefreq: "monthly", priority: "0.6" },
  { loc: "/ai-garden-vision", changefreq: "monthly", priority: "0.6" },
  { loc: "/contact", changefreq: "monthly", priority: "0.5" },
  { loc: "/blog", changefreq: "daily", priority: "0.9" },
  { loc: "/t%26c", changefreq: "yearly", priority: "0.3" },
  { loc: "/privacy-policy", changefreq: "yearly", priority: "0.3" },
];
/**
 * Escapes special XML characters in a string to their corresponding XML entities.
 *
 * Converts the following characters:
 * - `&` → `&amp;`
 * - `<` → `&lt;`
 * - `>` → `&gt;`
 * - `"` → `&quot;`
 * - `'` → `&apos;`
 *
 * This function is useful for safely embedding user-provided text in XML
 * documents, such as RSS feeds, sitemaps, or SOAP messages.
 *
 * @param {string} str - The input string to escape.
 * @returns {string} The XML-escaped string.
 */
function escapeXml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}
/**
 * Builds an XML sitemap from static pages and published blog posts.
 *
 * The generated sitemap conforms to the Sitemap Protocol and includes:
 * - Static site pages with their configured change frequency and priority.
 * - Published blog posts with their last modified date, weekly change
 *   frequency, and a default priority of `0.7`.
 *
 * Blog post slugs are XML-escaped to ensure valid output.
 *
 * @param {StaticPage[]} staticPages - The collection of static pages to include
 * in the sitemap.
 * @param {BlogSlugRow[]} blogRows - The published blog posts containing their
 * slugs and last updated timestamps.
 * @returns {string} A complete XML sitemap as a string.
 */
function buildXml(staticPages: StaticPage[], blogRows: BlogSlugRow[]): string {
  const staticEntries = staticPages
    .map(
      (p) => `
  <url>
    <loc>${BASE_URL}${p.loc}</loc>
    <changefreq>${p.changefreq}</changefreq>
    <priority>${p.priority}</priority>
  </url>`
    )
    .join("");

  const blogEntries = blogRows
    .map(
      (b) => `
  <url>
    <loc>${BASE_URL}/blog/${escapeXml(b.slug)}</loc>
    <lastmod>${new Date(b.updated_at).toISOString().split("T")[0]}</lastmod>
    <changefreq>weekly</changefreq>
    <priority>0.7</priority>
  </url>`
    )
    .join("");

  return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${staticEntries}${blogEntries}
</urlset>`;
}
/**
 * Handles requests for the XML sitemap.
 *
 * Generates the sitemap on demand and caches the generated XML for a fixed
 * duration to reduce database queries and improve response times. When the
 * cache expires, the sitemap is rebuilt using the latest published blog posts.
 *
 * Response:
 * - `200 OK` with the XML sitemap.
 * - `500 Internal Server Error` if sitemap generation fails.
 *
 * @async
 * @param {Request} req - The Express request object.
 * @param {Response} res - The Express response object used to send the sitemap.
 * @returns {Promise<void>} A promise that resolves once the response has been sent.
 */
export const getSitemapXml = async (req: Request, res: Response): Promise<void> => {
  try {
    const now = Date.now();
    // console.log("Sitemap request received at");
    if (!cachedXml || now - cachedAt > CACHE_TTL_MS) {
      const blogs: BlogSlugRow[] = await getPublishedBlogSlugs();
      cachedXml = buildXml(STATIC_PAGES, blogs);
      cachedAt = now;
    }

    res.set("Content-Type", "application/xml");
    res.send(cachedXml);
  } catch (err) {
    console.error("Sitemap generation failed:", err);
    res.status(500).send("Sitemap generation error");
  }
};