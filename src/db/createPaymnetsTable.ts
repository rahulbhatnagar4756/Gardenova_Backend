import { connectDB } from "../core/config/db";

/**
 * Creates the `payments` table and related database objects in PostgreSQL.
 *
 * This function performs the following operations:
 * - Creates the `payment_status` ENUM type (if not already created)
 * - Creates the `payments` table with all required constraints and relationships
 * - Adds indexes for optimized queries (user, subscription, status, payload)
 * - Creates/updates the `set_updated_at` trigger function
 * - Attaches a trigger to automatically update `updated_at` on row updates
 *
 * ⚠️ This function is idempotent only if underlying SQL checks are respected.
 * It should typically be executed as part of a migration step, not runtime logic.
 *
 * @async
 * @function createPaymentsTable
 * @returns {Promise<void>} Resolves when the table and related objects are created successfully.
 *
 * @throws {Error} If the database connection fails or any SQL execution fails.
 */
export async function createPaymentsTable(): Promise<void> {
    const clinet = await connectDB();
    const query = `
    CREATE TYPE payment_status AS ENUM (
  'pending',
  'success',
  'failed',
  'refunded'
);

CREATE TABLE payments (
  id              UUID            PRIMARY KEY DEFAULT gen_random_uuid(),
  subscription_id UUID            NOT NULL
                                    REFERENCES subscriptions(id) ON DELETE RESTRICT,
  user_id         UUID            NOT NULL
                                    REFERENCES users(id) ON DELETE RESTRICT,
  amount          NUMERIC(10,2)   NOT NULL,
  currency        VARCHAR(3)      NOT NULL DEFAULT 'INR',
  status          payment_status  NOT NULL DEFAULT 'pending',

  -- Gateway reference (Razorpay / Stripe order id)
  gateway         VARCHAR(50)     NOT NULL DEFAULT 'razorpay',
  transaction_id  VARCHAR(255)    UNIQUE,        -- gateway's payment id
  gateway_payload JSONB,                         -- raw webhook for auditing

  paid_at         TIMESTAMPTZ,   -- NULL until payment succeeds
  created_at      TIMESTAMPTZ    NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ    NOT NULL DEFAULT now(),

  CONSTRAINT positive_amount CHECK (amount >= 0)
);

-- Indexes for billing history and reconciliation
CREATE INDEX idx_payments_user_id         ON payments(user_id);
CREATE INDEX idx_payments_subscription_id ON payments(subscription_id);
CREATE INDEX idx_payments_status          ON payments(status);
CREATE INDEX idx_payments_gateway_payload ON payments USING GIN (gateway_payload);

CREATE TRIGGER payments_updated_at
  BEFORE UPDATE ON payments
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();
    `;
    await clinet.query(query);
    // console.log("Payments table created successfully");
}
