import { connectDB } from "../core/config/db";

/**
 * Creates the subscription-related database schema in PostgreSQL.
 *
 * This function performs the following operations:
 * - Creates ENUM types:
 *   - `billing_period` (monthly, yearly)
 *   - `subscription_status` (active, cancelled, expired, trial, past_due)
 * - Creates a reusable trigger function `set_updated_at()` for timestamp updates
 * - Creates the `subscriptions` table with user and plan relationships
 * - Adds indexes for efficient querying (user, status, expiry)
 * - Adds a partial unique index to ensure only one active/trial subscription per user
 * - Adds a trigger to automatically update `updated_at` on row updates
 *
 * Key behavior:
 * - Each subscription belongs to a user and a plan
 * - Subscriptions track lifecycle states (active, trial, expired, etc.)
 * - Expiry and cancellation timestamps support billing logic
 *
 * ⚠️ Intended for database setup/migration only.
 * Re-running without guards may fail if objects already exist.
 *
 * @async
 * @function createSubscriptionTables
 * @returns {Promise<void>} Resolves when subscription schema is created successfully.
 *
 * @throws {Error} Logs database or query execution errors if creation fails.
 */
export async function createSubscriptionTables():Promise<void> {
    const client = await connectDB();

    const query = `
    CREATE TYPE billing_period AS ENUM ('monthly', 'yearly');

    CREATE TYPE subscription_status AS ENUM (
      'active',
      'cancelled',
      'expired',
      'trial',
      'past_due'
    );

    -- Trigger function
    CREATE OR REPLACE FUNCTION set_updated_at()
    RETURNS TRIGGER AS $$
    BEGIN
      NEW.updated_at = now();
      RETURN NEW;
    END;
    $$ LANGUAGE plpgsql;

    CREATE TABLE subscriptions (
      id              UUID                PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id         UUID                NOT NULL
                                            REFERENCES users(id) ON DELETE CASCADE,
      plan_id         UUID                NOT NULL
                                            REFERENCES plans(id),
      billing_period  billing_period      NOT NULL DEFAULT 'monthly',
      status          subscription_status NOT NULL DEFAULT 'active',
      started_at      TIMESTAMPTZ         NOT NULL DEFAULT now(),
      expires_at      TIMESTAMPTZ         NOT NULL,
      cancelled_at    TIMESTAMPTZ,
      created_at      TIMESTAMPTZ         NOT NULL DEFAULT now(),
      updated_at      TIMESTAMPTZ         NOT NULL DEFAULT now()
    );

    -- Only one active/trial sub per user at a time
    CREATE UNIQUE INDEX uq_user_active_sub
      ON subscriptions(user_id)
      WHERE status IN ('active', 'trial');

    CREATE INDEX idx_subscriptions_user_id
      ON subscriptions(user_id);

    CREATE INDEX idx_subscriptions_status
      ON subscriptions(status);

    CREATE INDEX idx_subscriptions_expires
      ON subscriptions(expires_at);

    CREATE TRIGGER subscriptions_updated_at
      BEFORE UPDATE ON subscriptions
      FOR EACH ROW
      EXECUTE FUNCTION set_updated_at();
    `;

    try {
        await client.query(query);
        // console.log("subscriptions Table created successfully!");
    } catch (error: unknown) {
        if (error instanceof Error) {
            console.error("Error creating subscriptions table:", error.message);
        } else {
            console.error("Unknown error:", error);
        }
    }
}