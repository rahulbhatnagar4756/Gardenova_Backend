import { connectDB } from "../core/config/db";

/**
 * Creates the `plan_limits` table in PostgreSQL.
 *
 * This table defines feature limits and access controls for each subscription plan.
 *
 * It includes:
 * - Usage limits (e.g., scans per month, AI generations, saved plants)
 * - Feature flags (e.g., ad-free, AI assistant, HD renders, priority support)
 * - A one-to-one relationship with the `plans` table
 *
 * Key behavior:
 * - Each plan can have only one limits record (`plan_id` is UNIQUE)
 * - `-1` can be used to represent unlimited usage (for numeric limits)
 * - Cascade delete ensures limits are removed when a plan is deleted
 *
 * ⚠️ This function is intended for database setup or migrations.
 * It is not safe to run repeatedly without additional "IF NOT EXISTS" guards.
 *
 * @async
 * @function createPlans_limitTables
 * @returns {Promise<void>} Resolves when the `plan_limits` table is created successfully.
 *
 * @throws {Error} Logs database or query execution errors if creation fails.
 */
export async function createPlans_limitTables():Promise<void> {
    const client = await connectDB();

    const query = `
    CREATE TABLE plan_limits (
  id                       UUID     PRIMARY KEY DEFAULT gen_random_uuid(),
  plan_id                  UUID     NOT NULL UNIQUE
                                      REFERENCES plans(id) ON DELETE CASCADE,

  -- Usage caps (-1 = unlimited)
  scans_per_month          INT      NOT NULL DEFAULT 0,
  landscape_gens_per_month INT      NOT NULL DEFAULT 0,
  max_saved_plants         INT      NOT NULL DEFAULT 0,  -- -1 = unlimited

  -- Feature flags
  care_reminders           BOOLEAN  NOT NULL DEFAULT FALSE,
  ad_free                  BOOLEAN  NOT NULL DEFAULT FALSE,
  ai_care_assistant        BOOLEAN  NOT NULL DEFAULT FALSE,
  hd_renders               BOOLEAN  NOT NULL DEFAULT FALSE,
  priority_support         BOOLEAN  NOT NULL DEFAULT FALSE,
  pdf_export               BOOLEAN  NOT NULL DEFAULT FALSE,
  priority_generation      BOOLEAN  NOT NULL DEFAULT FALSE,
  premium_styles           BOOLEAN  NOT NULL DEFAULT FALSE,
  before_after_downloads   BOOLEAN  NOT NULL DEFAULT FALSE,

  created_at               TIMESTAMPTZ NOT NULL DEFAULT now()
);
    `;


    try {

        await client.query(query);
        // console.log("plan_limits Table created successfully!");

    } catch (error: unknown) {
        if (error instanceof Error) {
            console.error("Error creating plan_limits table:", error.message);
        } else {
            console.error("Unknown error:", error);
        }
    }

}