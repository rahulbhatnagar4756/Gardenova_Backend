import { connectDB } from "../core/config/db";
/**
 * Creates the `professional_accounts` table in the database.
 *
 * This function:
 * - Drops the existing `professional_accounts` table if it exists (CASCADE enabled).
 * - Recreates the table with required relationships and constraints.
 *
 * Table Structure:
 * - id: UUID (Primary Key, auto-generated)
 * - user_id: UUID (Foreign key → users.id, CASCADE on delete)
 * - professional_profile_id: UUID (Foreign key → professional_profiles.id, SET NULL on delete)
 * - subscription_plan_id: UUID (Foreign key → subscrptionPlans.id, SET NULL on delete)
 * - is_founder: Boolean (Default: false)
 * - is_first_login: Boolean (Default: true)
 * - trial_start_date: Timestamp
 * - trial_end_date: Timestamp
 * - plan: String (Subscription plan name)
 * - created_at: Timestamp (Default: CURRENT_TIMESTAMP)
 * - updated_at: Timestamp (Default: CURRENT_TIMESTAMP)
 *
 * ⚠ Warning:
 * This function permanently deletes the existing `professional_accounts` table
 * before recreating it. All existing data will be lost.
 *
 * @async
 * @function createProfessionalAccountTable
 * @returns {Promise<void>} Resolves when the table is successfully created.
 *
 * @throws {Error} Logs database errors if table creation fails.
 */
export async function createProfessionalAccountTable(): Promise<void> {
    try {
        const client = await connectDB();

        const query = `
        DROP TABLE IF EXISTS professional_accounts CASCADE;

        CREATE TABLE professional_accounts (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
            professional_profile_id UUID REFERENCES professional_profiles(id) ON DELETE SET NULL,
            subscription_plan_id UUID REFERENCES subscrptionPlans(id) ON DELETE SET NULL,
            is_founder BOOLEAN DEFAULT false,
            is_first_login BOOLEAN DEFAULT true,
            trial_start_date TIMESTAMP,
            trial_end_date TIMESTAMP,
            plan VARCHAR(100),
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );
        `;

        await client.query(query);
        console.error("professional_accounts table created successfully.");

    } catch (error: unknown) {
        if (error instanceof Error) {
            console.error("Error creating professional_accounts table:", error.message);
        } else {
            console.error("Unknown error:", error);
        }
    }
}