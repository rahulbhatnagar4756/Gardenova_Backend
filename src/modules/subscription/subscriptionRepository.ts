import { getDB } from "../../core/config/db";
import {
  comparePlanChange,
  GetAllPlansWithDetailResponse,
  SubscriptionPlan,
  UserSubscription,
  VerifySubscriptionBody,
} from "../../interface/subscription";
import logger from "../../core/config/logger";
import {
  acknowledgePlaySubscription,
  extractDeferredReplacement,
  extractLineItem,
  fetchPlaySubscription,
  mapPlayStateToLocal,
} from "./googlePlay.service";
import { syncSubscriptionFromPlay } from "./webhook.service";

/**
 * Fetch all active subscription plans with feature display labels.
 *
 * @returns {Promise<GetAllPlansWithDetailResponse>} Plans payload or failure message.
 */
export const getAllPlansWithDetailService = async (): Promise<GetAllPlansWithDetailResponse> => {
  const client = getDB();
  try {
    const query = `
      SELECT
        id, code, tier, billing_cycle, price_inr,
        google_product_id, google_base_plan_id, google_offer_id, features
      FROM subscription_plans
      WHERE is_active = true
      ORDER BY
        CASE tier
          WHEN 'free' THEN 0 WHEN 'starter' THEN 1
          WHEN 'plus' THEN 2 WHEN 'pro' THEN 3 ELSE 4
        END,
        CASE billing_cycle WHEN 'monthly' THEN 0 WHEN 'yearly' THEN 1 ELSE 2 END
    `;
    const { rows } = await client.query(query);

    const data = rows.map((plan) => {
      const f = plan.features;
      return {
        id: plan.id,
        code: plan.code,
        tier: plan.tier,
        billing_cycle: plan.billing_cycle,
        price_inr: plan.price_inr,
        google_product_id: plan.google_product_id,
        google_base_plan_id: plan.google_base_plan_id,
        google_offer_id: plan.google_offer_id,
        features: [
          {
            key: "diagnosis_scans",
            label:
              f.diagnosis_scans === null
                ? "Unlimited Diagnosis Scans"
                : `${f.diagnosis_scans} Diagnosis Scans per month`,
            enabled: f.diagnosis_scans === null || f.diagnosis_scans > 0,
          },
          {
            key: "landscape_gens",
            label:
              f.landscape_gens === null
                ? "Unlimited Landscape Generations"
                : `${f.landscape_gens} Landscape Generations per month`,
            enabled: f.landscape_gens === null || f.landscape_gens > 0,
          },
          {
            key: "saved_plants",
            label:
              f.saved_plants === null
                ? "Unlimited Saved Plants"
                : `${f.saved_plants} Saved Plants`,
            enabled: f.saved_plants === null || f.saved_plants > 0,
          },
          { key: "ai_care_assistant", label: "AI Care Assistant", enabled: !!f.ai_care_assistant },
          { key: "hd_renders", label: "HD Renders", enabled: !!f.hd_renders },
          { key: "priority_support", label: "Priority Support", enabled: !!f.priority_support },
          { key: "pdf_export", label: "PDF Export", enabled: !!f.pdf_export },
          {
            key: "priority_generation",
            label: "Priority Generation",
            enabled: !!f.priority_generation,
          },
          { key: "premium_themes", label: "Premium Themes", enabled: !!f.premium_themes },
          {
            key: "before_after_download",
            label: "Before/After Download",
            enabled: !!f.before_after_download,
          },
          { key: "ad_free", label: "Ad Free", enabled: !!f.ad_free },
        ],
      };
    });

    return { success: true, data };
  } catch (err) {
    logger.error("getAllPlansWithDetailService failed", { err });
    return { success: false, message: "Failed to fetch plans" };
  }
};

/**
 * Looks up an active plan by its code.
 *
 * @param {string} planCode - Plan code (e.g. starter_monthly).
 * @returns {Promise<SubscriptionPlan>} Matching subscription plan.
 */
export const getPlanByCode = async (planCode: string): Promise<SubscriptionPlan> => {
  const client = await getDB();
  const { rows } = await client.query(
    `SELECT * FROM subscription_plans WHERE code = $1 AND is_active = true`,
    [planCode]
  );
  if (!rows[0]) throw new Error(`Plan with code ${planCode} not found.`);
  return rows[0] as SubscriptionPlan;
};

/**
 * Loads the free plan row.
 *
 * @returns {Promise<SubscriptionPlan>} Free subscription plan.
 */
async function getFreePlan(): Promise<SubscriptionPlan> {
  const client = await getDB();
  const { rows } = await client.query(`SELECT * FROM subscription_plans WHERE code = 'free'`);
  if (!rows[0]) throw new Error("Free plan not found.");
  return rows[0] as SubscriptionPlan;
}

/**
 * Resolves a local plan from Google Play product / base plan ids.
 *
 * @param {string} productId - Google Play product id.
 * @param {string | null | undefined} [basePlanId] - Optional base plan id.
 * @returns {Promise<SubscriptionPlan | null>} Matching plan, or null if unmapped.
 */
export async function getPlanByGoogleIds(
  productId: string,
  basePlanId?: string | null
): Promise<SubscriptionPlan | null> {
  const client = await getDB();
  const { rows } = await client.query(
    `SELECT * FROM subscription_plans
     WHERE google_product_id = $1
       AND ($2::text IS NULL OR google_base_plan_id = $2)
       AND is_active = true
     ORDER BY CASE WHEN google_base_plan_id = $2 THEN 0 ELSE 1 END
     LIMIT 1`,
    [productId, basePlanId ?? null]
  );
  return (rows[0] as SubscriptionPlan) ?? null;
}

/**
 * Ensures purchase_token can be assigned to this user without unique conflicts.
 * Clears the token from expired/canceled rows owned by other users; rejects if
 * another account still has an active entitlement on this token.
 *
 * @param {string} userId - Claiming user UUID.
 * @param {string} purchaseToken - Google Play purchase token.
 * @returns {Promise<void>} Resolves when the token is free for this user.
 */
async function claimPurchaseTokenForUser(
  userId: string,
  purchaseToken: string
): Promise<void> {
  const client = await getDB();
  const { rows } = await client.query<{ id: string; user_id: string; status: string }>(
    `SELECT id, user_id, status FROM user_subscriptions WHERE purchase_token = $1`,
    [purchaseToken]
  );
  const existing = rows[0];
  if (!existing) return;
  if (existing.user_id === userId) return;

  if (existing.status === "expired" || existing.status === "canceled") {
    logger.warn("Reclaiming purchase_token from expired/canceled row", {
      fromUserId: existing.user_id,
      toUserId: userId,
      status: existing.status,
    });
    await client.query(
      `UPDATE user_subscriptions
         SET purchase_token = NULL,
             linked_purchase_token = NULL,
             updated_at = now()
       WHERE id = $1`,
      [existing.id]
    );
    return;
  }

  throw new Error(
    "This Google Play purchase is already linked to another account"
  );
}

/**
 * Returns the user's active/in-grace subscription with plan, or free plan fallback.
 *
 * @param {string} userId - User UUID.
 * @returns {Promise<{ subscription: UserSubscription | null, plan: SubscriptionPlan }>}
 * Active subscription (if any) and resolved plan.
 */
export async function getActiveSubscriptionWithPlan(userId: string): Promise<{
  subscription: UserSubscription | null;
  plan: SubscriptionPlan;
}> {
  const client = await getDB();
  const { rows } = await client.query(
    `SELECT us.*, row_to_json(sp.*) AS plan
     FROM user_subscriptions us
     JOIN subscription_plans sp ON sp.id = us.plan_id
     WHERE us.user_id = $1
       AND us.status IN ('active', 'in_grace')
     LIMIT 1`,
    [userId]
  );

  if (rows.length === 0) {
    return { subscription: null, plan: await getFreePlan() };
  }

  const row = rows[0];
  const { plan, ...subscription } = row;
  return {
    subscription: subscription as UserSubscription,
    plan: plan as SubscriptionPlan,
  };
}

export type VerifySubscriptionResult = {
  verified: boolean;
  status: string;
  activated: boolean;
  deferred: boolean;
  planCode: string;
  pendingPlanCode: string | null;
  pendingEffectiveAt: Date | null;
};

/**
 * Verifies a Google Play purchase, acknowledges it, and either activates immediately
 * (upgrade / first purchase) or schedules a pending plan (downgrade / Play deferred).
 *
 * @param {string} userId - Purchasing user UUID.
 * @param {VerifySubscriptionBody} body - Purchase token and product identifiers.
 * @returns {Promise<VerifySubscriptionResult>} Verification outcome and plan codes.
 */
export async function verifySubscriptionPayment(
  userId: string,
  body: VerifySubscriptionBody
): Promise<VerifySubscriptionResult> {
  const client = await getDB();
  const { purchaseToken, productId, basePlanId, orderId } = body;

  if (!purchaseToken || !productId) {
    throw new Error("purchaseToken and productId are required");
  }

  const play = await fetchPlaySubscription(purchaseToken);
  const line = extractLineItem(play);
  const deferredReplacement = extractDeferredReplacement(play);

  const resolvedProductId = line.productId || productId;
  const resolvedBasePlanId = line.basePlanId || basePlanId || null;

  if (line.productId && line.productId !== productId && !deferredReplacement) {
    logger.warn("Verify productId mismatch with Play line item", {
      bodyProductId: productId,
      playProductId: line.productId,
    });
  }

  const activeLinePlan = await getPlanByGoogleIds(resolvedProductId, resolvedBasePlanId);
  if (!activeLinePlan) {
    throw new Error(
      `No local plan mapped for productId=${resolvedProductId} basePlanId=${resolvedBasePlanId}`
    );
  }

  let pendingTargetPlan: SubscriptionPlan | null = null;
  if (deferredReplacement) {
    pendingTargetPlan = await getPlanByGoogleIds(
      deferredReplacement.productId,
      deferredReplacement.basePlanId
    );
    if (!pendingTargetPlan) {
      throw new Error(
        `No local plan mapped for deferred productId=${deferredReplacement.productId}`
      );
    }
  } else {
    const bodyPlan = await getPlanByGoogleIds(productId, basePlanId ?? null);
    if (bodyPlan && bodyPlan.id !== activeLinePlan.id) {
      pendingTargetPlan = bodyPlan;
    }
  }

  const { subscription: currentSub, plan: currentPlan } =
    await getActiveSubscriptionWithPlan(userId);
  const hasPaidCurrent =
    !!currentSub && currentPlan.code !== "free" && currentPlan.tier !== "free";

  const candidateForCompare = pendingTargetPlan ?? activeLinePlan;
  const changeKind = hasPaidCurrent
    ? comparePlanChange(currentPlan, candidateForCompare)
    : "upgrade";

  // Play already replaced onto the lower product (Android used immediate mode).
  const playAlreadyOnLower =
    hasPaidCurrent &&
    changeKind === "downgrade" &&
    !deferredReplacement &&
    activeLinePlan.id !== currentPlan.id &&
    activeLinePlan.id === candidateForCompare.id;

  const deferredPlan =
    pendingTargetPlan ??
    (changeKind === "downgrade" && hasPaidCurrent
      ? await getPlanByGoogleIds(productId, basePlanId ?? null)
      : null);

  const deferNow =
    !!deferredReplacement ||
    (changeKind === "downgrade" &&
      hasPaidCurrent &&
      !playAlreadyOnLower &&
      !!deferredPlan);

  if (playAlreadyOnLower) {
    logger.warn(
      "Downgrade arrived as immediate Play replacement; activating lower plan now. Android should use ReplacementMode.DEFERRED.",
      { userId, from: currentPlan.code, to: activeLinePlan.code }
    );
  }

  const status = mapPlayStateToLocal(play.subscriptionState);
  const activatable = status === "active" || status === "in_grace";

  let acknowledged = play.acknowledgementState === "ACKNOWLEDGEMENT_STATE_ACKNOWLEDGED";
  const ackProductId = deferredReplacement?.productId || resolvedProductId;
  if (!acknowledged && (activatable || deferNow)) {
    try {
      await acknowledgePlaySubscription(ackProductId, purchaseToken);
      acknowledged = true;
    } catch (err) {
      logger.warn("Acknowledge failed during verify", {
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }

  const periodStart = play.startTime ? new Date(play.startTime) : new Date();
  const periodEnd = line.expiryTime;

  const auditProductId = deferNow
    ? (deferredPlan?.google_product_id ?? productId)
    : resolvedProductId;
  const auditBasePlanId = deferNow
    ? (deferredPlan?.google_base_plan_id ?? basePlanId ?? null)
    : resolvedBasePlanId;

  await client.query(
    `INSERT INTO google_play_purchases
       (user_id, product_id, base_plan_id, purchase_token, order_id, acknowledged, raw_response)
     VALUES ($1, $2, $3, $4, $5, $6, $7)
     ON CONFLICT (purchase_token) DO UPDATE SET
       user_id = EXCLUDED.user_id,
       product_id = EXCLUDED.product_id,
       base_plan_id = EXCLUDED.base_plan_id,
       order_id = COALESCE(EXCLUDED.order_id, google_play_purchases.order_id),
       acknowledged = EXCLUDED.acknowledged,
       raw_response = EXCLUDED.raw_response,
       updated_at = now()`,
    [
      userId,
      auditProductId,
      auditBasePlanId,
      purchaseToken,
      orderId ?? play.latestOrderId ?? null,
      acknowledged,
      play,
    ]
  );

  if (deferNow && currentSub && deferredPlan) {
    await client.query(
      `UPDATE user_subscriptions
         SET pending_plan_id = $2,
             raw_play_payload = $3,
             acknowledged = $4,
             updated_at = now()
       WHERE user_id = $1
         AND status IN ('active', 'in_grace')`,
      [userId, deferredPlan.id, play, acknowledged]
    );

    await client.query(
      `UPDATE google_play_purchases g
         SET user_subscription_id = us.id, updated_at = now()
       FROM user_subscriptions us
       WHERE g.purchase_token = $1 AND us.user_id = $2`,
      [purchaseToken, userId]
    );

    return {
      verified: true,
      status: currentSub.status,
      activated: false,
      deferred: true,
      planCode: currentPlan.code,
      pendingPlanCode: deferredPlan.code,
      pendingEffectiveAt: currentSub.current_period_end,
    };
  }

  const activatePlan = activeLinePlan;

  // Avoid unique violations when this token already sits on another row
  // (common after DB cleanup / account switches in test).
  await claimPurchaseTokenForUser(userId, purchaseToken);

  await client.query(
    `INSERT INTO user_subscriptions (
       user_id, plan_id, status, purchase_token, order_id,
       linked_purchase_token, auto_renewing, acknowledged,
       current_period_start, current_period_end, cancel_at_period_end,
       raw_play_payload, updated_at
     ) VALUES (
       $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, now()
     )
     ON CONFLICT (user_id) DO UPDATE SET
       plan_id = EXCLUDED.plan_id,
       status = EXCLUDED.status,
       purchase_token = EXCLUDED.purchase_token,
       order_id = COALESCE(EXCLUDED.order_id, user_subscriptions.order_id),
       linked_purchase_token = COALESCE(EXCLUDED.linked_purchase_token, user_subscriptions.linked_purchase_token),
       auto_renewing = EXCLUDED.auto_renewing,
       acknowledged = EXCLUDED.acknowledged,
       current_period_start = EXCLUDED.current_period_start,
       current_period_end = EXCLUDED.current_period_end,
       cancel_at_period_end = EXCLUDED.cancel_at_period_end,
       raw_play_payload = EXCLUDED.raw_play_payload,
       pending_plan_id = NULL,
       updated_at = now()`,
    [
      userId,
      activatePlan.id,
      status,
      purchaseToken,
      orderId ?? play.latestOrderId ?? null,
      play.linkedPurchaseToken ?? null,
      line.autoRenewing,
      acknowledged,
      periodStart,
      periodEnd,
      line.autoRenewing === false && status === "active",
      play,
    ]
  );

  await client.query(
    `UPDATE google_play_purchases g
       SET user_subscription_id = us.id, updated_at = now()
     FROM user_subscriptions us
     WHERE g.purchase_token = $1 AND us.user_id = $2`,
    [purchaseToken, userId]
  );

  if (activatable) {
    await syncSubscriptionFromPlay(purchaseToken, play);
  }

  return {
    verified: true,
    status,
    activated: activatable,
    deferred: false,
    planCode: activatePlan.code,
    pendingPlanCode: null,
    pendingEffectiveAt: null,
  };
}

/**
 * Builds the "my subscription" API payload including usage and pending plan.
 *
 * @param {string} userId - User UUID.
 * @returns {Promise<object>} Current plan, status, pending change, and feature usage.
 */
export async function getMySubscriptionService(userId: string): Promise<{
  plan: {
    code: string;
    tier: "free" | "starter" | "plus" | "pro";
    billing_cycle: "monthly" | "yearly" | null;
    features: SubscriptionPlan["features"];
  };
  status: string;
  current_period_end: Date | null;
  cancel_at_period_end: boolean;
  pending_plan: {
    code: string;
    tier: "free" | "starter" | "plus" | "pro";
    billing_cycle: "monthly" | "yearly" | null;
  } | null;
  pending_effective_at: Date | null;
  usage: { diagnosis_scans_used: number; landscape_gens_used: number };
}> {
  const client = await getDB();
  const { subscription, plan } = await getActiveSubscriptionWithPlan(userId);

  const cycleStart = subscription?.current_period_start ?? null;
  const usage = { diagnosis_scans_used: 0, landscape_gens_used: 0 };

  if (cycleStart) {
    const period = new Date(cycleStart).toISOString().slice(0, 7);
    const { rows } = await client.query(
      `SELECT feature_type, count FROM feature_usage
       WHERE user_id = $1 AND period = $2`,
      [userId, period]
    );
    for (const row of rows) {
      if (row.feature_type === "diagnosis") usage.diagnosis_scans_used = row.count;
      if (row.feature_type === "landscape") usage.landscape_gens_used = row.count;
    }
  }

  let pending_plan: {
    code: string;
    tier: "free" | "starter" | "plus" | "pro";
    billing_cycle: "monthly" | "yearly" | null;
  } | null = null;

  if (subscription?.pending_plan_id) {
    const { rows: pendingRows } = await client.query<SubscriptionPlan>(
      `SELECT code, tier, billing_cycle FROM subscription_plans WHERE id = $1`,
      [subscription.pending_plan_id]
    );
    if (pendingRows[0]) {
      pending_plan = {
        code: pendingRows[0].code,
        tier: pendingRows[0].tier,
        billing_cycle: pendingRows[0].billing_cycle,
      };
    }
  }

  return {
    plan: {
      code: plan.code,
      tier: plan.tier,
      billing_cycle: plan.billing_cycle,
      features: plan.features,
    },
    status: subscription?.status ?? "active",
    current_period_end: subscription?.current_period_end ?? null,
    cancel_at_period_end: subscription?.cancel_at_period_end ?? false,
    pending_plan,
    pending_effective_at: pending_plan
      ? (subscription?.current_period_end ?? null)
      : null,
    usage,
  };
}

/**
 * Marks local cancel_at_period_end. Actual Play cancel is done in the Play Store /
 * BillingClient; RTDN will sync status afterward.
 *
 * @param {string} userId - User UUID.
 * @returns {Promise<{ cancel_at_period_end: boolean, active_until: Date | null }>}
 * Cancellation flags and access end date.
 */
export async function cancelSubscriptionService(
  userId: string
): Promise<{ cancel_at_period_end: boolean; active_until: Date | null }> {
  const { subscription, plan } = await getActiveSubscriptionWithPlan(userId);
  const client = await getDB();

  if (!subscription || plan.code === "free") {
    throw new Error("Already on the free plan");
  }
  if (!subscription.purchase_token) {
    throw new Error("No Google Play purchase to cancel");
  }

  await client.query(
    `UPDATE user_subscriptions
       SET cancel_at_period_end = true,
           auto_renewing = false,
           updated_at = now()
     WHERE user_id = $1`,
    [userId]
  );

  return {
    cancel_at_period_end: true,
    active_until: subscription.current_period_end,
  };
}
