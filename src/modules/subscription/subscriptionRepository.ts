import { getDB } from "../../core/config/db";
import {
  GetAllPlansWithDetailResponse,
  SubscriptionPlan,
  UserSubscription,
  VerifySubscriptionBody,
} from "../../interface/subscription";
import logger from "../../core/config/logger";
import {
  extractDeferredReplacement,
  extractLineItem,
  fetchPlaySubscription,
  mapPlayStateToLocal,
} from "./googlePlay.service";
import { decideVerifyChange } from "./verifyDecision";

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
     WHERE is_active = true
       AND (
         (google_product_id = $1 AND ($2::text IS NULL OR google_base_plan_id = $2))
         OR code = $1
         OR google_product_id = $1
       )
     ORDER BY
       CASE
         WHEN google_product_id = $1 AND google_base_plan_id = $2 THEN 0
         WHEN code = $1 THEN 1
         WHEN google_product_id = $1 AND ($2::text IS NULL OR google_base_plan_id = $2) THEN 2
         ELSE 3
       END
     LIMIT 1`,
    [productId, basePlanId ?? null]
  );
  return (rows[0] as SubscriptionPlan) ?? null;
}

/**
 * Maps client/Play product + basePlan ids onto subscription_plans google_* values.
 * Handles shorthand like basePlanId "monthly" and composite productIds like "starter_monthly".
 *
 * @param {string} productId - Raw product id from the client.
 * @param {string | null | undefined} [basePlanId] - Raw base plan id from the client.
 * @returns {Promise<{ productId: string, basePlanId: string | null, planCode: string | null }>}
 * Canonical google product/base plan ids (and matched plan code when found).
 */
export async function normalizeVerifyPlanIds(
  productId: string,
  basePlanId?: string | null
): Promise<{
  productId: string;
  basePlanId: string | null;
  planCode: string | null;
}> {
  const client = await getDB();
  const rawProduct = productId.trim();
  const rawBase = basePlanId?.trim() || null;
  const composedBase =
    rawBase && rawProduct && !rawBase.includes("-")
      ? `${rawProduct.replace(/_/g, "-")}-${rawBase}`
      : null;
  // e.g. productId "starter" + "monthly" → plan code "starter_monthly"
  const composedCode =
    rawBase && (rawBase === "monthly" || rawBase === "yearly")
      ? `${rawProduct}_${rawBase}`
      : null;

  const { rows } = await client.query<{
    code: string;
    google_product_id: string;
    google_base_plan_id: string | null;
  }>(
    `SELECT code, google_product_id, google_base_plan_id
     FROM subscription_plans
     WHERE is_active = true
       AND google_product_id IS NOT NULL
       AND (
         (google_product_id = $1 AND ($2::text IS NULL OR google_base_plan_id = $2))
         OR code = $1
         OR ($4::text IS NOT NULL AND code = $4)
         OR (google_product_id = $1 AND billing_cycle::text = $2)
         OR (google_product_id = $1 AND google_base_plan_id = $3)
         OR ($3::text IS NOT NULL AND google_base_plan_id = $3)
         OR (google_product_id = $1 AND $2::text IS NOT NULL AND google_base_plan_id LIKE ('%' || $2))
         OR google_product_id = $1
       )
     ORDER BY
       CASE
         WHEN google_product_id = $1 AND google_base_plan_id = $2 THEN 0
         WHEN code = $1 THEN 1
         WHEN $4::text IS NOT NULL AND code = $4 THEN 2
         WHEN google_product_id = $1 AND billing_cycle::text = $2 THEN 3
         WHEN google_product_id = $1 AND google_base_plan_id = $3 THEN 4
         WHEN $3::text IS NOT NULL AND google_base_plan_id = $3 THEN 5
         WHEN google_product_id = $1 AND $2::text IS NOT NULL AND google_base_plan_id LIKE ('%' || $2) THEN 6
         WHEN google_product_id = $1 THEN 7
         ELSE 8
       END
     LIMIT 1`,
    [rawProduct, rawBase, composedBase, composedCode]
  );

  const plan = rows[0];
  if (!plan) {
    return {
      productId: rawProduct,
      basePlanId: rawBase,
      planCode: null,
    };
  }

  return {
    productId: plan.google_product_id,
    basePlanId: plan.google_base_plan_id,
    planCode: plan.code,
  };
}

/**
 * Ensures purchase_token can be assigned to this verifying user.
 * Authenticated verify is the source of truth for account linking, so any other
 * row holding this token (including ones wrongly updated by an early RTDN) is
 * cleared before upsert.
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

  logger.warn("Moving purchase_token to verifying user", {
    fromUserId: existing.user_id,
    toUserId: userId,
    previousStatus: existing.status,
  });

  await client.query(
    `UPDATE user_subscriptions
       SET purchase_token = NULL,
           linked_purchase_token = NULL,
           status = CASE
             WHEN status IN ('active', 'in_grace', 'pending') THEN 'expired'
             ELSE status
           END,
           pending_plan_id = NULL,
           updated_at = now()
     WHERE id = $1`,
    [existing.id]
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
  /** Post-response Play ack (never awaited inside verify). */
  needsAcknowledge: boolean;
  ackProductId: string | null;
  purchaseToken: string;
};

/**
 * Verifies a Google Play purchase and persists entitlement.
 * Does NOT call Play acknowledge (controller does that after HTTP response).
 *
 * - Upgrade / first purchase → activate Play line plan now
 * - Downgrade / Play deferred → keep current paid plan + pending_plan until period end
 *
 * @param {string} userId - Purchasing user UUID.
 * @param {VerifySubscriptionBody} body - Purchase token and product identifiers.
 * @returns {Promise<VerifySubscriptionResult>} Verification outcome and plan codes.
 */
export async function verifySubscriptionPayment(
  userId: string,
  body: VerifySubscriptionBody
): Promise<VerifySubscriptionResult> {
  const client = getDB();
  const { purchaseToken, productId, basePlanId, orderId } = body;

  if (!purchaseToken || !productId) {
    throw new Error("purchaseToken and productId are required");
  }

  const t0 = Date.now();
  logger.info("Verify: fetching Play subscription", {
    userId,
    purchaseTokenPrefix: purchaseToken.slice(0, 16),
  });
  const play = await fetchPlaySubscription(purchaseToken);
  logger.info("Verify: Play fetch done", {
    userId,
    ms: Date.now() - t0,
    state: play.subscriptionState,
    ack: play.acknowledgementState,
  });

  const line = extractLineItem(play);
  const deferredReplacement = extractDeferredReplacement(play);
  logger.info("Verify: line items resolved", {
    userId,
    currentProductId: line.productId,
    currentBasePlanId: line.basePlanId,
    deferredProductId: deferredReplacement?.productId ?? null,
    ms: Date.now() - t0,
  });

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

  const bodyPlan = await getPlanByGoogleIds(productId, basePlanId ?? null);

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
  } else if (bodyPlan && bodyPlan.id !== activeLinePlan.id) {
    pendingTargetPlan = bodyPlan;
  }

  const { subscription: currentSub, plan: currentPlan } =
    await getActiveSubscriptionWithPlan(userId);
  const hasPaidCurrent =
    !!currentSub && currentPlan.code !== "free" && currentPlan.tier !== "free";

  const decision = decideVerifyChange({
    hasPaidCurrent,
    currentPlan,
    activeLinePlan,
    pendingTargetPlan,
    deferredFromPlay: !!deferredReplacement,
    bodyMappedPlan: bodyPlan,
  });

  if (decision.playAlreadyOnLower) {
    logger.warn(
      "Downgrade arrived without Play deferredItemReplacement; keeping current plan and scheduling pending. Android should use ReplacementMode.DEFERRED.",
      {
        userId,
        from: currentPlan.code,
        pending: decision.pendingPlan?.code ?? null,
      }
    );
  }

  const status = mapPlayStateToLocal(play.subscriptionState);
  const activatable = status === "active" || status === "in_grace";
  const acknowledged =
    play.acknowledgementState === "ACKNOWLEDGEMENT_STATE_ACKNOWLEDGED";
  const needsAcknowledge = !acknowledged && (activatable || decision.mode === "defer");

  const periodStart = play.startTime ? new Date(play.startTime) : new Date();
  const periodEnd = line.expiryTime ?? currentSub?.current_period_end ?? null;

  const deferNow = decision.mode === "defer" && !!decision.pendingPlan;
  const auditProductId = deferNow
    ? (bodyPlan?.google_product_id ??
        (decision.pendingPlan as SubscriptionPlan | null)?.google_product_id ??
        productId)
    : resolvedProductId;
  const auditBasePlanId = deferNow
    ? (bodyPlan?.google_base_plan_id ?? basePlanId ?? null)
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

  if (deferNow && decision.pendingPlan) {
    const keepPlan = decision.keepOrActivatePlan as SubscriptionPlan;
    const pendingPlan = decision.pendingPlan as SubscriptionPlan;
    const keepStatus: string =
      status === "active" || status === "in_grace" ? status : "active";

    await client.query(
      `INSERT INTO user_subscriptions (
         user_id, plan_id, status, purchase_token, order_id,
         linked_purchase_token, auto_renewing, acknowledged,
         current_period_start, current_period_end, cancel_at_period_end,
         pending_plan_id, raw_play_payload, updated_at
       ) VALUES (
         $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, now()
       )
       ON CONFLICT (user_id) DO UPDATE SET
         plan_id = $2,
         status = $3,
         purchase_token = COALESCE($4, user_subscriptions.purchase_token),
         order_id = COALESCE($5, user_subscriptions.order_id),
         linked_purchase_token = COALESCE(
           $6,
           user_subscriptions.linked_purchase_token
         ),
         auto_renewing = COALESCE($7, user_subscriptions.auto_renewing),
         acknowledged = $8,
         current_period_start = COALESCE(
           $9,
           user_subscriptions.current_period_start
         ),
         current_period_end = COALESCE($10, user_subscriptions.current_period_end),
         cancel_at_period_end = $11,
         pending_plan_id = $12,
         raw_play_payload = $13,
         updated_at = now()`,
      [
        userId,
        keepPlan.id,
        keepStatus,
        purchaseToken,
        orderId ?? play.latestOrderId ?? null,
        play.linkedPurchaseToken ?? null,
        line.autoRenewing,
        acknowledged,
        periodStart,
        periodEnd,
        line.autoRenewing === false,
        pendingPlan.id,
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

    logger.info("Verify: deferred downgrade saved", {
      userId,
      planCode: keepPlan.code,
      pendingPlanCode: pendingPlan.code,
      ms: Date.now() - t0,
    });

    return {
      verified: true,
      status: keepStatus,
      activated: true,
      deferred: true,
      planCode: keepPlan.code,
      pendingPlanCode: pendingPlan.code,
      pendingEffectiveAt: periodEnd,
      needsAcknowledge,
      ackProductId: resolvedProductId,
      purchaseToken,
    };
  }

  const activatePlan = decision.keepOrActivatePlan as SubscriptionPlan;

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

  logger.info("Verify: activated plan saved", {
    userId,
    planCode: activatePlan.code,
    status,
    ms: Date.now() - t0,
  });

  return {
    verified: true,
    status,
    activated: activatable,
    deferred: false,
    planCode: activatePlan.code,
    pendingPlanCode: null,
    pendingEffectiveAt: null,
    needsAcknowledge,
    ackProductId: resolvedProductId,
    purchaseToken,
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
