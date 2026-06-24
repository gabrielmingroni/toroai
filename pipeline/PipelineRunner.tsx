"use client";

// Pipeline runner UI — restructured to reflect the Neural Parsal Engine
// architecture described in the TDD (§5):
//
//   ┌─ NPE preprocessing (sequential) ──────────────────────────────┐
//   │ Layer 1 → Layer 2 → Layer 3 → Layer 4                          │
//   └────────────────────────────────────────────────────────────────┘
//                              ↓
//   ┌─ FIVE SIMULTANEOUS OUTPUT LANES ──────────────────────────────┐
//   │ Design │ BOM │ Labor/SOV │ Permitting │ Schedule              │
//   └────────────────────────────────────────────────────────────────┘
//                              ↓
//   ┌─ POST-PROCESSING ENFORCEMENT (parallel) ──────────────────────┐
//   │ Davis-Bacon │ LC/UPC │ Production rate │ Permit triggers      │
//   └────────────────────────────────────────────────────────────────┘
//                              ↓
//                       RCDD review gate
//                              ↓
//   ┌─ Final delivery (sequential) ─────────────────────────────────┐
//   │ Construction drawing → PDF export → Upload outputs            │
//   └────────────────────────────────────────────────────────────────┘
//
// The five lanes are intentionally rendered side-by-side with their own
// progress bars so the simultaneity TDD §4 names as the "novelty anchor" is
// visually obvious.

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import clsx from "clsx";
import type { Project } from "@/lib/projects/types";
import type { PipelineRun, StageId, StageState, StageStatus, StageDef } from "@/lib/pipeline/types";
import { STAGE_DEFS, stagesInPhase } from "@/lib/pipeline/types";
import { pipelineClient } from "@/lib/pipeline/client";

export function PipelineRunner({ project, initialRun }: { project: Project; initialRun: PipelineRun | null }) {
  const [run, setRun] = useState<PipelineRun | null>(initialRun);
  const [busy, setBusy] = useState(false);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Poll while the pipeline is in motion (not paused at gate, not completed)
  useEffect(() => {
    function stopPoll() {
      if (pollRef.current) { clearInterval(pollRef.current); pollRef.current = null; }
    }
    if (!run) { stopPoll(); return; }
    const isCompleted = !!run.completedAt;
    const isAtGate = run.currentStage === "rcdd_review_gate" && !run.gateReleasedAt;
    if (isCompleted || isAtGate) { stopPoll(); return; }
    if (pollRef.current) return;
    pollRef.current = setInterval(async () => {
      const res = await pipelineClient.status(project.id);
      if (res.ok && res.run) setRun(res.run);
    }, 500);
    return stopPoll;
  }, [run, project.id]);

  async function startRun() {
    setBusy(true);
    const res = await pipelineClient.start(project.id);
    if (res.ok && res.run) setRun(res.run);
    setBusy(false);
  }

  async function releaseGate() {
    setBusy(true);
    const res = await pipelineClient.releaseGate(project.id);
    if (res.ok && res.run) setRun(res.run);
    setBusy(false);
  }

  async function resetRun() {
    setBusy(true);
    await pipelineClient.reset(project.id);
    setRun(null);
    setBusy(false);
  }

  function stateFor(stageId: StageId): StageState | undefined {
    return run?.stages.find(s => s.id === stageId);
  }

  // ── Empty state — no run yet ──────────────────────────────────────────────
  if (!run) {
    const npeDefs      = stagesInPhase("npe");
    const laneDefs     = stagesInPhase("lane");
    const enforceDefs  = stagesInPhase("enforce");
    const deliveryDefs = stagesInPhase("delivery");

    return (
      <div className="h-full overflow-y-auto p-6">
        <div className="max-w-[1100px] mx-auto">
          <header className="mb-6">
            <h1 className="text-[20px] font-semibold mb-1">Project pipeline</h1>
            <p className="text-[11.5px] text-text3 font-mono">
              4 sequential intake layers feed 5 simultaneous output lanes,
              followed by 4 parallel enforcement modules, the RCDD review gate, and
              final delivery.
            </p>
          </header>

          <PhaseBand title="Document intake — sequential" tone="info">
            {npeDefs.map((d, i) => <PhaseBandRow key={d.id} idx={i + 1} def={d} state={null} />)}
          </PhaseBand>

          <PhaseBand title="Five simultaneous output lanes — parallel" tone="accent">
            <div className="grid grid-cols-5 gap-2 p-3">
              {laneDefs.map(d => <LaneCard key={d.id} def={d} state={null} />)}
            </div>
          </PhaseBand>

          <PhaseBand title="Post-processing enforcement — parallel" tone="warn">
            <div className="grid grid-cols-4 gap-2 p-3">
              {enforceDefs.map(d => <EnforceCard key={d.id} def={d} state={null} />)}
            </div>
          </PhaseBand>

          <PhaseBand title="RCDD review gate" tone="warn">
            <div className="px-4 py-3 text-[11.5px] text-text2">
              Pipeline pauses here. Approve placements + acknowledge advisories in the
              review queue, then release the gate to generate construction documents.
            </div>
          </PhaseBand>

          <PhaseBand title="Final delivery — sequential" tone="pass">
            {deliveryDefs.map((d, i) => <PhaseBandRow key={d.id} idx={i + 1} def={d} state={null} />)}
          </PhaseBand>

          <div className="mt-6">
            <button onClick={startRun} disabled={busy}
                    className="btn btn-primary text-[13px] px-5 py-2.5 font-medium disabled:opacity-60">
              {busy ? "Starting…" : "Run pipeline →"}
            </button>
            <span className="ml-3 text-[10.5px] text-text4 font-mono">
              Pipeline will pause at the RCDD review gate until you approve.
            </span>
          </div>
        </div>
      </div>
    );
  }

  // ── Active run state ──────────────────────────────────────────────────────
  const completed = !!run.completedAt;
  const atGate = run.currentStage === "rcdd_review_gate" && !run.gateReleasedAt;
  const overallPct = Math.round(run.overallProgress * 100);
  const startedAt = new Date(run.startedAt);
  const elapsedSec = Math.round((Date.now() - startedAt.getTime()) / 1000);

  return (
    <div className="h-full overflow-y-auto">
      <div className="p-6 max-w-[1100px] mx-auto">

        {/* Header */}
        <header className="mb-5 flex items-start justify-between gap-4">
          <div>
            <h1 className="text-[20px] font-semibold mb-1">
              {completed ? "Pipeline complete" : atGate ? "Awaiting RCDD review" : "Pipeline running"}
            </h1>
            <p className="text-[11.5px] text-text3 font-mono">
              Started {startedAt.toLocaleTimeString()} · elapsed {elapsedSec}s · run {run.id}
            </p>
          </div>
          <div className="flex items-center gap-2">
            {completed && (
              <Link href={`/projects/${project.id}/results`} className="btn btn-primary text-[13px] px-4 py-2 font-medium">
                Open Results →
              </Link>
            )}
            <button onClick={resetRun} disabled={busy} className="btn btn-ghost text-[11px]">Reset</button>
          </div>
        </header>

        {/* Overall progress */}
        <div className="card mb-5">
          <div className="card-body py-3">
            <div className="flex items-baseline justify-between mb-2">
              <div className="text-[11.5px] text-text2">
                {completed ? "Done · all artifacts ready"
                 : atGate ? "Paused at RCDD review gate"
                 : currentLabel(run)}
              </div>
              <div className="text-[12px] font-mono text-accent tabular-nums">{overallPct}%</div>
            </div>
            <div className="h-1 bg-chrome-darkest rounded-full overflow-hidden">
              <div className={clsx("h-full transition-all duration-300",
                completed ? "bg-pass" : atGate ? "bg-warn" : "bg-accent")}
                style={{ width: overallPct + "%" }} />
            </div>
          </div>
        </div>

        {/* RCDD review gate — pause card */}
        {atGate && <GatePauseCard onApprove={releaseGate} busy={busy} projectId={project.id} />}

        {/* Document intake band */}
        <PhaseBand title="Document intake — sequential (Layers 1-4)" tone="info">
          {stagesInPhase("npe").map((d, i) => (
            <PhaseBandRow key={d.id} idx={i + 1} def={d} state={stateFor(d.id) ?? null} />
          ))}
        </PhaseBand>

        {/* Five parallel output lanes */}
        <PhaseBand title="Five simultaneous output lanes — parallel" tone="accent"
                   subtitle="Design, BOM, labor, permitting, and schedule generated from a single intake">
          <div className="grid grid-cols-5 gap-2 p-3">
            {stagesInPhase("lane").map(d => (
              <LaneCard key={d.id} def={d} state={stateFor(d.id) ?? null} />
            ))}
          </div>
        </PhaseBand>

        {/* Post-processing enforcement */}
        <PhaseBand title="Post-processing enforcement — parallel" tone="warn"
                   subtitle="Davis-Bacon · LC/UPC · production rate · permit triggers">
          <div className="grid grid-cols-4 gap-2 p-3">
            {stagesInPhase("enforce").map(d => (
              <EnforceCard key={d.id} def={d} state={stateFor(d.id) ?? null} />
            ))}
          </div>
        </PhaseBand>

        {/* RCDD review gate slot */}
        <PhaseBand title="RCDD review gate" tone="warn">
          <GateRow state={stateFor("rcdd_review_gate") ?? null} releasedAt={run.gateReleasedAt} />
        </PhaseBand>

        {/* Final delivery */}
        <PhaseBand title="Final delivery — sequential" tone="pass">
          {stagesInPhase("delivery").map((d, i) => (
            <PhaseBandRow key={d.id} idx={i + 1} def={d} state={stateFor(d.id) ?? null} />
          ))}
        </PhaseBand>

        {completed && (
          <div className="mt-4 border border-pass/30 bg-pass/5 rounded-[2px] px-4 py-3 flex items-center gap-3">
            <div className="text-[12px] text-pass font-medium">
              ✓ Pipeline complete — submittal artifacts uploaded to S3
            </div>
            <Link href={`/projects/${project.id}/results`} className="ml-auto btn btn-primary text-[12px] px-3 py-1.5">
              Open Results →
            </Link>
          </div>
        )}

      </div>
    </div>
  );
}

// ── Sub-components ───────────────────────────────────────────────────────

function currentLabel(run: PipelineRun): string {
  const def = STAGE_DEFS.find(d => d.id === run.currentStage);
  return def?.label ?? "Initializing";
}

const TONE_BORDER: Record<"info" | "warn" | "accent" | "pass", string> = {
  info:   "border-l-info",
  warn:   "border-l-warn",
  accent: "border-l-accent",
  pass:   "border-l-pass",
};
const TONE_TEXT: Record<"info" | "warn" | "accent" | "pass", string> = {
  info:   "text-info",
  warn:   "text-warn",
  accent: "text-accent",
  pass:   "text-pass",
};

function PhaseBand({
  title, subtitle, tone, children,
}: {
  title: string; subtitle?: string;
  tone: "info" | "warn" | "accent" | "pass";
  children: React.ReactNode;
}) {
  return (
    <section className={clsx("card mb-3 border-l-2", TONE_BORDER[tone])}>
      <div className="px-4 py-2 border-b border-chrome-dark flex items-baseline justify-between">
        <div className={clsx("text-[10px] uppercase tracking-[0.06em] font-mono", TONE_TEXT[tone])}>{title}</div>
        {subtitle && <div className="text-[9.5px] text-text4 font-mono">{subtitle}</div>}
      </div>
      <div>{children}</div>
    </section>
  );
}

function PhaseBandRow({ idx, def, state }: { idx: number; def: StageDef; state: StageState | null }) {
  const status = state?.status ?? "queued";
  const progress = state?.progress ?? 0;
  const { pillCls, icon } = pillFor(status, idx);
  return (
    <div className={clsx(
      "px-4 py-2.5 flex items-start gap-3 border-b border-chrome-dark last:border-b-0",
      status === "running" && "bg-accent/5",
      status === "paused"  && "bg-warn/5",
    )}>
      <span className={clsx(
        "w-6 h-6 rounded-full flex items-center justify-center text-[10.5px] font-mono font-medium flex-shrink-0",
        pillCls,
      )}>{icon}</span>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-3">
          {def.band && (
            <span className="text-[9.5px] font-mono text-text4 uppercase tracking-[0.06em]">{def.band}</span>
          )}
          <span className={clsx("text-[12px]",
            status === "done" ? "text-text2"
            : status === "running" || status === "paused" ? "text-text font-medium"
            : "text-text4",
          )}>{def.label}</span>
          {status === "running" && (
            <span className="text-[10px] font-mono text-accent tabular-nums">{Math.round(progress * 100)}%</span>
          )}
        </div>
        <div className="text-[10.5px] text-text4 mt-0.5">{def.subtitle}</div>
        {status === "running" && (
          <div className="mt-1.5 h-0.5 bg-chrome-darkest rounded-full overflow-hidden">
            <div className="h-full bg-accent transition-all duration-300" style={{ width: progress * 100 + "%" }} />
          </div>
        )}
      </div>
    </div>
  );
}

/** Compact card used for output lanes — one per lane, in a 5-column grid. */
function LaneCard({ def, state }: { def: StageDef; state: StageState | null }) {
  const status = state?.status ?? "queued";
  const progress = state?.progress ?? 0;
  return (
    <div className={clsx(
      "border border-chrome-dark rounded-[2px] p-2.5 bg-chrome-darkest/40 flex flex-col gap-1.5",
      status === "running" && "border-accent/40 bg-accent/5",
      status === "done"    && "border-pass/40 bg-pass/5",
    )}>
      <div className="flex items-baseline justify-between">
        <span className={clsx(
          "text-[9.5px] font-mono uppercase tracking-[0.06em]",
          status === "done" ? "text-pass" : status === "running" ? "text-accent" : "text-text4",
        )}>{def.band}</span>
        <span className={clsx(
          "text-[10.5px] font-mono tabular-nums",
          status === "done" ? "text-pass" : status === "running" ? "text-accent" : "text-text4",
        )}>
          {status === "done" ? "✓" : status === "running" ? `${Math.round(progress * 100)}%` : "—"}
        </span>
      </div>
      <div className={clsx(
        "text-[11px] leading-tight",
        status === "queued" ? "text-text3" : "text-text",
      )}>{def.label}</div>
      <div className="text-[9.5px] text-text4 leading-snug line-clamp-2">{def.subtitle}</div>
      <div className="mt-auto h-0.5 bg-chrome-darkest rounded-full overflow-hidden">
        <div className={clsx(
          "h-full transition-all duration-300",
          status === "done" ? "bg-pass" : "bg-accent",
        )} style={{ width: (status === "done" ? 100 : progress * 100) + "%" }} />
      </div>
    </div>
  );
}

/** Compact card used for enforcement modules — one per module, in a 4-column grid. */
function EnforceCard({ def, state }: { def: StageDef; state: StageState | null }) {
  const status = state?.status ?? "queued";
  const progress = state?.progress ?? 0;
  return (
    <div className={clsx(
      "border border-chrome-dark rounded-[2px] p-2.5 bg-chrome-darkest/40 flex flex-col gap-1.5",
      status === "running" && "border-warn/40 bg-warn/5",
      status === "done"    && "border-pass/40 bg-pass/5",
    )}>
      <div className="flex items-baseline justify-between">
        <span className={clsx(
          "text-[9.5px] font-mono uppercase tracking-[0.06em]",
          status === "done" ? "text-pass" : status === "running" ? "text-warn" : "text-text4",
        )}>Enforce</span>
        <span className={clsx(
          "text-[10.5px] font-mono tabular-nums",
          status === "done" ? "text-pass" : status === "running" ? "text-warn" : "text-text4",
        )}>
          {status === "done" ? "✓" : status === "running" ? `${Math.round(progress * 100)}%` : "—"}
        </span>
      </div>
      <div className={clsx(
        "text-[11px] leading-tight",
        status === "queued" ? "text-text3" : "text-text",
      )}>{def.label}</div>
      <div className="text-[9.5px] text-text4 leading-snug line-clamp-2">{def.subtitle}</div>
    </div>
  );
}

function GateRow({ state, releasedAt }: { state: StageState | null; releasedAt: string | null }) {
  const status = state?.status ?? "queued";
  const label =
    status === "paused" ? "Paused — awaiting RCDD release"
    : status === "done" ? `Released ${releasedAt ? new Date(releasedAt).toLocaleTimeString() : ""}`
    : status === "queued" ? "Queued"
    : "Running";
  const cls = status === "paused" ? "text-warn" : status === "done" ? "text-pass" : "text-text3";
  return (
    <div className={clsx("px-4 py-2.5 flex items-center gap-3", status === "paused" && "bg-warn/5")}>
      <span className={clsx(
        "w-6 h-6 rounded-full flex items-center justify-center text-[12px] flex-shrink-0",
        status === "paused" ? "bg-warn/20 text-warn"
          : status === "done" ? "bg-pass/20 text-pass"
          : "bg-chrome-dark text-text4 border border-chrome-lighter",
      )}>{status === "paused" ? "⏸" : status === "done" ? "✓" : "·"}</span>
      <div className="flex-1">
        <div className="text-[12px] text-text2">RCDD review gate</div>
        <div className="text-[10.5px] text-text4">{label}</div>
      </div>
      <span className={clsx("text-[10.5px] font-mono uppercase tracking-[0.06em]", cls)}>
        {status}
      </span>
    </div>
  );
}

function GatePauseCard({ onApprove, busy, projectId }: { onApprove: () => void; busy: boolean; projectId: string }) {
  return (
    <div className="card mb-5 border-l-2 border-l-warn">
      <div className="card-body">
        <div className="flex items-start gap-4">
          <div className="w-9 h-9 rounded-full bg-warn/15 text-warn flex items-center justify-center text-[16px] flex-shrink-0">⏸</div>
          <div className="flex-1 min-w-0">
            <div className="text-[10px] uppercase tracking-[0.06em] text-warn font-mono mb-1">RCDD review gate</div>
            <div className="text-[14px] text-text font-medium mb-1">All five output lanes generated · approve to deliver construction documents</div>
            <div className="text-[11.5px] text-text3 leading-relaxed mb-3">
              The 4 NPE layers, 5 output lanes, and 4 enforcement modules have completed. The
              RCDD must release the gate to run construction drawing, PDF export, and S3 upload.
            </div>
            <div className="flex items-center gap-2">
              <button onClick={onApprove} disabled={busy}
                className="btn btn-primary text-[12px] px-3 py-2 font-medium disabled:opacity-60">
                {busy ? "Releasing…" : "Approve and continue →"}
              </button>
              <Link href={`/projects/${projectId}/review`}
                    className="btn btn-ghost text-[11.5px]">Open review queue</Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function pillFor(status: StageStatus, idx: number): { pillCls: string; icon: React.ReactNode } {
  if (status === "done") return { pillCls: "bg-pass text-chrome-darkest", icon: <span>✓</span> };
  if (status === "running") return { pillCls: "bg-accent text-chrome-darkest animate-pulse", icon: <span>…</span> };
  if (status === "paused") return { pillCls: "bg-warn text-chrome-darkest", icon: <span>⏸</span> };
  if (status === "failed") return { pillCls: "bg-fail text-white", icon: <span>✕</span> };
  return { pillCls: "bg-chrome-dark border border-chrome-lighter text-text4", icon: <span>{idx}</span> };
}
