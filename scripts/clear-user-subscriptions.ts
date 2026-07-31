/**
 * Dev-only: clear subscription entitlement rows (not the plans catalog).
 *
 * Run:
 *   npx ts-node --transpile-only scripts/clear-user-subscriptions.ts
 */
import { connectDB, disconnectDB, getDB } from "../src/core/config/db";

async function main(): Promise<void> {
  await connectDB();
  const db = getDB();

  const beforeSubs = await db.query(`SELECT COUNT(*)::int AS c FROM user_subscriptions`);
  const beforePurchases = await db.query(
    `SELECT COUNT(*)::int AS c FROM google_play_purchases`
  );

  await db.query(`UPDATE google_play_purchases SET user_subscription_id = NULL`);
  const delPurchases = await db.query(`DELETE FROM google_play_purchases`);
  const delSubs = await db.query(`DELETE FROM user_subscriptions`);

  let delEvents = 0;
  try {
    const ev = await db.query(`DELETE FROM billing_webhook_events`);
    delEvents = ev.rowCount ?? 0;
  } catch {
    /* table may not exist in some envs */
  }

  console.log("Cleared subscription test data:");
  console.log(`  user_subscriptions:      ${delSubs.rowCount ?? 0} (was ${beforeSubs.rows[0].c})`);
  console.log(
    `  google_play_purchases:   ${delPurchases.rowCount ?? 0} (was ${beforePurchases.rows[0].c})`
  );
  console.log(`  billing_webhook_events:  ${delEvents}`);
  console.log("subscription_plans left unchanged. Everyone is free until next verify.");

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
