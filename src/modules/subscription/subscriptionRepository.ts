import { connectDB, getDB } from "../../core/config/db";
import config from "../../core/config/env";
import { GetAllPlansWithDetailResponse, SubscriptionPlan, UserSubscription, VerifySubscriptionBody } from "../../interface/subscription";
import Razorpay from "razorpay";
import { findUserById } from "../auth/authRepository";
import logger from "../../core/config/logger";
import { verifyCheckoutSignature } from "./razorPay.service";

const razorpay = new Razorpay({
  key_id: config.RAZORPAY_KEY_ID,
  key_secret: config.RAZORPAY_KEY_SECRET,
});

/**
 * Fetch all active subscription plans along with their limits/details.
 *
 * This service queries the database to retrieve:
 * - Plan metadata (name, tier, pricing, status)
 * - Plan limits and feature entitlements (scans, AI features, exports, etc.)
 *
 * It joins `plans` and `plan_limits` tables to return a unified dataset
 * for all active subscription plans.
 *
 * @async
 * @function getAllPlansWithDetailService
 *
 * @returns {Promise<GetAllPlansWithDetailResponse>} Returns an object containing:
 * - `success`: boolean indicating operation status
 * - `data`: array of subscription plans with details (if successful)
 * - `message`: error message (if failed)
 *
 * @throws Does not throw; errors are caught and returned in a structured response:
 * - `{ success: false, message: "Failed to fetch plans" }`
 */
export const getAllPlansWithDetailService = async (): Promise<GetAllPlansWithDetailResponse> => {
  const client = await connectDB();
  try {
    const query = `
      SELECT
        id,
        code,
        tier,
        billing_cycle,
        price_inr,
        razorpay_plan_id,
        features
      FROM subscription_plans
      WHERE is_active = true
      ORDER BY price_inr ASC
    `;
    const result = await client.query(query);

    const plans = result.rows.map((plan) => {
      const f = plan.features; // JSONB column comes back as parsed JS object already

      return {
        id: plan.id,
        code: plan.code,
        tier: plan.tier,
        billing_cycle: plan.billing_cycle,
        price_inr: plan.price_inr,
        razorpay_plan_id: plan.razorpay_plan_id,
        features: [
          {
            key: "diagnosis_scans",
            label:
              f.diagnosis_scans === null
                ? "Unlimited Diagnosis Scans"
                : `${f.diagnosis_scans} Diagnosis Scans per month`,
            enabled: f.diagnosis_scans === null || f.diagnosis_scans > 0
          },
          {
            key: "landscape_gens",
            label:
              f.landscape_gens === null
                ? "Unlimited Landscape Generations"
                : `${f.landscape_gens} Landscape Generations per month`,
            enabled: f.landscape_gens === null || f.landscape_gens > 0
          },
          {
            key: "saved_plants",
            label:
              f.saved_plants === null ? "Unlimited Plants" : `${f.saved_plants} Plants`,
            enabled: f.saved_plants === null || f.saved_plants > 0
          },
          {
            key: "ai_care_assistant",
            label: "AI Care Assistant",
            enabled: f.ai_care_assistant
          },
          {
            key: "hd_renders",
            label: "HD Renders",
            enabled: f.hd_renders
          },
          {
            key: "pdf_export",
            label: "PDF Export",
            enabled: f.pdf_export
          },
          {
            key: "priority_generation",
            label: "Priority Generation",
            enabled: f.priority_generation
          },
          {
            key: "premium_themes",
            label: "Premium Styles/Themes",
            enabled: f.premium_themes
          },
          {
            key: "before_after_download",
            label: "Before/After Comparison Downloads",
            enabled: f.before_after_download
          },
          {
            key: "priority_support",
            label: "Priority Support",
            enabled: f.priority_support
          },
          {
            key: "ad_free",
            label: "Ad-Free Experience",
            enabled: f.ad_free
          }
        ]
      };
    });

    return {
      success: true,
      data: plans
    };
  } catch (error) {
    console.error("Error fetching plans:", error);
    return {
      success: false,
      message: "Failed to fetch plans"
    };
  }
};
/**
 * Retrieves an active subscription plan by its unique code.
 *
 * Queries the database for an active subscription plan matching the
 * provided plan code. Throws an error if no active plan is found.
 *
 * @async
 * @function getPlanByCode
 * @param {string} planCode - The unique code identifying the subscription plan.
 * @returns {Promise<SubscriptionPlan>} A promise that resolves to the matching active subscription plan.
 *
 * @throws {Error} If no active subscription plan exists for the specified plan code.
 */
export const getPlanByCode = async (planCode: string): Promise<SubscriptionPlan> => {
  const client = await getDB();

  const query = `
    select * from subscription_plans where code = $1 and is_active = true
    `;
  const result = await client.query(query, [planCode]);

  if (result.rows.length === 0) {
    throw new Error(`No active plan found for code: ${planCode}`);
  }
  return result.rows[0];
}
/**
 * Retrieves the default free subscription plan.
 *
 * Queries the database for the subscription plan with the code
 * `free` and returns it.
 *
 * @async
 * @function getFreePlan
 * @returns {Promise<SubscriptionPlan>} A promise that resolves to the free subscription plan.
 *
 * @throws {Error} If a database error occurs while retrieving the plan.
 */
async function getFreePlan(): Promise<SubscriptionPlan> {
  const client = await getDB();
  const { rows } = await client.query(`SELECT * FROM subscription_plans WHERE code = 'free'`);
  return rows[0];
}
/**
 * Retrieves a user's subscription along with its associated plan.
 *
 * If the user has no subscription or their subscription is not active,
 * the default free subscription plan is returned instead. The subscription
 * object is still returned (if it exists), allowing callers to inspect its
 * current status.
 *
 * @async
 * @function getActiveSubscriptionWithPlan
 * @param {string} userId - The unique identifier of the user.
 * @returns {Promise<{ subscription: UserSubscription | null; plan: SubscriptionPlan }>}
 * A promise that resolves to an object containing:
 * - `subscription`: The user's subscription, or `null` if none exists.
 * - `plan`: The active subscription plan or the default free plan.
 *
 * @throws {Error} If a database error occurs while retrieving the subscription or plan.
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
     WHERE us.user_id = $1`,
    [userId]
  );

  if (rows.length === 0 || rows[0].status !== "active") {
    // no row, or row exists but not active (cancelled/expired/halted) -> free fallback
    const plan = await getFreePlan();
    return { subscription: rows[0] ?? null, plan };
  }

  const row = rows[0];
  return { subscription: row, plan: row.plan };
}



/**
 * Maps Razorpay's subscription status values to this app's internal
 * status enum, since they don't use identical naming.
 * @param {string} razorpayStatus - The subscription status from Razorpay.
 * @returns {"active" | "pending" | "paused" | "halted" | "cancelled" | "expired"}
 * The corresponding internal subscription status.
 * @throws {Error} If the Razorpay status is unrecognized, defaults to "expired" and logs a warning.
 */
function mapRazorpayStatusToLocal(
  razorpayStatus: string
): "active" | "pending" | "paused" | "halted" | "cancelled" | "expired" {
  switch (razorpayStatus) {
    case "active":
    case "authenticated":
      return "active";
    case "created":
    case "pending":
      return "pending";
    case "paused":
      return "paused";
    case "halted":
      return "halted";
    case "cancelled":
      return "cancelled";
    case "completed":
    case "expired":
      return "expired";
    default:
      logger.warn(`Unknown Razorpay subscription status: ${razorpayStatus}, defaulting to expired`);
      return "expired";
  }
}
/**
 * Creates a Razorpay subscription for the specified user.
 *
 * This service validates the requested subscription plan, ensures the user
 * exists, creates a Razorpay customer if one does not already exist, creates
 * a Razorpay subscription, and stores or updates the user's subscription
 * record in the database with a pending status.
 *
 * @async
 * @function createSubscriptionService
 * @param {string} userId - The unique identifier of the user.
 * @param {string} planCode - The code of the subscription plan to subscribe to.
 * @returns {Promise<{ subscriptionId: string; keyId: string | undefined }>}
 * A promise that resolves to an object containing:
 * - `subscriptionId`: The Razorpay subscription ID.
 * - `keyId`: The Razorpay Key ID used by the client to complete the payment.
 *
 * @throws {Error} If:
 * - The subscription plan does not exist or has no associated Razorpay plan ID.
 * - The user cannot be found.
 * - Creating the Razorpay customer or subscription fails.
 * - Updating the database fails.
 */
export const createSubscriptionService = async (
  userId: string,
  planCode: string
): Promise<{
  subscriptionId?: string;
  keyId?: string | undefined;
  scheduled?: boolean;
  effective_at?: Date | null;
  pending_plan_code?: string;
}> => {
  const client = await getDB();

  const plan = await getPlanByCode(planCode);
  if (!plan.razorpay_plan_id) {
    throw new Error(`Plan with code ${planCode} does not have a valid Razorpay plan ID.`);
  }

  const user = await findUserById(userId);
  if (!user) {
    throw new Error(`User with ID ${userId} not found.`);
  }

  // Check if user already has an active paid subscription — if so, this is
  // a plan change (upgrade/downgrade), not a fresh subscription.
  const { subscription: currentSubscription, plan: currentPlan } =
    await getActiveSubscriptionWithPlan(userId);

  if (currentPlan.code === planCode) {
    throw new Error(`The requested plan is already active.`);
  }

  if (currentSubscription?.razorpay_subscription_id && currentPlan.code !== "free") {
    // Prevent double-scheduling before any Razorpay calls
    if (currentSubscription.cancel_at_period_end || currentSubscription.pending_plan_id) {
      throw new Error(
        `A subscription change is already scheduled.`
      );
    }

    // ── Verify live status on Razorpay before attempting any change ──
    const liveSubscription = await razorpay.subscriptions.fetch(
      currentSubscription.razorpay_subscription_id
    );
    const liveStatus = liveSubscription.status;
    const localIsActive = currentSubscription.status === "active";
    // "created"/"pending" are OK when local is already active (webhook activated
    // entitlement before / without a live charge state — common in test + races).
    const liveAllowsChange =
      ["authenticated", "active"].includes(liveStatus) ||
      (localIsActive && ["created", "pending"].includes(liveStatus));

    if (!liveAllowsChange) {
      const terminalStatuses = ["halted", "cancelled", "completed", "expired"];
      if (terminalStatuses.includes(liveStatus)) {
        await client.query(
          `UPDATE user_subscriptions
             SET status = $1, updated_at = now()
           WHERE user_id = $2`,
          [mapRazorpayStatusToLocal(liveStatus), userId]
        );
      }

      throw new Error(
        `Cannot change plan — current subscription is "${liveStatus}" on Razorpay. ` +
        `Please start a new subscription instead.`
      );
    }

    const currentPeriodEnd = currentSubscription.current_period_end;
    if (!currentPeriodEnd) {
      throw new Error(
        `Cannot schedule plan change — current subscription has no period end date.`
      );
    }

    const startAtUnix = Math.floor(new Date(currentPeriodEnd).getTime() / 1000);
    // Razorpay requires a finite total_count; after these cycles the sub completes
    // and the user must create a new subscription to continue paid access.
    const totalCount = plan.billing_cycle === "yearly" ? 1 : 12;

    // ── 1. Create new subscription, scheduled to start when old one ends ──
    // Do this BEFORE cancelling the old one — if this call fails, the user
    // keeps their current active subscription untouched.
    const newRpSubscription = await razorpay.subscriptions.create({
      plan_id: plan.razorpay_plan_id,
      customer_notify: 1,
      total_count: totalCount,
      start_at: startAtUnix,
      notes: { userId, planCode },
    } as any); // eslint-disable-line @typescript-eslint/no-explicit-any

    // ── 2. Cancel old subscription ──
    // Uncharged ("created") subs cannot use cancel_at_cycle_end — cancel immediately.
    try {
      if (["created", "pending"].includes(liveStatus)) {
        await razorpay.subscriptions.cancel(currentSubscription.razorpay_subscription_id);
      } else {
        await razorpay.subscriptions.cancel(currentSubscription.razorpay_subscription_id, {
          cancel_at_cycle_end: 1,
        } as any); // eslint-disable-line @typescript-eslint/no-explicit-any
      }
    } catch (cancelErr) {
      // Roll back the new subscription so we don't end up with two active
      // subscriptions for this user if the cancel step fails.
      try {
        await razorpay.subscriptions.cancel(newRpSubscription.id);
      } catch {
        // best-effort rollback; log and let alerting catch orphaned subscription
      }
      throw cancelErr;
    }

    // ── 3. Persist both — old one still active till cycle end, new one pending ──
    await client.query(
      `UPDATE user_subscriptions
         SET pending_plan_id = $1,
             pending_razorpay_subscription_id = $2,
             cancel_at_period_end = true,
             updated_at = now()
       WHERE user_id = $3`,
      [plan.id, newRpSubscription.id, userId]
    );

    return {
      subscriptionId: newRpSubscription.id,
      keyId: process.env.RAZORPAY_KEY_ID,
      scheduled: true,
      effective_at: new Date(currentPeriodEnd),
      pending_plan_code: planCode,
    };
  }

  // No active paid subscription (free plan or none) -> create a fresh one
  let customerId = user.razorpay_customer_id as string | null;
  if (!customerId) {
    const customer = await razorpay.customers.create({
      name: user.name,
      email: user.email ?? undefined,
      contact: user.phone_number ?? "",
      notes: { userId },
    });
    customerId = customer.id;
    await client.query(`UPDATE users SET razorpay_customer_id = $1 WHERE id = $2`, [
      customerId,
      userId,
    ]);
  }

  // Razorpay requires a finite total_count; after these cycles the sub completes
  // and the user must create a new subscription to continue paid access.
  const totalCount = plan.billing_cycle === "yearly" ? 1 : 12;

  const rpSubscription = await razorpay.subscriptions.create({
    plan_id: plan.razorpay_plan_id,
    customer_notify: 1,
    total_count: totalCount,
    notes: { userId, planCode },
  });

  await client.query(
    `INSERT INTO user_subscriptions (user_id, plan_id, razorpay_subscription_id, razorpay_customer_id, status)
     VALUES ($1, $2, $3, $4, 'pending')
     ON CONFLICT (user_id) DO UPDATE
       SET plan_id = EXCLUDED.plan_id,
           razorpay_subscription_id = EXCLUDED.razorpay_subscription_id,
           razorpay_customer_id = EXCLUDED.razorpay_customer_id,
           status = 'pending',
           pending_plan_id = NULL,
           pending_razorpay_subscription_id = NULL,
           cancel_at_period_end = false,
           updated_at = now()`,
    [userId, plan.id, rpSubscription.id, customerId]
  );

  return {
    subscriptionId: rpSubscription.id,
    keyId: process.env.RAZORPAY_KEY_ID,
  };
};
/**
 * Verifies a Razorpay subscription payment for a user.
 *
 * This service validates the Razorpay checkout signature to ensure the
 * payment response is authentic, then confirms that the subscription
 * belongs to the requesting user before marking the verification as
 * successful.
 *
 * @async
 * @function verifySubscriptionPayment
 * @param {string} userId - The unique identifier of the user attempting to verify the subscription.
 * @param {VerifySubscriptionBody} body - Razorpay payment verification payload containing payment ID, subscription ID, and signature.
 * @returns {Promise<{ verified: boolean }>} A promise that resolves with the verification status.
 *
 * @throws {Error} If:
 * - The Razorpay signature verification fails.
 * - The subscription does not belong to the specified user.
 * - A database operation fails.
 */
export async function verifySubscriptionPayment(
  userId: string,
  body: VerifySubscriptionBody
): Promise<{ verified: boolean }> {

  const client = await getDB();

  const ok = verifyCheckoutSignature(body);
  if (!ok) {
    logger.warn("Razorpay signature mismatch on verify", { userId, body });
    throw new Error("Signature verification failed");
  }
  const { rows } = await client.query(
    `SELECT 1 FROM user_subscriptions
     WHERE user_id = $1
       AND (
         razorpay_subscription_id = $2
         OR pending_razorpay_subscription_id = $2
       )`,
    [userId, body.razorpay_subscription_id]
  );
  if (rows.length === 0) {
    throw new Error("Subscription does not belong to this user");
  }
  return { verified: true };

}

/**
 * Retrieves the authenticated user's subscription details along with usage information.
 *
 * This service fetches the user's active subscription and associated plan details.
 * If the user does not have an active paid subscription, the free plan is returned
 * as a fallback. It also retrieves usage metrics for the current billing cycle.
 *
 * @async
 * @function getMySubscriptionService
 * @param {string} userId - The unique identifier of the user.
 * @returns {Promise<{
 *   plan: {
 *     code: string;
 *    tier: "free" | "starter" | "plus" | "pro";
 *    billing_cycle: "monthly" | "yearly" | null;
 *    features: {
 *    diagnosis_scans: number | null;
 *   landscape_gens: number | null;
 *  saved_plants: number | null;
 * ai_care_assistant: boolean;
 * hd_renders: boolean;
 * priority_support: boolean;
 * pdf_export: boolean;
 * priority_generation: boolean;
 * premium_themes: boolean;
 * before_after_download: boolean;
 * ad_free: boolean;
 * };
 *   };
 *   status: "active" | "pending" | "paused" | "halted" | "cancelled" | "expired";
 *  current_period_end: Date | null;
 *  cancel_at_period_end: boolean;
 *  usage: {
 *   diagnosis_scans_used: number;
 *  landscape_gens_used: number;
 * };
 * }>} A promise that resolves to an object containing the user's subscription and usage details.
 * @throws {Error} If a database error occurs while retrieving subscription or usage data.
 */
export async function getMySubscriptionService(userId: string): Promise<{
  plan: {
    code: string;
    tier: "free" | "starter" | "plus" | "pro";
    billing_cycle: "monthly" | "yearly" | null;
    features: {
      diagnosis_scans: number | null;
      landscape_gens: number | null;
      saved_plants: number | null;
      ai_care_assistant: boolean;
      hd_renders: boolean;
      priority_support: boolean;
      pdf_export: boolean;
      priority_generation: boolean;
      premium_themes: boolean;
      before_after_download: boolean;
      ad_free: boolean;
    };
  };
  status: "active" | "pending" | "paused" | "halted" | "cancelled" | "expired";
  current_period_end: Date | null;
  cancel_at_period_end: boolean;
  pending_plan: {
    code: string;
    tier: "free" | "starter" | "plus" | "pro";
    billing_cycle: "monthly" | "yearly" | null;
  } | null;
  pending_effective_at: Date | null;
  usage: {
    diagnosis_scans_used: number;
    landscape_gens_used: number;
  };
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
 * Cancels the authenticated user's active paid subscription.
 *
 * This service checks the user's current subscription status, prevents
 * cancellation of free-tier subscriptions, requests Razorpay to cancel
 * the subscription at the end of the current billing cycle, and updates
 * the local subscription record to reflect the pending cancellation.
 *
 * @async
 * @function cancelSubscriptionService
 * @param {string} userId - The unique identifier of the user whose subscription should be cancelled.
 * @returns {Promise<{ cancel_at_period_end: boolean; active_until: Date | null }>}
 * A promise that resolves to an object indicating:
 * - `cancel_at_period_end`: true if the subscription is set to cancel at the end of the current cycle.
 * - `active_until`: the date until which the subscription remains active.
 *
 */
export async function cancelSubscriptionService(userId: string): Promise<{ cancel_at_period_end: boolean; active_until: Date | null }> {
  const { subscription, plan } = await getActiveSubscriptionWithPlan(userId);
  const client = await getDB();
  if (!subscription || !subscription.razorpay_subscription_id) {
    throw new Error("No active paid subscription to cancel");
  }
  if (plan.code === "free") {
    throw new Error("Already on the free plan");
  }

  // If a plan change is scheduled, drop the pending Razorpay sub first so cancel
  // means "paid until period end → free", not "keep the pending upgrade".
  if (subscription.pending_razorpay_subscription_id) {
    try {
      await razorpay.subscriptions.cancel(subscription.pending_razorpay_subscription_id);
    } catch (err) {
      logger.warn("Failed to cancel pending Razorpay subscription during user cancel", {
        userId,
        pendingId: subscription.pending_razorpay_subscription_id,
        error: err instanceof Error ? err.message : String(err),
      });
    }
    await client.query(
      `UPDATE user_subscriptions
         SET pending_plan_id = NULL,
             pending_razorpay_subscription_id = NULL,
             updated_at = now()
       WHERE user_id = $1`,
      [userId]
    );
  }

  // cancel_at_cycle_end = 1 -> user keeps access till current_period_end, then falls back to free
  // Skip RP cancel if already scheduled at cycle end from a prior plan-change.
  if (!subscription.cancel_at_period_end) {
    try {
      await razorpay.subscriptions.cancel(subscription.razorpay_subscription_id, {
        cancel_at_cycle_end: 1,
      } as any);//eslint-disable-line @typescript-eslint/no-explicit-any
    } catch (err) {
      logger.warn("Failed to cancel Razorpay subscription at cycle end, trying immediate cancel", {
        userId,
        subscriptionId: subscription.razorpay_subscription_id,
        error: err instanceof Error ? err.message : String(err),
      });
      // Uncharged subscriptions ("created") often reject cancel_at_cycle_end — try immediate cancel.
      try {
        await razorpay.subscriptions.cancel(subscription.razorpay_subscription_id);
      } catch (err2) {
        const msg =
          (err2 as { error?: { description?: string } })?.error?.description ||
          (err2 instanceof Error ? err2.message : "Failed to cancel subscription on Razorpay");
        throw new Error(msg);
      }
    }
  }

  await client.query(
    `UPDATE user_subscriptions
       SET cancel_at_period_end = true,
           pending_plan_id = NULL,
           pending_razorpay_subscription_id = NULL,
           updated_at = now()
     WHERE user_id = $1`,
    [userId]
  );

  return { cancel_at_period_end: true, active_until: subscription.current_period_end };
}
