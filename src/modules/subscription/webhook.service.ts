import { getDB } from "../../core/config/db";
import logger from "../../core/config/logger";
import {
  acknowledgePlaySubscription,
  extractDeferredReplacement,
  extractLineItem,
  fetchPlaySubscription,
  mapPlayStateToLocal,
  PLAY_NOTIFICATION_TYPES,
  PlaySubscriptionV2,
} from "./googlePlay.service";

interface PubSubPushBody {
  message?: {
    data?: string;
    messageId?: string;
    publishTime?: string;
  };
  subscription?: string;
}

interface PlayRtdnPayload {
  version?: string;
  packageName?: string;
  eventTimeMillis?: string;
  subscriptionNotification?: {
    version?: string;
    notificationType?: number;
    purchaseToken?: string;
    subscriptionId?: string;
  };
  testNotification?: { version?: string };
}

/**
 * Records a billing webhook event for idempotency.
 *
 * @param {Object} params - Event fields to persist.
 * @param {string} params.eventId - Unique event id for de-duplication.
 * @param {string} params.eventType - Notification / processing type label.
 * @param {string | null} [params.packageName] - Android package name.
 * @param {string | null} [params.purchaseToken] - Related purchase token.
 * @param {unknown} params.payload - Raw event payload JSON.
 * @returns {Promise<boolean>} True if this is a new event that should be processed.
 */
export async function recordBillingWebhookEvent(params: {
  eventId: string;
  eventType: string;
  packageName?: string | null;
  purchaseToken?: string | null;
  payload: unknown;
}): Promise<boolean> {
  const db = await getDB();
  const { rowCount } = await db.query(
    `INSERT INTO billing_webhook_events
       (event_id, event_type, package_name, purchase_token, payload)
     VALUES ($1, $2, $3, $4, $5)
     ON CONFLICT (event_id) DO NOTHING`,
    [
      params.eventId,
      params.eventType,
      params.packageName ?? null,
      params.purchaseToken ?? null,
      params.payload,
    ]
  );
  return rowCount! > 0;
}

/**
 * Marks a billing webhook event as processed.
 *
 * @param {string} eventId - Event id previously recorded.
 * @returns {Promise<void>} Resolves when processed_at is set.
 */
export async function markBillingWebhookProcessed(eventId: string): Promise<void> {
  const db = await getDB();
  await db.query(
    `UPDATE billing_webhook_events SET processed_at = now() WHERE event_id = $1`,
    [eventId]
  );
}

/**
 * Resolves a subscription_plans.id from Play product / base plan ids.
 *
 * @param {string | null} productId - Google product id.
 * @param {string | null} basePlanId - Optional base plan id.
 * @returns {Promise<string | null>} Local plan id, or null.
 */
async function resolvePlanId(
  productId: string | null,
  basePlanId: string | null
): Promise<string | null> {
  if (!productId) return null;
  const db = await getDB();
  const { rows } = await db.query<{ id: string }>(
    `SELECT id FROM subscription_plans
     WHERE google_product_id = $1
       AND ($2::text IS NULL OR google_base_plan_id = $2)
       AND is_active = true
     ORDER BY
       CASE WHEN google_base_plan_id = $2 THEN 0 ELSE 1 END
     LIMIT 1`,
    [productId, basePlanId]
  );
  return rows[0]?.id ?? null;
}

/**
 * Applies a Play SubscriptionPurchaseV2 payload onto the matching local row
 * (by purchase_token or linked_purchase_token).
 *
 * Deferred replacements keep the current plan active and only set pending_plan_id.
 * When the deferred change takes effect (no deferredItemReplacement, active state),
 * pending_plan_id is cleared and the new line-item plan is activated.
 *
 * @param {string} purchaseToken - Google Play purchase token.
 * @param {PlaySubscriptionV2} play - SubscriptionPurchaseV2 payload from Play.
 * @returns {Promise<void>} Resolves when local subscription rows are updated.
 */
export async function syncSubscriptionFromPlay(
  purchaseToken: string,
  play: PlaySubscriptionV2
): Promise<void> {
  const db = await getDB();
  const { productId, basePlanId, expiryTime, autoRenewing } = extractLineItem(play);
  const deferred = extractDeferredReplacement(play);
  const status = mapPlayStateToLocal(play.subscriptionState);
  const startMs = play.startTime ? new Date(play.startTime) : null;
  const cancelAtPeriodEnd = autoRenewing === false && status === "active";

  const planId = await resolvePlanId(productId, basePlanId);
  const pendingPlanId = deferred
    ? await resolvePlanId(deferred.productId, deferred.basePlanId)
    : null;

  const linked =
    play.linkedPurchaseToken && play.linkedPurchaseToken.length > 0
      ? play.linkedPurchaseToken
      : null;

  // Active/in-grace/pending may migrate a row from an old (linked) token to the
  // replacement token. Terminal RTDNs (expired/canceled/…) must only touch the
  // exact purchase_token — otherwise an old replaced sub overwrites the new one.
  const isEntitlementGranting =
    status === "active" || status === "in_grace" || status === "pending";

  // While a deferred replacement is pending, keep current plan_id; only set pending.
  // Once deferred clears and entitlement is active, activate line-item plan and clear pending.
  const hasDeferredPending = !!deferred && !!pendingPlanId;

  const { rowCount } = await db.query(
    `UPDATE user_subscriptions
       SET status = $2,
           plan_id = CASE
             WHEN $12::boolean THEN plan_id
             ELSE COALESCE($3, plan_id)
           END,
           purchase_token = $1,
           order_id = COALESCE($4, order_id),
           linked_purchase_token = COALESCE($5, linked_purchase_token),
           auto_renewing = $6,
           current_period_start = COALESCE($7, current_period_start),
           current_period_end = COALESCE($8, current_period_end),
           cancel_at_period_end = $9,
           raw_play_payload = $10,
           pending_plan_id = CASE
             WHEN $12::boolean THEN $13::uuid
             WHEN $2 IN ('active', 'in_grace') THEN NULL
             ELSE pending_plan_id
           END,
           updated_at = now()
     WHERE purchase_token = $1
        OR (
          $11::boolean = true
          AND (
            linked_purchase_token = $1
            OR ($5::text IS NOT NULL AND purchase_token = $5)
          )
        )`,
    [
      purchaseToken,
      status,
      planId,
      play.latestOrderId ?? null,
      linked,
      autoRenewing,
      startMs,
      expiryTime,
      cancelAtPeriodEnd,
      play,
      isEntitlementGranting,
      hasDeferredPending,
      pendingPlanId,
    ]
  );

  if (!rowCount) {
    logger.warn(`syncSubscriptionFromPlay: no row for token=${purchaseToken.slice(0, 12)}...`);
  }

  if (status === "active" && startMs && !hasDeferredPending) {
    await resetUsageCycleForToken(purchaseToken, startMs);
  }
}

/**
 * Ensures feature_usage rows exist for the subscription owner for the given period.
 *
 * @param {string} purchaseToken - Purchase token used to find the user.
 * @param {Date} periodStart - Cycle start used to derive YYYY-MM period.
 * @returns {Promise<void>} Resolves when usage rows are ensured.
 */
async function resetUsageCycleForToken(
  purchaseToken: string,
  periodStart: Date
): Promise<void> {
  const db = await getDB();
  const { rows } = await db.query<{ user_id: string }>(
    `SELECT user_id FROM user_subscriptions
     WHERE purchase_token = $1 OR linked_purchase_token = $1
     LIMIT 1`,
    [purchaseToken]
  );
  if (!rows[0]) return;
  const period = periodStart.toISOString().slice(0, 7);
  await db.query(
    `INSERT INTO feature_usage (user_id, feature_type, period, count)
     VALUES
       ($1, 'diagnosis', $2, 0),
       ($1, 'landscape', $2, 0)
     ON CONFLICT (user_id, feature_type, period) DO NOTHING`,
    [rows[0].user_id, period]
  );
}

/**
 * Handles Google Play RTDN via Pub/Sub push.
 *
 * @param {PubSubPushBody} body - Pub/Sub push body containing base64 RTDN data.
 * @returns {Promise<void>} Resolves when the notification is processed or ignored.
 */
export async function handleGooglePlayRtdn(body: PubSubPushBody): Promise<void> {
  const messageId = body.message?.messageId ?? `no-id:${Date.now()}`;
  const rawData = body.message?.data;
  if (!rawData) {
    logger.info("Ignoring Pub/Sub message without data");
    return;
  }

  let payload: PlayRtdnPayload;
  try {
    payload = JSON.parse(Buffer.from(rawData, "base64").toString("utf8")) as PlayRtdnPayload;
  } catch (err) {
    logger.error("Failed to decode RTDN payload", { err });
    return;
  }

  if (payload.testNotification) {
    const fresh = await recordBillingWebhookEvent({
      eventId: `${messageId}:test`,
      eventType: "TEST",
      packageName: payload.packageName ?? null,
      payload,
    });
    if (fresh) await markBillingWebhookProcessed(`${messageId}:test`);
    logger.info("Processed Play RTDN test notification");
    return;
  }

  const subNotif = payload.subscriptionNotification;
  if (!subNotif?.purchaseToken) {
    logger.info("Ignoring RTDN without subscriptionNotification.purchaseToken");
    return;
  }

  const typeCode = subNotif.notificationType ?? 0;
  const eventType = PLAY_NOTIFICATION_TYPES[typeCode] ?? `UNKNOWN_${typeCode}`;
  const eventId = `${messageId}:${eventType}:${subNotif.purchaseToken.slice(0, 24)}`;

  const fresh = await recordBillingWebhookEvent({
    eventId,
    eventType,
    packageName: payload.packageName ?? null,
    purchaseToken: subNotif.purchaseToken,
    payload,
  });
  if (!fresh) {
    logger.debug(`Duplicate RTDN skipped: ${eventId}`);
    return;
  }

  try {
    const play = await fetchPlaySubscription(subNotif.purchaseToken);
    await syncSubscriptionFromPlay(subNotif.purchaseToken, play);

    // Acknowledge if still unacknowledged and active-ish
    const productId = subNotif.subscriptionId || extractLineItem(play).productId;
    if (
      productId &&
      play.acknowledgementState === "ACKNOWLEDGEMENT_STATE_PENDING" &&
      ["SUBSCRIPTION_STATE_ACTIVE", "SUBSCRIPTION_STATE_IN_GRACE_PERIOD"].includes(
        play.subscriptionState ?? ""
      )
    ) {
      try {
        await acknowledgePlaySubscription(productId, subNotif.purchaseToken);
      } catch (ackErr) {
        logger.warn("RTDN acknowledge soft-failed", {
          error: ackErr instanceof Error ? ackErr.message : String(ackErr),
        });
      }
    }

    await markBillingWebhookProcessed(eventId);
  } catch (err) {
    logger.error("RTDN processing failed", {
      eventId,
      error: err instanceof Error ? err.message : String(err),
    });
    throw err;
  }
}
