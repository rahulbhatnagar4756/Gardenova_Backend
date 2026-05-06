import { JwtPayload } from "jsonwebtoken";
import { Request } from "express";

export interface csvUser {
  // ── Identity ──────────────────────────────────────────────
  /** Legal or trade name of the business. */
  business_name?: string;

  /** Geographic region or neighborhood (e.g. "Downtown", "Zona Sul"). */
  legal_name?: string;

  cnpj?: string;  

  /** Primary contact email. Required — used as a unique identifier during import. */
  email?: string;

  phone?: string;
  // ── Classification ────────────────────────────────────────
  /** Business category (e.g. "Electrician", "Plumber"). */
  category?: string;

  /** Short description of the professional or service offered. */
  // description?: string;

  address?: string;

  // ── Location ──────────────────────────────────────────────
 neighborhood?: string;

 city?: string;
  state?: string;
 zip_code?: string;

 subscription_plan?: string;

 trial_expires?: string;


 is_verified  ?: boolean;


 is_active  ?: boolean; 

 source ?: string;

 created_at?: string;

 
  /**
   * Decimal latitude (-90 to 90).
   * Must be a finite number; NaN / Infinity are not valid.
   */
  latitude?: number;

  /**
   * Decimal longitude (-180 to 180).
   * Must be a finite number; NaN / Infinity are not valid.
   */
  longitude?: number;

  // ── Contact ───────────────────────────────────────────────

  /** WhatsApp-enabled number. */
  whatsapp?: string;

  /** Full URL including protocol, e.g. "https://example.com". */
  website?: string;

  /** Instagram handle without "@", e.g. "mybusiness". */
  
  // ── Ratings ───────────────────────────────────────────────
  /**
   * Aggregate rating score (0.00 – 5.00).
   * Stored as NUMERIC(3,2) in the DB — values outside this range will fail insertion.
   */
  
  /** Total number of ratings received. Must be a non-negative integer. */
  

  /** Source that verified this profile (e.g. "Google", "Manual"). */
  

  // ── Import Metadata ───────────────────────────────────────
  /**
   * 1-based row number from the source CSV.
   * Never persisted to the DB — used only for error reporting during import.
   */
  __rowNumber?: number;
}


export interface responseProfessional  extends csvUser {
  id: string;
  created_at: string;
  updated_at: string;
}
// Extend Express Request to include user
export interface AuthRequest extends Request {
  user?: JwtPayload | string | unknown;
  professional?: csvUser[];
}

export interface AuthTokenPayload extends JwtPayload {
  userId: string;
  userEmail: string;
  role: string;
}

export interface AuthUserPayload {
  userEmail?: string;
  role?: string;
}
export interface AppleJwtPayload {
  sub: string;
  email?: string;
  email_verified?: string;
  auth_time?: number;
  nonce?: string;
  nonce_supported?: boolean;
  c_hash?: string;
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

export type RateLimitErrorResponse = {
  code: string;
  statusCode: number;
  message: string;
  details: {
    retryAfterSeconds: number;
    retryAfterMinutes: number;
    retryAt: string;
    remainingPoints: number;
    consumedPoints: number;
  };
};