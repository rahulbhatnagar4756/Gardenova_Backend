// Interface for flattened full user profile response
export interface IFullUserProfile {
  name: string | null;
  email: string | null;
  contactNumber: string | null;
  profileImage: string | null;
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

// ─── Used when creating/updating a profile (camelCase, app-side) ─────────────
// export interface IUserProfile {
//   id?: string;
//   userId: string;
//   profileImage?: string | null;
//   dateOfBirth?: string |Date | null;       // ✅ removed Date union — always string from DB
//   gender?: "male" | "female" | "other" | "";  // ✅ removed "" — use null instead
//   bio?: string | null;
//   street?: string | null;
//   city?: string | null;
//   state?: string | null;
//   country?: string | null;
//   zipCode?: string | null;
//   occupation?: string | null;
//   company?: string | null;
//   createdAt?: string;                // ✅ string not Date — consistent with DB output
//   updatedAt?: string;
// }

// // ─── Final API response shape ─────────────────────────────────────────────────
// export interface IFullUserProfile {
//   name: string | null;
//   email: string | null;
//   contactNumber: string | null;
//   profileImage: string | null;
//   dateOfBirth: string | null;        // ✅ removed Date | undefined — always string or null
//   gender: "male" | "female" | "other" | null;
//   bio: string | null;
//   address: {
//     street: string | null;
//     city: string | null;
//     state: string | null;
//     country: string | null;
//     zipCode: string | null;
//   };
//   occupation: string | null;
//   company: string | null;
// }

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