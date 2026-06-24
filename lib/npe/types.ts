// Neural Parsal Engine reasoning layer — TDD §5.5 two-call architecture.
//
// Call 1 takes the Layer-3 entity dictionary + full_text and produces the
// BOM line items + Labor SOV under the 13 engineering rules.
//
// Call 2 takes Call 1's output (with optional enforcement corrections) and
// produces the CPM schedule + Primavera P6 XML.
//
// The architecture must always sequence Call 1 BEFORE Call 2 — this is the
// patent claim's structural requirement per Claim 2 (TDD §8.2):
//   "generating a critical path schedule with Primavera P6 export in a
//    second AI reasoning call using outputs of the first call."

import type { Project } from "@/lib/projects/types";
import type { BomLineItem, LaborTask, NpeCall1Output, EnforcementBundle } from "@/lib/enforcement/types";

// ── Layer 3 entity classification output (TDD §5.4) ──────────────────────

/** The 10 telecom-domain entity categories per TDD §5.4. */
export type TelecomEntityCategory =
  | "fiber_type"
  | "conduit_ref"
  | "cable_count"
  | "distance_ref"
  | "code_reference"
  | "jurisdiction"
  | "permit_keywords"
  | "equipment_ref"
  | "splice_ref"
  | "power_ref";

export const TELECOM_ENTITY_LABEL: Record<TelecomEntityCategory, string> = {
  fiber_type:      "Fiber type",
  conduit_ref:     "Conduit reference",
  cable_count:     "Cable count",
  distance_ref:    "Distance reference",
  code_reference:  "Code reference",
  jurisdiction:    "Jurisdiction",
  permit_keywords: "Permit keywords",
  equipment_ref:   "Equipment reference",
  splice_ref:      "Splice reference",
  power_ref:       "Power reference",
};

/** One classified entity from Layer 3. */
export interface TelecomEntity {
  category: TelecomEntityCategory;
  text: string;
  /** Page or line number in the source document (best-effort). */
  source?: string;
  /** Classifier confidence 0..1. */
  confidence: number;
}

/** Entity dictionary — grouped by category for downstream consumers. */
export type EntityDict = Record<TelecomEntityCategory, TelecomEntity[]>;

// ── Call 1 — BOM + Labor SOV generation ──────────────────────────────────

export interface Call1Input {
  /** Concatenated extracted text from Layer 2 (PyMuPDF / Tesseract / ezdxf). */
  fullText: string;
  /** Layer 3 telecom-domain entity classification. */
  entityDict: EntityDict;
  /** Project context — Davis-Bacon applicability, jurisdiction, sector, etc. */
  project: Pick<Project, "id" | "number" | "name" | "city" | "state" | "sector" | "exhibit">;
}

/** Trace of which engineering rule (1-13) fired against which line item / task. */
export interface RuleApplication {
  ruleNumber: number;
  ruleName: string;
  appliedTo: { kind: "bom" | "labor"; id: string }[];
  note?: string;
}

/** Call 1 produces NpeCall1Output (re-exported from enforcement) + a rule trace. */
export interface Call1Output extends NpeCall1Output {
  /** Per-rule trace — what fired and where, for audit + patent enablement. */
  ruleApplications: RuleApplication[];
  /** Token estimate (real Claude call would return this from the API). */
  estimatedTokens: { input: number; output: number };
}

// ── Call 2 — Critical Path Schedule generation ───────────────────────────

export type ActivityKind =
  | "permit_window"       // permit lead-time placeholder
  | "mobilization"
  | "conduit_prep"
  | "cable_pull"
  | "splicing"
  | "testing"
  | "ahj_inspection"
  | "closeout"
  | "milestone";

export interface CpmActivity {
  id: string;                  // P6 activity ID, e.g. "A1010"
  name: string;
  kind: ActivityKind;
  /** Calendar duration in days. Zero for milestones. */
  durationDays: number;
  /** Predecessor activity IDs (finish-to-start). */
  predecessors: string[];
  /** Forward-pass: earliest start day relative to project day 0. */
  earlyStart: number;
  earlyFinish: number;
  /** Backward-pass: latest start/finish without delaying project completion. */
  lateStart: number;
  lateFinish: number;
  /** Total float = lateStart − earlyStart (slack). */
  totalFloat: number;
  /** Free float — slack without delaying any successor. */
  freeFloat: number;
  /** Resource — used in P6 export. */
  resource?: string;
  /** ID of the LaborTask this activity came from, where applicable. */
  laborTaskId?: string;
}

export interface Milestone {
  id: string;
  name: string;
  /** Project-day index when the milestone is reached. */
  dayIndex: number;
  /** What gates this milestone — predecessor activity ID. */
  gatingActivityId: string;
}

export interface Call2Input {
  bomLineItems: BomLineItem[];
  laborTasks: LaborTask[];
  /** Enforcement corrections that must be respected by the schedule. */
  enforcement?: EnforcementBundle;
  /** Project context. */
  project: Pick<Project, "id" | "number" | "name" | "occupancyDate" | "exhibit">;
}

export interface Call2Output {
  /** All activities including milestones (with kind="milestone"). */
  cpmActivities: CpmActivity[];
  milestones: Milestone[];
  /** Activity IDs on the critical path (totalFloat === 0). */
  criticalPath: string[];
  /** Total schedule length in calendar days. */
  totalDurationDays: number;
  /** Primavera P6 XML import file (string). */
  primaveraP6Xml: string;
  /** Estimated tokens (mock; would be real for live API). */
  estimatedTokens: { input: number; output: number };
}

// ── Orchestrator bundle ──────────────────────────────────────────────────

export interface TwoCallBundle {
  projectId: string;
  ranAt: string;
  call1Input:  Call1Input;
  call1Output: Call1Output;
  call2Input:  Call2Input;
  call2Output: Call2Output;
  /** Time elapsed between Call 1 invoke and Call 2 finish, in ms. */
  elapsedMs: number;
  /** Implementation strategy used — for patent enablement clarity. */
  strategy: "deterministic_mock" | "live_anthropic_api";
}

export interface NpeResponse {
  ok: boolean;
  bundle?: TwoCallBundle;
  error?: { code: string; message: string };
}

// Re-export shared types so consumers can import from a single path.
export type { BomLineItem, LaborTask, NpeCall1Output } from "@/lib/enforcement/types";
