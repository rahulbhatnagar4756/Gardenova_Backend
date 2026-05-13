import { connectDB } from "../core/config/db";

/**
 * Creates the `plant_care_Table` table and its related indexes.
 *
 * This table stores plant care instructions associated with plants
 * from the `plant_table_final` table.
 *
 * Columns:
 * - `id`           : Primary key
 * - `plant_id`     : Foreign key referencing `plant_table_final(id)`
 * - `watering`     : Watering instructions
 * - `sunlight`     : Sunlight requirements
 * - `pruning`      : Pruning instructions
 * - `created_at`   : Record creation timestamp
 * - `updated_at`   : Record last update timestamp
 *
 * Indexes:
 * - `idx_plant_care_plant_id`
 *   Improves lookup performance by `plant_id`.
 *
 * @async
 * @function createPlantCareTables
 * @returns {Promise<void>} Resolves when the table and index are created successfully.
 *
 * @throws Will throw an error if table creation fails.
 */
export async function createPlantCareTables(): Promise<void> {
    try {
        const client = await connectDB();
        const query = `
            CREATE TABLE plant_care_Table (
    id              SERIAL PRIMARY KEY,
    plant_id        INTEGER NOT NULL REFERENCES plant_table_final(id) ON DELETE CASCADE,
    watering        TEXT,
    sunlight        TEXT,
    pruning         TEXT,
    created_at      TIMESTAMP DEFAULT NOW(),
    updated_at      TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_plant_care_plant_id ON plant_care_Table(plant_id);
        `;
        await client.query(query);
        // console.log("Plant care tables created successfully.");
    }
    catch (error) {
        console.error("Error creating plant care tables:", error);
        throw error;
    }
}