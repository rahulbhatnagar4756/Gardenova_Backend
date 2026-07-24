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
