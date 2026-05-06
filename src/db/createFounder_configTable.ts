import { connectDB } from "../core/config/db";

/**
 * Creates the `founder_config` table if it does not already exist.
 *
 * The table contains:
 * - id (Primary Key)
 * - founder_counter (current number of founders)
 * - founder_limit (maximum allowed founders, default: 50)
 *
 * This function is typically executed during application startup
 * or database initialization.
 *
 * @returns {Promise<void>} Resolves when the table creation process completes.
 * @throws {Error} Logs any database or execution errors encountered.
 */
export async function createFounderConfigTables(): Promise<void> {
    try {
        const client = await connectDB();
        console.error("Connected to database...");
        const query = `
        CREATE TABLE IF NOT EXISTS founder_config (
        id SERIAL PRIMARY KEY,
        founder_counter INTEGER DEFAULT 0,
        founder_limit INTEGER DEFAULT 50
        );`;
        await client.query(query);
        console.error("Founder config table created successfully!");
    } catch (error: unknown) {
        if (error instanceof Error) {
            console.error("Error creating founder_config table:", error.message);
        } else {
            console.error("Unknown error:", error);
        }

    }
}
