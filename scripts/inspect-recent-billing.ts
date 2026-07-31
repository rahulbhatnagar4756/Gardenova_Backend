import { connectDB, disconnectDB, getDB } from "../src/core/config/db";

async function main(): Promise<void> {
  await connectDB();
  const db = getDB();

  const ev = await db.query(
    `
    SELECT event_type,
           LEFT(purchase_token, 36) AS token,
           created_at,
           processed_at,
           payload->'subscriptionNotification'->>'subscriptionId' AS sid,
           payload->'subscriptionNotification'->>'notificationType' AS nt
    FROM billing_webhook_events
    WHERE created_at > now() - interval '6 hours'
    ORDER BY created_at DESC
    LIMIT 30
    `
  );
  console.log("=== recent events ===");
  console.log(JSON.stringify(ev.rows, null, 2));

  const subs = await db.query(
    `
    SELECT us.user_id, sp.code AS plan, us.status, psp.code AS pending,
           LEFT(us.purchase_token, 36) AS token, us.updated_at
    FROM user_subscriptions us
    JOIN subscription_plans sp ON sp.id = us.plan_id
    LEFT JOIN subscription_plans psp ON psp.id = us.pending_plan_id
    ORDER BY us.updated_at DESC
    LIMIT 20
    `
  );
  console.log("=== all subs ===");
  console.log(JSON.stringify(subs.rows, null, 2));

  const purchases = await db.query(
    `
    SELECT user_id, product_id, base_plan_id,
           LEFT(purchase_token, 36) AS token, updated_at
    FROM google_play_purchases
    ORDER BY updated_at DESC
    LIMIT 20
    `
  );
  console.log("=== purchases ===");
  console.log(JSON.stringify(purchases.rows, null, 2));

  // Fetch Play state for latest purchased tokens if any
  const tokens = ev.rows
    .filter((r: { event_type: string }) => r.event_type === "SUBSCRIPTION_PURCHASED")
    .slice(0, 2)
    .map((r: { token: string }) => r.token);

  if (tokens.length) {
    const full = await db.query(
      `SELECT purchase_token, event_type, created_at
       FROM billing_webhook_events
       WHERE LEFT(purchase_token, 36) = ANY($1::text[])
       ORDER BY created_at DESC`,
      [tokens]
    );
    console.log("=== full tokens for purchased ===");
    console.log(JSON.stringify(full.rows, null, 2));
  }

  await disconnectDB();
}

main().catch(async (e) => {
  console.error(e);
  try {
    await disconnectDB();
  } catch {
    /* ignore */
  }
  process.exit(1);
});
