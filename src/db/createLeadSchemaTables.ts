import { connectDB } from "../core/config/db";

/**
 * Creates the `leads_schema` table in the database if it does not already exist.
 *
 * Table Structure:
 * - id: UUID (Primary Key) – Auto-generated unique identifier for each lead.
 * - partner_profile_ids: UUID – References the partner profile associated with the lead.
 * - user_id: UUID – References the user who created the lead.
 * - leads_status: VARCHAR(20) – Status of the lead.
 *      Allowed values: 'new', 'converted', 'closed'.
 * - is_deleted: BOOLEAN – Soft delete flag (default: false).
 * - created_at: TIMESTAMP – Record creation timestamp (default: current time).
 * - updated_at: TIMESTAMP – Record last update timestamp (default: current time).
 *
 * @async
 * @function createLeadsTable
 * @returns {Promise<void>} Resolves when the table is successfully created.
 *
 * @throws Will log an error if table creation fails.
 */
export async function createLeadsTable(): Promise<void> {
  try {
    const client = await connectDB();

    const query = `
      CREATE TABLE IF NOT EXISTS leads_Schema (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        partner_profile_ids UUID NOT NULL,
        user_id UUID NOT NULL,
        leads_status VARCHAR(20) NOT NULL CHECK (leads_status IN ('new', 'contacted', 'closed')),
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

