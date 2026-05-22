import { connectDB } from "../../core/config/db";
import { GetAllPlansWithDetailResponse, PlanFields, PlanLimitFields, ServiceResponse, UpdatePlanPayload } from "../../interface/subscription";

/**
 * Fetch all active subscription plans along with their limits/details.
 *
 * This service queries the database to retrieve:
 * - Plan metadata (name, tier, pricing, status)
 * - Plan limits and feature entitlements (scans, AI features, exports, etc.)
 *
 * It joins `plans` and `plan_limits` tables to return a unified dataset
 * for all active subscription plans.
 *
 * @async
 * @function getAllPlansWithDetailService
 *
 * @returns {Promise<GetAllPlansWithDetailResponse>} Returns an object containing:
 * - `success`: boolean indicating operation status
 * - `data`: array of subscription plans with details (if successful)
 * - `message`: error message (if failed)
 *
 * @throws Does not throw; errors are caught and returned in a structured response:
 * - `{ success: false, message: "Failed to fetch plans" }`
 */
export const getAllPlansWithDetailService = async ():Promise<GetAllPlansWithDetailResponse> => {
    // Placeholder for actual subscription plan retrieval logic
    const client = await connectDB();
    try {
        const query = `
        SELECT 
    p.id AS plan_id,
    p.name,
    p.tier,
    p.price_monthly,
    p.price_yearly,
    p.is_active AS plan_status,
    
    pl.plan_id AS limit_id,
    pl.scans_per_month,
    pl.landscape_gens_per_month,
    pl.max_saved_plants,
    pl.care_reminders,
    pl.ad_free,
    pl.ai_care_assistant,
    pl.hd_renders,
    pl.priority_support,
    pl.pdf_export,
    pl.priority_generation,
    pl.premium_styles,
    pl.before_after_downloads

    FROM plans p
    JOIN plan_limits pl
        ON p.id = pl.plan_id
    WHERE p.is_active = TRUE;
            
        `;
        const result = await client.query(query);

        return {
            success: true,
            data: result.rows
        };

    } catch (error) {
        console.error("Error fetching plans:", error);

        return {
            success: false,
            message: "Failed to fetch plans"
        };

    }
}

const PLAN_COLUMNS = new Set<keyof PlanFields>([
  'name', 'tier', 'price_monthly', 'price_yearly', 'is_active',
]);

const PLAN_LIMIT_COLUMNS = new Set<keyof PlanLimitFields>([
  'scans_per_month', 'landscape_gens_per_month', 'max_saved_plants',
  'care_reminders', 'ad_free', 'ai_care_assistant', 'hd_renders',
  'priority_support', 'pdf_export', 'priority_generation',
  'premium_styles', 'before_after_downloads',
]);

/**
 * Builds a dynamic SQL SET clause for parameterized queries.
 *
 * This utility converts a key-value object into a SQL-safe SET clause
 * along with the corresponding parameter values and next parameter index.
 *
 * Example output:
 * - clause: "name = $1, age = $2"
 * - values: ["John", 25]
 *
 * Useful for UPDATE queries where fields are dynamic.
 *
 * @function buildSetClause
 *
 * @param {Record<string, unknown>} fields - Object containing column names as keys
 * and their corresponding values to be updated.
 *
 * @param {number} [startAt=1] - Starting index for SQL parameter placeholders
 * (useful when composing larger queries with existing bindings).
 *
 * @returns {{
 *   clause: string;
 *   values: unknown[];
 *   nextIndex: number;
 * } | null}
 * Returns:
 * - `clause`: SQL SET clause string (e.g., "col1 = $1, col2 = $2")
 * - `values`: Array of values in order of placeholders
 * - `nextIndex`: Next available parameter index after processing
 *
 * Returns `null` if no fields are provided.
 */
function buildSetClause(
  fields : Record<string, unknown>,
  startAt: number = 1,
): { clause: string; values: unknown[]; nextIndex: number } | null {
  const entries = Object.entries(fields);
  if (entries.length === 0) return null;

  const parts : string[]  = [];
  const values: unknown[] = [];
  let i = startAt;

  for (const [key, value] of entries) {
    parts.push(`${key} = $${i++}`);
    values.push(value);
  }

  return { clause: parts.join(', '), values, nextIndex: i };
}
/**
 * Updates a subscription plan and its associated limits in a single transaction.
 *
 * This service:
 * 1. Validates the provided `planId`.
 * 2. Splits incoming update payload into:
 *    - `plans` table fields
 *    - `plan_limits` table fields
 * 3. Ignores unknown fields safely (prevents unsafe SQL injection inputs).
 * 4. Executes both updates inside a single DB transaction.
 * 5. Ensures atomicity using BEGIN / COMMIT / ROLLBACK.
 *
 * If either update fails, the entire transaction is rolled back.
 *
 * @async
 * @function updatePlanDetailService
 *
 * @param {string} planId - Unique identifier of the subscription plan to update.
 *
 * @param {UpdatePlanPayload} updateData - Partial payload containing fields
 * for either `plans` or `plan_limits` tables.
 *
 * @returns {Promise<ServiceResponse>} Service response object:
 * - `{ success: true, message: string }` on success
 * - `{ success: false, message: string }` on failure or invalid input
 *
 * @remarks
 * - Uses `buildSetClause` to dynamically generate parameterized SQL.
 * - Ensures safe updates by mapping only whitelisted columns.
 * - Unknown fields are ignored and not passed to SQL.
 */
export const updatePlanDetailService = async (
  planId    : string,
  updateData: UpdatePlanPayload,
): Promise<ServiceResponse> => {
  if (!planId) {
    return { success: false, message: 'planId is required' };
  }

  // ── 1. split payload into per-table buckets ──────────────
  const planFields        : Record<string, unknown> = {};
  const planLimitFields   : Record<string, unknown> = {};
  const unknownFields     : string[] = [];

  for (const [key, value] of Object.entries(updateData)) {
    if (PLAN_COLUMNS.has(key as keyof PlanFields)) {
      planFields[key] = value;
    } else if (PLAN_LIMIT_COLUMNS.has(key as keyof PlanLimitFields)) {
      planLimitFields[key] = value;
    } else {
      unknownFields.push(key); // ignore unknown — never pass raw input to SQL
    }
  }

  if (unknownFields.length > 0) {
    // console.warn(`[updatePlanDetailService] unknown fields ignored:`, unknownFields);
  }

  const hasPlansUpdate     = Object.keys(planFields).length > 0;
  const hasLimitsUpdate    = Object.keys(planLimitFields).length > 0;

  if (!hasPlansUpdate && !hasLimitsUpdate) {
    return { success: false, message: 'No valid fields provided to update' };
  }

  // ── 2. run both updates inside a single transaction ──────
  const client = await connectDB();
  try {
    await client.query('BEGIN');

    // ── 2a. UPDATE plans ──────────────────────────────────
    if (hasPlansUpdate) {
      const built = buildSetClause(planFields, 1);
      if (built) {
        const { clause, values, nextIndex } = built;
        await client.query(
          `UPDATE plans
           SET    ${clause}, updated_at = now()
           WHERE  id = $${nextIndex}`,
          [...values, planId],
        );
      }
    }

    // ── 2b. UPDATE plan_limits ────────────────────────────
    if (hasLimitsUpdate) {
      const built = buildSetClause(planLimitFields, 1);
      if (built) {
        const { clause, values, nextIndex } = built;
        await client.query(
          `UPDATE plan_limits
           SET    ${clause}
           WHERE  plan_id = $${nextIndex}`,
          [...values, planId],
        );
      }
    }

    await client.query('COMMIT');
    return { success: true, message: 'Plan updated successfully' };

  } catch (error) {
    await client.query('ROLLBACK');
    console.error('[updatePlanDetailService] transaction failed:', error);
    return { success: false, message: 'Failed to update plan' };

  } 
};