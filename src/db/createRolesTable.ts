import { connectDB } from "../core/config/db";

/**
 * Creates the "roles" table in PostgreSQL.
 */
export async function createRolesTable(): Promise<void> {
  try {
    const client = await connectDB();

    const query = `
      CREATE TABLE IF NOT EXISTS roles (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        name VARCHAR(30) NOT NULL UNIQUE CHECK (LENGTH(name) >= 2),
        description TEXT DEFAULT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `;

    await client.query(query);
    console.error("Roles table created successfully!");
  } catch (error: unknown) {
    if (error instanceof Error) {
      console.error("Error creating roles table:", error.message);
    } else {
      console.error("Unknown error:", error);
    }
  }
}
