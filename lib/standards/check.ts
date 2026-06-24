// Standards-corpus check runner. Walks the rule list, evaluates each
// rule's predicate against the context, and produces a structured result
// with per-standard rollups.

import type { Project } from "@/lib/projects/types";
import { intakeStore } from "@/lib/intake/mock-store";
import { designStore } from "@/lib/design/mock-store";
import { placementStore } from "@/lib/placement/mock-store";
import { pathwayStore } from "@/lib/pathway/mock-store";
import { RULES } from "./rules";
import type {
  ComplianceCheckContext, StandardsComplianceResult, StandardFamily,
} from "./types";

const EMPTY_BY_STANDARD = (): StandardsComplianceResult["byStandard"] => ({
  "BICSI-TDMM-15": zeros(), "TIA-568.2-D": zeros(), "TIA-568.1-D": zeros(),
  "TIA-569": zeros(), "TIA-758-B": zeros(), "TIA-607": zeros(),
  "NEC-770": zeros(), "NEC-800": zeros(), "NEC-830": zeros(),
  "UFC-3-580-01": zeros(),
});
const zeros = () => ({ pass: 0, advisory: 0, fail: 0, not_applicable: 0, total: 0 });

/** Resolve the full check context from the project + the lazy mock stores. */
export function buildContext(project: Project, userId: string): ComplianceCheckContext {
  const intake = intakeStore.get(project.id);
  const placement = placementStore.get(project.id, userId);
  const designParams = designStore.get(project.id, userId);
  const pathway = pathwayStore.get(project.id);
  return {
    project,
    rooms: intake?.rooms,
    placement,
    designParams,
    pathway: { segments: pathway.segments, runs: pathway.runs },
  };
}

/** Run all 20 rules and aggregate results. */
export function runComplianceChecks(ctx: ComplianceCheckContext): StandardsComplianceResult {
  const rules = RULES.map(def => ({
    def,
    outcome: def.check(ctx),
  }));

  const counts = { pass: 0, advisory: 0, fail: 0, not_applicable: 0, total: rules.length };
  const byStandard = EMPTY_BY_STANDARD();

  for (const r of rules) {
    const std = r.def.standard as StandardFamily;
    byStandard[std].total += 1;
    counts[r.outcome.status] += 1;
    byStandard[std][r.outcome.status] += 1;
  }

  return {
    generatedAt: new Date().toISOString(),
    projectId: ctx.project.id,
    rules, counts, byStandard,
  };
}
