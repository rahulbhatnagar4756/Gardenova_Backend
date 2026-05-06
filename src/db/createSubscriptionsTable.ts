import { connectDB } from "../core/config/db";
/**
 * Creates the `subscriptions` table if it does not already exist.
 *
 * The table stores subscription records for professional profiles,
 * including pricing details, plan reference, subscription period,
 * and status tracking.
 *
 * @returns {Promise<void>} Resolves when the table creation process completes.
 * @throws {Error} Logs any database-related errors encountered during execution.
 */
export async function createSubscriptionsTable(): Promise<void> {
    try {
        const client = await connectDB();
        const query = `
      CREATE TABLE IF NOT EXISTS subscriptions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    professional_id UUID NOT NULL
    REFERENCES professional_profiles(id) ON DELETE CASCADE,

    plan_id UUID NOT NULL
    REFERENCES subscrptionPlans(id),

    base_annual_price DECIMAL(10,2) NOT NULL,
    discount_percent DECIMAL(5,2) DEFAULT 0,
    final_price DECIMAL(10,2) NOT NULL,

    start_date DATE NOT NULL,
    end_date DATE NOT NULL,

    status VARCHAR(20)
        CHECK (status IN ('active','expired','cancelled')),

    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );`;
        await client.query(query);
        // console.log("Subscriptions table created successfully!");
    } catch (error: unknown) {
        if (error instanceof Error) {
            console.error("Error creating subscriptions table:", error.message);
        } else {
            console.error("Unknown error:", error);
        }
    }
}
