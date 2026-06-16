import { connectDB } from "../core/config/db";

/**
 * Creates the database tables required for the blog module.
 *
 * This function creates:
 * - `blog_status` enum for managing blog states (`draft`, `published`)
 * - `blog_posts` table for storing blog content and metadata
 * - `blog_tags` table for storing reusable tags
 * - `blog_post_tags` junction table for the many-to-many relationship
 *   between blog posts and tags
 * - A trigger function to automatically update `updated_at`
 *   whenever a blog post is modified
 *
 * The function uses the existing database connection from `connectDB()`
 * and executes all SQL statements in a single query.
 *
 * @async
 * @returns {Promise<void>} Resolves when all blog tables are created successfully.
 *
 * @throws {Error} Logs database errors if table creation fails.
 */
export async function createBlogTable(): Promise<void> {
    try {
        const client = await connectDB();

        const query = `
-- ─────────────────────────────────────────
-- Blog tables
-- ─────────────────────────────────────────

CREATE TYPE blog_status AS ENUM ('draft', 'published');

CREATE TABLE blog_posts (
  id            SERIAL PRIMARY KEY,
  title         TEXT        NOT NULL,
  slug          TEXT        NOT NULL UNIQUE,
  excerpt       TEXT,
  content       TEXT        NOT NULL,
  category      TEXT,
  author        TEXT,
  status        blog_status NOT NULL DEFAULT 'draft',
  banner_url    TEXT,
  thumbnail_url TEXT,
  published_at  TIMESTAMPTZ,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE blog_tags (
  id   SERIAL PRIMARY KEY,
  name TEXT NOT NULL UNIQUE
);

CREATE TABLE blog_post_tags (
  post_id INTEGER NOT NULL REFERENCES blog_posts(id) ON DELETE CASCADE,
  tag_id  INTEGER NOT NULL REFERENCES blog_tags(id)  ON DELETE CASCADE,
  PRIMARY KEY (post_id, tag_id)
);

-- Auto-update updated_at
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER blog_posts_updated_at
  BEFORE UPDATE ON blog_posts
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();`;

        await client.query(query);
        console.error("Blog tables created successfully!");
    } catch (error: unknown) {
        if (error instanceof Error) {
            console.error("Error creating blog tables:", error.message);
        } else {
            console.error("Unknown error:", error);
        }
    }
}