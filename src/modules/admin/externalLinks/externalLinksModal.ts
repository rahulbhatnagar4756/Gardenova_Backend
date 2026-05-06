import { getDB } from "../../../core/config/db";
import { ExternalLink } from "../../../interface/externalLinks";


/**
 * Creates a new external link entry in the database.
 *
 * @param title - Display title of the external link
 * @param url - URL of the external link (can be null)
 * @param is_active - Whether the link is active (default: false)
 *
 * @returns Promise that resolves when the insert is completed
 */
export const createExternalLinks = async (
  title: string,
  url: string | null,
  is_active: boolean = false
): Promise<void> => {
  const pool = await getDB();

  const query = `
    INSERT INTO external_links (title, url, is_active)
    VALUES ($1, $2, $3)
    RETURNING id;
  `;

  const values = [title, url, is_active];

  await pool.query(query, values);
};


/**
 * Fetches all external links from the database.
 *
 * @returns A record object where the key is the link ID
 *          and the value is the ExternalLink data
 */
export const fetchExternalLinksFromDB = async (): Promise<Record<string, ExternalLink>>  => {
  const pool = await getDB();

  const query = `
    SELECT id, title, url, is_active
    FROM external_links;
  `;

  const { rows } = await pool.query(query);

  const result: Record<string, ExternalLink> = {};

  for (const row of rows) {
    result[row.title] = row; // ✅ use id instead of key
  }

  return result;
};


/**
 * Updates an existing external link.
 * Only provided fields will be updated.
 *
 * @param id - Unique ID of the external link
 * @param title - New title (optional)
 * @param url - New URL (optional, can be null)
 * @param is_active - New active status (optional)
 *
 * @returns true if the link was updated, false if not found
 */
export const updateExternalLink = async (
  id: string,
  title?: string,
  url?: string | null,
  is_active?: boolean
): Promise<boolean> => {
  const pool = await getDB();

  const query = `
    UPDATE external_links
    SET
      title = COALESCE($2, title),
      url = COALESCE($3, url),
      is_active = COALESCE($4, is_active),
      updated_at = NOW()
    WHERE id = $1
    RETURNING id;
  `;

  const { rows } = await pool.query(query, [id, title, url, is_active]);

  return rows.length > 0; // true if update happened, false otherwise
};


/**
 * Deletes an external link by its ID.
 *
 * @param id - Unique ID of the external link
 *
 * @returns true if the link was deleted, false if not found
 */
export const deleteExternalLinkById = async (
  id: string
): Promise<boolean> => {
  const pool = await getDB();
  const query = `
    DELETE FROM external_links
    WHERE id = $1
    RETURNING id;
  `;

  const result = await pool.query(query, [id]);

  return result.rows.length > 0;
};
/**
 * Updates the status value for a given status record.
 *
 * @param id - Unique ID of the status record
 * @param status - New status value
 *
 * @returns Updated status object if found, otherwise null
 */
export async function updateStatusInDb(id: string, status: string): Promise<{ id: string; status: string; updated_at: Date } | null> {
  const client = await getDB();
  try {
    const query = `
      UPDATE status
      SET status = $1,
          updated_at = NOW()
      WHERE id = $2
      RETURNING id, status, updated_at;
    `;
    const values = [status, id];
    const result = await client.query(query, values);

    if (result.rows.length === 0) {
      return null; // status not found
    }

    return result.rows[0]; // return updated row
  } catch (error) {
    console.error("Failed to update status in DB:", error);
    throw error;
  } 
}
