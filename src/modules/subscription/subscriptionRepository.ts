import { connectDB } from "../../core/config/db";
import config from "../../core/config/env";
import { GetAllPlansWithDetailResponse, PlanFields, PlanLimitFields, RazorpayOrder, ServiceResponse, UpdatePlanPayload } from "../../interface/subscription";
import Razorpay from "razorpay";
import crypto from "crypto";

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
  // Placeholder for actual subscription plan retrieval logic
  const client = await connectDB();
  try {
    const query = `
            SELECT
                id,
                name,
                tier,
                billing_period,
                product_id,
                price,
                currency,
                diagnosis_scans,
                landscape_gen,
                max_plants,
                ai_assistant,
                hd_renders,
                pdf_export,
                premium_styles,
                before_after_download,
                basic_reminders
            FROM subscription_plans
            WHERE is_active = true
        `;
    const result = await client.query(query);
    const plans = result.rows.map((plan) => ({
      id: plan.id,
      name: plan.name,
      tier: plan.tier,
      billing_period: plan.billing_period,
      product_id: plan.product_id,
      price: plan.price,
      currency: plan.currency,
      features: [
        {
          key: "diagnosis_scans",
          label: `${plan.diagnosis_scans} Diagnosis Scans`,
          enabled: plan.diagnosis_scans > 0
        },
        {
          key: "landscape_gen",
          label: `${plan.landscape_gen} Landscape Generations`,
          enabled: plan.landscape_gen > 0
        },
        {
          key: "max_plants",
          label:
            plan.max_plants === -1
              ? "Unlimited Plants"
              : `${plan.max_plants} Plants`,
          enabled: plan.max_plants > 0 || plan.max_plants === -1
        },
        {
          key: "ai_assistant",
          label: "AI Assistant",
          enabled: plan.ai_assistant
        },
        {
          key: "hd_renders",
          label: "HD Renders",
          enabled: plan.hd_renders
        },
        {
          key: "pdf_export",
          label: "PDF Export",
          enabled: plan.pdf_export
        },
        {
          key: "premium_styles",
          label: "Premium Styles",
          enabled: plan.premium_styles
        },
        {
          key: "before_after_download",
          label: "Before/After Download",
          enabled: plan.before_after_download
        },
        {
          key: "basic_reminders",
          label: "Basic Reminders",
          enabled: plan.basic_reminders
        }
      ]
    }));
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
}

const PLAN_COLUMNS = new Set<keyof PlanFields>([
  'name', 'tier', 'price_monthly', 'price_yearly', 'is_active',
]);

const PLAN_LIMIT_COLUMNS = new Set<keyof PlanLimitFields>([
  'scans_per_month', 'landscape_gens_per_month', 'max_saved_plants',
  'care_reminders', 'ad_free', 'ai_care_assistant', 'hd_renders',
  'priority_support', 'pdf_export', 'priority_generation',
  'premium_styles', 'before_after_downloads',
]);

/**
 * Builds a dynamic SQL SET clause for parameterized queries.
 *
 * This utility converts a key-value object into a SQL-safe SET clause
 * along with the corresponding parameter values and next parameter index.
 *
 * Example output:
 * - clause: "name = $1, age = $2"
 * - values: ["John", 25]
 *
 * Useful for UPDATE queries where fields are dynamic.
 *
 * @function buildSetClause
 *
 * @param {Record<string, unknown>} fields - Object containing column names as keys
 * and their corresponding values to be updated.
 *
 * @param {number} [startAt=1] - Starting index for SQL parameter placeholders
 * (useful when composing larger queries with existing bindings).
 *
 * @returns {{
 *   clause: string;
 *   values: unknown[];
 *   nextIndex: number;
 * } | null}
 * Returns:
 * - `clause`: SQL SET clause string (e.g., "col1 = $1, col2 = $2")
 * - `values`: Array of values in order of placeholders
 * - `nextIndex`: Next available parameter index after processing
 *
 * Returns `null` if no fields are provided.
 */
function buildSetClause(
  fields: Record<string, unknown>,
  startAt: number = 1,
): { clause: string; values: unknown[]; nextIndex: number } | null {
  const entries = Object.entries(fields);
  if (entries.length === 0) return null;

  const parts: string[] = [];
  const values: unknown[] = [];
  let i = startAt;

  for (const [key, value] of entries) {
    parts.push(`${key} = $${i++}`);
    values.push(value);
  }

  return { clause: parts.join(', '), values, nextIndex: i };
}
/**
 * Updates a subscription plan and its associated limits in a single transaction.
 *
 * This service:
 * 1. Validates the provided `planId`.
 * 2. Splits incoming update payload into:
 *    - `plans` table fields
 *    - `plan_limits` table fields
 * 3. Ignores unknown fields safely (prevents unsafe SQL injection inputs).
 * 4. Executes both updates inside a single DB transaction.
 * 5. Ensures atomicity using BEGIN / COMMIT / ROLLBACK.
 *
 * If either update fails, the entire transaction is rolled back.
 *
 * @async
 * @function updatePlanDetailService
 *
 * @param {string} planId - Unique identifier of the subscription plan to update.
 *
 * @param {UpdatePlanPayload} updateData - Partial payload containing fields
 * for either `plans` or `plan_limits` tables.
 *
 * @returns {Promise<ServiceResponse>} Service response object:
 * - `{ success: true, message: string }` on success
 * - `{ success: false, message: string }` on failure or invalid input
 *
 * @remarks
 * - Uses `buildSetClause` to dynamically generate parameterized SQL.
 * - Ensures safe updates by mapping only whitelisted columns.
 * - Unknown fields are ignored and not passed to SQL.
 */
export const updatePlanDetailService = async (
  planId: string,
  updateData: UpdatePlanPayload,
): Promise<ServiceResponse> => {
  if (!planId) {
    return { success: false, message: 'planId is required' };
  }

  // ── 1. split payload into per-table buckets ──────────────
  const planFields: Record<string, unknown> = {};
  const planLimitFields: Record<string, unknown> = {};
  const unknownFields: string[] = [];

  for (const [key, value] of Object.entries(updateData)) {
    if (PLAN_COLUMNS.has(key as keyof PlanFields)) {
      planFields[key] = value;
    } else if (PLAN_LIMIT_COLUMNS.has(key as keyof PlanLimitFields)) {
      planLimitFields[key] = value;
    } else {
      unknownFields.push(key); // ignore unknown — never pass raw input to SQL
    }
  }

  if (unknownFields.length > 0) {
    // console.warn(`[updatePlanDetailService] unknown fields ignored:`, unknownFields);
  }

  const hasPlansUpdate = Object.keys(planFields).length > 0;
  const hasLimitsUpdate = Object.keys(planLimitFields).length > 0;

  if (!hasPlansUpdate && !hasLimitsUpdate) {
    return { success: false, message: 'No valid fields provided to update' };
  }

  // ── 2. run both updates inside a single transaction ──────
  const client = await connectDB();
  try {
    await client.query('BEGIN');

    // ── 2a. UPDATE plans ──────────────────────────────────
    if (hasPlansUpdate) {
      const built = buildSetClause(planFields, 1);
      if (built) {
        const { clause, values, nextIndex } = built;
        await client.query(
          `UPDATE plans
           SET    ${clause}, updated_at = now()
           WHERE  id = $${nextIndex}`,
          [...values, planId],
        );
      }
    }

    // ── 2b. UPDATE plan_limits ────────────────────────────
    if (hasLimitsUpdate) {
      const built = buildSetClause(planLimitFields, 1);
      if (built) {
        const { clause, values, nextIndex } = built;
        await client.query(
          `UPDATE plan_limits
           SET    ${clause}
           WHERE  plan_id = $${nextIndex}`,
          [...values, planId],
        );
      }
    }

    await client.query('COMMIT');
    return { success: true, message: 'Plan updated successfully' };

  } catch (error) {
    await client.query('ROLLBACK');
    console.error('[updatePlanDetailService] transaction failed:', error);
    return { success: false, message: 'Failed to update plan' };

  }
};


/**
 * Fetches detailed information for a subscription plan by plan ID.
 *
 * This service:
 * - Connects to the database
 * - Retrieves plan information from the `plans` table
 * - Retrieves associated feature limits from the `plan_limits` table
 * - Returns a combined detailed subscription plan object
 *
 * @param planId - Unique identifier of the subscription plan
 *
 * @returns Promise resolving to a plan detail response object
 * - success: Indicates whether the operation succeeded
 * - data: Detailed subscription plan information (if found)
 * - message: Error or status message
 *
 * @throws Handles database query errors internally and returns failure response
 */
export const getPlanDetailsByIdServices = async (planId: string): Promise<GetAllPlansWithDetailResponse> => {
  const client = await connectDB();
  try {
    const query = `
        SELECT
    p.id AS plan_id,
    p.name,
    p.tier,
    p.price,
    p.billing_period,
    p.razorpay_id,
    p.is_active AS plan_status,
    
    pl.scans_per_month,
    pl.landscape_gens_per_month,
    pl.max_saved_plants,
    pl.care_reminders,
    pl.ad_free,
    pl.ai_care_assistant,
    pl.hd_renders,
    pl.priority_support,
    pl.pdf_export,
    pl.priority_generation,
    pl.premium_styles,
    pl.before_after_downloads
    FROM plans p
    JOIN plan_limits pl
        ON p.id = pl.plan_id
    WHERE p.id = $1;
        `;
    const result = await client.query(query, [planId]);

    if (result.rows.length === 0) {
      return {
        success: false,
        message: "Plan not found"
      };
    }

    return {
      success: true,
      data: result.rows[0] // return single plan details
    };
  } catch (error) {
    console.error("Error fetching plan details:", error);
    return {
      success: false,
      message: "Failed to fetch plan details"
    };
  }
}


/**
 * Creates a Razorpay payment order for a subscription plan.
 *
 * This service:
 * - Creates a new Razorpay order
 * - Converts amount into paise/cents (smallest currency unit)
 * - Stores subscription-related metadata in Razorpay order notes
 * - Returns the generated Razorpay order ID
 *
 * @param amount - Subscription/payment amount
 * @param currency - Currency code (e.g. INR, USD)
 * @param billing_period - Subscription billing period (monthly/yearly)
 * @param userId - Unique user ID
 * @param planId - Subscription plan ID
 *
 * @returns Promise resolving to:
 * - success: Indicates whether order creation succeeded
 * - orderId: Razorpay generated order ID (if successful)
 * - message: Error message (if failed)
 *
 * @throws Handles Razorpay API errors internally and returns failure response
 */
export const createRazorpayOrderService = async (
  planId: string,
  userId: string,
  billing_period: string
): Promise<{ success: boolean, message?: string, orderId?: string }> => {
  try {
    // For simplicity, using fixed amount and currency. In real implementation, fetch plan details to get these values
    const client = await connectDB();
    const planResult = await client.query(
      `SELECT price_monthly, price_yearly FROM plans WHERE razorpay_id = $1`,
      [planId]
    );
    if (planResult.rows.length === 0) {
      return { success: false, message: "Plan not found" };
    }

    const razorpaySubscription = await razorpay.subscriptions.create({
      plan_id: planId,
      customer_notify: 1,
      total_count: billing_period === "yearly" ? 12 : 1, // monthly = 1 payment, yearly = 12 payments
      notes: {
        userId,
        planId,
        billing_period,
      },
    });

    return { success: true, orderId: razorpaySubscription.id };



  } catch (err) {
    // console.error("Error creating Razorpay order:", err);

    return { success: false, message: `Failed to create Razorpay order error - ${err}` };
  }
};


/**
 * Fetch Razorpay orders with optional user and date filtering.
 *
 * @param userId - Optional user ID to filter orders by notes.userId.
 * @param from - Optional start timestamp.
 * @param to - Optional end timestamp.
 * @param count - Number of orders to fetch.
 * @param skip - Number of orders to skip.
 * @returns Razorpay orders and total count.
 */
export const getAllRazorpayOrdersService = async (
  userId?: string,
  from?: number,
  to?: number,
  count: number = 10,
  skip: number = 0
): Promise<{
  success: boolean;
  orders?: RazorpayOrder[];
  totalCount?: number;
  message?: string;
}> => {
  try {
    const params: Record<string, string | number> = {
      count,
      skip,
    };

    if (from) params.from = from;
    if (to) params.to = to;

    const response = await razorpay.orders.all(params);
    //  console.log("Fetched Razorpay orders:", response);

    let orders = response.items as RazorpayOrder[];

    // Filter by userId from notes if provided
    if (userId) {
      orders = orders.filter((order) => order.notes?.userId === userId);
    }

    return {
      success: true,
      orders,
      totalCount: response.count,
    };
  } catch (err) {
    console.error("Error fetching Razorpay orders:", err);
    return { success: false, message: "Failed to fetch Razorpay orders" };
  }
};

/**
 * Verifies a Razorpay payment signature and activates the user's subscription.
 *
 * This service:
 * - Validates Razorpay webhook/payment signature
 * - Supports test bypass mode in non-production environments
 * - Fetches order metadata from Razorpay order notes
 * - Calculates subscription expiration date
 * - Creates or updates the user's active subscription in the database
 *
 * @param razorpay_payment_id - Razorpay payment ID
 * @param razorpay_subscription_id - Razorpay order ID
 * @param razorpay_signature - Razorpay generated payment signature
 *
 * @returns Promise resolving to:
 * - success: Indicates whether payment verification succeeded
 * - message: Verification or error message
 *
 * @throws Error if Razorpay secret key is not configured
 * @throws Handles invalid signatures and missing metadata gracefully
 */
export const verifyRazorpayPaymentService = async (
  razorpay_payment_id: string,
  razorpay_subscription_id: string,
  razorpay_signature: string
): Promise<{ success: boolean; message: string }> => {

  // ── Step 1: Guard env var ─────────────────────────────────
  const secret = config.RAZORPAY_KEY_SECRET;
  if (!secret) throw new Error("RAZORPAY_KEY_SECRET is not configured");

  // ── Step 2: Test bypass (dev/staging only) ────────────────
  const isTestBypass =
    process.env.NODE_ENV !== "production" &&
    razorpay_signature === "test_bypass";

  if (!isTestBypass) {
    const body = razorpay_payment_id + "|" + razorpay_subscription_id;
    const expectedSignature = crypto
      .createHmac("sha256", secret)
      .update(body)
      .digest("hex");

    if (expectedSignature !== razorpay_signature) {
      return { success: false, message: "Invalid payment signature" };
    }
  }

  // ── Step 3: Fetch order notes from Razorpay ───────────────
  const order = await razorpay.subscriptions.fetch(razorpay_subscription_id);
  const { userId, planId, billing_period } = order.notes as {
    userId: string;
    planId: string;
    billing_period: string;
  };

  if (!userId || !planId || !billing_period) {
    return { success: false, message: "Order is missing required metadata" };
  }

  // ── Step 4: Calculate expires_at ─────────────────────────
  const now = new Date();
  const expires_at = new Date(now);

  if (billing_period === "yearly") {
    expires_at.setFullYear(expires_at.getFullYear() + 1);
  } else {
    expires_at.setMonth(expires_at.getMonth() + 1);
  }

  // ── Step 5: Upsert subscription via shared pool ───────────
  const pool = await connectDB();
  await pool.query(
    `INSERT INTO subscriptions
        (user_id, plan_id, billing_period, status, started_at, expires_at)
     VALUES
        ($1, $2, $3, 'active', now(), $4)
     ON CONFLICT ON CONSTRAINT uq_user_active_sub
     DO UPDATE SET
       plan_id        = EXCLUDED.plan_id,
       billing_period = EXCLUDED.billing_period,
       status         = 'active',
       started_at     = now(),
       expires_at     = EXCLUDED.expires_at,
       updated_at     = now()
     RETURNING *`,
    [userId, planId, billing_period, expires_at]
  );

  return { success: true, message: "Payment verified and subscription activated" };
};