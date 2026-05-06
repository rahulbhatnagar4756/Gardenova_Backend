import { connectDB } from "../core/config/db";

/**
 * Creates the `subscription_plans` table in the database if it does not exist.
 * This table stores all subscription plans for professionals in the KasaGarden app.
 * 
 * Columns:
 * - id: UUID, primary key, auto-generated
 * - plan_name: Name of the subscription plan
 * - description: Description of the plan
 * - monthly_price: Monthly subscription cost
 * - annual_price: Annual subscription cost
 * - lead_limit_per_month: Maximum number of leads allowed per month
 * - number_of_regions: Number of regions covered by the plan
 * - highlight_in_result: Whether the plan is highlighted in search results
 * - verification_badge: Whether the plan has a verification badge
 * - status: Plan status ('active' or 'inactive')
 * - created_at: Timestamp of creation
 * - updated_at: Timestamp of last update
 *
 * @returns {Promise<void>} Resolves when the table is created or already exists
 */
export async function createSubscriptionPlans(): Promise<void> {
    try {
        const client = await connectDB();

        const query = `
      CREATE TABLE IF NOT EXISTS subscrptionPlans (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        plan_name VARCHAR(100) NOT NULL, -- to_speak, gold, diamante
        description TEXT,
        name VARCHAR(50) UNIQUE NOT NULL, 
        cities_coverage INTEGER NOT NULL,  -- e.g. 1, 5, 20
        price_monthly NUMERIC(10,2) NOT NULL,
        price_annual NUMERIC(10,2) NOT NULL,
        appear_in_search BOOLEAN DEFAULT FALSE,
        leads_limit INTEGER,  -- NULL = unlimited
        premium_profile_badge BOOLEAN DEFAULT FALSE,
        priority_customer_support BOOLEAN DEFAULT FALSE,
        status VARCHAR(10) DEFAULT 'active'
        CHECK (status IN ('active', 'inactive')),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
    `;

        await client.query(query);
        console.error("subsscrption_Plans Table created successfully!");
    } catch (error: unknown) {
        if (error instanceof Error) {
            console.error("Error creating Subscription_pans table:", error.message);
        } else {
            console.error("Unknown error:", error);
        }
    }
}
