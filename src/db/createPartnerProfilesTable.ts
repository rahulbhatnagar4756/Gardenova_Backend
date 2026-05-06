import { connectDB } from "../core/config/db";

/**
 * Creates the "partner_profiles" table in PostgreSQL.
 * All fields are flattened — no JSON columns used.
 */
export async function createPartnerProfilesTable(): Promise<void> {
  try {
    const client = await connectDB();

    const query = `
      CREATE TABLE IF NOT EXISTS partner_profiles (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        email VARCHAR(255) NOT NULL,
        mobile_number VARCHAR(20) NOT NULL,
        company_name VARCHAR(255) DEFAULT NULL,
        speciality_1 VARCHAR(100) DEFAULT NULL,
        speciality_2 VARCHAR(100) DEFAULT NULL,
        speciality_3 VARCHAR(100) DEFAULT NULL,
        street VARCHAR(255) DEFAULT NULL,
        city VARCHAR(100) DEFAULT NULL,
        state VARCHAR(100) DEFAULT NULL,
        country VARCHAR(100) DEFAULT NULL,
        zip_code VARCHAR(20) DEFAULT NULL,
        website VARCHAR(255) DEFAULT NULL,
        contact_person VARCHAR(150) DEFAULT NULL,
        project_image_url TEXT DEFAULT NULL,
        rating NUMERIC(2,1) DEFAULT NULL,
        status VARCHAR(20) DEFAULT 'pending',
        is_disabled BOOLEAN DEFAULT FALSE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `;

    await client.query(query);
    console.error("partner_profiles table created successfully!");
  } catch (error: unknown) {
    if (error instanceof Error) {
      console.error("Error creating partner_profiles table:", error.message);
    } else {
      console.error("Unknown error:", error);
    }
  }
}

/**
 * Creates optimized indexes for fast retrieval of plant and partner recommendations.
 * These indexes significantly improve query performance for recommendation queries.
 */
export async function createOptimizedIndexes(): Promise<void> {
  try {
    const client = await connectDB();

    const queries = `
      -- ===============================
      -- Plant Indexes
      -- ===============================
      
      -- Main plant filters
      CREATE INDEX IF NOT EXISTS idx_plants_is_deleted 
        ON plants(is_deleted) 
        WHERE is_deleted = FALSE;

      -- Linked table indexes for fast joins
      CREATE INDEX IF NOT EXISTS idx_plant_space_types_plant_id 
        ON plant_space_types(plant_id);
      
      CREATE INDEX IF NOT EXISTS idx_plant_space_types_space_type 
        ON plant_space_types(space_type);
      
      -- Case-insensitive search on space_type
      CREATE INDEX IF NOT EXISTS idx_plant_space_types_space_type_lower 
        ON plant_space_types(LOWER(space_type));

      CREATE INDEX IF NOT EXISTS idx_plant_area_sizes_plant_id 
        ON plant_area_sizes(plant_id);
      
      CREATE INDEX IF NOT EXISTS idx_plant_area_sizes_area_size_lower 
        ON plant_area_sizes(LOWER(area_size));

      CREATE INDEX IF NOT EXISTS idx_plant_challenges_plant_id 
        ON plant_challenges(plant_id);
      
      CREATE INDEX IF NOT EXISTS idx_plant_challenges_challenge_lower 
        ON plant_challenges(LOWER(challenge));

      CREATE INDEX IF NOT EXISTS idx_plant_tech_preferences_plant_id 
        ON plant_tech_preferences(plant_id);
      
      CREATE INDEX IF NOT EXISTS idx_plant_tech_preferences_tech_lower 
        ON plant_tech_preferences(LOWER(tech_preference));

      CREATE INDEX IF NOT EXISTS idx_plant_locations_plant_id 
        ON plant_locations(plant_id);
      
      CREATE INDEX IF NOT EXISTS idx_plant_locations_type_value 
        ON plant_locations(LOWER(location_type), LOWER(location_value));

      -- ===============================
      -- Partner Profile Indexes
      -- ===============================
      
      -- Status filter (most common filter)
      CREATE INDEX IF NOT EXISTS idx_partner_profiles_status 
        ON partner_profiles(status) 
        WHERE status = 'active';

      -- Location matching (case-insensitive)
      CREATE INDEX IF NOT EXISTS idx_partner_profiles_state_lower 
        ON partner_profiles(LOWER(state));
      
      CREATE INDEX IF NOT EXISTS idx_partner_profiles_city_lower 
        ON partner_profiles(LOWER(city));
      
      -- Composite index for location + status queries
      CREATE INDEX IF NOT EXISTS idx_partner_profiles_location_status 
        ON partner_profiles(LOWER(state), LOWER(city), status) 
        WHERE status = 'active';

      -- Rating for sorting
      CREATE INDEX IF NOT EXISTS idx_partner_profiles_rating 
        ON partner_profiles(rating DESC NULLS LAST) 
        WHERE status = 'active';

      -- Specialities for filtering
      CREATE INDEX IF NOT EXISTS idx_partner_profiles_speciality1_lower 
        ON partner_profiles(LOWER(speciality_1));
      
      CREATE INDEX IF NOT EXISTS idx_partner_profiles_speciality2_lower 
        ON partner_profiles(LOWER(speciality_2));
      
      CREATE INDEX IF NOT EXISTS idx_partner_profiles_speciality3_lower 
        ON partner_profiles(LOWER(speciality_3));

      -- ===============================
      -- GIN Indexes for Text Search (Optional - Advanced)
      -- ===============================
      
      -- If you need full-text search on descriptions
      CREATE INDEX IF NOT EXISTS idx_plants_description_gin 
        ON plants USING gin(to_tsvector('english', COALESCE(description, '')));

      -- If you need fuzzy matching on company names
      CREATE INDEX IF NOT EXISTS idx_partner_profiles_company_gin 
        ON partner_profiles USING gin(to_tsvector('english', COALESCE(company_name, '')));
    `;

    await client.query(queries);
    console.error("All optimized indexes created successfully!");
    console.error(
      "Database is now optimized for fast recommendations retrieval"
    );
  } catch (error: unknown) {
    if (error instanceof Error) {
      console.error("Error creating indexes:", error.message);
    } else {
      console.error("Unknown error:", error);
    }
  }
}
