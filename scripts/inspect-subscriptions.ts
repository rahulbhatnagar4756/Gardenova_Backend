/**
 * Inspect subscription rows after upgrade/downgrade tests.
 *
 * Run:
 *   npx ts-node --transpile-only scripts/inspect-subscriptions.ts
 *   npx ts-node --transpile-only scripts/inspect-subscriptions.ts <userId>
 */
import { connectDB, disconnectDB, getDB } from "../src/core/config/db";

async function main(): Promise<void> {
  const userId = process.argv[2] ?? null;
  await connectDB();
  const db = getDB();

  const subs = await db.query(
    `
    SELECT us.id, us.user_id, us.status,
           LEFT(us.purchase_token, 24) AS token_prefix,
           LEFT(us.linked_purchase_token, 24) AS linked_prefix,
           sp.code AS plan_code, sp.tier,
           psp.code AS pending_code,
           us.current_period_end,
           us.cancel_at_period_end,
           us.updated_at
    FROM user_subscriptions us
    JOIN subscription_plans sp ON sp.id = us.plan_id
    LEFT JOIN subscription_plans psp ON psp.id = us.pending_plan_id
    WHERE ($1::uuid IS NULL OR us.user_id = $1::uuid)
    ORDER BY us.updated_at DESC NULLS LAST
    LIMIT 50
    `,
    [userId]
  );

  const purchases = await db.query(
    `
    SELECT g.user_id, g.product_id, g.base_plan_id, g.acknowledged,
           LEFT(g.purchase_token, 24) AS token_prefix,
           g.updated_at
    FROM google_play_purchases g
    WHERE ($1::uuid IS NULL OR g.user_id = $1::uuid)
    ORDER BY g.updated_at DESC NULLS LAST
    LIMIT 50
    `,
    [userId]
  );

  const events = await db.query(
    `
    SELECT event_type, package_name,
           LEFT(purchase_token, 24) AS token_prefix,
           created_at, processed_at
    FROM billing_webhook_events
    WHERE ($1::uuid IS NULL OR true)
    ORDER BY created_at DESC
    LIMIT 20
    `,
    [userId]
  );

  console.log("=== user_subscriptions ===");
  console.table(subs.rows);
  console.log("=== google_play_purchases ===");
  console.table(purchases.rows);
  console.log("=== billing_webhook_events (latest 20) ===");
  console.table(events.rows);

  await disconnectDB();
}

main().catch(async (err) => {
  console.error(err);
  try {
    await disconnectDB();
  } catch {
    /* ignore */
  }
  process.exit(1);
});
