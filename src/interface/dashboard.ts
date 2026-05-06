export interface DashboardData {
  total_leads: {
    count: number;
    today: number;
    message: string;
  };
  active_professionals: {
    count: number;
    today: number;
    message: string;
  };
  closed_leads: {
    total: number;
    this_month: number;
    message: string;
  };
  lead_status_counts: Array<{
    leads_status: string;
    count: number;
  }>;
  lead_trend: {
    all_leads: LeadTrendPoint[];
    new_leads: LeadTrendPoint[];
    closed_leads: LeadTrendPoint[];
    contacted_leads: LeadTrendPoint[];
  };
}

export interface LeadTrendPoint {
  date: string;
  count: number;
}
