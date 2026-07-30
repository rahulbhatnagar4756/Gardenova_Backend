export type BillingCycle = "monthly" | "yearly";

export type SubscriptionStatus =
  | "active"
  | "pending"
  | "paused"
  | "on_hold"
  | "in_grace"
  | "canceled"
  | "expired";

export interface PlanFeatures {
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
}

export interface SubscriptionPlan {
  id: string;
  code: string;
  tier: "free" | "starter" | "plus" | "pro";
  billing_cycle: BillingCycle | null;
  price_inr: number;
  google_product_id: string | null;
  google_base_plan_id: string | null;
  google_offer_id: string | null;
  features: PlanFeatures;
  is_active: boolean;
}

export type PlanChangeKind = "upgrade" | "downgrade" | "same";

/** Tier rank used for upgrade / downgrade decisions (matches plan list ordering). */
export const TIER_RANK: Record<SubscriptionPlan["tier"], number> = {
  free: 0,
  starter: 1,
  plus: 2,
  pro: 3,
};

/**
 * Compares two plans: higher tier wins; same tier uses price_inr.
 *
 * @param {Pick<SubscriptionPlan, "tier" | "price_inr">} current - Current entitlement plan.
 * @param {Pick<SubscriptionPlan, "tier" | "price_inr">} next - Newly purchased plan.
 * @returns {PlanChangeKind} upgrade | downgrade | same.
 */
export function comparePlanChange(
  current: Pick<SubscriptionPlan, "tier" | "price_inr">,
  next: Pick<SubscriptionPlan, "tier" | "price_inr">
): PlanChangeKind {
  const currentRank = TIER_RANK[current.tier] ?? 0;
  const nextRank = TIER_RANK[next.tier] ?? 0;
  if (nextRank > currentRank) return "upgrade";
  if (nextRank < currentRank) return "downgrade";

  const currentPrice = Number(current.price_inr) || 0;
  const nextPrice = Number(next.price_inr) || 0;
  if (nextPrice > currentPrice) return "upgrade";
  if (nextPrice < currentPrice) return "downgrade";
  return "same";
}

export interface UserSubscription {
  id: string;
  user_id: string;
  plan_id: string;
  status: SubscriptionStatus;
  purchase_token: string | null;
  order_id: string | null;
  linked_purchase_token: string | null;
  auto_renewing: boolean | null;
  acknowledged: boolean;
  current_period_start: Date | null;
  current_period_end: Date | null;
  cancel_at_period_end: boolean;
  pending_plan_id: string | null;
  raw_play_payload: unknown | null;
}

/** Body from Android BillingClient after a successful purchase. */
export interface VerifySubscriptionBody {
  purchaseToken: string;
  productId: string;
  basePlanId?: string;
  orderId?: string;
}

interface PlanFeatureDisplay {
  key: string;
  label: string;
  enabled: boolean;
}

interface PlanWithDetail {
  id: string;
  code: string;
  tier: "free" | "starter" | "plus" | "pro";
  billing_cycle: "monthly" | "yearly" | null;
  price_inr: number;
  google_product_id: string | null;
  google_base_plan_id: string | null;
  google_offer_id: string | null;
  features: PlanFeatureDisplay[];
}

export interface GetAllPlansWithDetailResponse {
  success: boolean;
  data?: PlanWithDetail[];
  message?: string;
}
