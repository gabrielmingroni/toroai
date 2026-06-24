// Permit trigger extraction — TDD §5.5 (post-processing) + §6.4 (Regulatory
// Output Engine, identified in the disclosure as "the strongest individual
// patent claim").
//
// Takes the raw permit-candidate strings produced by the Claude reasoning
// step and taxonomizes each into a PermitType, attaching the responsible
// authority and a lead-time estimate. Unresolved candidates are surfaced
// separately for human review.
//
// The taxonomy is the predicate library — a deterministic rule set rather
// than an AI re-classification, which is what makes the module patent-
// defensible per TDD §10 (Alice Step 2B).

import type {
  NpeCall1Output, PermitTrigger, PermitTriggerResult, PermitType,
} from "./types";
import type { Project } from "@/lib/projects/types";

// Pattern → (PermitType, default lead time, authority resolver).
interface Pattern {
  pattern: RegExp;
  type: PermitType;
  leadTimeDays: number;
  authority: (project: Project) => string;
}

const CITY_AHJ = (p: Project) => p.ahj;
const STATE_DOT = (p: Project) => `${p.state} Department of Transportation`;
const VA_FEDERAL = () => "Veterans Affairs — Facilities Management Office";
const DOL_WAGES = (p: Project) => `U.S. Department of Labor — Wage & Hour (${p.state})`;
const OSHA = () => "OSHA Region VI (Houston Area Office)";

const PATTERNS: Pattern[] = [
  { pattern: /row|right[\s-]?of[\s-]?way|encroachment/i, type: "row_encroachment",
    leadTimeDays: 30, authority: CITY_AHJ },
  { pattern: /excavation|trench/i, type: "excavation_trench",
    leadTimeDays: 14, authority: CITY_AHJ },
  { pattern: /directional[\s-]?bore|boring|HDD/i, type: "directional_bore",
    leadTimeDays: 21, authority: STATE_DOT },
  { pattern: /aerial|pole[\s-]?attachment/i, type: "aerial_attachment",
    leadTimeDays: 45, authority: (p) => `${p.city} Pole Attachment Coordinator` },
  { pattern: /building permit/i, type: "building",
    leadTimeDays: 21, authority: CITY_AHJ },
  { pattern: /low[\s-]?voltage|LV contractor/i, type: "low_voltage_contractor",
    leadTimeDays: 7, authority: STATE_DOT },
  { pattern: /confined[\s-]?space/i, type: "confined_space",
    leadTimeDays: 3, authority: OSHA },
  { pattern: /VA federal|veterans affairs/i, type: "federal_project",
    leadTimeDays: 30, authority: VA_FEDERAL },
  { pattern: /davis[\s-]?bacon|prevailing wage/i, type: "davis_bacon",
    leadTimeDays: 7, authority: DOL_WAGES },
];

export function enforcePermitTriggers(
  call1: NpeCall1Output,
  project: Project,
): PermitTriggerResult {
  const triggers: PermitTrigger[] = [];
  const unresolved: string[] = [];

  for (const raw of call1.permitCandidates) {
    const match = PATTERNS.find(p => p.pattern.test(raw));
    if (!match) {
      unresolved.push(raw);
      continue;
    }
    triggers.push({
      type: match.type,
      triggerSource: raw,
      authority: match.authority(project),
      estimatedLeadTimeDays: match.leadTimeDays,
    });
  }

  return {
    totalCandidates: call1.permitCandidates.length,
    triggers,
    unresolved,
  };
}
