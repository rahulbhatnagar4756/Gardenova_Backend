import { getDB } from "../config/db";

export type FeatureType = "diagnosis" | "landscape";

interface PlanFeatures {
  diagnosis_scans?: number;
  landscape_generations?: number;
  [key: string]: unknown;
}

interface ActivePlan {
  code: string;
  tier: string;
  features: PlanFeatures;
}

interface UsageCheckResult {
  allowed: boolean;
  limit: number;
  used: number;
  remaining: number;
}

/**
 * Retrieves the currently active subscription plan for a user.
 *
 * The function first looks for the user's most recent active subscription.
 * If no active subscription exists, it falls back to the default `free` plan.
 *
 * @param userId - The unique identifier of the user.
 * @returns A promise that resolves to the user's active plan. If no active
 * subscription is found, the default `free` plan is returned. Returns `null`
 * if neither an active plan nor the `free` plan exists in the database.
 */
export const getUserActivePlan = async (userId: string): Promise<ActivePlan | null> => {
  const client = getDB();

  const { rows } = await client.query<ActivePlan>(
    `
    SELECT sp.code, sp.tier, sp.features
    FROM user_subscriptions us
    JOIN subscription_plans sp ON sp.id = us.plan_id
    WHERE us.user_id = $1
      AND us.status = 'active'
    ORDER BY us.created_at DESC
    LIMIT 1
    `,
    [userId]
  );

  if (rows[0]) return rows[0];

  const { rows: freeRows } = await client.query<ActivePlan>(
    `SELECT code, tier, features FROM subscription_plans WHERE code = 'free' LIMIT 1`
  );

  return freeRows[0] ?? null;
};

const FEATURE_LIMIT_KEY: Record<FeatureType, keyof PlanFeatures> = {
  diagnosis: "diagnosis_scans",
  landscape: "landscape_gens",
};

/**
 * Checks whether a user has remaining usage for a feature and, if allowed,
 * atomically consumes one usage from their monthly quota.
 *
 * The user's active subscription plan is used to determine the feature limit.
 * Usage is tracked on a per-user, per-feature, per-month basis. The operation
 * is executed within a database transaction to prevent race conditions during
 * concurrent requests.
 *
 * @param userId - The unique identifier of the user.
 * @param featureType - The feature whose usage quota should be checked and consumed.
 * @returns A promise that resolves to a {@link UsageCheckResult} containing:
 * - `allowed`: Whether the usage request was permitted.
 * - `limit`: The monthly usage limit for the feature.
 * - `used`: The total number of usages after this operation.
 * - `remaining`: The number of usages remaining for the current month.
 *
 * @throws Rethrows any database error that occurs during the transaction.
 */
export const checkAndConsumeUsage = async (
  userId: string,
  featureType: FeatureType
): Promise<UsageCheckResult> => {
  const pool = getDB();
  const plan = await getUserActivePlan(userId);

  const limit = plan?.features?.[FEATURE_LIMIT_KEY[featureType]] as number | undefined;

  if (!plan || limit === undefined) {
    return { allowed: false, limit: 0, used: 0, remaining: 0 };
  }

  const period = new Date().toISOString().slice(0, 7); // "2026-07"

  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    const { rows } = await client.query<{ count: number }>(
      `
      SELECT count FROM feature_usage
      WHERE user_id = $1 AND feature_type = $2 AND period = $3
      FOR UPDATE
      `,
      [userId, featureType, period]
    );

    const currentCount = rows[0]?.count ?? 0;

    if (currentCount >= limit) {
      await client.query("ROLLBACK");
      return { allowed: false, limit, used: currentCount, remaining: 0 };
    }

    if (rows.length === 0) {
      await client.query(
        `INSERT INTO feature_usage (user_id, feature_type, period, count) VALUES ($1, $2, $3, 1)`,
        [userId, featureType, period]
      );
    } else {
      await client.query(
        `UPDATE feature_usage SET count = count + 1, updated_at = now()
         WHERE user_id = $1 AND feature_type = $2 AND period = $3`,
        [userId, featureType, period]
      );
    }

    await client.query("COMMIT");

    return { allowed: true, limit, used: currentCount + 1, remaining: limit - currentCount - 1 };
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }
};