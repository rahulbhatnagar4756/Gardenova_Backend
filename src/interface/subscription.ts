export interface SubscriptionPlanInput {
  plan_name: string;
  description: string;
  price_monthly: number;
  price_annual: number;
  leads_limit: number | null; // null means unlimited
  cities_coverage: number;
  appear_in_search: boolean;
  premium_profile_badge: boolean;
  priority_customer_support: boolean;
  status: "active" | "inactive";
}


export interface ISubscriptionPlan {
  id: string;
  plan_name: string;
  description: string;
  price_monthly: number;
  price_annual: number;
  leads_limit: number | null; // null means unlimited
  cities_coverage: number;
  appear_in_search: boolean;
  premium_profile_badge: boolean;
  priority_customer_support: boolean;
  status: "active" | "inactive";
  created_at: Date;
  updated_at: Date;
}