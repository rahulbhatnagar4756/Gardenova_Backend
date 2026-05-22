export interface PlanWithDetails {
    plan_id: string;

    name: string;

    tier: 'free' | 'starter' | 'plus' | 'pro';

    price_monthly: number;
    price_yearly: number;

    plan_status: boolean;

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

export interface GetAllPlansWithDetailResponse {
    success: boolean;
    data?: PlanWithDetails[];
    message?: string;
}

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