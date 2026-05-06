import { connectDB } from "../core/config/db";

/**
 * Creates the "users" table in the PostgreSQL database.
 */
export async function createUsersTable(): Promise<void> {
  try {
    const client = await connectDB();
    console.error("Connected to database...");

    const query = `
      CREATE EXTENSION IF NOT EXISTS "pgcrypto";

      CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(50) NOT NULL CHECK (LENGTH(name) >= 2),
  email VARCHAR(255) NOT NULL UNIQUE,
  password VARCHAR(255),

  google_uid VARCHAR(255) UNIQUE,
  apple_uid VARCHAR(255) UNIQUE,
  facebook_uid VARCHAR(255) UNIQUE,

  role_id UUID NOT NULL,
  phone_number VARCHAR(20),
  is_email_verified BOOLEAN DEFAULT FALSE,
  password_reset_token VARCHAR(255),
  password_reset_expires TIMESTAMP,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,  
);

    `;

    await client.query(query);

    console.error("Users table created successfully!");
  } catch (error: unknown) {
    if (error instanceof Error) {
      console.error("Error creating users table:", error.message);
    } else {
      console.error("Unknown error:", error);
    }
  }
}
