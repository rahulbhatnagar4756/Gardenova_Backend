/**
 * User entity interface matching PostgreSQL table
 */
export interface IUser {
  id?: string;
  name: string;
  email: string;
  password?: string;
  google_uid?: string;
  role_id: string;
  phone_number?: string;
  is_email_verified?: boolean;
  profile_picture?: string;
  password_reset_token?: string | null;
  password_reset_expires?: Date | null;
  isdeleted?: boolean;
  created_at?: Date;
  updated_at?: Date;
}

export interface IRole {
  id?: string;
  name: string;
  description?: string | null;
  created_at?: string;
  updated_at?: string;
}

export interface AuthUserPayload {
  userEmail?: string;
  role?: string;
}

export interface IUserOAuth {
  id: string;
  name: string;
  email: string;
  role_id: string;
  is_email_verified: boolean;
}


export interface FacebookIdTokenPayload {
  iss: string;
  aud: string;
  sub: string;
  email?: string;
  name?: string;
  given_name?: string;
  family_name?: string;
  picture?: string;
  exp: number;
  iat: number;
}

export interface FacebookUser {
  id: string;
  email?: string;
  name?: string;
  picture?: string;
}
