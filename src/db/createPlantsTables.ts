import { connectDB } from "../core/config/db";

/**
 * Creates the "plants" and related tables in PostgreSQL.
 */
export async function createPlantsTables(): Promise<void> {
  try {
    const client = await connectDB();

    const query = `
      -- ===============================
      -- Main table: plants
      -- ===============================
      CREATE TABLE IF NOT EXISTS plants (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        scientific_name VARCHAR(255) NOT NULL,
        common_name VARCHAR(255) NOT NULL,
        image_search_url TEXT DEFAULT NULL,
        description TEXT DEFAULT NULL,
        native BOOLEAN DEFAULT NULL,
        light VARCHAR(100) DEFAULT NULL,
        water_needs VARCHAR(100) DEFAULT NULL,
        maintenance_level VARCHAR(100) DEFAULT NULL,
        growth_form VARCHAR(100) DEFAULT NULL,
        is_deleted BOOLEAN DEFAULT FALSE,
        version INT DEFAULT 0,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );

      -- ===============================
      -- Linked tables (1-to-many)
      -- ===============================

      CREATE TABLE IF NOT EXISTS plant_space_types (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        plant_id UUID NOT NULL REFERENCES plants(id) ON DELETE CASCADE,
        space_type VARCHAR(100) NOT NULL
      );

      CREATE TABLE IF NOT EXISTS plant_area_sizes (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        plant_id UUID NOT NULL REFERENCES plants(id) ON DELETE CASCADE,
        area_size VARCHAR(100) NOT NULL
      );

      CREATE TABLE IF NOT EXISTS plant_  (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        plant_id UUID NOT NULL REFERENCES plants(id) ON DELETE CASCADE,
        challenge VARCHAR(255) NOT NULL
      );

      CREATE TABLE IF NOT EXISTS plant_tech_preferences (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        plant_id UUID NOT NULL REFERENCES plants(id) ON DELETE CASCADE,
        tech_preference VARCHAR(100) NOT NULL
      );

      CREATE TABLE IF NOT EXISTS plant_care_notes (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        plant_id UUID NOT NULL REFERENCES plants(id) ON DELETE CASCADE,
        note TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS plant_locations (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        plant_id UUID NOT NULL REFERENCES plants(id) ON DELETE CASCADE,
        location_type VARCHAR(100) NOT NULL,
        location_value VARCHAR(255) NOT NULL
      );
    `;

    await client.query(query);
    console.error("Plants and related tables created successfully!");
  } catch (error: unknown) {
    if (error instanceof Error) {
      console.error("Error creating plants tables:", error.message);
    } else {
      console.error("Unknown error:", error);
    }
  }
}
