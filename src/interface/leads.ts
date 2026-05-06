/**
 * Type for lead status aggregate result
 */
export interface LeadStatusCount {
  leads_status: string;
  count: number;
}

/**
 * Type for lead trend line chart data
 */
export interface LeadTrendPoint {
  date: string;
  count: number;
}

export interface ILeadGrouped {
  lead_id: string;
  leads_status: string;
  user: {
    user_id: string;
    user_name: string;
    user_email: string;
  } | null; // allow null

  partners: {
    partner_id: string;
    company_name: string | null; // partner name may be null
  }[];
}

export interface ILead {
  id?: string;
  partnerIds?: string[];
  userId?: string;
  leadsStatus?: "new" | "converted" | "closed";
  isDeleted?: boolean;
  createdAt?: Date;
  updatedAt?: Date;
}
