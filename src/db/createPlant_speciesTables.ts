import { connectDB } from "../core/config/db";

/**
 * Creates the `plant_species` table if it does not already exist.
 *
 * The table stores plant species metadata including:
 * - Scientific and common names
 * - Description and image URL (AWS S3 reference)
 * - Water reminder frequency
 * - Fertilizer and pruning schedules
 * - Preferred notification time
 * - Flexible JSONB-based configuration options
 *
 * @returns {Promise<void>} Resolves when the table creation process completes.
 * @throws {Error} Logs any database-related errors during execution.
 */
export async function createPlantSpeciesTable(): Promise<void> {
    try {
        const client = await connectDB();
        const query = `
            CREATE TABLE IF NOT EXISTS plant_species (
                id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

                scientific_name VARCHAR(255) NOT NULL,
                common_name VARCHAR(255) NOT NULL,

                description TEXT,

                -- Image stored in AWS S3
                image_url TEXT,

                -- Water reminder frequency (in days)
                water_reminder_frequency INTEGER NOT NULL 
                    CHECK (water_reminder_frequency > 0),
                water_notification_enabled BOOLEAN DEFAULT FALSE,

                -- Fertilizer schedule (in days)
                fertilizer_schedule INTEGER 
                    CHECK (fertilizer_schedule > 0),
                fertilizer_notification_enabled BOOLEAN DEFAULT FALSE,

                -- Pruning alert frequency (in days)
                pruning_alert INTEGER 
                    CHECK (pruning_alert > 0),
                pruning_notification_enabled BOOLEAN DEFAULT FALSE,

                -- Multiple generic care options 
                -- Each object: { name, frequency, preferred_time, notification_enabled }
                generic_options JSONB DEFAULT '[]'::jsonb,
                generic_reminder_frequency INTEGER 
                    CHECK (pruning_alert > 0),
                generic_notification_enable BOOLEAN DEFAULT FALSE,


                created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
            );
        `;
        await client.query(query);
        console.error("Plant species table created successfully!");
    } catch (error: unknown) {
        if (error instanceof Error) {
            console.error("Error creating plant species table:", error.message);
        } else {
            console.error("Unknown error:", error);
        }
    }
}
