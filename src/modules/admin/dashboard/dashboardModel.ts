import { getDB } from "../../../core/config/db";
import { LeadTrendPoint } from "../../../interface/dashboard";
import { LeadStatusCount } from "../../../interface/leads";

/**
 * Fetch the total number of closed leads and how many were closed this month.
 *
 * @returns {Promise<{ total: number; this_month: number }>}
 *          An object containing total closed leads and closed leads for the current month.
 */
export const getClosedLeadsCount = async (): Promise<{
  total: number;
  this_month: number;
}> => {
  const pool = getDB();

  const result = await pool.query(`
    SELECT 
      COUNT(*) AS total,
      COUNT(*) FILTER (
        WHERE DATE_TRUNC('month', updated_at) = DATE_TRUNC('month', CURRENT_DATE)
      ) AS this_month
    FROM leads
    WHERE leads_status = 'closed'
  `);

  return {
    total: Number(result.rows[0].total),
    this_month: Number(result.rows[0].this_month),
  };
};

/**
 * Fetch total number of leads in the system.
 *
 * @returns {Promise<number>} Total lead count
 */
export async function getTotalLeadsCount(): Promise<{
  total: number;
  today: number;
}> {
  const pool = getDB();

  const result = await pool.query(`
    SELECT
      COUNT(*) AS total,
      COUNT(*) FILTER (
        WHERE DATE(created_at) = CURRENT_DATE
      ) AS today
    FROM leads
  `);

  return {
    total: Number(result.rows[0].total),
    today: Number(result.rows[0].today),
  };
}

/**
 * Fetch total number of active partner_profiles professionals
 * plus number of today's joined active professionals.
 *
 * @returns {Promise<{ total: number; today: number }>}
 */
export async function getActiveProfessionalsCount(): Promise<{
  total: number;
  today: number;
}> {
  const pool = getDB();

  const result = await pool.query(`
    SELECT
      COUNT(*) AS total,
      COUNT(*) FILTER (
        WHERE status = 'active'
        AND DATE(created_at) = CURRENT_DATE
      ) AS today
    FROM partner_profiles
    WHERE status = 'active'
  `);

  return {
    total: Number(result.rows[0].total),
    today: Number(result.rows[0].today),
  };
}

/**
 * Fetch lead count grouped by lead status (e.g., contacted, converted, etc.)
 *
 * @returns {Promise<LeadStatusCount[]>} Array of lead status aggregates
 */
export async function getLeadStatusCounts(): Promise<LeadStatusCount[]> {
  const pool = getDB();
  const result = await pool.query(`
    SELECT leads_status, COUNT(*) AS count
    FROM leads
    GROUP BY leads_status
    ORDER BY leads_status ASC
  `);

  return result.rows.map((r) => ({
    leads_status: r.leads_status,
    count: Number(r.count),
  }));
}

/**
 * Get trend data for all lead statuses:
 * - all_leads
 * - new_leads
 * - closed_leads
 * - contacted_leads
 *
 * @returns {Promise<{
 *   all_leads: LeadTrendPoint[];
 *   new_leads: LeadTrendPoint[];
 *   closed_leads: LeadTrendPoint[];
 *   contacted_leads: LeadTrendPoint[];
 * }>}
 */
export async function getLeadTrendData(): Promise<{
  all_leads: LeadTrendPoint[];
  new_leads: LeadTrendPoint[];
  closed_leads: LeadTrendPoint[];
  contacted_leads: LeadTrendPoint[];
}> {
  const pool = getDB();

  const result = await pool.query(`
    SELECT 
      to_char(updated_at, 'YYYY-MM-DD') AS date,
      leads_status,
      COUNT(*) AS count
    FROM leads
    GROUP BY date, leads_status
    ORDER BY date ASC;
  `);

  // Maps for each trend line
  const map = {
    all_leads: new Map<string, number>(),
    new_leads: new Map<string, number>(),
    closed_leads: new Map<string, number>(),
    contacted_leads: new Map<string, number>(),
  };

  result.rows.forEach((row) => {
    const date = row.date;
    const status = row.leads_status;
    const count = Number(row.count);

    // Aggregate all leads
    map.all_leads.set(date, (map.all_leads.get(date) ?? 0) + count);

    if (status === "new") map.new_leads.set(date, count);
    if (status === "closed") map.closed_leads.set(date, count);
    if (status === "contacted") map.contacted_leads.set(date, count);
  });

  /**
   * Convert a map of date → count into an array of LeadTrendPoint items.
   *
   * @param {Map<string, number>} m - Map containing date/count pairs
   * @returns {LeadTrendPoint[]} Array of trend points with date and count
   */
  const convert = (m: Map<string, number>): LeadTrendPoint[] =>
    Array.from(m.entries()).map(([date, count]) => ({
      date,
      count,
    }));

  return {
    all_leads: convert(map.all_leads),
    new_leads: convert(map.new_leads),
    closed_leads: convert(map.closed_leads),
    contacted_leads: convert(map.contacted_leads),
  };
}
