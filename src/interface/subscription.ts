export interface PlanWithDetails {
    plan_id: string;

    name: string;

    tier: 'free' | 'starter' | 'plus' | 'pro';

    price: number;
    // price_yearly: number;
    billing_period: 'monthly' | 'yearly';

    plan_status: boolean;
    razorpay_id: string;

    limit_id: string;

    scans_per_month: number;
    landscape_gens_per_month: number;
    max_saved_plants: number;

    care_reminders: boolean;
    ad_free: boolean;
    ai_care_assistant: boolean;
    hd_renders: boolean;
    priority_support: boolean;
    pdf_export: boolean;
    priority_generation: boolean;
    premium_styles: boolean;
    before_after_downloads: boolean;
}

// export interface GetAllPlansWithDetailResponse {
//     success: boolean;
//     data?: PlanWithDetails[];
//     message?: string;
// }

// ─── plans table fields ────────────────────────────────────
export interface PlanFields {
  name             : string;
  tier             : 'free' | 'starter' | 'plus' | 'pro';
  price_monthly    : number;
  price_yearly     : number;
  is_active        : boolean;
}

// ─── plan_limits table fields ──────────────────────────────
export interface PlanLimitFields {
  scans_per_month          : number;
  landscape_gens_per_month : number;
  max_saved_plants         : number;
  care_reminders           : boolean;
  ad_free                  : boolean;
  ai_care_assistant        : boolean;
  hd_renders               : boolean;
  priority_support         : boolean;
  pdf_export               : boolean;
  priority_generation      : boolean;
  premium_styles           : boolean;
  before_after_downloads   : boolean;
}

// ─── combined update payload ───────────────────────────────
export type UpdatePlanPayload = Partial<PlanFields> & Partial<PlanLimitFields>;

// ─── service response ──────────────────────────────────────
export interface ServiceResponse {
  success : boolean;
  message : string;
}



export interface RazorpayOrder {
  id: string;
  entity: string;
  amount: number;
  amount_paid: number;
  amount_due: number;
  currency: string;
  receipt: string;
  status: "created" | "attempted" | "paid";
  attempts: number;
  notes: {
    userId?: string;
    planId?: string;
    billing_period?: string;
  };
  created_at: number;
}

export interface PlanFeature {
    key: string;
    label: string;
    value?: number;
    enabled?: boolean;
}

export interface SubscriptionPlan {
    id: string;
    name: string;
    tier: string;
    billing_period: "monthly" | "yearly";
    product_id: string | null;
    price: string;
    currency: string;
    features: PlanFeature[];
}

export interface GetAllPlansWithDetailResponse {
    success: boolean;
    message?: string;
    data?: SubscriptionPlan[];
}

export interface VerifyPurchaseBody {
  purchaseToken: string;
  productId: string;
  packageName: string;
}