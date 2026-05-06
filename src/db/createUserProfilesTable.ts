import { connectDB } from "../core/config/db";

/**
 * Creates the "userprofiles" table in the PostgreSQL database.
 */
export async function createUserProfilesTable(): Promise<void> {
  try {
    const client = await connectDB();
    console.error("Connected to database...");

    const query = `
      CREATE TABLE IF NOT EXISTS userprofiles (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id UUID NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
        profile_image TEXT,
        date_of_birth DATE,
        gender VARCHAR(10) CHECK (gender IN ('male', 'female', 'other', '')),
        bio VARCHAR(500),
        street VARCHAR(255),
        city VARCHAR(255),
        state VARCHAR(255),
        country VARCHAR(255),
        zip_code VARCHAR(50),
        occupation VARCHAR(255),
        company VARCHAR(255),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `;

    await client.query(query);

    console.error("UserProfiles table created successfully!");
  } catch (error: unknown) {
    if (error instanceof Error) {
      console.error("Error creating userprofiles table:", error.message);
    } else {
      console.error("Unknown error:", error);
    }
  }
}
