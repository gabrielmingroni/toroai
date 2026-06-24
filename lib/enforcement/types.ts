// Post-processing enforcement domain — the four deterministic modules
// described in the ToroAI TDD §5.5 that run AFTER the two-call Claude
// reasoning step and BEFORE the RCDD review gate.
//
// These modules are the Alice Corp. v. CLS Bank Step 2B "inventive concept"
// per TDD §10:
//   "The inventive concept is the combination of:
//      (1) telecom-domain-specific NER classification,
//      (2) a two-call AI architecture that sequences BOM/labor generation
//          before schedule generation,
//      (3) post-processing enforcement functions that hardcode domain
//          standards (Davis-Bacon, connector specs, production rates), and
//      (4) simultaneous five-lane parallel output generation from a single
//          document upload.
//    No prior art system combines these elements."
//
// Each module takes the raw Call-1 / Call-2 outputs from the Claude reasoning
// layer and returns a structured before/after diff describing what was
// corrected, with citations to the underlying standards.

import type {
  ConnectorSpec, FederalAgency, ProjectExhibit,
} from "@/lib/projects/types";

// ── Mock Call-1 / Call-2 outputs from Claude reasoning (TDD §5.5) ────────

/** One BOM line item produced by Call 1. */
export interface BomLineItem {
  id: string;
  description: string;
  /** Material category — used by enforcement modules to filter. */
  category: "fiber_cable" | "connector" | "patch_panel" | "innerduct" | "conduit"
          | "splice_tray" | "labor" | "test_equipment" | "misc";
  quantity: number;
  unit: "LF" | "EA" | "ROLL" | "REEL" | "HR";
  unitCostCents: number;
  /** Fiber/connector spec where applicable. Drives LC/UPC enforcement. */
  connectorSpec?: ConnectorSpec;
}

/** One labor task produced by Call 1. */
export interface LaborTask {
  id: string;
  description: string;
  /** Davis-Bacon labor classification — keys into the prevailing wage table. */
  classification: string;
  /** Crew composition — informs production rate validation. */
  crewSize: number;
  /** Hours of labor at the proposed rate. */
  hours: number;
  /** AI-proposed hourly rate. Davis-Bacon enforcement may override. */
  proposedRateUsdHr: number;
  /** For pulling operations only — proposed LF/day production rate. */
  proposedLfPerDay?: number;
  /** Total LF being installed (cross-checks with production rate). */
  totalLf?: number;
}

/**
 * Synthesized Call-1 output for a project — what the two-call Claude
 * architecture (TDD §5.5) would produce before enforcement runs.
 */
export interface NpeCall1Output {
  projectId: string;
  bomLineItems: BomLineItem[];
  laborTasks: LaborTask[];
  /** Raw permit candidates pulled from the design — split by permit-triggers
   *  enforcement into a structured taxonomy. */
  permitCandidates: string[];
}

// ── Davis-Bacon enforcement (TDD §5.5 + §6.3) ────────────────────────────

/** One row of the prevailing wage table. */
export interface PrevailingWage {
  classification: string;
  baseRateUsdHr: number;
  fringeUsdHr: number;
  /** SCA wage determination identifier. */
  wageDecisionId: string;
  jurisdiction: string;
}

export interface DavisBaconViolation {
  taskId: string;
  taskDescription: string;
  classification: string;
  proposedRateUsdHr: number;
  prevailingRateUsdHr: number;   // base + fringe
  deltaUsdHr: number;             // prevailing - proposed
  /** Total dollar correction across the task (hours × delta). */
  correctionCents: number;
  wageDecisionId: string;
}

export interface DavisBaconResult {
  applies: boolean;
  reason: string;
  jurisdiction: string;
  wageTable: PrevailingWage[];
  violations: DavisBaconViolation[];
  /** Sum of correctionCents across all violations. */
  totalCorrectionCents: number;
  originalLaborCostCents: number;
  correctedLaborCostCents: number;
}

// ── LC/UPC connector enforcement (TDD §5.5) ──────────────────────────────

export interface LcUpcViolation {
  lineItemId: string;
  description: string;
  proposedSpec: ConnectorSpec;
  correctedSpec: ConnectorSpec;   // always "LC_UPC"
}

export interface LcUpcResult {
  /** Hard-coded standard — LC/UPC mandatory; LC/APC explicitly prohibited. */
  rule: "LC/UPC mandatory; LC/APC prohibited per TDD §5.5";
  violations: LcUpcViolation[];
  totalCorrected: number;
  totalLineItemsScanned: number;
}

// ── Production rate validation (TDD §5.5 + §6.5) ─────────────────────────

export interface ProductionRateViolation {
  taskId: string;
  taskDescription: string;
  crewSize: number;
  proposedLfPerDay: number;
  clampedLfPerDay: number;
  envelope: { minLfPerDay: number; maxLfPerDay: number };
  /** "below_envelope" if proposed < min, "above_envelope" if > max. */
  direction: "below_envelope" | "above_envelope";
}

export interface ProductionRateResult {
  /** Hard-coded envelope per TDD §6.5: 3,500–5,280 LF/day for 5-man OSP crew. */
  envelope: { minLfPerDay: 3500; maxLfPerDay: 5280 };
  /** Expected crew composition for the envelope to apply. */
  crewComposition: "1 Supervisor + 2 Journeymen + 2 Fiber Techs";
  violations: ProductionRateViolation[];
}

// ── Permit trigger extraction (TDD §5.5 + §6.4) ──────────────────────────

/** Permit type taxonomy — extracted from raw candidates. */
export type PermitType =
  | "row_encroachment"
  | "excavation_trench"
  | "directional_bore"
  | "aerial_attachment"
  | "building"
  | "low_voltage_contractor"
  | "confined_space"
  | "federal_project"
  | "davis_bacon";

export const PERMIT_TYPE_LABEL: Record<PermitType, string> = {
  row_encroachment:       "ROW Encroachment",
  excavation_trench:      "Excavation / Trench",
  directional_bore:       "Directional Bore",
  aerial_attachment:      "Aerial Pole Attachment",
  building:               "Building Permit",
  low_voltage_contractor: "Low-Voltage Contractor License",
  confined_space:         "Confined Space Entry",
  federal_project:        "Federal Project Approval",
  davis_bacon:            "Davis-Bacon Wage Determination",
};

export interface PermitTrigger {
  type: PermitType;
  /** What in the design or the project context triggered this. */
  triggerSource: string;
  /** Which AHJ / portal is responsible. */
  authority: string;
  /** Best-effort lead time in calendar days. */
  estimatedLeadTimeDays: number;
}

export interface PermitTriggerResult {
  /** Total raw candidates scanned. */
  totalCandidates: number;
  /** Permit triggers split from design_summary.json per TDD §5.5. */
  triggers: PermitTrigger[];
  /** Anything we couldn't taxonomize — surfaced for human review. */
  unresolved: string[];
}

// ── Bundle returned by runAllEnforcement ─────────────────────────────────

export interface EnforcementBundle {
  projectId: string;
  ranAt: string;
  davisBacon: DavisBaconResult;
  lcUpc: LcUpcResult;
  productionRate: ProductionRateResult;
  permitTriggers: PermitTriggerResult;
}

export interface EnforcementResponse {
  ok: boolean;
  bundle?: EnforcementBundle;
  /** The synthesized Call-1 output used as input — exposed so the UI can
   *  show the "before" side of the before/after diff. */
  call1Input?: NpeCall1Output;
  /** Project context used by Davis-Bacon (federalAgency, jurisdiction). */
  projectContext?: {
    federalAgency?: FederalAgency;
    davisBaconApplies: boolean;
    jurisdiction: string;
    exhibit?: ProjectExhibit;
  };
  error?: { code: string; message: string };
}
