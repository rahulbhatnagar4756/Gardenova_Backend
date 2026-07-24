import { connectDB } from "../core/config/db";

/**
 * Drops Razorpay billing tables and creates Google Play Billing schema.
 * Seeds free + paid plans (google product/basePlan ids are placeholders —
 * replace with Play Console values).
 *
 * WARNING: Destroys existing user_subscriptions / subscription_plans /
 * razorpay_webhook_events data.
 */
export async function createGooglePlayBillingTables(): Promise<void> {
  const client = await connectDB();

  await client.query(`
    DROP TABLE IF EXISTS razorpay_webhook_events CASCADE;
    DROP TABLE IF EXISTS google_play_purchases CASCADE;
    DROP TABLE IF EXISTS billing_webhook_events CASCADE;
    DROP TABLE IF EXISTS user_subscriptions CASCADE;
    DROP TABLE IF EXISTS subscription_plans CASCADE;

    ALTER TABLE users DROP COLUMN IF EXISTS razorpay_customer_id;

    CREATE TABLE subscription_plans (
      id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      code                 TEXT NOT NULL UNIQUE,
      tier                 TEXT NOT NULL,
      billing_cycle        TEXT,
      price_inr            INTEGER NOT NULL DEFAULT 0,
      google_product_id    TEXT,
      google_base_plan_id  TEXT,
      google_offer_id      TEXT,
      features             JSONB NOT NULL,
      is_active            BOOLEAN NOT NULL DEFAULT true,
      created_at           TIMESTAMPTZ NOT NULL DEFAULT now(),
      updated_at           TIMESTAMPTZ NOT NULL DEFAULT now()
    );

    CREATE UNIQUE INDEX uq_subscription_plans_google_product_base
      ON subscription_plans (google_product_id, google_base_plan_id)
      WHERE google_product_id IS NOT NULL AND google_base_plan_id IS NOT NULL;

    CREATE INDEX idx_subscription_plans_active
      ON subscription_plans (is_active) WHERE is_active = true;

    CREATE TABLE user_subscriptions (
      id                     UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id                UUID NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
      plan_id                UUID NOT NULL REFERENCES subscription_plans(id),
      status                 TEXT NOT NULL DEFAULT 'pending'
                             CHECK (status IN (
                               'active','pending','canceled','expired',
                               'on_hold','in_grace','paused'
                             )),
      purchase_token         TEXT UNIQUE,
      order_id               TEXT,
      linked_purchase_token  TEXT,
      auto_renewing          BOOLEAN,
      acknowledged           BOOLEAN NOT NULL DEFAULT false,
      current_period_start   TIMESTAMPTZ,
      current_period_end     TIMESTAMPTZ,
      cancel_at_period_end   BOOLEAN NOT NULL DEFAULT false,
      pending_plan_id        UUID REFERENCES subscription_plans(id),
      raw_play_payload       JSONB,
      created_at             TIMESTAMPTZ NOT NULL DEFAULT now(),
      updated_at             TIMESTAMPTZ NOT NULL DEFAULT now()
    );

    CREATE INDEX idx_user_subscriptions_status ON user_subscriptions (status);
    CREATE INDEX idx_user_subscriptions_order_id
      ON user_subscriptions (order_id) WHERE order_id IS NOT NULL;

    CREATE TABLE google_play_purchases (
      id                     UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id                UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      user_subscription_id   UUID REFERENCES user_subscriptions(id) ON DELETE SET NULL,
      product_id             TEXT NOT NULL,
      base_plan_id           TEXT,
      purchase_token         TEXT NOT NULL UNIQUE,
      order_id               TEXT,
      purchase_state         INTEGER,
      acknowledged           BOOLEAN NOT NULL DEFAULT false,
      raw_response           JSONB,
      created_at             TIMESTAMPTZ NOT NULL DEFAULT now(),
      updated_at             TIMESTAMPTZ NOT NULL DEFAULT now()
    );

    CREATE TABLE billing_webhook_events (
      id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      event_id       TEXT NOT NULL UNIQUE,
      event_type     TEXT NOT NULL,
      package_name   TEXT,
      purchase_token TEXT,
      payload        JSONB NOT NULL,
      processed_at   TIMESTAMPTZ,
      created_at     TIMESTAMPTZ NOT NULL DEFAULT now()
    );

    CREATE INDEX idx_billing_webhook_events_type
      ON billing_webhook_events (event_type);
  `);

  // Seed catalog — google_* ids are placeholders for Play Console.
  await client.query(
    `
    INSERT INTO subscription_plans
      (code, tier, billing_cycle, price_inr, google_product_id, google_base_plan_id, features)
    VALUES
      ('free', 'free', NULL, 0, NULL, NULL, $1::jsonb),
      ('starter_monthly', 'starter', 'monthly', 99, 'starter', 'monthly', $2::jsonb),
      ('starter_yearly', 'starter', 'yearly', 999, 'starter', 'yearly', $3::jsonb),
      ('plus_monthly', 'plus', 'monthly', 199, 'plus', 'monthly', $4::jsonb),
      ('plus_yearly', 'plus', 'yearly', 1999, 'plus', 'yearly', $5::jsonb),
      ('pro_monthly', 'pro', 'monthly', 299, 'pro', 'monthly', $6::jsonb),
      ('pro_yearly', 'pro', 'yearly', 2999, 'pro', 'yearly', $7::jsonb)
    `,
    [
      JSON.stringify({
        ad_free: false, hd_renders: false, pdf_export: false, saved_plants: 5,
        landscape_gens: 1, premium_themes: false, diagnosis_scans: 3,
        priority_support: false, ai_care_assistant: false,
        priority_generation: false, before_after_download: false,
      }),
      JSON.stringify({
        ad_free: true, hd_renders: false, pdf_export: false, saved_plants: 25,
        landscape_gens: 2, premium_themes: false, diagnosis_scans: 15,
        priority_support: false, ai_care_assistant: false,
        priority_generation: false, before_after_download: false,
      }),
      JSON.stringify({
        ad_free: true, hd_renders: false, pdf_export: false, saved_plants: 25,
        landscape_gens: 2, premium_themes: false, diagnosis_scans: 15,
        priority_support: false, ai_care_assistant: false,
        priority_generation: false, before_after_download: false,
      }),
      JSON.stringify({
        ad_free: true, hd_renders: true, pdf_export: false, saved_plants: null,
        landscape_gens: 5, premium_themes: false, diagnosis_scans: 30,
        priority_support: true, ai_care_assistant: true,
        priority_generation: false, before_after_download: false,
      }),
      JSON.stringify({
        ad_free: true, hd_renders: true, pdf_export: false, saved_plants: null,
        landscape_gens: 5, premium_themes: false, diagnosis_scans: 30,
        priority_support: true, ai_care_assistant: true,
        priority_generation: false, before_after_download: false,
      }),
      JSON.stringify({
        ad_free: true, hd_renders: true, pdf_export: true, saved_plants: null,
        landscape_gens: 10, premium_themes: true, diagnosis_scans: 50,
        priority_support: true, ai_care_assistant: true,
        priority_generation: true, before_after_download: true,
      }),
      JSON.stringify({
        ad_free: true, hd_renders: true, pdf_export: true, saved_plants: null,
        landscape_gens: 10, premium_themes: true, diagnosis_scans: 50,
        priority_support: true, ai_care_assistant: true,
        priority_generation: true, before_after_download: true,
      }),
    ]
  );

  console.error("Google Play billing tables created and plans seeded");
}
