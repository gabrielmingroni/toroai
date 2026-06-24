// In-memory pipeline runner that mirrors the Neural Parsal Engine
// architecture from the TDD (sequential NPE preprocessing → simultaneous
// five-lane output generation → parallel enforcement → RCDD gate → sequential
// delivery). One run per project at a time.

import { randomBytes } from "crypto";
import type { PipelineRun, StageState, StageId, StageStatus, StagePhase } from "./types";
import { STAGE_DEFS, stagesInPhase } from "./types";

const runsByProject = new Map<string, PipelineRun>();

function id(prefix: string) { return prefix + "_" + randomBytes(4).toString("hex"); }

function freshRun(projectId: string): PipelineRun {
  const now = new Date().toISOString();
  const stages: StageState[] = STAGE_DEFS.map((d, i) => ({
    id: d.id,
    status: i === 0 ? "running" : "queued",
    startedAt: i === 0 ? now : null,
    completedAt: null,
    progress: 0,
  }));
  return {
    id: id("run"),
    projectId,
    startedAt: now,
    completedAt: null,
    gateReleasedAt: null,
    stages,
    currentStage: stages[0].id,
    overallProgress: 0,
  };
}

// ── Phase durations (drive overall progress weight) ────────────────────────
//   NPE: sum of layer durations (sequential)
//   Lanes: MAX of lane durations (parallel — bottleneck = slowest lane)
//   Enforce: MAX of enforcement durations (parallel)
//   Delivery: sum of delivery durations (sequential)
const NPE_MS      = stagesInPhase("npe").reduce((s, d) => s + d.durationMs, 0);
const LANE_MS     = Math.max(...stagesInPhase("lane").map(d => d.durationMs));
const ENFORCE_MS  = Math.max(...stagesInPhase("enforce").map(d => d.durationMs));
const DELIVERY_MS = stagesInPhase("delivery").reduce((s, d) => s + d.durationMs, 0);
const TOTAL_TIMED_MS = NPE_MS + LANE_MS + ENFORCE_MS + DELIVERY_MS;

function getStage(run: PipelineRun, sid: StageId): StageState | undefined {
  return run.stages.find(s => s.id === sid);
}

/** Mark a single stage's progress at cursor time. */
function advanceStage(
  st: StageState, defDuration: number, phaseStartMs: number, now: number,
) {
  const stageStart = phaseStartMs;          // caller passes the stage-specific start
  const stageEnd   = stageStart + defDuration;
  if (now >= stageEnd) {
    st.status = "done";
    st.startedAt   ||= new Date(stageStart).toISOString();
    st.completedAt ||= new Date(stageEnd).toISOString();
    st.progress = 1;
  } else if (now >= stageStart) {
    st.status = "running";
    st.startedAt ||= new Date(stageStart).toISOString();
    st.progress = (now - stageStart) / defDuration;
  } else {
    st.status = "queued";
    st.progress = 0;
  }
}

function tick(run: PipelineRun) {
  if (run.completedAt) return;
  const now = Date.now();
  const startMs = new Date(run.startedAt).getTime();

  // ── Phase 1: NPE preprocessing (sequential) ─────────────────────────
  const npeStages = stagesInPhase("npe");
  let cursor = startMs;
  for (const def of npeStages) {
    const st = getStage(run, def.id)!;
    advanceStage(st, def.durationMs, cursor, now);
    cursor += def.durationMs;
  }
  const npeDoneMs = cursor;
  const npeFinished = now >= npeDoneMs;

  // ── Phase 2: Five output lanes (PARALLEL) ───────────────────────────
  // All five start at npeDoneMs; each finishes after its own duration.
  const laneStages = stagesInPhase("lane");
  if (npeFinished) {
    for (const def of laneStages) {
      const st = getStage(run, def.id)!;
      advanceStage(st, def.durationMs, npeDoneMs, now);
    }
  } else {
    // Keep lanes queued until NPE finishes.
    for (const def of laneStages) {
      const st = getStage(run, def.id)!;
      st.status = "queued"; st.progress = 0;
    }
  }
  const lanesDoneMs = npeDoneMs + LANE_MS;
  const lanesFinished = now >= lanesDoneMs && npeFinished;

  // ── Phase 3: Enforcement modules (PARALLEL) ─────────────────────────
  const enforceStages = stagesInPhase("enforce");
  if (lanesFinished) {
    for (const def of enforceStages) {
      const st = getStage(run, def.id)!;
      advanceStage(st, def.durationMs, lanesDoneMs, now);
    }
  } else {
    for (const def of enforceStages) {
      const st = getStage(run, def.id)!;
      st.status = "queued"; st.progress = 0;
    }
  }
  const enforceDoneMs = lanesDoneMs + ENFORCE_MS;
  const enforceFinished = now >= enforceDoneMs && lanesFinished;

  // ── Phase 4: Gate ───────────────────────────────────────────────────
  const gateStage = getStage(run, "rcdd_review_gate")!;
  if (enforceFinished && !run.gateReleasedAt) {
    gateStage.status = "paused";
    gateStage.startedAt ||= new Date(enforceDoneMs).toISOString();
    gateStage.progress = 0;
    run.currentStage = "rcdd_review_gate";
    run.overallProgress = (NPE_MS + LANE_MS + ENFORCE_MS) / TOTAL_TIMED_MS;
    return;
  }
  if (run.gateReleasedAt) {
    gateStage.status = "done";
    gateStage.completedAt ||= run.gateReleasedAt;
    gateStage.progress = 1;
  }

  // ── Phase 5: Delivery (sequential) ──────────────────────────────────
  if (run.gateReleasedAt) {
    const gateMs = new Date(run.gateReleasedAt).getTime();
    let dCursor = gateMs;
    for (const def of stagesInPhase("delivery")) {
      const st = getStage(run, def.id)!;
      advanceStage(st, def.durationMs, dCursor, now);
      dCursor += def.durationMs;
    }
    if (run.stages.every(s => s.status === "done")) {
      run.completedAt ||= new Date(dCursor).toISOString();
      run.currentStage = null;
    }
  }

  // ── Update derived state ────────────────────────────────────────────
  // currentStage = most-advanced running stage (for legacy single-stage callers)
  run.currentStage = computeCurrentStage(run);

  // Overall progress weighted across phases
  const npeProgress = npeStages.reduce((s, d) => {
    const st = getStage(run, d.id)!;
    return s + (st.status === "done" ? d.durationMs : st.status === "running" ? d.durationMs * st.progress : 0);
  }, 0);
  const laneProgress = laneStages.length === 0 ? 0
    : Math.max(...laneStages.map(d => {
        const st = getStage(run, d.id)!;
        return st.status === "done" ? d.durationMs
             : st.status === "running" ? d.durationMs * st.progress
             : 0;
      })) * (LANE_MS / Math.max(...laneStages.map(d => d.durationMs)));
  const enforceProgress = enforceStages.length === 0 ? 0
    : Math.max(...enforceStages.map(d => {
        const st = getStage(run, d.id)!;
        return st.status === "done" ? d.durationMs
             : st.status === "running" ? d.durationMs * st.progress
             : 0;
      })) * (ENFORCE_MS / Math.max(...enforceStages.map(d => d.durationMs)));
  const deliveryProgress = stagesInPhase("delivery").reduce((s, d) => {
    const st = getStage(run, d.id)!;
    return s + (st.status === "done" ? d.durationMs : st.status === "running" ? d.durationMs * st.progress : 0);
  }, 0);

  run.overallProgress = Math.min(1, (npeProgress + laneProgress + enforceProgress + deliveryProgress) / TOTAL_TIMED_MS);
}

function computeCurrentStage(run: PipelineRun): StageId | null {
  // Priority: paused gate > running stage (in phase order) > null if done
  const paused = run.stages.find(s => s.status === "paused");
  if (paused) return paused.id;
  // Walk in phase order, return the first running stage we see.
  const phaseOrder: StagePhase[] = ["npe", "lane", "enforce", "gate", "delivery"];
  for (const phase of phaseOrder) {
    const inPhase = stagesInPhase(phase);
    for (const def of inPhase) {
      const st = getStage(run, def.id)!;
      if (st.status === "running") return def.id;
    }
  }
  if (run.stages.every(s => s.status === "done")) return null;
  // Otherwise return the first queued stage.
  return run.stages.find(s => s.status === "queued")?.id ?? null;
}

export const pipelineStore = {
  get(projectId: string): PipelineRun | undefined {
    const run = runsByProject.get(projectId);
    if (run) tick(run);
    return run;
  },
  start(projectId: string): PipelineRun {
    const run = freshRun(projectId);
    runsByProject.set(projectId, run);
    return run;
  },
  releaseGate(projectId: string): PipelineRun | undefined {
    const run = this.get(projectId);
    if (!run) return undefined;
    if (run.currentStage !== "rcdd_review_gate") return run;  // only when actually paused
    run.gateReleasedAt = new Date().toISOString();
    tick(run);
    return run;
  },
  reset(projectId: string): void {
    runsByProject.delete(projectId);
  },
};
