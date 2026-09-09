import { connectDB } from "../core/config/db";

/**
 * Creates the `deleted_accounts` table if it does not already exist.
 *
 * Stores email + user id when an account is deleted so a later
 * registration with the same email can reuse the previous user id.
 *
 * @returns {Promise<void>} Resolves when the table is ready.
 */
export const createDeletedAccountsTable = async (): Promise<void> => {
  try {
    const client = await connectDB();

    const query = `
      CREATE TABLE IF NOT EXISTS deleted_accounts (
        user_id    UUID PRIMARY KEY,
        email      VARCHAR(255) NOT NULL,
        deleted_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );

      CREATE UNIQUE INDEX IF NOT EXISTS uq_deleted_accounts_email_lower
        ON deleted_accounts (LOWER(email));
    `;

    await client.query(query);
  } catch (error: unknown) {
    if (error instanceof Error) {
      console.error("Error creating deleted_accounts table:", error.message);
    } else {
      console.error("Unknown error creating deleted_accounts table:", error);
    }
  }
};
