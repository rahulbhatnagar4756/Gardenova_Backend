import { ZodError } from "zod";
import { createLeadDto } from "../../../dto/leadDto";
import { getDB } from "../../../core/config/db";
import { ILead, ILeadGrouped } from "../../../interface/leads";
import { ILeadItem, ILeadsPaginated } from "../../../interface/professional";
import { getSignedFileUrl } from "../../../core/services/s3UploadService";

// Create a partial schema for updates
const updateLeadDto = createLeadDto.partial();

/**
 * Maps JavaScript field names to database column names.
 * @param field - The field name from the DTO.
 * @returns The corresponding PostgreSQL column name.
 */
function mapField(field: string): string {
  const mapping: Record<string, string> = {
    partnerIds: "partner_profile_ids",
    userId: "user_id",
    leadsStatus: "leads_status",
    isDeleted: "is_deleted",
  };
  return mapping[field] ?? field;
}

/**
 * Creates a new lead record after Zod validation.
 * @param data - The raw data to validate and insert.
 * @returns The created lead record, or null if insertion failed.
 */
export async function createLead(data: unknown): Promise<ILead | null> {
  // Validate first 
  const parsedData = createLeadDto.parse(data);

  const pool = getDB();

  const query = `
    INSERT INTO leads (
      partner_profile_ids,
      user_id,
      leads_status,
      is_deleted
    )
    VALUES ($1, $2, $3, $4)
    RETURNING id, partner_profile_ids, user_id, leads_status;
  `;

  const values = [
    parsedData.partnerIds,
    parsedData.userId,
    parsedData.leadsStatus,
    parsedData.isDeleted,
  ];
  const { rows } = await pool.query<ILead>(query, values);
  return rows[0] ?? null;
}

/**
 * Updates an existing lead record after validation.
 * @param id - Lead UUID.
 * @param data - Partial data for update.
 * @returns The updated lead record, or null if not found.
 */
export async function updateLead(
  id: string,
  data: unknown
): Promise<ILead | null> {
  try {
    const parsedData = updateLeadDto.parse(data);

    if (Object.keys(parsedData).length === 0) {
      throw new Error("No fields provided for update");
    }

    const client = await getDB();

    // Dynamically build SET clause
    const setClauses: string[] = [];
    const values: unknown[] = [];
    let index = 1;

    for (const [key, value] of Object.entries(parsedData)) {
      setClauses.push(`${mapField(key)} = $${index}`);
      values.push(value);
      index++;
    }

    // Add updated_at
    setClauses.push(`updated_at = CURRENT_TIMESTAMP`);
    values.push(id);

    const query = `
      UPDATE leads
      SET ${setClauses.join(", ")}
      WHERE id = $${index}
      RETURNING id, partner_profile_ids, user_id, leads_status, is_deleted, created_at, updated_at;
    `;

    const { rows } = await client.query<ILead>(query, values);
    return rows[0] ?? null;
  } catch (err) {
    if (err instanceof ZodError) throw err;
    throw err;
  }
}

/**
 * Fetch paginated leads.
 *
 * @param {number} page - Current page number.
 * @param {number} limit - Number of items per page.
 * @returns {Promise<{ leads: ILeadGrouped[]; total: number }>}
 * Returns an object containing the paginated leads and the total count.
 */
export async function findAllLeads(
  page: number,
  limit: number
): Promise<{ leads: ILeadGrouped[]; total: number }> {
  const client = await getDB();

  const offset = (page - 1) * limit;

  // Count unique leads
  const totalResult = await client.query(
    `SELECT COUNT(*) FROM leads WHERE is_deleted = FALSE`
  );
  const total = Number(totalResult.rows[0].count);

  // Get ONLY the lead IDs for the given page
  const leadIdResult = await client.query(
    `
    SELECT id
    FROM leads
    WHERE is_deleted = FALSE
    ORDER BY created_at DESC
    LIMIT $1 OFFSET $2;
    `,
    [limit, offset]
  );

  const leadIds: string[] = leadIdResult.rows.map((row) => row.id);

  if (leadIds.length === 0) {
    return { leads: [], total };
  }

  // Fetch partner & user details ONLY for those leads
  const { rows } = await client.query(
    `
    SELECT 
      l.id AS lead_id,
      partner_id,
      p.company_name,
      u.id AS user_id,
      u.name AS user_name,
      u.email AS user_email,
      l.leads_status
    FROM leads l
    LEFT JOIN LATERAL UNNEST(l.partner_profile_ids) AS partner_id ON TRUE
    LEFT JOIN partner_profiles p ON p.id = partner_id
    LEFT JOIN users u ON u.id = l.user_id
    WHERE l.id = ANY($1)
    ORDER BY l.created_at DESC;
    `,
    [leadIds]
  );

  // Group into unique leads
  const groups: Record<string, ILeadGrouped> = {};

  for (const row of rows) {
    if (!groups[row.lead_id]) {
      groups[row.lead_id] = {
        lead_id: row.lead_id,
        leads_status: row.leads_status,
        user: row.user_id
          ? {
              user_id: row.user_id,
              user_email: row.user_email,
              user_name: row.user_name,
            }
          : null,
        partners: [],
      };
    }

    if (row.partner_id) {
      groups[row.lead_id]!.partners.push({
        partner_id: row.partner_id,
        company_name: row.company_name,
      });
    }
  }

  return { leads: Object.values(groups), total };
}

/**
 * Soft deletes a lead record by ID.
 * @param id - Lead UUID.
 * @returns void
 */
export async function softDeleteLead(id: string): Promise<void> {
  const client = await getDB();
  await client.query(`UPDATE leads SET is_deleted = TRUE WHERE id = $1;`, [id]);
}

/**
 * Updates the status of a lead by its ID.
 *
 * @param {string} id - The unique ID of the lead.
 * @param {string} status - The new lead status to be updated.
 * @returns {Promise<ILead | null>} Returns the updated lead object or null if not found.
 */
export async function updateLeadStatus(
  id: string,
  status: string
): Promise<ILead | null> {
  const client = await getDB();

  const query = `
      UPDATE leads
      SET leads_status = $1,
          updated_at = CURRENT_TIMESTAMP
      WHERE id = $2
      RETURNING id, partner_profile_ids, user_id, leads_status, is_deleted, created_at, updated_at;
    `;

  const { rows } = await client.query<ILead>(query, [status, id]);
  return rows[0] ?? null;
}

/**
 * Fetches the number of leads for the current month, including total, new, contacted, and closed leads.
 * 
 * @param {string} userId - The ID of the user whose lead data needs to be fetched.
 * @returns {Promise<{ totalLeads: number; newLeads: number; contactedLeads: number; closedLeads: number; }>} 
 * A promise that resolves to an object containing counts for the total, new, contacted, and closed leads.
 */
export async function findAllLeadsForMonths(
  userId: string
): Promise<{
  totalLeads: number;
  newLeads: number;
  contactedLeads: number;
  closedLeads: number;
}> {
  const client = await getDB();

  const query = `
    SELECT
      COUNT(*) AS total_leads,
      SUM(CASE WHEN leads_status = 'new' THEN 1 ELSE 0 END) AS new_leads,
      SUM(CASE WHEN leads_status = 'contacted' THEN 1 ELSE 0 END) AS contacted_leads,
      SUM(CASE WHEN leads_status = 'closed' THEN 1 ELSE 0 END) AS closed_leads
    FROM leads_schema
    WHERE partner_profile_ids = $1;
  `;

  try {
    const { rows } = await client.query(query, [userId]);

    return {
      totalLeads: parseInt(rows[0].total_leads, 10) || 0,
      newLeads: parseInt(rows[0].new_leads, 10) || 0,
      contactedLeads: parseInt(rows[0].contacted_leads, 10) || 0,
      closedLeads: parseInt(rows[0].closed_leads, 10) || 0,
    };
  } catch (error: unknown) {
    if (error instanceof Error) {
      console.error("Error fetching leads data:", error.message);
    } else {
      console.error("Unknown error:", error);
    }

    throw error;
  }
}


/**
 * Fetches paginated leads data for admin users from the database.
 *
 * Performs a total count query and returns leads along with pagination info.
 *
 * @param {number} page - Page number (1-based index)
 * @param {number} limit - Number of leads per page
 * @returns {Promise<ILeadsPaginated>} Paginated leads data including:
 *   - leads: Array of lead items
 *   - total: Total number of leads
 *   - page: Current page
 *   - limit: Page size
 *   - totalPages: Total number of pages
 */
export const findAllLeadsForAdmin = async (
  page: number,
  limit: number
): Promise<ILeadsPaginated> => {
  const client = await getDB();
  const offset = (page - 1) * limit;

  // total count query
  const { rows: countRows } = await client.query<{ total: string }>(
    `SELECT COUNT(*) AS total
     FROM leads_schema
     WHERE is_deleted = false`
  );
  const total = parseInt(countRows[0]?.total ?? "0", 10);

 const { rows } = await client.query<ILeadItem>(
    `
    SELECT
      l.id                                      AS lead_id,
      l.leads_status,

      -- quoter (the user who created the lead)
      u.id                                      AS quoter_id,
      u.name                                    AS quoter_name,
      u.email                                   AS quoter_email,

      -- partner (the professional user linked to the lead)
      pu.id                                     AS partner_id,
      COALESCE(
        NULLIF(TRIM(pp.business_name), ''),
        pu.name
      )                                           AS partner_display_name,
      pp.image_url                             AS partner_image_url,
      pp.category                               AS partner_speciality,
      pp.address                                AS partner_address,
      pp.city                                   AS partner_city,
      pp.state                                  AS partner_state

    FROM leads_schema l

    JOIN users u
      ON u.id = l.user_id                       -- quoter

    JOIN users pu
      ON pu.id = l.partner_profile_ids          -- partner's user record

    LEFT JOIN professional pp
      ON pp.user_id = pu.id                     -- professional profile via user_id FK

    WHERE l.is_deleted = false
    ORDER BY l.created_at DESC
    LIMIT $1 OFFSET $2
    `,
    [limit, offset]
  );
   const leads = await Promise.all(
    rows.map(async (row) => ({
      ...row,
      partner_image_url: row.partner_image_url
        ? row.partner_image_url.startsWith("http")
          ? row.partner_image_url
          : (await getSignedFileUrl(row.partner_image_url)) ?? row.partner_image_url
        : null,
    }))
  );

 
  const result = {
    leads,          // ✅ use processed leads
    total,
    page,
    limit,
    totalPages: Math.ceil(total / limit),
  };

  // console.log("🔥 RESULT:", JSON.stringify(result.leads[0]));
  return result;
};