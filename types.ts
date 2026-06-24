// Standards-corpus compliance types — TDD §6.4 names:
//   BICSI TDMM 15
//   TIA-568.2-D · TIA-568.1-D
//   TIA-569 (pathways + spaces)
//   TIA-758-B (customer-owned outside plant)
//   TIA-607 (telecom bonding + grounding)
//   NEC Article 770 (optical fiber)
//   NEC Article 800 (communications circuits)
//   NEC Article 830 (network-powered broadband)
//   UFC 3-580-01 (DoD telecom cabling)
//
// Each rule is a small object with a deterministic check() function that
// runs against a ComplianceCheckContext. The runner aggregates results into
// a per-standard rollup so the UI can show "5 of 5 TIA-568 rules passing,
// 2 of 3 NEC-800 rules passing, 1 NEC-800 advisory," etc.

import type { Project } from "@/lib/projects/types";
import type { ExtractedRoom } from "@/lib/intake/types";
import type { PlacementState } from "@/lib/placement/types";
import type { DesignParameters } from "@/lib/design/types";
import type { PathwaySegment, CableRun } from "@/lib/pathway/types";

export type StandardFamily =
  | "BICSI-TDMM-15"
  | "TIA-568.2-D"
  | "TIA-568.1-D"
  | "TIA-569"
  | "TIA-758-B"
  | "TIA-607"
  | "NEC-770"
  | "NEC-800"
  | "NEC-830"
  | "UFC-3-580-01";

export const STANDARD_LABEL: Record<StandardFamily, string> = {
  "BICSI-TDMM-15":  "BICSI TDMM 15",
  "TIA-568.2-D":    "TIA-568.2-D",
  "TIA-568.1-D":    "TIA-568.1-D",
  "TIA-569":        "TIA-569",
  "TIA-758-B":      "TIA-758-B",
  "TIA-607":        "TIA-607",
  "NEC-770":        "NEC Article 770",
  "NEC-800":        "NEC Article 800",
  "NEC-830":        "NEC Article 830",
  "UFC-3-580-01":   "UFC 3-580-01",
};

export type RuleCategory =
  | "horizontal_cabling"
  | "backbone_cabling"
  | "pathways_spaces"
  | "osp"
  | "grounding_bonding"
  | "fire_safety_jacketing"
  | "tr_design"
  | "outlet_density"
  | "dod_specific";

export type RuleStatus = "pass" | "advisory" | "fail" | "not_applicable";

/** Output of a single rule check. */
export interface RuleCheckOutcome {
  status: RuleStatus;
  /** Human-readable explanation of the check's result. */
  message?: string;
  /** Hyperlink target — same shape as ComplianceRule.locate. */
  locate?: { kind: "room" | "outlet" | "wap" | "pathway"; id: string };
}

/** Input context every rule sees. */
export interface ComplianceCheckContext {
  project: Project;
  rooms?:        ExtractedRoom[];
  placement?:    PlacementState;
  designParams?: DesignParameters;
  pathway?:      { segments: PathwaySegment[]; runs: CableRun[] };
}

/** Static definition of one rule. */
export interface ComplianceRuleDef {
  /** Short code surfaced in the UI, e.g. "TIA-568.2-D-§4.2". */
  code: string;
  /** Which standard this rule comes from. */
  standard: StandardFamily;
  /** Full citation string for the report. */
  citation: string;
  /** Short title. */
  title: string;
  /** One-sentence description. */
  description: string;
  category: RuleCategory;
  /** When the predicate returns a failing result, what severity does the rule fail at? */
  failSeverity: "advisory" | "fail";
  /** The check predicate — deterministic over the context. */
  check: (ctx: ComplianceCheckContext) => RuleCheckOutcome;
}

/** Result of running ALL rules for a project. */
export interface StandardsComplianceResult {
  generatedAt: string;
  projectId: string;
  rules: Array<{
    def: ComplianceRuleDef;
    outcome: RuleCheckOutcome;
  }>;
  counts: { pass: number; advisory: number; fail: number; not_applicable: number; total: number };
  /** Per-standard rollup. */
  byStandard: Record<StandardFamily, {
    pass: number; advisory: number; fail: number; not_applicable: number; total: number;
  }>;
}
