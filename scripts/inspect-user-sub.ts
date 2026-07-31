/**
 * Inspect one user's subscription state.
 * Usage: npx ts-node --transpile-only scripts/inspect-user-sub.ts <userId>
 */
import { connectDB, disconnectDB, getDB } from "../src/core/config/db";

async function main(): Promise<void> {
  const arg = process.argv[2];
  if (!arg) {
    console.error("Usage: inspect-user-sub.ts <userId|base64UserId>");
    process.exit(1);
  }

  const userId = arg.includes("-")
    ? arg
    : Buffer.from(arg, "base64").toString("utf8");

  await connectDB();
  const db = getDB();

  const subs = await db.query(
    `
    SELECT us.status,
           sp.code AS plan,
           psp.code AS pending,
           LEFT(us.purchase_token, 32) AS token,
           LEFT(us.linked_purchase_token, 32) AS linked,
           us.current_period_end,
           us.cancel_at_period_end,
           us.updated_at,
           us.raw_play_payload->>'subscriptionState' AS state,
           us.raw_play_payload->'lineItems'->0->>'productId' AS line_product,
           us.raw_play_payload->'lineItems'->0->'offerDetails'->>'basePlanId' AS base,
           us.raw_play_payload->'lineItems'->0->'deferredItemReplacement' AS deferred,
           us.raw_play_payload->'lineItems'->0->'autoRenewingPlan' AS auto_renew
    FROM user_subscriptions us
    JOIN subscription_plans sp ON sp.id = us.plan_id
    LEFT JOIN subscription_plans psp ON psp.id = us.pending_plan_id
    WHERE us.user_id = $1
    `,
    [userId]
  );

  const pur = await db.query(
    `
    SELECT product_id, base_plan_id, acknowledged,
           LEFT(purchase_token, 32) AS token, updated_at
    FROM google_play_purchases
    WHERE user_id = $1
    ORDER BY updated_at DESC
    `,
    [userId]
  );

  const tokens = [
    ...new Set(
      [
        ...subs.rows.map((r: { token: string | null }) => r.token),
        ...pur.rows.map((r: { token: string | null }) => r.token),
      ].filter(Boolean)
    ),
  ];

  const ev = await db.query(
    `
    SELECT event_type, LEFT(purchase_token, 32) AS token, created_at, processed_at
    FROM billing_webhook_events
    WHERE purchase_token IS NOT NULL
      AND (
        LEFT(purchase_token, 32) = ANY($1::text[])
        OR true
      )
    ORDER BY created_at DESC
    LIMIT 20
    `,
    [tokens.length ? tokens : [""]]
  );

  console.log("userId:", userId);
  console.log("=== subscription ===");
  console.log(JSON.stringify(subs.rows, null, 2));
  console.log("=== purchases ===");
  console.log(JSON.stringify(pur.rows, null, 2));
  console.log("=== recent webhook events ===");
  console.log(JSON.stringify(ev.rows, null, 2));

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
