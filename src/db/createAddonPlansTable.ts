import { connectDB } from "../core/config/db";

/**
 * Creates the `plan_addons` table in the database.
 *
 * The table stores optional add-ons that can be attached
 * to subscription plans (e.g., national visibility, extra leads, etc.).
 *
 * Columns:
 * - id: Unique identifier (UUID, auto-generated)
 * - name: Name of the add-on (e.g., national_visibility)
 * - description: Optional description of the add-on
 * - price_monthly: Monthly price of the add-on
 * - price_annual: Annual price of the add-on
 * - created_at: Timestamp when the add-on was created
 * - updated_at: Timestamp when the add-on was last updated
 *
 * @async
 * @function plan_addons
 * @returns {Promise<void>} Resolves when the table is created successfully.
 * @throws Will log an error if table creation fails.
 */
export async function plan_addons (): Promise<void> {
    try {
        const client = await connectDB(); 
        
        const query = `
        CREATE TABLE plan_addons (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        name VARCHAR(100) NOT NULL, -- national_visibility

        description TEXT,

        price_monthly NUMERIC(10,2),
        price_annual NUMERIC(10,2),

        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
        );
        `;

        await client.query(query);
        console.error("plan_addons Table created successfully!");
    } catch (error: unknown) {
        if (error instanceof Error) {
            console.error("Error creating plan_addons table:", error.message);
        }
            else {
            console.error("Unknown error:", error);
        }
    }
}