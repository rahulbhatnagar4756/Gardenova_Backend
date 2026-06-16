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




// interface UpdateBlogPostInput {
//   title?: string;
//   excerpt?: string;
//   content?: string;
//   category?: string;
//   author?: string;
//   tags?: string[];
//   bannerUrl?: string;
//   thumbnailUrl?: string;
//   status?: "draft" | "published";
// }

interface BlogPost {
  id: number;
  title: string;
  excerpt: string| null;
  content: string;
  category: string| null;
  author: string| null;
  banner_url: string | null;
  thumbnail_url: string | null;
  status: "draft" | "published";
  published_at: Date | null;
  created_at: Date;
  updated_at: Date;
}

/**
 * Updates an existing blog post and manages its related tags.
 *
 * This service handles:
 * - Dynamically updating only the provided blog post fields.
 * - Updating publication timestamp when status changes to "published".
 * - Removing and recreating tag relationships when tags are provided.
 * - Creating new tags or reusing existing tags.
 * - Executing all database operations inside a transaction.
 *
 * @async
 * @function updateBlogPost
 *
 * @param {number} id - The unique identifier of the blog post to update.
 * @param {Object} input - The fields to update.
 * @param {string} [input.title] - Updated blog post title.
 * @param {string} [input.excerpt] - Updated blog post excerpt.
 * @param {string} [input.content] - Updated blog post content.
 * @param {string} [input.category] - Updated blog post category.
 * @param {string} [input.author] - Updated blog post author.
 * @param {string[]} [input.tags] - Updated list of tags associated with the post.
 * @param {string} [input.bannerUrl] - Updated banner image URL.
 * @param {string} [input.thumbnailUrl] - Updated thumbnail image URL.
 * @param {"draft" | "published"} [input.status] - Updated publication status.
 *
 * @returns {Promise<Object>} The updated blog post with formatted image URLs.
 *
 * @throws {Error} If no fields are provided for update.
 * @throws {Error} If the blog post does not exist.
 * @throws {Error} If any database operation fails.
 */
export async function updateBlogPost(id: number, input: {
  title?: string;
  excerpt?: string;
  content?: string;
  category?: string;
  author?: string;
  tags?: string[];
  bannerUrl?: string;
  thumbnailUrl?: string;
  status?: "draft" | "published";
}):Promise<BlogPost> {
  const pool = await connectDB();
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
 
    const fields: string[] = [];
    //eslint-disable-next-line @typescript-eslint/no-explicit-any
    const values: any[] = [];
 
    if (input.title !== undefined)    { fields.push(`title = $${values.length + 1}`);         values.push(input.title); }
    if (input.excerpt !== undefined)  { fields.push(`excerpt = $${values.length + 1}`);       values.push(input.excerpt); }
    if (input.content !== undefined)  { fields.push(`content = $${values.length + 1}`);       values.push(input.content); }
    if (input.category !== undefined) { fields.push(`category = $${values.length + 1}`);      values.push(input.category); }
    if (input.author !== undefined)   { fields.push(`author = $${values.length + 1}`);        values.push(input.author); }
    if (input.bannerUrl !== undefined)    { fields.push(`banner_url = $${values.length + 1}`);    values.push(input.bannerUrl); }
    if (input.thumbnailUrl !== undefined) { fields.push(`thumbnail_url = $${values.length + 1}`); values.push(input.thumbnailUrl); }
    if (input.status !== undefined) {
      fields.push(`status = $${values.length + 1}`);
      values.push(input.status);
      if (input.status === "published") {
        fields.push(`published_at = $${values.length + 1}`);
        values.push(new Date());
      }
    }
 
    if (fields.length === 0) throw new Error("No fields to update");
 
    values.push(id);
    const { rows } = await client.query(
      `UPDATE blog_posts SET ${fields.join(", ")} WHERE id = $${values.length} RETURNING *`,
      values
    );
 
    if (!rows[0]) throw new Error("Post not found");
 
    if (input.tags !== undefined) {
      await client.query("DELETE FROM blog_post_tags WHERE post_id = $1", [id]);
      for (const name of input.tags) {
        const { rows: tagRows } = await client.query(
          `INSERT INTO blog_tags (name) VALUES ($1) ON CONFLICT (name) DO UPDATE SET name = EXCLUDED.name RETURNING id`,
          [name.toLowerCase().trim()]
        );
        await client.query(
          `INSERT INTO blog_post_tags (post_id, tag_id) VALUES ($1, $2) ON CONFLICT DO NOTHING`,
          [id, tagRows[0].id]
        );
      }
    }
 
    await client.query("COMMIT");
    return withImageUrls(rows[0]);
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }
}
/**
 * Deletes a blog post from the database by its ID.
 *
 * This service handles:
 * - Connecting to the database.
 * - Deleting the blog post with the specified identifier.
 * - Returning the deleted post ID when deletion succeeds.
 * - Returning null when no matching blog post is found.
 *
 * @async
 * @function deleteBlogPost
 *
 * @param {number} id - The unique identifier of the blog post to delete.
 *
 * @returns {Promise<{ id: number } | null>} The deleted blog post ID,
 * or null if the post does not exist.
 *
 * @throws {Error} If the database connection or deletion query fails.
 */
export async function deleteBlogPost(id: number):Promise<{ id: number } | null>  {
  const pool = await connectDB();
  const { rows } = await pool.query(
    "DELETE FROM blog_posts WHERE id = $1 RETURNING id",
    [id]
  );
  return rows[0] ?? null;
}