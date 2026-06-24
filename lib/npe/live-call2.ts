// Live Call 2 — real Anthropic API implementation of the CPM Schedule
// generator. Takes Call 1's outputs + enforcement bundle and produces the
// CPM schedule + Primavera P6 XML.

import { callAnthropic, extractJsonObject } from "@/lib/anthropic/client";
import { CALL_2_SYSTEM_PROMPT } from "./prompts";
import { emitPrimaveraP6Xml } from "./p6-xml";
import type {
  Call2Input, Call2Output, CpmActivity, Milestone,
} from "./types";

export interface LiveCall2Result {
  output: Call2Output;
  rawText: string;
}

export async function liveCall2(input: Call2Input): Promise<LiveCall2Result> {
  const userContent = buildCall2UserContent(input);

  const res = await callAnthropic({
    system: CALL_2_SYSTEM_PROMPT,
    user: userContent,
    maxTokens: 8000,
    temperature: 0.2,
  });

  if (!res.ok) {
    throw new Error(`Call 2 failed: ${res.error.kind} — ${res.error.message}`);
  }

  const parsed = extractJsonObject(res.response.text);
  if (!parsed || typeof parsed !== "object") {
    throw new Error("Call 2 returned non-JSON content.");
  }
  const p = parsed as { cpmActivities?: unknown; milestones?: unknown; criticalPath?: unknown; totalDurationDays?: unknown };
  if (!Array.isArray(p.cpmActivities) || !Array.isArray(p.milestones)) {
    throw new Error("Call 2 JSON missing cpmActivities or milestones arrays.");
  }

  const cpmActivities = (p.cpmActivities as unknown[]).map(coerceActivity);
  const milestones    = (p.milestones    as unknown[]).map(coerceMilestone);
  const criticalPath  = Array.isArray(p.criticalPath)
    ? (p.criticalPath as unknown[]).map(x => String(x))
    : cpmActivities.filter(a => a.totalFloat === 0).map(a => a.id);
  const totalDurationDays = typeof p.totalDurationDays === "number"
    ? p.totalDurationDays
    : Math.max(...cpmActivities.map(a => a.earlyFinish));

  // Emit P6 XML from our parsed activities — more reliable than asking
  // Claude to produce valid XML.
  const xml = emitPrimaveraP6Xml(cpmActivities, milestones, {
    projectId: input.project.number,
    projectName: input.project.name,
    startDate: "2026-07-01",
  });

  const output: Call2Output = {
    cpmActivities,
    milestones,
    criticalPath,
    totalDurationDays,
    primaveraP6Xml: xml,
    estimatedTokens: {
      input:  res.response.usage.inputTokens,
      output: res.response.usage.outputTokens,
    },
  };

  return { output, rawText: res.response.text };
}

// ── User content builder ────────────────────────────────────────────────

function buildCall2UserContent(input: Call2Input): string {
  const sections: string[] = [];

  sections.push("## Project context");
  sections.push(`Project: ${input.project.number} — ${input.project.name}`);
  sections.push(`Target occupancy: ${input.project.occupancyDate ?? "not set"}`);
  sections.push("");

  sections.push("## BOM line items (from Call 1)");
  sections.push(JSON.stringify(input.bomLineItems, null, 2));
  sections.push("");

  sections.push("## Labor tasks (from Call 1, post-enforcement)");
  sections.push(JSON.stringify(input.laborTasks, null, 2));
  sections.push("");

  if (input.enforcement) {
    sections.push("## Enforcement corrections applied");
    sections.push("Davis-Bacon violations: " + input.enforcement.davisBacon.violations.length);
    sections.push("LC/UPC overrides: "        + input.enforcement.lcUpc.violations.length);
    sections.push("Production-rate clamps: " + input.enforcement.productionRate.violations.length);
    sections.push("");
    sections.push("Permit triggers to integrate as predecessor constraints:");
    for (const t of input.enforcement.permitTriggers.triggers) {
      sections.push(`  - ${t.type}: ${t.estimatedLeadTimeDays} days lead, authority: ${t.authority}`);
    }
    sections.push("");
  }

  sections.push("## Task");
  sections.push("Produce the CPM schedule + milestones + critical path as structured JSON per your system prompt. Output ONLY the JSON object, no prose. Skip the `primaveraP6Xml` field — it will be generated server-side from your activity list.");

  return sections.join("\n");
}

// ── Coercion helpers ────────────────────────────────────────────────────

function coerceActivity(x: unknown): CpmActivity {
  const o = x as Record<string, unknown>;
  return {
    id: String(o.id ?? "A_" + Math.random().toString(36).slice(2, 6).toUpperCase()),
    name: String(o.name ?? "Activity"),
    kind: (typeof o.kind === "string" ? o.kind : "cable_pull") as CpmActivity["kind"],
    durationDays: Number(o.durationDays ?? 1),
    predecessors: Array.isArray(o.predecessors) ? (o.predecessors as unknown[]).map(String) : [],
    earlyStart:   Number(o.earlyStart   ?? 0),
    earlyFinish:  Number(o.earlyFinish  ?? Number(o.earlyStart ?? 0) + Number(o.durationDays ?? 1)),
    lateStart:    Number(o.lateStart    ?? o.earlyStart  ?? 0),
    lateFinish:   Number(o.lateFinish   ?? o.earlyFinish ?? 1),
    totalFloat:   Number(o.totalFloat   ?? 0),
    freeFloat:    Number(o.freeFloat    ?? 0),
    resource:     typeof o.resource     === "string" ? o.resource     : undefined,
    laborTaskId:  typeof o.laborTaskId  === "string" ? o.laborTaskId  : undefined,
  };
}

function coerceMilestone(x: unknown): Milestone {
  const o = x as Record<string, unknown>;
  return {
    id: String(o.id ?? "M_" + Math.random().toString(36).slice(2, 6).toUpperCase()),
    name: String(o.name ?? "Milestone"),
    dayIndex: Number(o.dayIndex ?? 0),
    gatingActivityId: String(o.gatingActivityId ?? ""),
  };
}
