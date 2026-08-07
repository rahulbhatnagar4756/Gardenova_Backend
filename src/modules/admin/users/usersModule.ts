import { getDB } from "../../../core/config/db";

export type AdminAccountStatus = "active" | "inactive";

export interface AdminUserListFilters {
  search?: string;
  tier?: string;
  accountStatus?: AdminAccountStatus;
  signupFrom?: string;
  signupTo?: string;
  subscriptionStatus?: string;
  page: number;
  limit: number;
}

export interface AdminUserListItem {
  id: string;
  name: string | null;
  email: string | null;
  phone_number: string | null;
  role: string | null;
  is_email_verified: boolean | null;
  is_phone_verified: boolean | null;
  account_status: AdminAccountStatus;
  created_at: Date;
  updated_at: Date | null;
  subscription: {
    status: string;
    plan_code: string;
    tier: string;
    billing_cycle: string | null;
    price_inr: number | null;
    current_period_start: Date | null;
    current_period_end: Date | null;
    cancel_at_period_end: boolean | null;
    pending_plan_code: string | null;
    pending_plan_tier: string | null;
    purchase_token: string | null;
    order_id: string | null;
    updated_at: Date | null;
  } | null;
  subscription_history: AdminSubscriptionHistoryItem[];
}

export interface AdminSubscriptionHistoryItem {
  id: string;
  product_id: string;
  base_plan_id: string | null;
  purchase_token: string;
  order_id: string | null;
  purchase_state: number | null;
  acknowledged: boolean;
  plan_code: string | null;
  tier: string | null;
  billing_cycle: string | null;
  price_inr: number | null;
  created_at: Date;
  updated_at: Date | null;
}

export interface AdminUserDetail extends AdminUserListItem {
  profile_picture: string | null;
  google_uid: string | null;
  apple_uid: string | null;
  facebook_uid: string | null;
}

/**
 * Lists users for the admin portal with search, filters, and per-user
 * subscription summary + purchase history for the current page.
 *
 * @param {AdminUserListFilters} filters - Pagination and filter options.
 * @returns {Promise<{ users: AdminUserListItem[]; total: number }>} Page of users and total count.
 */
export async function findAdminUsers(
  filters: AdminUserListFilters
): Promise<{ users: AdminUserListItem[]; total: number }> {
  const db = getDB();
  const values: unknown[] = [];
  const where: string[] = [`r.name IS DISTINCT FROM 'Admin'`];

  if (filters.search?.trim()) {
    values.push(`%${filters.search.trim().toLowerCase()}%`);
    const i = values.length;
    where.push(
      `(LOWER(u.email) LIKE $${i} OR LOWER(COALESCE(u.name, '')) LIKE $${i} OR COALESCE(u.phone_number, '') LIKE $${i})`
    );
  }

  if (filters.accountStatus === "active") {
    where.push(`COALESCE(u.isdeleted, false) = false`);
  } else if (filters.accountStatus === "inactive") {
    where.push(`COALESCE(u.isdeleted, false) = true`);
  }

  if (filters.signupFrom) {
    values.push(filters.signupFrom);
    where.push(`u.created_at >= $${values.length}::timestamptz`);
  }

  if (filters.signupTo) {
    values.push(filters.signupTo);
    where.push(`u.created_at <= $${values.length}::timestamptz`);
  }

  // Tier: users with no paid row count as free.
  if (filters.tier?.trim()) {
    values.push(filters.tier.trim().toLowerCase());
    where.push(`LOWER(COALESCE(sp.tier, 'free')) = $${values.length}`);
  }

  if (filters.subscriptionStatus?.trim()) {
    values.push(filters.subscriptionStatus.trim().toLowerCase());
    where.push(`LOWER(COALESCE(us.status, 'none')) = $${values.length}`);
  }

  const whereSql = where.length ? `WHERE ${where.join(" AND ")}` : "";

  const countResult = await db.query<{ count: string }>(
    `
    SELECT COUNT(*)::text AS count
    FROM users u
    LEFT JOIN roles r ON r.id = u.role_id
    LEFT JOIN user_subscriptions us ON us.user_id = u.id
    LEFT JOIN subscription_plans sp ON sp.id = us.plan_id
    ${whereSql}
    `,
    values
  );
  const total = Number(countResult.rows[0]?.count ?? 0);

  const limit = filters.limit;
  const offset = (filters.page - 1) * limit;
  values.push(limit);
  const limitIdx = values.length;
  values.push(offset);
  const offsetIdx = values.length;

  const { rows } = await db.query<{
    id: string;
    name: string | null;
    email: string | null;
    phone_number: string | null;
    role: string | null;
    is_email_verified: boolean | null;
    is_phone_verified: boolean | null;
    isdeleted: boolean | null;
    created_at: Date;
    updated_at: Date | null;
    sub_status: string | null;
    plan_code: string | null;
    plan_tier: string | null;
    billing_cycle: string | null;
    price_inr: number | null;
    current_period_start: Date | null;
    current_period_end: Date | null;
    cancel_at_period_end: boolean | null;
    pending_plan_code: string | null;
    pending_plan_tier: string | null;
    purchase_token: string | null;
    order_id: string | null;
    sub_updated_at: Date | null;
  }>(
    `
    SELECT
      u.id,
      u.name,
      u.email,
      u.phone_number,
      r.name AS role,
      u.is_email_verified,
      u.is_phone_verified,
      u.isdeleted,
      u.created_at,
      u.updated_at,
      us.status AS sub_status,
      COALESCE(sp.code, 'free') AS plan_code,
      COALESCE(sp.tier, 'free') AS plan_tier,
      sp.billing_cycle,
      sp.price_inr,
      us.current_period_start,
      us.current_period_end,
      us.cancel_at_period_end,
      psp.code AS pending_plan_code,
      psp.tier AS pending_plan_tier,
      us.purchase_token,
      us.order_id,
      us.updated_at AS sub_updated_at
    FROM users u
    LEFT JOIN roles r ON r.id = u.role_id
    LEFT JOIN user_subscriptions us ON us.user_id = u.id
    LEFT JOIN subscription_plans sp ON sp.id = us.plan_id
    LEFT JOIN subscription_plans psp ON psp.id = us.pending_plan_id
    ${whereSql}
    ORDER BY u.created_at DESC
    LIMIT $${limitIdx} OFFSET $${offsetIdx}
    `,
    values
  );

  const userIds = rows.map((r) => r.id);
  const historyByUser = await fetchPurchaseHistoryByUserIds(userIds);

  const users: AdminUserListItem[] = rows.map((r) => ({
    id: r.id,
    name: r.name,
    email: r.email,
    phone_number: r.phone_number,
    role: r.role,
    is_email_verified: r.is_email_verified,
    is_phone_verified: r.is_phone_verified,
    account_status: r.isdeleted ? "inactive" : "active",
    created_at: r.created_at,
    updated_at: r.updated_at,
    subscription: {
      status: r.sub_status ?? "none",
      plan_code: r.plan_code ?? "free",
      tier: r.plan_tier ?? "free",
      billing_cycle: r.billing_cycle,
      price_inr: r.price_inr,
      current_period_start: r.current_period_start,
      current_period_end: r.current_period_end,
      cancel_at_period_end: r.cancel_at_period_end,
      pending_plan_code: r.pending_plan_code,
      pending_plan_tier: r.pending_plan_tier,
      purchase_token: r.purchase_token,
      order_id: r.order_id,
      updated_at: r.sub_updated_at,
    },
    subscription_history: historyByUser.get(r.id) ?? [],
  }));

  return { users, total };
}

/**
 * Fetches one user with current subscription and full purchase history.
 *
 * @param {string} userId - Target user UUID.
 * @returns {Promise<AdminUserDetail | null>} User detail or null when missing.
 */
export async function findAdminUserById(
  userId: string
): Promise<AdminUserDetail | null> {
  const db = getDB();
  const { rows } = await db.query<{
    id: string;
    name: string | null;
    email: string | null;
    phone_number: string | null;
    role: string | null;
    is_email_verified: boolean | null;
    is_phone_verified: boolean | null;
    isdeleted: boolean | null;
    profile_picture: string | null;
    google_uid: string | null;
    apple_uid: string | null;
    facebook_uid: string | null;
    created_at: Date;
    updated_at: Date | null;
    sub_status: string | null;
    plan_code: string | null;
    plan_tier: string | null;
    billing_cycle: string | null;
    price_inr: number | null;
    current_period_start: Date | null;
    current_period_end: Date | null;
    cancel_at_period_end: boolean | null;
    pending_plan_code: string | null;
    pending_plan_tier: string | null;
    purchase_token: string | null;
    order_id: string | null;
    sub_updated_at: Date | null;
  }>(
    `
    SELECT
      u.id,
      u.name,
      u.email,
      u.phone_number,
      r.name AS role,
      u.is_email_verified,
      u.is_phone_verified,
      u.isdeleted,
      up.profile_image AS profile_picture,
      u.google_uid,
      u.apple_uid,
      u.facebook_uid,
      u.created_at,
      u.updated_at,
      us.status AS sub_status,
      COALESCE(sp.code, 'free') AS plan_code,
      COALESCE(sp.tier, 'free') AS plan_tier,
      sp.billing_cycle,
      sp.price_inr,
      us.current_period_start,
      us.current_period_end,
      us.cancel_at_period_end,
      psp.code AS pending_plan_code,
      psp.tier AS pending_plan_tier,
      us.purchase_token,
      us.order_id,
      us.updated_at AS sub_updated_at
    FROM users u
    LEFT JOIN roles r ON r.id = u.role_id
    LEFT JOIN userprofiles up ON up.user_id = u.id
    LEFT JOIN user_subscriptions us ON us.user_id = u.id
    LEFT JOIN subscription_plans sp ON sp.id = us.plan_id
    LEFT JOIN subscription_plans psp ON psp.id = us.pending_plan_id
    WHERE u.id = $1
    LIMIT 1
    `,
    [userId]
  );

  const r = rows[0];
  if (!r) return null;

  const historyByUser = await fetchPurchaseHistoryByUserIds([r.id]);

  return {
    id: r.id,
    name: r.name,
    email: r.email,
    phone_number: r.phone_number,
    role: r.role,
    is_email_verified: r.is_email_verified,
    is_phone_verified: r.is_phone_verified,
    account_status: r.isdeleted ? "inactive" : "active",
    profile_picture: r.profile_picture,
    google_uid: r.google_uid,
    apple_uid: r.apple_uid,
    facebook_uid: r.facebook_uid,
    created_at: r.created_at,
    updated_at: r.updated_at,
    subscription: {
      status: r.sub_status ?? "none",
      plan_code: r.plan_code ?? "free",
      tier: r.plan_tier ?? "free",
      billing_cycle: r.billing_cycle,
      price_inr: r.price_inr,
      current_period_start: r.current_period_start,
      current_period_end: r.current_period_end,
      cancel_at_period_end: r.cancel_at_period_end,
      pending_plan_code: r.pending_plan_code,
      pending_plan_tier: r.pending_plan_tier,
      purchase_token: r.purchase_token,
      order_id: r.order_id,
      updated_at: r.sub_updated_at,
    },
    subscription_history: historyByUser.get(r.id) ?? [],
  };
}

/**
 * Loads Google Play purchase rows for the given users, grouped by user id.
 *
 * @param {string[]} userIds - User UUIDs on the current page.
 * @returns {Promise<Map<string, AdminSubscriptionHistoryItem[]>>} History keyed by user id.
 */
async function fetchPurchaseHistoryByUserIds(
  userIds: string[]
): Promise<Map<string, AdminSubscriptionHistoryItem[]>> {
  const map = new Map<string, AdminSubscriptionHistoryItem[]>();
  if (!userIds.length) return map;

  const db = getDB();
  const { rows } = await db.query<
    AdminSubscriptionHistoryItem & { user_id: string }
  >(
    `
    SELECT
      g.id,
      g.user_id,
      g.product_id,
      g.base_plan_id,
      g.purchase_token,
      g.order_id,
      g.purchase_state,
      g.acknowledged,
      sp.code AS plan_code,
      sp.tier,
      sp.billing_cycle,
      sp.price_inr,
      g.created_at,
      g.updated_at
    FROM google_play_purchases g
    LEFT JOIN subscription_plans sp
      ON sp.google_product_id = g.product_id
     AND (
       g.base_plan_id IS NULL
       OR sp.google_base_plan_id = g.base_plan_id
     )
    WHERE g.user_id = ANY($1::uuid[])
    ORDER BY g.created_at DESC
    `,
    [userIds]
  );

  for (const row of rows) {
    const list = map.get(row.user_id) ?? [];
    list.push({
      id: row.id,
      product_id: row.product_id,
      base_plan_id: row.base_plan_id,
      purchase_token: row.purchase_token,
      order_id: row.order_id,
      purchase_state: row.purchase_state,
      acknowledged: row.acknowledged,
      plan_code: row.plan_code,
      tier: row.tier,
      billing_cycle: row.billing_cycle,
      price_inr: row.price_inr,
      created_at: row.created_at,
      updated_at: row.updated_at,
    });
    map.set(row.user_id, list);
  }

  return map;
}
