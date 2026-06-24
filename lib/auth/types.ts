// Auth domain types. These will be replaced by openapi-typescript output once
// the FastAPI side is online. Until then, frontend + mock backend share this file.

export type AuthRole = "rcdd" | "designer" | "admin" | "viewer";

export interface AuthUser {
  id: string;
  email: string;
  firstName: string;
  lastName: string;

  // RCDD credentials
  rcddNumber: string | null;
  rcddState: string | null;
  rcddExpiry: string | null; // ISO date
  role: AuthRole;

  // Firm / branding
  firmName: string | null;
  firmAddress: string | null;
  firmCity: string | null;
  firmState: string | null;
  whiteLabel: boolean;

  // Tier (Stripe)
  tier: "free" | "starter" | "pro" | "rcdd" | "enterprise";
  designsUsedThisMonth: number;
  designsLimit: number;

  // Status
  emailVerified: boolean;
  createdAt: string;
}

export interface LoginRequest {
  email: string;
  password: string;
  remember?: boolean;
}

export interface SignupRequest {
  email: string;
  password: string;
  firstName: string;
  lastName: string;
  role: AuthRole;
  rcddNumber?: string;
  rcddState?: string;
  firmName?: string;
  tier?: AuthUser["tier"];
}

export interface ForgotPasswordRequest { email: string; }
export interface ResetPasswordRequest { token: string; newPassword: string; }

export interface AuthError {
  code: string;
  message: string;
  field?: string;
}

export interface AuthResponse {
  ok: boolean;
  user?: AuthUser;
  error?: AuthError;
}
