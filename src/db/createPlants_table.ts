import { connectDB } from "../core/config/db";
/**
 * Creates the `plant_table` table and its indexes in the database.
 *
 * This function:
 * - Connects to the PostgreSQL database
 * - Drops the existing `plant_table` (development only)
 * - Creates a fresh `plant_table`
 * - Adds useful indexes for optimized querying
 *
 * @async
 * @function createPlantsTable
 * @returns {Promise<void>} Resolves when table creation is complete.
 *
 * @throws Will log an error if database connection or queries fail.
 */
export async function createPlantsTable(): Promise<void> {
    try {
        const client = await connectDB();

        // Drop old table during development
        await client.query(`
            DROP TABLE IF EXISTS plant_table CASCADE;
        `);

        // Create table
        await client.query(`
            CREATE TABLE plant_table (
                id                          INTEGER PRIMARY KEY,
                common_name                 TEXT,
                scientific_name             TEXT,
                other_name                  TEXT,
                family                      TEXT,
                genus                       TEXT,
                species_epithet             TEXT,
                hybrid                      TEXT,
                authority                   TEXT,
                subspecies                  TEXT,
                cultivar                    TEXT,
                variety                     TEXT,
                origin                      TEXT,
                type                        TEXT,
                cycle                       TEXT,

                -- Watering
                watering                    TEXT,
                watering_benchmark_value    TEXT,
                watering_benchmark_unit     TEXT,

                -- Sunlight / Soil
                sunlight                    TEXT,
                soil                        TEXT,

                -- Hardiness
                hardiness_min               TEXT,
                hardiness_max               TEXT,
                hardiness_map_url           TEXT,
                hardiness_map_iframe        TEXT,

                -- Dimensions
                dimension_type              TEXT,
                dimension_min_value         NUMERIC,
                dimension_max_value         NUMERIC,
                dimension_unit              TEXT,

                -- Growth & Care
                growth_rate                 TEXT,
                maintenance                 TEXT,
                care_level                  TEXT,
                care_guides_url             TEXT,

                -- Pruning & Propagation
                pruning_month               TEXT,
                propagation                 TEXT,

                -- Attracts & Pests
                attracts                    TEXT,
                pest_susceptibility         TEXT,

                -- Anatomy
                plant_anatomy               TEXT,

                -- Boolean traits
                drought_tolerant            BOOLEAN,
                salt_tolerant               BOOLEAN,
                thorny                      BOOLEAN,
                invasive                    BOOLEAN,
                tropical                    BOOLEAN,
                indoor                      BOOLEAN,
                flowers                     BOOLEAN,
                flowering_season            TEXT,
                cones                       BOOLEAN,
                fruits                      BOOLEAN,
                edible_fruit                BOOLEAN,
                harvest_season              TEXT,
                leaf                        BOOLEAN,
                edible_leaf                 BOOLEAN,
                seeds                       BOOLEAN,
                cuisine                     BOOLEAN,
                medicinal                   BOOLEAN,
                poisonous_to_humans         BOOLEAN,
                poisonous_to_pets           BOOLEAN,

                -- Description
                description                 TEXT,

                -- Default image
                image_license_code          INTEGER,
                image_license_name          TEXT,
                image_license_url           TEXT,
                image_original_url          TEXT,
                image_regular_url           TEXT,
                image_medium_url            TEXT,
                image_small_url             TEXT,
                image_thumbnail             TEXT,

                created_at TIMESTAMP DEFAULT NOW()
            );
        `);

        // Indexes
        const indexes = [
            `CREATE INDEX IF NOT EXISTS idx_plant_table_common_name ON plant_table(common_name);`,
            `CREATE INDEX IF NOT EXISTS idx_plant_table_family ON plant_table(family);`,
            `CREATE INDEX IF NOT EXISTS idx_plant_table_genus ON plant_table(genus);`,
            `CREATE INDEX IF NOT EXISTS idx_plant_table_type ON plant_table(type);`,
            `CREATE INDEX IF NOT EXISTS idx_plant_table_indoor ON plant_table(indoor);`,
            `CREATE INDEX IF NOT EXISTS idx_plant_table_medicinal ON plant_table(medicinal);`,
            `CREATE INDEX IF NOT EXISTS idx_plant_table_edible_fruit ON plant_table(edible_fruit);`,
            `CREATE INDEX IF NOT EXISTS idx_plant_table_poisonous_humans ON plant_table(poisonous_to_humans);`
        ];

        for (const query of indexes) {
            await client.query(query);
        }

        console.error("plant_table created successfully.");
    } catch (error) {
        console.error("Error creating plant_table:", error);
    }
}