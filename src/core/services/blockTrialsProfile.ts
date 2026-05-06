import { connectDB } from "../config/db";

/**
 * Blocks professional profiles whose trial period has expired.
 *
 * Updates profiles with:
 * - status = 'blocked'
 * - updated_at = CURRENT_TIMESTAMP
 *
 * @returns {Promise<number>} Number of profiles that were blocked.
 */
export async function blockExpiredTrialProfiles(): Promise<number> {
  const client = await connectDB();

  const query = `
    UPDATE professional_profiles
    SET 
      status = 'blocked',
      updated_at = CURRENT_TIMESTAMP
    WHERE 
      status = 'trial'
      AND trial_end_date < CURRENT_DATE
    RETURNING id;
  `;

  const result = await client.query(query);


  return result.rowCount ?? 0;
}
