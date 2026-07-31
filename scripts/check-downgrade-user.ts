/**
 * Check current subscription + recent billing for a user.
 * Usage:
 *   npx ts-node --transpile-only scripts/check-downgrade-user.ts <userId>
 *   npx ts-node --transpile-only scripts/check-downgrade-user.ts --email ashirwad11@yopmail.com
 */
import { connectDB, disconnectDB, getDB } from "../src/core/config/db";
import {
  extractDeferredReplacement,
  extractLineItem,
  fetchPlaySubscription,
} from "../src/modules/subscription/googlePlay.service";

async function main(): Promise<void> {
  await connectDB();
  const db = getDB();

  let userId = process.argv[2];
  if (userId === "--email") {
    const email = process.argv[3];
    const { rows } = await db.query<{ id: string; email: string }>(
      `SELECT id, email FROM users WHERE email = $1 LIMIT 1`,
      [email]
    );
    if (!rows[0]) {
      console.error("User not found");
      process.exit(1);
    }
    userId = rows[0].id;
    console.log("user:", rows[0]);
  } else if (!userId) {
    // Default test account used in prior runs
    const { rows } = await db.query<{ id: string; email: string }>(
      `SELECT id, email FROM users WHERE email = $1 LIMIT 1`,
      ["ashirwad11@yopmail.com"]
    );
    if (!rows[0]) {
      console.error("Default user not found");
      process.exit(1);
    }
    userId = rows[0].id;
    console.log("user:", rows[0]);
  }

  const subs = await db.query(
    `
    SELECT us.status,
           sp.code AS plan,
           sp.tier AS plan_tier,
           psp.code AS pending,
           psp.tier AS pending_tier,
           LEFT(us.purchase_token, 36) AS token,
           LEFT(us.linked_purchase_token, 36) AS linked,
           us.current_period_start,
           us.current_period_end,
           us.cancel_at_period_end,
           us.updated_at
    FROM user_subscriptions us
    JOIN subscription_plans sp ON sp.id = us.plan_id
    LEFT JOIN subscription_plans psp ON psp.id = us.pending_plan_id
    WHERE us.user_id = $1
    `,
    [userId]
  );

  const purchases = await db.query(
    `
    SELECT product_id, base_plan_id, acknowledged,
           LEFT(purchase_token, 36) AS token, updated_at
    FROM google_play_purchases
    WHERE user_id = $1
    ORDER BY updated_at DESC
    `,
    [userId]
  );

  const events = await db.query(
    `
    SELECT event_type,
           LEFT(purchase_token, 36) AS token,
           payload->'subscriptionNotification'->>'subscriptionId' AS sid,
           created_at,
           processed_at
    FROM billing_webhook_events
    WHERE created_at > now() - interval '3 hours'
    ORDER BY created_at DESC
    LIMIT 15
    `
  );

  console.log("=== local subscription ===");
  console.log(JSON.stringify(subs.rows, null, 2));
  console.log("=== purchases ===");
  console.log(JSON.stringify(purchases.rows, null, 2));
  console.log("=== recent webhooks ===");
  console.log(JSON.stringify(events.rows, null, 2));

  const token = subs.rows[0]?.token as string | undefined;
  if (token) {
    const { rows: full } = await db.query<{ purchase_token: string }>(
      `SELECT purchase_token FROM user_subscriptions WHERE user_id = $1 LIMIT 1`,
      [userId]
    );
    const playToken = full[0]?.purchase_token;
    if (playToken) {
      const play = await fetchPlaySubscription(playToken);
      const line = extractLineItem(play);
      const deferred = extractDeferredReplacement(play);
      console.log("=== Play (current extractors) ===");
      console.log(
        JSON.stringify(
          {
            subscriptionState: play.subscriptionState,
            line,
            deferred,
            lineItemCount: play.lineItems?.length ?? 0,
            lineProducts: (play.lineItems ?? []).map((i) => ({
              productId: i?.productId,
              expiryTime: i?.expiryTime,
              hasDeferred: !!i?.deferredItemReplacement?.productId,
              deferredProductId: i?.deferredItemReplacement?.productId ?? null,
              replacementMode:
                (i as { itemReplacement?: { replacementMode?: string } })
                  ?.itemReplacement?.replacementMode ?? null,
            })),
          },
          null,
          2
        )
      );

      const expectedOk =
        !!deferred &&
        line.productId &&
        ["pro", "pro_monthly", "pro_yearly"].some((p) =>
          String(line.productId).includes("pro")
        ) &&
        String(deferred.productId).includes("plus") &&
        subs.rows[0]?.plan?.includes("pro") &&
        !!subs.rows[0]?.pending?.includes("plus");

      console.log("=== verdict ===");
      console.log(
        expectedOk
          ? "PASS: still on pro locally with pending plus (deferred downgrade)"
          : "CHECK: local/Play state does not match expected deferred downgrade"
      );
      console.log({
        localPlan: subs.rows[0]?.plan,
        localPending: subs.rows[0]?.pending,
        playCurrent: line.productId,
        playPending: deferred?.productId ?? null,
      });
    }
  } else {
    console.log("No local subscription row for user");
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
