export type BillingCycle = "monthly" | "yearly";
export type SubscriptionStatus =
  | "active"
  | "pending"
  | "paused"
  | "halted"
  | "cancelled"
  | "expired";

export interface PlanFeatures {
  diagnosis_scans: number | null; // null = unlimited
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
  razorpay_plan_id: string | null;
  features: PlanFeatures;
  is_active: boolean;
}

export interface UserSubscription {
  id: string;
  user_id: string;
  plan_id: string;
  razorpay_subscription_id: string | null;
  razorpay_customer_id: string | null;
  status: SubscriptionStatus;
  current_period_start: Date | null;
  current_period_end: Date | null;
  cancel_at_period_end: boolean;
}

export interface CreateSubscriptionBody {
  planCode: string;
}

export interface VerifySubscriptionBody {
  razorpay_payment_id: string;
  razorpay_subscription_id: string;
  razorpay_signature: string;
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
  razorpay_plan_id: string | null;
  features: PlanFeatureDisplay[];
}

export interface GetAllPlansWithDetailResponse {
  success: boolean;
  data?: PlanWithDetail[];
  message?: string;
}