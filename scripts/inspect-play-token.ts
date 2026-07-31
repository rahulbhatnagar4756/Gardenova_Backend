/**
 * Fetch Play V2 payload for a purchase token prefix/full token from DB or argv.
 * Usage: npx ts-node --transpile-only scripts/inspect-play-token.ts <tokenOrPrefix>
 */
import { connectDB, disconnectDB, getDB } from "../src/core/config/db";
import {
  extractDeferredReplacement,
  extractLineItem,
  fetchPlaySubscription,
} from "../src/modules/subscription/googlePlay.service";

async function main(): Promise<void> {
  const arg = process.argv[2];
  if (!arg) {
    console.error("token required");
    process.exit(1);
  }
  await connectDB();
  const db = getDB();
  const { rows } = await db.query<{ purchase_token: string }>(
    `SELECT purchase_token FROM billing_webhook_events
     WHERE purchase_token LIKE $1
     ORDER BY created_at DESC LIMIT 1`,
    [`${arg}%`]
  );
  const token = rows[0]?.purchase_token ?? arg;
  console.log("token prefix:", token.slice(0, 40));

  const play = await fetchPlaySubscription(token);
  const line = extractLineItem(play);
  const deferred = extractDeferredReplacement(play);
  console.log(
    JSON.stringify(
      {
        subscriptionState: play.subscriptionState,
        acknowledgementState: play.acknowledgementState,
        linkedPurchaseToken: play.linkedPurchaseToken
          ? String(play.linkedPurchaseToken).slice(0, 40)
          : null,
        replacementCancellation: !!play.canceledStateContext?.replacementCancellation,
        line,
        deferred,
        lineItems: play.lineItems,
      },
      null,
      2
    )
  );

  const sub = await db.query(
    `SELECT us.user_id, sp.code, us.status, psp.code AS pending,
            us.current_period_end, us.updated_at
     FROM user_subscriptions us
     JOIN subscription_plans sp ON sp.id = us.plan_id
     LEFT JOIN subscription_plans psp ON psp.id = us.pending_plan_id
     WHERE us.purchase_token = $1 OR us.linked_purchase_token = $1`,
    [token]
  );
  console.log("local row:", JSON.stringify(sub.rows, null, 2));
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
