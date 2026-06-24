// Deterministic mock implementation of Call 1 — BOM + Labor SOV generation.
//
// In production this calls Anthropic Claude with the CALL_1_SYSTEM_PROMPT,
// full_text, and entity_dict. For the patent-defending demo we return the
// existing DEBAKEY_CALL1_OUTPUT fixture (which seeds the enforcement
// modules) plus a rule-application trace mapping each BOM/labor entry to
// the engineering rules that fired against it.
//
// Strategy: "deterministic_mock". A future live_anthropic_api strategy can
// be swapped in behind the same interface without touching consumers.

import type { Call1Input, Call1Output, RuleApplication } from "./types";
import { DEBAKEY_CALL1_OUTPUT } from "@/lib/enforcement/fixtures";
import { ENGINEERING_RULES } from "./prompts";

/** Mock Call 1 — returns BOM + Labor + permit candidates + rule trace. */
export function mockCall1(input: Call1Input): Call1Output {
  const base = DEBAKEY_CALL1_OUTPUT;
  // For non-DeBakey projects we'd lookup or synthesize — but the patent
  // demo only exercises the DeBakey fixture.
  if (input.project.id !== base.projectId) {
    return {
      projectId: input.project.id,
      bomLineItems: [],
      laborTasks: [],
      permitCandidates: [],
      ruleApplications: [],
      estimatedTokens: { input: estimateTokens(input.fullText) + entityTokens(input), output: 0 },
    };
  }

  // Build the rule trace — which engineering rule fired against which items.
  // In a live API call, Claude would explain its reasoning in a separate
  // structured field; we synthesize the equivalent here.
  const ruleApplications: RuleApplication[] = [
    {
      ruleNumber: 1,
      ruleName: ENGINEERING_RULES[0].name,
      appliedTo: base.bomLineItems.filter(b => b.connectorSpec).map(b => ({ kind: "bom" as const, id: b.id })),
      note: "LC/UPC enforced on every connectorized line item. Two items emitted as LC/APC will be overridden in post-processing.",
    },
    {
      ruleNumber: 2,
      ruleName: ENGINEERING_RULES[1].name,
      appliedTo: base.laborTasks.map(t => ({ kind: "labor" as const, id: t.id })),
      note: "NECA MLU labor unit values informed hours per task type.",
    },
    {
      ruleNumber: 3,
      ruleName: ENGINEERING_RULES[2].name,
      appliedTo: base.bomLineItems.map(b => ({ kind: "bom" as const, id: b.id })),
      note: "RSMeans (Gordian) unit costs applied. Live distributor pipeline not yet wired.",
    },
    {
      ruleNumber: 4,
      ruleName: ENGINEERING_RULES[3].name,
      appliedTo: base.laborTasks.map(t => ({ kind: "labor" as const, id: t.id })),
      note: input.project.exhibit?.davisBaconApplies
        ? "Davis-Bacon prevailing wage applies (VA federal project)."
        : "Davis-Bacon does not apply to this project.",
    },
    {
      ruleNumber: 5,
      ruleName: ENGINEERING_RULES[4].name,
      appliedTo: base.bomLineItems.filter(b => b.category === "fiber_cable").map(b => ({ kind: "bom" as const, id: b.id })),
      note: "SM OS2 selected for the outdoor OSP run between B-100 and B-108.",
    },
    {
      ruleNumber: 9,
      ruleName: ENGINEERING_RULES[8].name,
      appliedTo: base.bomLineItems.filter(b => b.connectorSpec === "LC_UPC").map(b => ({ kind: "bom" as const, id: b.id })),
      note: "Channel loss budget: 0.3 dB per LC/UPC mated pair × 2 ends = 0.6 dB connector loss.",
    },
    {
      ruleNumber: 10,
      ruleName: ENGINEERING_RULES[9].name,
      appliedTo: base.laborTasks.filter(t => /splic/i.test(t.description)).map(t => ({ kind: "labor" as const, id: t.id })),
      note: "Fusion splice loss budget: 0.1 dB × 12 strands × 2 ends = 2.4 dB splice loss.",
    },
    {
      ruleNumber: 11,
      ruleName: ENGINEERING_RULES[10].name,
      appliedTo: base.bomLineItems.filter(b => /plenum|riser/i.test(b.description)).map(b => ({ kind: "bom" as const, id: b.id })),
      note: "Plenum-rated jacket required for the 1.25\" innerduct portion through return-air ceiling spaces.",
    },
    {
      ruleNumber: 12,
      ruleName: ENGINEERING_RULES[11].name,
      appliedTo: [],
      note: "TIA-568 90 m horizontal rule does not apply to this OSP backbone run — limit is per outlet horizontal channel, this is a building-to-building backbone.",
    },
  ];

  return {
    ...base,
    ruleApplications,
    estimatedTokens: {
      input:  estimateTokens(input.fullText) + entityTokens(input),
      output: 1800,   // illustrative — actual depends on JSON size
    },
  };
}

function estimateTokens(text: string): number {
  // ~1 token per 4 characters is the standard rough estimate.
  return Math.ceil(text.length / 4);
}

function entityTokens(input: Call1Input): number {
  let n = 0;
  for (const cat of Object.keys(input.entityDict) as (keyof typeof input.entityDict)[]) {
    for (const e of input.entityDict[cat]) n += Math.ceil(e.text.length / 4) + 5;
  }
  return n;
}
