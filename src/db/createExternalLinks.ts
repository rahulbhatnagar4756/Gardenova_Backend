import { connectDB } from "../core/config/db";

/**
 * Creates the `external_links` table in the database if it does not already exist.
 *
 * The table includes:
 * - `id`: UUID primary key (auto-generated)
 * - `title`: Title of the external link (required)
 * - `url`: URL of the external link (optional)
 * - `is_active`: Flag to indicate active/inactive status
 * - `created_at`: Timestamp when the record was created
 * - `updated_at`: Timestamp when the record was last updated
 *
 * @returns Promise<void> Resolves when the table creation query completes
 *
 * @throws Logs an error if table creation fails
 */
export async function createExternalLinksTable(): Promise<void> {
    try {
        const client = await connectDB();
        const query = `
      CREATE TABLE IF NOT EXISTS external_links (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

     title VARCHAR(100) NOT NULL,

     url TEXT,

     is_active BOOLEAN NOT NULL DEFAULT FALSE,

     created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
     updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
    );`;
        await client.query(query);
        console.error("External links table created successfully!");
    } catch (error: unknown) {
        if (error instanceof Error) {
            console.error("Error creating users table:", error.message);
        } else {
            console.error("Unknown error:", error);
        }
    }
}