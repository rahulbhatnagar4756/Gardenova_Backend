import { connectDB } from "../core/config/db";


/**
 * Creates the `professional_profiles` table if it does not already exist.
 *
 * The table stores:
 * - Profile status (trial, active, blocked)
 * - Trial period dates
 * - Subscription reference
 * - Founder flags and numbering
 * - Geographic coverage settings
 *
 * @returns {Promise<void>} Resolves when the table creation completes.
 * @throws {Error} Logs any database-related errors encountered during execution.
 */
// import { connectDB } from "../core/config/db";

/**
 * Drops and recreates the `professional_profiles` table
 * with the new complete structure.
 */
export async function createSuppliersProfilesTable(): Promise<void> {
    try {
        const client = await connectDB();

        const query = `
        DROP TABLE IF EXISTS suppliers_table CASCADE;

        CREATE TABLE suppliers_table (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            -- Basic Info
            company_name VARCHAR(150),
            email VARCHAR(150),
            category VARCHAR(100),
            description TEXT,

            -- Location
            city VARCHAR(100),
            state VARCHAR(100),
            address TEXT,
            latitude DOUBLE PRECISION,
            longitude DOUBLE PRECISION,

            -- Contact
            telefone VARCHAR(20),
            whatsapp VARCHAR(20),
            website VARCHAR(255),
            instagram VARCHAR(100),

            -- Ratings
            assessment NUMERIC(3,2), -- example: 4.75
            num_avaliacoes INTEGER DEFAULT 0,
            verified_source VARCHAR(100), 

            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );
        `;

        await client.query(query);
        console.error("professional_profiles table recreated successfully.");

    } catch (error: unknown) {
        if (error instanceof Error) {
            console.error("Error recreating professional_profiles table:", error.message);
        } else {
            console.error("Unknown error:", error);
        }
    }
}   