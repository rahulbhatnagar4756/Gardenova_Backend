/**
 * Repair a user wrongly activated onto the deferred (lower) plan.
 * Usage: npx ts-node --transpile-only scripts/repair-deferred-user.ts <userId>
 */
import { connectDB, disconnectDB, getDB } from "../src/core/config/db";
import {
  extractDeferredReplacement,
  extractLineItem,
  fetchPlaySubscription,
} from "../src/modules/subscription/googlePlay.service";

async function main(): Promise<void> {
  const userId = process.argv[2];
  if (!userId) {
    console.error("userId required");
    process.exit(1);
  }

  await connectDB();
  const db = getDB();

  const { rows } = await db.query<{ purchase_token: string | null }>(
    `SELECT purchase_token FROM user_subscriptions WHERE user_id = $1 LIMIT 1`,
    [userId]
  );
  const token = rows[0]?.purchase_token;
  if (!token) {
    console.error("No subscription row / token for user");
    process.exit(1);
  }

  const play = await fetchPlaySubscription(token);
  const line = extractLineItem(play);
  const deferred = extractDeferredReplacement(play);
  console.log("Play current:", line);
  console.log("Play deferred:", deferred);

  if (!line.productId || !deferred?.productId) {
    console.error("Not a deferred replacement payload; aborting repair");
    process.exit(1);
  }

  const currentPlan = await db.query<{ id: string; code: string }>(
    `SELECT id, code FROM subscription_plans
     WHERE google_product_id = $1
       AND ($2::text IS NULL OR google_base_plan_id = $2)
       AND is_active = true
     ORDER BY CASE WHEN google_base_plan_id = $2 THEN 0 ELSE 1 END
     LIMIT 1`,
    [line.productId, line.basePlanId]
  );
  const pendingPlan = await db.query<{ id: string; code: string }>(
    `SELECT id, code FROM subscription_plans
     WHERE google_product_id = $1
       AND ($2::text IS NULL OR google_base_plan_id = $2)
       AND is_active = true
     ORDER BY CASE WHEN google_base_plan_id = $2 THEN 0 ELSE 1 END
     LIMIT 1`,
    [deferred.productId, deferred.basePlanId]
  );

  if (!currentPlan.rows[0] || !pendingPlan.rows[0]) {
    console.error("Could not map plans", { currentPlan: currentPlan.rows, pendingPlan: pendingPlan.rows });
    process.exit(1);
  }

  await db.query(
    `UPDATE user_subscriptions
       SET plan_id = $2,
           pending_plan_id = $3,
           status = 'active',
           current_period_end = COALESCE($4, current_period_end),
           raw_play_payload = $5,
           updated_at = now()
     WHERE user_id = $1`,
    [
      userId,
      currentPlan.rows[0].id,
      pendingPlan.rows[0].id,
      line.expiryTime,
      play,
    ]
  );

  console.log("Repaired:", {
    userId,
    plan: currentPlan.rows[0].code,
    pending: pendingPlan.rows[0].code,
    current_period_end: line.expiryTime,
  });

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
