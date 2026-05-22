import { connectDB } from "../core/config/db";
/**
 * Creates the `plans` table and associated ENUM type in PostgreSQL.
 *
 * This function performs the following operations:
 * - Creates the `plan_tier` ENUM type (free, starter, plus, pro)
 * - Creates the `plans` table with pricing and status fields
 * - Sets up timestamps for record tracking
 *
 * ⚠️ Note: This function will fail if the ENUM type or table already exists.
 * It is intended for use in database setup or migration scripts, not runtime execution.
 *
 * @async
 * @function createPlansTable
 * @returns {Promise<void>} Resolves when the plans table is created successfully.
 *
 * @throws {Error} Logs database or query execution errors if the operation fails.
 */
export  async function createPlansTable():Promise<void> {

    const client =await connectDB();

    const query = `
    
CREATE TYPE plan_tier AS ENUM (
  'free',
  'starter',
  'plus',
  'pro'
);

CREATE TABLE plans (
  id               UUID           PRIMARY KEY DEFAULT gen_random_uuid(),
  name             VARCHAR(50)    NOT NULL,
  tier             plan_tier      NOT NULL UNIQUE,
  price_monthly    NUMERIC(10,2)  NOT NULL DEFAULT 0,
  price_yearly     NUMERIC(10,2)  NOT NULL DEFAULT 0,
  is_active        BOOLEAN        NOT NULL DEFAULT TRUE,
  created_at       TIMESTAMPTZ    NOT NULL DEFAULT now(),
  updated_at       TIMESTAMPTZ    NOT NULL DEFAULT now()
);

    `;

    try {   
        await client.query(query);
        // console.log("plans Table created successfully!");

    } catch (error: unknown) {
        if (error instanceof Error) {
            console.error("Error creating plans table:", error.message);
        } else {
            console.error("Unknown error:", error);
        }
    } 

}
