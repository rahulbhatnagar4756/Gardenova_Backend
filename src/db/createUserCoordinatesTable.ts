import { connectDB } from "../core/config/db";

/**
 * Creates the user_coordinates table used to store a user's last known lat/long.
 *
 * @returns {Promise<void>} Resolves when the table exists.
 */
export async function createUserCoordinatesTable(): Promise<void> {
  try {
    const client = await connectDB();
    await client.query(`
      CREATE EXTENSION IF NOT EXISTS "pgcrypto";

      CREATE TABLE IF NOT EXISTS user_coordinates (
        user_id     UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
        latitude    DOUBLE PRECISION NOT NULL,
        longitude   DOUBLE PRECISION NOT NULL,
        soil_type   VARCHAR(20),
        updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
      );

      CREATE INDEX IF NOT EXISTS idx_user_coordinates_updated_at
        ON user_coordinates (updated_at DESC);
    `);
  } catch (error: unknown) {
    if (error instanceof Error) {
      console.error("Error creating user_coordinates table:", error.message);
    } else {
      console.error("Unknown error creating user_coordinates table:", error);
    }
  }
}

if (require.main === module) {
  void createUserCoordinatesTable().then(() => process.exit(0));
}
