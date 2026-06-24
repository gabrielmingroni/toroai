// Deterministic mock implementation of Call 2 — Critical Path Schedule.
//
// Inputs the Call 1 BOM + Labor and enforcement corrections. Builds a CPM
// activity network covering: permit windows (parallel predecessors),
// mobilization, conduit prep, cable pull, splicing × 2 ends, OTDR/OLTS
// testing, AHJ inspection, closeout. Runs forward + backward pass for
// float, identifies the critical path, emits P6 XML.

import type {
  Call2Input, Call2Output, CpmActivity, Milestone,
} from "./types";
import { emitPrimaveraP6Xml } from "./p6-xml";

const DAY_HOURS = 8;

function days(hours: number): number {
  return Math.max(1, Math.ceil(hours / DAY_HOURS));
}

/** Mock Call 2 — turns Call 1 outputs into a CPM schedule. */
export function mockCall2(input: Call2Input): Call2Output {
  const activities: CpmActivity[] = [];

  // ── Permit windows (parallel predecessors to mobilization) ───────────
  // Each enforcement-extracted permit becomes a zero-predecessor activity.
  // Their lead time is taken from the Regulatory Output Engine output.
  const permitActs: CpmActivity[] = (input.enforcement?.permitTriggers.triggers ?? [])
    .map((t, i) => ({
      id: `A09${(i + 1).toString().padStart(2, "0")}`,        // A0901, A0902, …
      name: t.authority + " — " + permitDisplayName(t.type),
      kind: "permit_window" as const,
      durationDays: t.estimatedLeadTimeDays,
      predecessors: [],
      earlyStart: 0, earlyFinish: 0, lateStart: 0, lateFinish: 0,
      totalFloat: 0, freeFloat: 0,
      resource: "Permitting Specialist",
    }));
  activities.push(...permitActs);

  // ── Mobilization (depends on all permit windows) ─────────────────────
  const mobilization: CpmActivity = {
    id: "A1000", name: "Mobilization & site safety setup", kind: "mobilization",
    durationDays: 2,
    predecessors: permitActs.map(p => p.id),
    earlyStart: 0, earlyFinish: 0, lateStart: 0, lateFinish: 0, totalFloat: 0, freeFloat: 0,
    resource: "5-man OSP pull crew",
  };
  activities.push(mobilization);

  // ── Conduit / pathway prep ───────────────────────────────────────────
  const conduitPrep: CpmActivity = {
    id: "A1010", name: "Conduit / pathway prep (innerduct + handhole staging)",
    kind: "conduit_prep", durationDays: 3,
    predecessors: ["A1000"],
    earlyStart: 0, earlyFinish: 0, lateStart: 0, lateFinish: 0, totalFloat: 0, freeFloat: 0,
    resource: "5-man OSP pull crew",
  };
  activities.push(conduitPrep);

  // ── Cable pull (5-man OSP crew at 5,280 LF/day max) ─────────────────
  // Production rate already clamped by enforcement to 5,280 LF/day max.
  const pullTask = input.laborTasks.find(t => /OSP fiber pull/i.test(t.description));
  const pullLf = pullTask?.totalLf ?? 2300;
  const cablePull: CpmActivity = {
    id: "A1020", name: `OSP fiber pull (${pullLf.toLocaleString()} LF @ 5,280 LF/day max)`,
    kind: "cable_pull", durationDays: Math.max(1, Math.ceil(pullLf / 5280)),
    predecessors: ["A1010"],
    earlyStart: 0, earlyFinish: 0, lateStart: 0, lateFinish: 0, totalFloat: 0, freeFloat: 0,
    resource: "5-man OSP pull crew",
    laborTaskId: pullTask?.id,
  };
  activities.push(cablePull);

  // ── Splicing — two ends, in parallel ────────────────────────────────
  const spliceTask = input.laborTasks.find(t => /splic/i.test(t.description));
  const spliceMdf: CpmActivity = {
    id: "A1030", name: "Fusion splicing — MDF (B-100 6F)",
    kind: "splicing", durationDays: days((spliceTask?.hours ?? 7.2) / 2),
    predecessors: ["A1020"],
    earlyStart: 0, earlyFinish: 0, lateStart: 0, lateFinish: 0, totalFloat: 0, freeFloat: 0,
    resource: "Splicer Technician", laborTaskId: spliceTask?.id,
  };
  const spliceIdf: CpmActivity = {
    id: "A1031", name: "Fusion splicing — IDF-A (B-108)",
    kind: "splicing", durationDays: days((spliceTask?.hours ?? 7.2) / 2),
    predecessors: ["A1020"],
    earlyStart: 0, earlyFinish: 0, lateStart: 0, lateFinish: 0, totalFloat: 0, freeFloat: 0,
    resource: "Splicer Technician", laborTaskId: spliceTask?.id,
  };
  activities.push(spliceMdf, spliceIdf);

  // ── Testing (OTDR + OLTS, bidirectional) ────────────────────────────
  const testTask = input.laborTasks.find(t => /OTDR|OLTS|test/i.test(t.description));
  const testing: CpmActivity = {
    id: "A1040", name: "OTDR + OLTS bidirectional testing (12-strand × 2 ends)",
    kind: "testing", durationDays: days(testTask?.hours ?? 4.8),
    predecessors: ["A1030", "A1031"],
    earlyStart: 0, earlyFinish: 0, lateStart: 0, lateFinish: 0, totalFloat: 0, freeFloat: 0,
    resource: "Fiber Technician", laborTaskId: testTask?.id,
  };
  activities.push(testing);

  // ── AHJ inspection ──────────────────────────────────────────────────
  const inspection: CpmActivity = {
    id: "A1050", name: "AHJ inspection (City of Houston Permit Office)",
    kind: "ahj_inspection", durationDays: 1,
    predecessors: ["A1040"],
    earlyStart: 0, earlyFinish: 0, lateStart: 0, lateFinish: 0, totalFloat: 0, freeFloat: 0,
    resource: "Project Manager",
  };
  activities.push(inspection);

  // ── Closeout ────────────────────────────────────────────────────────
  const closeout: CpmActivity = {
    id: "A1060", name: "TIA-606 labeling, as-built, closeout package",
    kind: "closeout", durationDays: 1,
    predecessors: ["A1050"],
    earlyStart: 0, earlyFinish: 0, lateStart: 0, lateFinish: 0, totalFloat: 0, freeFloat: 0,
    resource: "Telecom Worker",
  };
  activities.push(closeout);

  // ── Forward + backward pass — compute floats and critical path ──────
  forwardPass(activities);
  const totalDuration = Math.max(...activities.map(a => a.earlyFinish));
  backwardPass(activities, totalDuration);
  for (const a of activities) {
    a.totalFloat = a.lateStart - a.earlyStart;
  }
  // Free float = min successor.earlyStart - this.earlyFinish
  for (const a of activities) {
    const successors = activities.filter(x => x.predecessors.includes(a.id));
    if (successors.length === 0) {
      a.freeFloat = totalDuration - a.earlyFinish;
    } else {
      a.freeFloat = Math.min(...successors.map(s => s.earlyStart - a.earlyFinish));
    }
  }
  const criticalPath = activities.filter(a => a.totalFloat === 0).map(a => a.id);

  // ── Milestones (gated by specific activities) ───────────────────────
  const milestones: Milestone[] = [
    { id: "M1", name: "Mobilization complete",          dayIndex: byId(activities, "A1000").earlyFinish, gatingActivityId: "A1000" },
    { id: "M2", name: "Conduit / pathway prep complete", dayIndex: byId(activities, "A1010").earlyFinish, gatingActivityId: "A1010" },
    { id: "M3", name: "Cable pull complete",             dayIndex: byId(activities, "A1020").earlyFinish, gatingActivityId: "A1020" },
    { id: "M4", name: "Splicing complete",               dayIndex: Math.max(byId(activities, "A1030").earlyFinish, byId(activities, "A1031").earlyFinish), gatingActivityId: "A1031" },
    { id: "M5", name: "Testing complete",                dayIndex: byId(activities, "A1040").earlyFinish, gatingActivityId: "A1040" },
    { id: "M6", name: "AHJ inspection passed",           dayIndex: byId(activities, "A1050").earlyFinish, gatingActivityId: "A1050" },
    { id: "M7", name: "Substantial completion",          dayIndex: byId(activities, "A1060").earlyFinish, gatingActivityId: "A1060" },
  ];

  // ── P6 XML ──────────────────────────────────────────────────────────
  const xml = emitPrimaveraP6Xml(activities, milestones, {
    projectId: input.project.number,
    projectName: input.project.name,
    startDate: "2026-07-01",   // illustrative project start
  });

  return {
    cpmActivities: activities,
    milestones,
    criticalPath,
    totalDurationDays: totalDuration,
    primaveraP6Xml: xml,
    estimatedTokens: { input: 1800, output: 2200 },
  };
}

// ── CPM helpers ─────────────────────────────────────────────────────────

function byId(acts: CpmActivity[], id: string): CpmActivity {
  return acts.find(a => a.id === id)!;
}

function forwardPass(acts: CpmActivity[]) {
  // Topological order by predecessor chain.
  const done = new Set<string>();
  const queue = acts.slice();
  let safety = acts.length * acts.length;     // worst-case
  while (queue.length > 0 && safety-- > 0) {
    const next = queue.shift()!;
    if (!next.predecessors.every(p => done.has(p))) { queue.push(next); continue; }
    next.earlyStart = next.predecessors.length === 0 ? 0
      : Math.max(...next.predecessors.map(p => byId(acts, p).earlyFinish));
    next.earlyFinish = next.earlyStart + next.durationDays;
    done.add(next.id);
  }
}

function backwardPass(acts: CpmActivity[], projectDuration: number) {
  // Reverse topological order.
  const successorsOf: Record<string, string[]> = {};
  for (const a of acts) for (const p of a.predecessors) (successorsOf[p] ??= []).push(a.id);

  const done = new Set<string>();
  const queue = acts.slice();
  let safety = acts.length * acts.length;
  while (queue.length > 0 && safety-- > 0) {
    const next = queue.shift()!;
    const succs = successorsOf[next.id] ?? [];
    if (!succs.every(s => done.has(s))) { queue.push(next); continue; }
    next.lateFinish = succs.length === 0 ? projectDuration
      : Math.min(...succs.map(s => byId(acts, s).lateStart));
    next.lateStart = next.lateFinish - next.durationDays;
    done.add(next.id);
  }
}

function permitDisplayName(type: string): string {
  return type.split("_").map(w => w[0]?.toUpperCase() + w.slice(1)).join(" ");
}
