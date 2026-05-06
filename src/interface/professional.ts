export interface RegistrationResult {
    rowNumber: number;
    success: boolean;
    email: string;
    name: string;
    userId?: string;
    emailSent?: boolean;
    emailError?: string;
    error?: string;
}

export interface ServiceResult {
    total: number;
    successful: number;
    failed: number;
    emailsSent: number;
    emailsFailed: number;
    results: RegistrationResult[];
}

export interface ProfessionalProfileResponse {
    id: string;
    companyName: string | null;
    email: string | null;
    category: string | null;
    description: string | null;

    location: {
        city: string | null;
        state: string | null;
        address: string | null;
        latitude: number | null;
        longitude: number | null;
    };

    contact: {
        telefone: string | null;
        whatsapp: string | null;
        website: string | null;
        instagram: string | null;
    };

    ratings: {
        assessment: number | null;
        numAvaliacoes: number;
    };

    verifiedSource: string | null;
    createdAt: Date;
    updatedAt: Date;
}



export type InsertResult = {
    inserted: number;
    failed: number;
};




export interface GetProfessionalsParams {
  userId: string | null; // ✅ to personalize results based on user's profile and history
  userLat: number;
  userLng: number;
  category?: string |undefined;
  limit: number;
  offset: number;
}

export interface ProfessionalResult {
  id: string;
  userid: string; // ✅ return userID for frontend to fetch profile details
  company_name: string;
  category: string;
  city: string;
  state: string;
  address: string;
  contact: {
    telefone: string;
    whatsapp: string;
    website: string;
    instagram: string;
  };
  rating: number;
  num_avaliacoes: number;
  verified_source: string;
  subscription: {
    plan_name: string;
    highlight_in_result: boolean;
    verification_badge: boolean;
  };
  distance_km: number;
}
export interface GetProfessionalsResponse {
  total: number;
  limit: number;
  offset: number;
  user_location: { lat: number; lng: number };
  data: ProfessionalResult[];
}



export interface professionalProfileResponse{
    name: string;
    email: string;
    profileImage: string | null;
    subscriptionPlan: string;
    accountStatus: string;
    endDate: Date | null;
    startDate: Date | null;
    address: {
        city: string | null;
        state: string | null;
        street: string | null;
    };
    phone: string | null;
    category: string | null;
    description: string | null;
}



export interface Location {
    city: string | null;
    state: string | null;
    address: string | null;
    latitude: number | null;
    longitude: number | null;
}

export interface RequestingUser {
    userId: string;
    professionalProfileId: string | null;
    description: string | null;
    category: string | null;
    size: string | null;
}

export interface ProfessionalPartner {
    leads_status: string | null;
    lead_id:string | null;  // ✅ from leads_schema
    userId: string;
    role: "professional";
    company_name: string | null;
    location: Location;
    telefone: string | null;
    whatsapp: string | null;
    website: string | null;
    email: string | null;
    // instagram: string | null;
    requestingUser: RequestingUser;
    created_at: string | null;
}

export interface UserPartner {
    leads_status: string | null;
    lead_id:string | null;  // ✅ from leads_schema
    userId: string;
    role: "user";
    location: Location;
    name: string | null;
    email: string | null;
    phone_number: string | null;
    requestingUser: RequestingUser;
    created_at: string | null;
}

export type PartnerProfile = ProfessionalPartner | UserPartner;




export interface ILeadItem {
  lead_id: string;
  leads_status: string;
  quoter_id: string;
  quoter_name: string;
  quoter_email: string;
  partner_id: string;
  partner_display_name: string | null;
  partner_image_url: string | null;
  partner_speciality: string | null;
  partner_address: string | null;
  partner_city: string | null;
  partner_state: string | null;
}

export interface ILeadsPaginated {
  leads: ILeadItem[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export interface AdminProfessionalProfileResponse {
    id: number;
    userId: number | null;

    companyName: string | null;
    legal_name: string | null;
    cnpj: string | null;
    ratings: string | null;
    category: string | null;
    description: string | null;
    phone: string | null;
    whatsapp: string | null;
    email: string | null;
    website: string | null;

    location: {
        city: string | null;
        state: string | null;
        address: string | null;
        neighborhood: string | null;
        zip_code: string | null;
    };

    contact:{
        telefone: string | null;
        whatsapp: string | null;      
    }

    subscription_plan: string | null;
    trial_expires: string | null; // or Date if you convert it

    is_verified: boolean;
    is_active: boolean;

    source: string | null;

    latitude: string | null;
    longitude: string | null;

    created_at: string; // since you're casting to varchar
    updated_at: string;
}