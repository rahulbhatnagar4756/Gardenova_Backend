import { connectDB } from "../core/config/db";

/**
 * Creates the "leads" table in PostgreSQL.
 */
export async function createLeadsTable(): Promise<void> {
  try {
    const client = await connectDB();

    const query = `
      CREATE TABLE IF NOT EXISTS leads (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        partner_profile_ids UUID[] NOT NULL,
        user_id UUID NOT NULL,
        leads_status VARCHAR(20) NOT NULL CHECK (leads_status IN ('new', 'converted', 'closed')),
        is_deleted BOOLEAN NOT NULL DEFAULT FALSE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `;

    await client.query(query);
    console.error("Leads table created successfully!");
  } catch (error: unknown) {
    if (error instanceof Error) {
      console.error("Error creating leads table:", error.message);
    } else {
      console.error("Unknown error:", error);
    }
  }
}
