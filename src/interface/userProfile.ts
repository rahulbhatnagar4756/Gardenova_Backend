// Interface for flattened full user profile response
export interface IFullUserProfile {
  name: string | null;
  email: string | null;
  contactNumber: string | null;
  is_email_verified: boolean; // ✅ added is_email_verified to the full profile interface
  is_phone_verified: boolean; // ✅ added is_phone_verified to the full profile interface
  profileImage: string | null;
  is_sso_user: boolean; // ✅ added is_sso_user to indicate if the user is an SSO user
  dateOfBirth: Date | string | null | undefined;
  gender: "male" | "female" | "other" | null;
  bio: string | null;
  address: {
    street: string | null;
    city: string | null;
    state: string | null;
    country: string | null;
    zipCode: string | null;
  };
  occupation: string | null;
  company: string | null;
  responseId?: string | null; // ✅ added responseId to the full profile interface
  subscription: {
    planId: string | null;
    planName: string | null;
    status: string | null;
    startedAt: string | null;
    expiresAt: string | null;
  } | null;
}

export interface IUserProfile {
  id?: string;
  userId: string;
  profile_image?: string | null;
  dateOfBirth?: string | Date | null;
  gender?: "male" | "female" | "other" | "";
  bio?: string | null;
  street?: string | null;
  city?: string | null;
  state?: string | null;
  country?: string | null;
  zipCode?: string | null;
  occupation?: string | null;
  company?: string | null;
  createdAt?: Date;
  updatedAt?: Date;
}



// ─── Raw DB row from userprofiles table ──────────────────────────────────────
export interface IUserProfileRow {
  profile_image: string | null;
  date_of_birth: string | null;
  gender: "male" | "female" | "other" | null;
  bio: string | null;
  street: string | null;
  city: string | null;
  state: string | null;
  country: string | null;
  zip_code: string | null;
  occupation: string | null;
  company: string | null;
}

// ─── Raw DB row from external_links table ────────────────────────────────────
export interface IExternalLink {
  id: string;
  title: string;
  url: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}
// ─── Final API response wrapper ───────────────────────────────────────────────
export interface IProfileResponse {
  profile: IFullUserProfile;
  externalLinks: {
    [key: string]: {
      url: string | null;
      isActive: boolean;
    };
  };
}