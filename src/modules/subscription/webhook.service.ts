import { getDB } from "../../core/config/db";
import logger from "../../core/config/logger";

interface RazorpayWebhookPayload {
  event: string;
  created_at: number;
  payload: {
    subscription?: { entity: any }; //eslint-disable-line @typescript-eslint/no-explicit-any
    payment?: { entity: any }; //eslint-disable-line @typescript-eslint/no-explicit-any
  };
}

/**
 * Records a Razorpay webhook event to ensure idempotent processing.
 *
 * This function uses an insert-first approach to prevent duplicate
 * processing of the same webhook event. If the event has already been
 * recorded, the database conflict is ignored and the function returns
 * false. Otherwise, the event is stored and marked as new.
 *
 * @async
 * @function recordWebhookEvent
 * @param {RazorpayWebhookPayload} payload - The Razorpay webhook payload containing event details.
 * @returns {Promise<boolean>} A promise that resolves to:
 * - `true` if the event is new and should be processed.
 * - `false` if the event was already processed.
 *
 * @throws {Error} If a database operation fails while recording the webhook event.
 */
export async function recordWebhookEvent(payload: RazorpayWebhookPayload): Promise<boolean> {
  const subscriptionEntity = payload.payload?.subscription?.entity;
  const eventId = `${subscriptionEntity?.id ?? "no-sub"}:${payload.event}:${payload.created_at}`;
  const db = await getDB();
  const { rowCount } = await db.query(
    `INSERT INTO razorpay_webhook_events (event_id, event_type, payload)
     VALUES ($1, $2, $3)
     ON CONFLICT (event_id) DO NOTHING`,
    [eventId, payload.event, payload]
  );

  return rowCount! > 0; // true = fresh event, go process it
}
/**
 * Handles Razorpay subscription webhook events.
 *
 * This function processes different subscription lifecycle events received
 * from Razorpay and updates the local subscription state accordingly.
 * Events such as activation, successful charges, payment failures,
 * cancellation, and completion are mapped to their respective handlers.
 *
 * Webhook events without a valid subscription entity are ignored.
 *
 * @async
 * @function handleSubscriptionEvent
 * @param {RazorpayWebhookPayload} payload - The Razorpay webhook payload containing event type and subscription details.
 * @returns {Promise<void>} Resolves when the webhook event has been handled.
 *
 * @throws {Error} If an error occurs while updating subscription status
 * or processing the event.
 */
export async function handleSubscriptionEvent(payload: RazorpayWebhookPayload): Promise<void> {
  const sub = payload.payload?.subscription?.entity;
  if (!sub) {
    logger.info(`Ignoring webhook without subscription entity: ${payload.event}`);
    return;
  }

  switch (payload.event) {
    case "subscription.authenticated":
      // mandate captured, first charge not yet done — no local status change needed,
      // still 'pending'
      break;

    case "subscription.activated":
      await activateSubscription(sub.id, sub.plan_id, sub.current_start, sub.current_end);
      break;

    case "subscription.charged":
      await activateSubscription(sub.id, sub.plan_id, sub.current_start, sub.current_end);
      await resetUsageCycle(sub.id, sub.current_start);
      break;

    case "subscription.pending":
      await setStatus(sub.id, "pending");
      break;

    case "subscription.halted":
      await setStatus(sub.id, "halted");
      logger.warn(`Subscription halted after repeated payment failure: ${sub.id}`);
      break;

    case "subscription.cancelled":
      await setStatus(sub.id, "cancelled");
      break;

    case "subscription.completed":
      // total_count cycles exhausted (monthly plans hitting 12 renewals / yearly hitting 1)
      await setStatus(sub.id, "expired");
      break;

    default:
      logger.info(`Unhandled Razorpay webhook event: ${payload.event}`);
  }
}
/**
 * Activates a user subscription after successful Razorpay confirmation.
 *
 * Matches either the current `razorpay_subscription_id` or a scheduled
 * `pending_razorpay_subscription_id` (plan change / upgrade-downgrade handoff).
 * When the pending id matches, promotes it to the active subscription fields.
 *
 * @async
 * @function activateSubscription
 * @param {string} razorpaySubId - The Razorpay subscription ID associated with the user subscription.
 * @param razorpayPlanId
 * @param {number} periodStartUnix - The subscription period start timestamp in Unix format.
 * @param {number} periodEndUnix - The subscription period end timestamp in Unix format.
 * @returns {Promise<void>} Resolves when the subscription has been activated.
 *
 * @throws {Error} If a database error occurs while updating the subscription.
 */
async function activateSubscription(
  razorpaySubId: string,
  razorpayPlanId: string,
  periodStartUnix: number,
  periodEndUnix: number
): Promise<void> {
  const db = await getDB();

  const { rows: planRows } = await db.query(
    `SELECT id FROM subscription_plans WHERE razorpay_plan_id = $1`,
    [razorpayPlanId]
  );

  const planId = planRows[0]?.id ?? null;

  const { rowCount } = await db.query(
    `UPDATE user_subscriptions
     SET status = 'active',
         razorpay_subscription_id = $4,
         plan_id = COALESCE($1, plan_id),
         pending_plan_id = NULL,
         pending_razorpay_subscription_id = NULL,
         current_period_start = to_timestamp($2),
         current_period_end = to_timestamp($3),
         cancel_at_period_end = false,
         updated_at = now()
     WHERE razorpay_subscription_id = $4
        OR pending_razorpay_subscription_id = $4`,
    [planId, periodStartUnix, periodEndUnix, razorpaySubId]
  );

  if (!rowCount) {
    logger.warn(`activateSubscription matched no row for razorpaySubId=${razorpaySubId}`);
  }

  if (planRows.length === 0) {
    logger.warn(`No local plan found for razorpay_plan_id=${razorpayPlanId}, plan_id not synced`, {
      razorpaySubId,
    });
  }
}
/**
 * Updates the status of a user subscription from a Razorpay lifecycle event.
 *
 * Rules for plan-change handoff:
 * - Event id = pending_razorpay_subscription_id → clear pending (abandoned/failed new sub).
 * - Event id = razorpay_subscription_id while pending exists → keep status active
 *   (user remains entitled until the new sub activates); do not wipe pending.
 * - Otherwise → set status normally.
 *
 * @async
 * @function setStatus
 * @param {string} razorpaySubId - The Razorpay subscription ID associated with the subscription record.
 * @param {string} status - The new subscription status to set.
 * @returns {Promise<void>} Resolves when the subscription status has been updated.
 *
 * @throws {Error} If a database error occurs while updating the subscription status.
 */
async function setStatus(razorpaySubId: string, status: string): Promise<void> {
  const db = await getDB();

  const { rows } = await db.query<{
    id: string;
    razorpay_subscription_id: string | null;
    pending_razorpay_subscription_id: string | null;
  }>(
    `SELECT id, razorpay_subscription_id, pending_razorpay_subscription_id
     FROM user_subscriptions
     WHERE razorpay_subscription_id = $1
        OR pending_razorpay_subscription_id = $1
     LIMIT 1`,
    [razorpaySubId]
  );

  if (rows.length === 0) {
    logger.warn(`setStatus: no subscription row for razorpaySubId=${razorpaySubId}`);
    return;
  }

  const row = rows[0]!;
  const isPendingId = row.pending_razorpay_subscription_id === razorpaySubId;
  const isCurrentId = row.razorpay_subscription_id === razorpaySubId;
  const hasPending = !!row.pending_razorpay_subscription_id;
  const isDestructive = status === "cancelled" || status === "expired" || status === "halted";

  if (isPendingId) {
    // Non-destructive events (e.g. subscription.pending) are normal for a
    // scheduled start_at sub — leave the plan-change pending fields alone.
    if (!isDestructive) {
      logger.info(
        `Ignoring non-destructive ${status} on pending sub ${razorpaySubId}`
      );
      return;
    }
    // Pending (scheduled) subscription failed / was cancelled — drop the plan change.
    await db.query(
      `UPDATE user_subscriptions
         SET pending_plan_id = NULL,
             pending_razorpay_subscription_id = NULL,
             updated_at = now()
       WHERE id = $1`,
      [row.id]
    );
    logger.info(
      `Cleared pending plan change after ${status} on pending sub ${razorpaySubId}`
    );
    return;
  }

  if (isCurrentId && hasPending && isDestructive) {
    // Old subscription ended while a new one is scheduled — keep user active
    // until the pending sub activates. Do not mark cancelled/expired/halted.
    logger.info(
      `Ignoring ${status} on current sub ${razorpaySubId} — pending handoff in progress`
    );
    return;
  }

  await db.query(
    `UPDATE user_subscriptions SET status = $1, updated_at = now()
     WHERE id = $2`,
    [status, row.id]
  );
}
/**
 * Resets the usage tracking cycle for a subscription billing period.
 *
 * This function retrieves the user associated with a Razorpay subscription
 * (current or pending) and creates a new usage tracking record for the
 * current billing cycle. If a usage record for the same user and cycle
 * already exists, it is not duplicated.
 *
 * @async
 * @function resetUsageCycle
 * @param {string} razorpaySubId - The Razorpay subscription ID associated with the user's subscription.
 * @param {number} periodStartUnix - The billing cycle start timestamp in Unix format.
 * @returns {Promise<void>} Resolves when the usage cycle has been initialized.
 *
 * @throws {Error} If a database error occurs while retrieving the user or creating the usage record.
 */
async function resetUsageCycle(razorpaySubId: string, periodStartUnix: number): Promise<void> {
  const db = await getDB();
  const { rows } = await db.query(
    `SELECT user_id FROM user_subscriptions
     WHERE razorpay_subscription_id = $1
        OR pending_razorpay_subscription_id = $1`,
    [razorpaySubId]
  );
  if (rows.length === 0) return;

  const userId = rows[0].user_id;
  const period = new Date(periodStartUnix * 1000).toISOString().slice(0, 7); // "YYYY-MM"

  const featureTypes: ("diagnosis" | "landscape")[] = ["diagnosis", "landscape"];

  for (const featureType of featureTypes) {
    await db.query(
      `INSERT INTO feature_usage (user_id, feature_type, period, count)
       VALUES ($1, $2, $3, 0)
       ON CONFLICT (user_id, feature_type, period) DO NOTHING`,
      [userId, featureType, period]
    );
  }
}
