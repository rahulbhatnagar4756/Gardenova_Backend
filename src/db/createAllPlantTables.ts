import { connectDB } from "../core/config/db";

/**
 * Creates the All_plants table in the database if it does not already exist.
 * This table stores various attributes of different plants, including 
 * common name, scientific name, family, genus, and other plant-related details.
 * 
 * @returns {Promise<void>} A promise that resolves once the table is created.
 */
export async function createAllPlantTables(): Promise<void> {

    const client = await connectDB();
    try {
        const query = `
            CREATE EXTENSION IF NOT EXISTS "pgcrypto"; -- needed for gen_random_uuid()

            CREATE TABLE plantsTable (
                id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                gbif_id       BIGINT,
                species_id    BIGINT,
                genus_id      BIGINT,
                family_id     BIGINT,
                species_name  VARCHAR(255),
                genus_name    VARCHAR(255),
                family_name   VARCHAR(255),
                lat           DECIMAL(9, 6),
                lon           DECIMAL(9, 6),
                image_url     TEXT,
                day_of_year   SMALLINT,
                common_name         VARCHAR(255),
                inat_common_name    VARCHAR(255),
                trefle_common_name  VARCHAR(255),
                plant_type    VARCHAR(100),
                growth_habit  VARCHAR(100),
                edible        BOOLEAN,
                edible_part   VARCHAR(255),
                vegetable     BOOLEAN
            );
        `;
        await client.query(query);
        console.error("All plant tables created successfully.");
    } catch (error) {
        console.error("Error creating all plant tables:", error);
    }
};