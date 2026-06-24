// Regulatory Output Engine — TDD §6.4, Claim 3.
//
// TDD §6.4 identifies this engine as "the strongest individual patent claim."
// Claim 3 names its six discrete steps:
//   1. Receive project site location (address or GPS).
//   2. Resolve city / county / state / federal jurisdictions + permitting authorities.
//   3. Classify required permit types from a taxonomy.
//   4. Map each permit type to its responsible issuing authority + contact info.
//   5. Generate a Regulatory Readiness Report identifying all permits, authorities,
//      timelines, and compliance flags.
//   6. Integrate permit timelines as constraint activities within the CPM schedule.
//
// Step 6 is realised in lib/npe/mock-call2.ts which already turns each permit
// trigger into a predecessor activity. This module covers steps 1-5 with real
// data and a deterministic resolver.

import type { PermitType } from "@/lib/enforcement/types";

// ── Jurisdiction stack (Claim 3 step 2) ──────────────────────────────────

export type JurisdictionLevel = "city" | "county" | "state" | "federal";

export interface Jurisdiction {
  level: JurisdictionLevel;
  name: string;                  // e.g. "City of Houston"
  /** Two-letter state code for state/county/city; "US" for federal. */
  stateCode: string;
  /** Optional zip range or specific zip codes covered. */
  zips?: string[];
}

/** State DOT variant identifier (TDD §6.4: "FDOT, NCDOT, TXDOT, etc.") */
export interface StateDot {
  stateCode: string;
  acronym: string;               // "TxDOT" / "FDOT" / "NCDOT"
  name: string;                  // "Texas Department of Transportation"
  contactPortal?: string;        // URL
}

/** Full jurisdictional stack for a project site. */
export interface JurisdictionStack {
  city: Jurisdiction;
  county: Jurisdiction;
  state: Jurisdiction;
  federal: Jurisdiction;
  dot: StateDot;
}

// ── Authority / AHJ contact (Claim 3 step 4) ─────────────────────────────

export interface Authority {
  /** Authority full name, e.g. "Houston Permitting Center". */
  name: string;
  /** Department / unit, e.g. "Public Works — ROW Section". */
  unit?: string;
  contactPortal?: string;
  contactEmail?: string;
  contactPhone?: string;
  /** Which level of government — drives display grouping. */
  level: JurisdictionLevel;
}

// ── Permit definition (Claim 3 step 3) ──────────────────────────────────

export interface PermitDefinition {
  type: PermitType;
  label: string;
  /** One-paragraph description of when this permit applies. */
  description: string;
  /** Average lead time in calendar days from submission to issuance. */
  leadTimeDays: number;
  /** Best-effort estimated application fee in cents. */
  estimatedFeeCents: number;
  /** Predicate names — descriptive labels of what triggered the requirement. */
  applicabilityRationale: string;
}

// ── Environmental flags (Claim 3 step 5) ─────────────────────────────────

export type EnvironmentalFlagKind =
  | "confined_space"
  | "va_federal"
  | "davis_bacon"
  | "nepa_review"
  | "asbestos_screening"
  | "historic_district"
  | "wetlands";

export const ENV_FLAG_LABEL: Record<EnvironmentalFlagKind, string> = {
  confined_space:    "Confined Space Entry Required",
  va_federal:        "VA Federal Project",
  davis_bacon:       "Davis-Bacon Prevailing Wage",
  nepa_review:       "NEPA Environmental Review",
  asbestos_screening: "Asbestos Screening Required",
  historic_district: "Historic District / Section 106",
  wetlands:          "Wetlands / Section 404",
};

export interface EnvironmentalFlag {
  kind: EnvironmentalFlagKind;
  /** Why this flag fired. */
  rationale: string;
  /** Whether construction can proceed before this flag is cleared. */
  blocksConstruction: boolean;
  /** Authority responsible, if applicable. */
  authority?: Authority;
}

// ── Permit requirement (joined view) ─────────────────────────────────────

/** A permit requirement specific to this project — combines definition + authority. */
export interface PermitRequirement {
  type: PermitType;
  definition: PermitDefinition;
  authority: Authority;
  /** Computed-for-this-project lead time (may differ from definition if location-specific). */
  leadTimeDays: number;
  estimatedFeeCents: number;
}

// ── The Regulatory Readiness Report (Claim 3 step 5) ─────────────────────

export interface RegulatoryReadinessReport {
  /** Project context echoed for the report header. */
  project: {
    id: string;
    number: string;
    name: string;
    addressLine1: string;
    city: string;
    state: string;
    zip: string;
  };
  generatedAt: string;
  jurisdictionStack: JurisdictionStack;
  permitRequirements: PermitRequirement[];
  environmentalFlags: EnvironmentalFlag[];
  /** Total estimated permit lead time on the critical path (max of all permit LT). */
  longestPermitLeadDays: number;
  /** Sum of all permit fees (cents). */
  totalEstimatedFeesCents: number;
  /** Free-text summary that would appear at the top of the PDF deliverable. */
  executiveSummary: string;
}

export interface RegulatoryResponse {
  ok: boolean;
  report?: RegulatoryReadinessReport;
  error?: { code: string; message: string };
}
