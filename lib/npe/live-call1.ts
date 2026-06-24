// Live Call 1 — real Anthropic API implementation of the BOM + Labor SOV
// generator. Uses the existing CALL_1_SYSTEM_PROMPT verbatim per TDD §5.5.
//
// Returns the same Call1Output shape the mock returns, so downstream
// consumers (enforcement, Call 2) don't care which strategy ran.

import { callAnthropic, extractJsonObject } from "@/lib/anthropic/client";
import { CALL_1_SYSTEM_PROMPT, ENGINEERING_RULES } from "./prompts";
import type {
  Call1Input, Call1Output, RuleApplication,
} from "./types";
import type {
  BomLineItem, LaborTask,
} from "@/lib/enforcement/types";

export interface LiveCall1Result {
  output: Call1Output;
  /** Raw response from Anthropic for debugging / audit. */
  rawText: string;
}

/**
 * Live Call 1. Returns the parsed Call1Output or throws on any failure.
 * Callers should wrap in try/catch and fall back to the mock if needed.
 */
export async function liveCall1(input: Call1Input): Promise<LiveCall1Result> {
  const userContent = buildCall1UserContent(input);

  const res = await callAnthropic({
    system: CALL_1_SYSTEM_PROMPT,
    user: userContent,
    maxTokens: 8000,
    temperature: 0.2,
  });

  if (!res.ok) {
    throw new Error(`Call 1 failed: ${res.error.kind} — ${res.error.message}`);
  }

  const parsed = extractJsonObject(res.response.text);
  if (!parsed || typeof parsed !== "object") {
    throw new Error("Call 1 returned non-JSON content.");
  }
  const p = parsed as { bomLineItems?: unknown; laborTasks?: unknown; permitCandidates?: unknown };
  if (!Array.isArray(p.bomLineItems) || !Array.isArray(p.laborTasks)) {
    throw new Error("Call 1 JSON missing bomLineItems or laborTasks arrays.");
  }

  const bomLineItems = (p.bomLineItems as unknown[]).map(coerceBomLine);
  const laborTasks   = (p.laborTasks   as unknown[]).map(coerceLaborTask);
  const permitCandidates = Array.isArray(p.permitCandidates)
    ? (p.permitCandidates as unknown[]).map(x => String(x))
    : [];

  const ruleApplications = synthesizeRuleTrace(bomLineItems, laborTasks, input);

  const output: Call1Output = {
    projectId: input.project.id,
    bomLineItems, laborTasks, permitCandidates,
    ruleApplications,
    estimatedTokens: {
      input:  res.response.usage.inputTokens,
      output: res.response.usage.outputTokens,
    },
  };

  return { output, rawText: res.response.text };
}

// ── User content builder ────────────────────────────────────────────────

function buildCall1UserContent(input: Call1Input): string {
  const exhibit = input.project.exhibit;
  const ctxLines = [
    `Project: ${input.project.number} — ${input.project.name}`,
    `Site: ${input.project.city}, ${input.project.state}`,
    `Sector: ${input.project.sector}`,
    exhibit?.federalAgency ? `Federal agency: ${exhibit.federalAgency}` : null,
    exhibit?.davisBaconApplies ? `Davis-Bacon: applies` : `Davis-Bacon: not applicable`,
  ].filter(Boolean).join("\n");

  const entityLines: string[] = [];
  for (const cat of Object.keys(input.entityDict) as (keyof typeof input.entityDict)[]) {
    const entries = input.entityDict[cat];
    if (entries.length === 0) continue;
    entityLines.push(`${cat}:`);
    for (const e of entries) entityLines.push(`  - "${e.text}" (${(e.confidence * 100).toFixed(0)}% confident)`);
  }

  return [
    "## Project context",
    ctxLines,
    "",
    "## Layer 3 entity dictionary",
    entityLines.join("\n") || "(none)",
    "",
    "## Layer 2 extracted text",
    input.fullText,
    "",
    "## Task",
    "Produce the BOM and Labor SOV as structured JSON per the format in your system prompt. Output ONLY the JSON object, no prose.",
  ].join("\n");
}

// ── Coercion helpers — accept whatever Claude returns, normalize to our types

function coerceBomLine(x: unknown): BomLineItem {
  const o = x as Record<string, unknown>;
  return {
    id: String(o.id ?? "b_" + Math.random().toString(36).slice(2, 8)),
    description: String(o.description ?? ""),
    category: (typeof o.category === "string" ? o.category : "misc") as BomLineItem["category"],
    quantity: Number(o.quantity ?? 0),
    unit: (typeof o.unit === "string" ? o.unit : "EA") as BomLineItem["unit"],
    unitCostCents: Number(o.unitCostCents ?? 0),
    connectorSpec: typeof o.connectorSpec === "string" ? (o.connectorSpec as BomLineItem["connectorSpec"]) : undefined,
  };
}

function coerceLaborTask(x: unknown): LaborTask {
  const o = x as Record<string, unknown>;
  return {
    id: String(o.id ?? "t_" + Math.random().toString(36).slice(2, 8)),
    description: String(o.description ?? ""),
    classification: String(o.classification ?? "Telecom Worker"),
    crewSize: Number(o.crewSize ?? 1),
    hours: Number(o.hours ?? 0),
    proposedRateUsdHr: Number(o.proposedRateUsdHr ?? 0),
    proposedLfPerDay: o.proposedLfPerDay !== undefined ? Number(o.proposedLfPerDay) : undefined,
    totalLf: o.totalLf !== undefined ? Number(o.totalLf) : undefined,
  };
}

// ── Rule trace synthesis ────────────────────────────────────────────────

function synthesizeRuleTrace(
  bom: BomLineItem[], labor: LaborTask[], input: Call1Input,
): RuleApplication[] {
  const apps: RuleApplication[] = [];
  apps.push({
    ruleNumber: 1, ruleName: ENGINEERING_RULES[0].name,
    appliedTo: bom.filter(b => b.connectorSpec).map(b => ({ kind: "bom" as const, id: b.id })),
    note: "LC/UPC enforced on connectorized items. Any LC/APC in this list will be overridden in post-processing.",
  });
  apps.push({
    ruleNumber: 2, ruleName: ENGINEERING_RULES[1].name,
    appliedTo: labor.map(t => ({ kind: "labor" as const, id: t.id })),
    note: "NECA MLU labor units informed task hours.",
  });
  apps.push({
    ruleNumber: 3, ruleName: ENGINEERING_RULES[2].name,
    appliedTo: bom.map(b => ({ kind: "bom" as const, id: b.id })),
    note: "RSMeans pricing applied (live distributor pipeline not yet wired).",
  });
  apps.push({
    ruleNumber: 4, ruleName: ENGINEERING_RULES[3].name,
    appliedTo: labor.map(t => ({ kind: "labor" as const, id: t.id })),
    note: input.project.exhibit?.davisBaconApplies
      ? "Davis-Bacon applies — labor rates will be cross-checked in enforcement."
      : "Davis-Bacon does not apply on this project.",
  });
  apps.push({
    ruleNumber: 8, ruleName: ENGINEERING_RULES[7].name,
    appliedTo: labor.map(t => ({ kind: "labor" as const, id: t.id })),
    note: "Tasks bucketed into AIA G703 phases (Mobilization / Cable Pull / Termination / Testing / Closeout).",
  });
  return apps;
}
