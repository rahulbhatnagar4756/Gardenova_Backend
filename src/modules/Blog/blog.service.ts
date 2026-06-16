import slugify from "slugify";
import { connectDB } from "../../core/config/db";


// ── Types ────────────────────────────────────────────────────────────
export interface CreateBlogInput {
    title: string;
    excerpt?: string;
    content: string;
    category?: string;
    author?: string;
    tags?: string[];   // ["indoor", "plant-care"]
    bannerUrl?: string | undefined;     // "/uploads/blogs/123-banner.jpg"
    thumbnailUrl?: string | undefined;     // "/uploads/blogs/123-thumb.jpg"
    status: "draft" | "published";
}
interface BlogPost {
  id: number;
  title: string;
  slug: string;
  excerpt: string | null;
  content: string;
  category: string | null;
  author: string | null;
  status: "draft" | "published";
  banner_url: string | null;
  thumbnail_url: string | null;
  published_at: Date | null;
  created_at: Date;
  updated_at: Date;
}
/**
 * Generates a unique slug for a blog post title.
 *
 * This function:
 * - Converts the provided title into a URL-friendly slug.
 * - Checks the database for existing slugs.
 * - Appends an incremental number if the slug already exists.
 *
 * Example:
 * ```
 * Input:
 * "My First Blog"
 *
 * Output:
 * "my-first-blog"
 *
 * If already exists:
 * "my-first-blog-1"
 * ```
 *
 * @async
 * @param {string} title - Blog post title used to generate the slug.
 *
 * @returns {Promise<string>} A unique slug that can be safely stored in the database.
 *
 * @throws {Error} Throws an error if database connection or query fails.
 */
async function makeUniqueSlug(title: string): Promise<string> {
    const base = slugify(title, { lower: true, strict: true });
    let slug = base;
    let i = 1;
    const client = await connectDB();
    while (true) {
        const { rows } = await client.query(
            "SELECT id FROM blog_posts WHERE slug = $1",
            [slug]
        );
        if (rows.length === 0) return slug;
        slug = `${base}-${i++}`;
    }
}
/**
 * Creates or updates blog tags and returns their database IDs.
 *
 * This function:
 * - Inserts new tags into the `blog_tags` table.
 * - Reuses existing tags when a tag name already exists.
 * - Normalizes tag names by converting them to lowercase and trimming whitespace.
 * - Collects and returns the IDs of all processed tags.
 *
 * The operation uses PostgreSQL's `ON CONFLICT` handling to prevent
 * duplicate tag records.
 *
 * Example:
 * ```
 * Input:
 * ["JavaScript", " Backend "]
 *
 * Stored:
 * ["javascript", "backend"]
 *
 * Returns:
 * [1, 2]
 * ```
 *
 * @async
 * @param {string[]} tagNames - List of tag names to insert or update.
 * @param {any} client - PostgreSQL database client used to execute queries.
 *
 * @returns {Promise<number[]>} Array of tag IDs.
 *
 * @throws {Error} Throws an error if the database query fails.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function upsertTags(tagNames: string[], client: any): Promise<number[]> {
    const ids: number[] = [];
    for (const name of tagNames) {
        const { rows } = await client.query(
            `INSERT INTO blog_tags (name)
       VALUES ($1)
       ON CONFLICT (name) DO UPDATE SET name = EXCLUDED.name
       RETURNING id`,
            [name.toLowerCase().trim()]
        );
        ids.push(rows[0].id);
    }
    return ids;
}
/**
 * Associates tags with a blog post.
 *
 * This function:
 * - Removes existing tag associations for the given blog post.
 * - Inserts new tag relationships into the `blog_post_tags` junction table.
 * - Prevents duplicate relationships using PostgreSQL conflict handling.
 *
 * This is useful when creating or updating a blog post where the tag list
 * may have changed.
 *
 * Database relationship:
 * ```
 * blog_posts
 *      |
 *      | (many-to-many)
 *      |
 * blog_post_tags
 *      |
 *      |
 * blog_tags
 * ```
 *
 * @async
 * @param {number} postId - ID of the blog post to attach tags to.
 * @param {number[]} tagIds - Array of tag IDs to associate with the blog post.
 * @param {any} client - PostgreSQL database client used to execute queries.
 *
 * @returns {Promise<void>} Resolves when all tag associations are updated.
 *
 * @throws {Error} Throws an error if database operations fail.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function attachTags(postId: number, tagIds: number[], client: any):Promise<void> {
    // Clear existing tags first (for updates)
    await client.query("DELETE FROM blog_post_tags WHERE post_id = $1", [postId]);
    for (const tagId of tagIds) {
        await client.query(
            "INSERT INTO blog_post_tags (post_id, tag_id) VALUES ($1, $2) ON CONFLICT DO NOTHING",
            [postId, tagId]
        );
    }
}

/**
 * Creates a new blog post and stores related tag associations.
 *
 * This function performs a complete blog creation workflow:
 *
 * - Starts a database transaction.
 * - Generates a unique slug from the blog title.
 * - Inserts the blog post into the `blog_posts` table.
 * - Creates or retrieves tags when provided.
 * - Attaches tags to the blog post through the `blog_post_tags` table.
 * - Commits the transaction after successful completion.
 * - Rolls back changes if any operation fails.
 *
 * The blog status determines the published date:
 * - `published` → sets `published_at` to the current date.
 * - `draft` → keeps `published_at` as `null`.
 *
 * @async
 * @param {CreateBlogInput} input - Blog post data including title, content,
 * metadata, images, tags, and status.
 *
 * @returns {Promise<object>} The newly created blog post record.
 *
 * @throws {Error} Throws an error if database operations fail.
 */
export async function createBlogPost(input: CreateBlogInput):Promise<BlogPost> {
    const pool = await connectDB();
    const client = await pool.connect();
    try {
        await client.query("BEGIN");

        const slug = await makeUniqueSlug(input.title);

        const { rows } = await client.query(
            `INSERT INTO blog_posts
         (title, slug, excerpt, content, category, author, status, banner_url, thumbnail_url, published_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9, $10)
       RETURNING *`,
            [
                input.title,
                slug,
                input.excerpt ?? null,
                input.content,
                input.category ?? null,
                input.author ?? null,
                input.status,
                input.bannerUrl ?? null,
                input.thumbnailUrl ?? null,
                input.status === "published" ? new Date() : null,
            ]
        );

        const post = rows[0];

        if (input.tags && input.tags.length > 0) {
            const tagIds = await upsertTags(input.tags, client);
            await attachTags(post.id, tagIds, client);
        }

        await client.query("COMMIT");
        return post;
    } catch (err) {
        await client.query("ROLLBACK");
        throw err;
    } finally {
        client.release();
    }
}

const APP_URL = process.env.APPDEV_URL || "http://localhost:8080";
/**
 * Converts relative blog image paths into complete public URLs.
 *
 * This function appends the application base URL to stored image paths
 * from the database so they can be accessed directly by clients.
 *
 * Example:
 * ```
 * Input:
 * {
 *   banner_url: "/uploads/blogs/banner.jpg",
 *   thumbnail_url: "/uploads/blogs/thumb.jpg"
 * }
 *
 * Output:
 * {
 *   banner_url: "https://example.com/uploads/blogs/banner.jpg",
 *   thumbnail_url: "https://example.com/uploads/blogs/thumb.jpg"
 * }
 * ```
 *
 * @param {any} row - Blog post database record containing image URL fields.
 *
 * @returns {object} Blog post record with absolute image URLs.
 */ 
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function withImageUrls(row: any):any  {
  return {
    ...row,
    banner_url:    row.banner_url    ? `${APP_URL}${row.banner_url}`    : null,
    thumbnail_url: row.thumbnail_url ? `${APP_URL}${row.thumbnail_url}` : null,
  };
}
/**
 * Retrieves blog posts from the database with optional filters.
 *
 * This function:
 * - Fetches blog posts from the `blog_posts` table.
 * - Supports filtering by post status and category.
 * - Joins related tags using the `blog_post_tags` and `blog_tags` tables.
 * - Returns posts ordered by newest creation date.
 * - Converts stored image paths into complete public URLs.
 *
 * Supported filters:
 * - `status`: Filter posts by `draft` or `published`.
 * - `category`: Filter posts by blog category.
 *
 * Example:
 * ```
 * getAllBlogPosts("published", "technology")
 * ```
 *
 * @async
 * @param {"draft" | "published"} [status] - Optional blog status filter.
 * @param {string} [category] - Optional blog category filter.
 *
 * @returns {Promise<object[]>} List of blog posts with associated tags
 * and formatted image URLs.
 *
 * @throws {Error} Throws an error if the database query fails.
 */
export async function getAllBlogPosts(status?: "draft" | "published", category?: string):Promise<BlogPost[]> {
  const conditions: string[] = [];
  const values: string[] = [];
 
  if (status)   { conditions.push(`p.status = $${values.length + 1}`);   values.push(status); }
  if (category) { conditions.push(`p.category = $${values.length + 1}`); values.push(category); }
 
  const where = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";
 
  const pool = await connectDB();
  const { rows } = await pool.query(
    `SELECT
       p.*,
       COALESCE(
         JSON_AGG(t.name) FILTER (WHERE t.name IS NOT NULL),
         '[]'
       ) AS tags
     FROM blog_posts p
     LEFT JOIN blog_post_tags pt ON pt.post_id = p.id
     LEFT JOIN blog_tags t       ON t.id = pt.tag_id
     ${where}
     GROUP BY p.id
     ORDER BY p.created_at DESC`,
    values
  );
 
  return rows.map(withImageUrls);
}
/**
 * Retrieves a single blog post by its unique slug.
 *
 * This function:
 * - Searches for a blog post using the provided slug.
 * - Fetches related tags through the blog post-tag relationship.
 * - Returns the post with formatted image URLs.
 * - Returns `null` when no matching blog post is found.
 *
 * Example:
 * ```
 * Input:
 * "my-first-blog-post"
 *
 * Output:
 * {
 *   id: 1,
 *   title: "My First Blog",
 *   slug: "my-first-blog-post",
 *   tags: ["technology"],
 *   banner_url: "https://example.com/blog_image/banner.jpg"
 * }
 * ```
 *
 * @async
 * @param {string} slug - Unique slug identifier of the blog post.
 *
 * @returns {Promise<object | null>} The blog post with tags and image URLs,
 * or `null` if the post does not exist.
 *
 * @throws {Error} Throws an error if the database query fails.
 */
export async function getBlogPostBySlug(slug: string):Promise<BlogPost | null> {
  const pool = await connectDB();
  const { rows } = await pool.query(
    `SELECT
       p.*,
       COALESCE(
         JSON_AGG(t.name) FILTER (WHERE t.name IS NOT NULL),
         '[]'
       ) AS tags
     FROM blog_posts p
     LEFT JOIN blog_post_tags pt ON pt.post_id = p.id
     LEFT JOIN blog_tags t       ON t.id = pt.tag_id
     WHERE p.slug = $1
     GROUP BY p.id`,
    [slug]
  );
 
  if (!rows[0]) return null;
  return withImageUrls(rows[0]);
}