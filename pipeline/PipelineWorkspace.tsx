"use client";

// Pipeline workspace — Revit-style CAD shell wrapping the parallel-lane
// pipeline view. Same phase architecture as PipelineRunner (NPE preprocessing
// → 5 lanes → 4 enforcement modules → gate → delivery) but rendered inside
// AppFrame with a real ProjectBrowser, PropertiesPalette, and StatusBar so
// the patent's "simultaneous parallel generation" claim reads as CAD-grade.

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import clsx from "clsx";
import type { Project } from "@/lib/projects/types";
import type { PipelineRun, StageDef, StageState, StageStatus, StagePhase } from "@/lib/pipeline/types";
import { STAGE_DEFS, stagesInPhase } from "@/lib/pipeline/types";
import { pipelineClient } from "@/lib/pipeline/client";
import { AppFrame } from "@/components/shell/cad/AppFrame";
import { RibbonBar, type RibbonTabId } from "@/components/shell/cad/RibbonBar";
import { ToolPalette, type ToolGroup } from "@/components/shell/cad/ToolPalette";
import { ProjectBrowser, type BrowserNode } from "@/components/shell/cad/ProjectBrowser";
import { PropertiesPalette, type PropertySection } from "@/components/shell/cad/PropertiesPalette";
import { StatusBar } from "@/components/shell/cad/StatusBar";

export function PipelineWorkspace({
  project, identity, initialRun,
}: { project: Project; identity?: string; initialRun: PipelineRun | null }) {
  const [run, setRun] = useState<PipelineRun | null>(initialRun);
  const [busy, setBusy] = useState(false);
  const [activeTab, setActiveTab] = useState<RibbonTabId>("analyze");
  const [activeToolId, setActiveToolId] = useState<string>("run");
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Polling while the pipeline is in motion (not paused at gate, not completed)
  useEffect(() => {
    function stop() { if (pollRef.current) { clearInterval(pollRef.current); pollRef.current = null; } }
    if (!run) { stop(); return; }
    const completed = !!run.completedAt;
    const atGate = run.currentStage === "rcdd_review_gate" && !run.gateReleasedAt;
    if (completed || atGate) { stop(); return; }
    if (pollRef.current) return;
    pollRef.current = setInterval(async () => {
      const res = await pipelineClient.status(project.id);
      if (res.ok && res.run) setRun(res.run);
    }, 500);
    return stop;
  }, [run, project.id]);

  async function startRun()   { setBusy(true); const r = await pipelineClient.start(project.id);       if (r.ok && r.run) setRun(r.run); setBusy(false); }
  async function release()    { setBusy(true); const r = await pipelineClient.releaseGate(project.id); if (r.ok && r.run) setRun(r.run); setBusy(false); }
  async function resetRun()   { setBusy(true); await pipelineClient.reset(project.id); setRun(null); setBusy(false); }

  function stateFor(sid: StageDef["id"]): StageState | undefined {
    return run?.stages.find(s => s.id === sid);
  }

  const overallPct = run ? Math.round(run.overallProgress * 100) : 0;
  const atGate    = !!run && run.currentStage === "rcdd_review_gate" && !run.gateReleasedAt;
  const completed = !!run?.completedAt;
  const elapsedSec = run ? Math.round((Date.now() - new Date(run.startedAt).getTime()) / 1000) : 0;

  // Counts for the properties palette + status bar
  const counts = useMemo(() => {
    if (!run) return { queued: 0, running: 0, done: 0, paused: 0, total: STAGE_DEFS.length };
    const c = { queued: 0, running: 0, done: 0, paused: 0, total: run.stages.length };
    for (const s of run.stages) {
      if (s.status === "queued") c.queued++;
      else if (s.status === "running") c.running++;
      else if (s.status === "done") c.done++;
      else if (s.status === "paused") c.paused++;
    }
    return c;
  }, [run]);

  // ── Tool palette ─────────────────────────────────────────────────────
  const toolGroups: ToolGroup[] = [
    {
      id: "run", label: "Run", tools: [
        { id: "run",        icon: "ti-player-play",  label: run ? "Restart" : "Start" },
        { id: "release",    icon: "ti-arrow-bar-to-right", label: "Release Gate", disabled: !atGate },
        { id: "reset",      icon: "ti-refresh",      label: "Reset", disabled: !run },
      ],
    },
    {
      id: "inspect", label: "Inspect", tools: [
        { id: "step",   icon: "ti-arrow-narrow-right", label: "Step", disabled: true },
        { id: "live",   icon: "ti-activity",  label: "Live", disabled: true },
        { id: "trace",  icon: "ti-list-tree", label: "Trace" },
      ],
    },
    {
      id: "export", label: "Export", tools: [
        { id: "p6",     icon: "ti-file-export", label: "P6 XML" },
        { id: "g703",   icon: "ti-file-spreadsheet", label: "AIA G703", disabled: true },
        { id: "report", icon: "ti-file-text",   label: "Report" },
      ],
    },
    {
      id: "verify", label: "Verify", tools: [
        { id: "compliance", icon: "ti-shield-check", label: "Compliance" },
        { id: "enforcement", icon: "ti-gavel",       label: "Enforce" },
      ],
    },
  ];

  // ── Project Browser ──────────────────────────────────────────────────
  const browserSections: BrowserNode[] = [
    {
      id: "views", label: "Views", icon: "ti-eye",
      children: [
        { id: "view-pipeline", label: "Pipeline Run", meta: "active" },
        { id: "view-cable-plan", label: "Cable Plan" },
        { id: "view-pathway", label: "Pathway Routing", href: `/projects/${project.id}/pathway` },
      ],
    },
    {
      id: "phases", label: "Phases", icon: "ti-stack-3",
      children: [
        { id: "phase-npe",      label: "NPE preprocessing", meta: `${stagesInPhase("npe").length}` },
        { id: "phase-lanes",    label: "Output lanes (parallel)", meta: `${stagesInPhase("lane").length}` },
        { id: "phase-enforce",  label: "Enforcement (parallel)",  meta: `${stagesInPhase("enforce").length}` },
        { id: "phase-gate",     label: "RCDD review gate" },
        { id: "phase-delivery", label: "Delivery",  meta: `${stagesInPhase("delivery").length}` },
      ],
    },
    {
      id: "outputs", label: "Outputs", icon: "ti-package",
      children: [
        { id: "out-bom",     label: "Bill of Materials" },
        { id: "out-labor",   label: "Labor SOV" },
        { id: "out-permits", label: "Permit Triggers" },
        { id: "out-cpm",     label: "CPM Schedule" },
        { id: "out-p6",      label: "Primavera P6 XML" },
      ],
    },
  ];

  // ── Properties palette content ───────────────────────────────────────
  const currentDef = STAGE_DEFS.find(d => d.id === run?.currentStage);
  const propsSections: PropertySection[] = run ? [
    {
      id: "run", label: "Run", defaultOpen: true,
      rows: [
        { label: "Run ID",   value: run.id, mono: true },
        { label: "Started",  value: new Date(run.startedAt).toLocaleTimeString(), mono: true },
        { label: "Elapsed",  value: `${elapsedSec} s`, mono: true },
        { label: "Progress", value: `${overallPct}%`,  mono: true, tone: completed ? "pass" : atGate ? "warn" : "text" },
        { label: "Strategy", value: "deterministic_mock", mono: true, tone: "text2" },
      ],
    },
    {
      id: "active", label: "Active Stage", defaultOpen: true,
      rows: currentDef ? [
        { label: "Phase", value: currentDef.phase.toUpperCase(), tone: "text" },
        { label: "Band",  value: currentDef.band ?? "—" },
        { label: "Stage", value: currentDef.label },
        { label: "State",
          value: atGate ? "paused" : completed ? "done" : (stateFor(currentDef.id)?.status ?? "—"),
          tone: atGate ? "warn" : completed ? "pass" : "text" },
      ] : [
        { label: "Stage", value: "None", tone: "text2" },
      ],
    },
    {
      id: "counts", label: "Stage Counts", defaultOpen: true,
      rows: [
        { label: "Done",    value: String(counts.done),    mono: true, tone: "pass" },
        { label: "Running", value: String(counts.running), mono: true, tone: "text" },
        { label: "Paused",  value: String(counts.paused),  mono: true, tone: counts.paused ? "warn" : "text2" },
        { label: "Queued",  value: String(counts.queued),  mono: true, tone: "text2" },
        { label: "Total",   value: String(counts.total),   mono: true, tone: "text2" },
      ],
    },
  ] : [];

  // ── Tool actions ─────────────────────────────────────────────────────
  function handleTool(id: string) {
    setActiveToolId(id);
    if (id === "run") void startRun();
    else if (id === "release" && atGate) void release();
    else if (id === "reset") void resetRun();
  }

  return (
    <AppFrame
      title={`${project.name}.toro`}
      identity={identity ?? `${project.owner} · ${project.number}`}
      ribbon={<RibbonBar active={activeTab} onChange={setActiveTab} />}
      toolPalette={
        <ToolPalette
          groups={toolGroups}
          activeToolId={activeToolId}
          onTool={handleTool}
          trailing={
            <>
              <span className="text-text4">Phases:</span>
              <span className="text-text2">Intake → 5 parallel lanes → enforcement → gate → delivery</span>
              <Link href={`/projects/${project.id}`} className="ml-3 text-info hover:text-accent text-[11px] inline-flex items-center gap-1">
                <i className="ti ti-arrow-left" style={{ fontSize: 11 }} aria-hidden="true" /> Project
              </Link>
            </>
          }
        />
      }
      browser={
        <ProjectBrowser
          projectName={project.name}
          sections={browserSections}
          currentNodeId="view-pipeline"
        />
      }
      canvas={
        <PipelineCanvas run={run} busy={busy} atGate={atGate} onRelease={release}
                        projectId={project.id} onStart={startRun} />
      }
      properties={
        <PropertiesPalette
          selectionLabel={run ? "Pipeline Run" : undefined}
          selectionSubtitle={run ? run.id : undefined}
          selectionIcon="ti-cpu"
          selectionTone={completed ? "pass" : atGate ? "warn" : "accent"}
          sections={propsSections}
          empty={
            <div>
              <div className="text-text2 font-medium mb-1">No active run</div>
              <div className="text-text3 leading-snug">
                Click <span className="text-accent">Start</span> in the ribbon to run the
                project pipeline. Four sequential intake layers feed five simultaneous output
                lanes (Design / BOM / Labor / Permitting / Schedule), then four parallel
                enforcement modules, the RCDD review gate, and final delivery.
              </div>
            </div>
          }
        />
      }
      status={
        <StatusBar
          segments={[
            { kind: "coord", text: run ? `Run ${run.id.slice(0, 12)}…` : "No run" },
            { kind: "coord", text: `Elapsed ${elapsedSec}s` },
            { kind: completed ? "pass" : atGate ? "warn" : "info", text: `${overallPct}%`,
              icon: completed ? "ti-circle-check" : atGate ? "ti-player-pause" : "ti-loader" },
            { text: `${counts.done}/${counts.total} stages done` },
          ]}
          trailing={[
            { icon: "ti-stack-3", text: "Phases: 5 · NPE → Lanes → Enforce → Gate → Delivery" },
            { kind: "warn", text: atGate ? "Awaiting RCDD release" : completed ? "Ready to stamp" : busy ? "Working…" : "Idle" },
          ]}
        />
      }
    />
  );
}

// ── Canvas — the phase bands ──────────────────────────────────────────────

function PipelineCanvas({
  run, busy, atGate, onRelease, onStart, projectId,
}: {
  run: PipelineRun | null;
  busy: boolean;
  atGate: boolean;
  onRelease: () => void;
  onStart: () => void;
  projectId: string;
}) {
  function stateFor(sid: StageDef["id"]): StageState | undefined {
    return run?.stages.find(s => s.id === sid);
  }

  return (
    <div className="w-full h-full overflow-y-auto bg-canvas-bg p-5">
      <div className="max-w-[1200px] mx-auto">

        <div className="mb-5 flex items-start justify-between gap-4">
          <div>
            <div className="text-[10px] uppercase tracking-[0.06em] text-canvas-text2 font-mono mb-1">Project Pipeline</div>
            <h1 className="text-[18px] text-canvas-text font-medium">
              {run?.completedAt ? "Pipeline complete" : atGate ? "Awaiting RCDD review" : run ? "Pipeline running" : "Pipeline ready"}
            </h1>
          </div>
          {!run && (
            <button onClick={onStart} disabled={busy}
              className="bg-accent text-chrome-darkest font-medium px-4 py-2 text-[12px] rounded-[2px] hover:bg-accent-strong">
              {busy ? "Starting…" : "Run pipeline →"}
            </button>
          )}
        </div>

        {/* Document intake — sequential */}
        <CanvasBand title="Document intake — sequential (Layers 1-4)" tone="info">
          {stagesInPhase("npe").map((d, i) => (
            <CanvasStageRow key={d.id} idx={i + 1} def={d} state={stateFor(d.id) ?? null} />
          ))}
        </CanvasBand>

        {/* Five lanes — parallel */}
        <CanvasBand title="Five simultaneous output lanes — parallel"
                    subtitle="Design, BOM, labor, permitting, and schedule generated from a single intake" tone="accent">
          <div className="grid grid-cols-5 gap-2 p-2.5">
            {stagesInPhase("lane").map(d => (
              <CanvasLaneCard key={d.id} def={d} state={stateFor(d.id) ?? null} />
            ))}
          </div>
        </CanvasBand>

        {/* Enforcement — parallel */}
        <CanvasBand title="Post-processing enforcement — parallel"
                    subtitle="Davis-Bacon · LC/UPC · production rate · permit triggers" tone="warn">
          <div className="grid grid-cols-4 gap-2 p-2.5">
            {stagesInPhase("enforce").map(d => (
              <CanvasEnforceCard key={d.id} def={d} state={stateFor(d.id) ?? null} />
            ))}
          </div>
        </CanvasBand>

        {/* Gate */}
        <CanvasBand title="RCDD review gate" tone="warn">
          <CanvasGateRow def={STAGE_DEFS.find(d => d.id === "rcdd_review_gate")!} state={stateFor("rcdd_review_gate") ?? null}
                         atGate={atGate} busy={busy} onRelease={onRelease} projectId={projectId} />
        </CanvasBand>

        {/* Delivery */}
        <CanvasBand title="Final delivery — sequential" tone="pass">
          {stagesInPhase("delivery").map((d, i) => (
            <CanvasStageRow key={d.id} idx={i + 1} def={d} state={stateFor(d.id) ?? null} />
          ))}
        </CanvasBand>

      </div>
    </div>
  );
}

// ── Canvas atoms ─────────────────────────────────────────────────────────

const BAND_BORDER: Record<"info" | "accent" | "warn" | "pass", string> = {
  info:   "border-l-info",
  accent: "border-l-accent",
  warn:   "border-l-warn",
  pass:   "border-l-pass",
};

function CanvasBand({
  title, subtitle, tone, children,
}: {
  title: string; subtitle?: string;
  tone: "info" | "accent" | "warn" | "pass";
  children: React.ReactNode;
}) {
  return (
    <section className={clsx("bg-white border border-[#dcdcd6] border-l-[3px] mb-3", BAND_BORDER[tone])}>
      <div className="px-3 py-1.5 border-b border-[#dcdcd6] flex items-baseline justify-between">
        <div className="text-[10px] uppercase tracking-[0.06em] font-mono text-canvas-text">{title}</div>
        {subtitle && <div className="text-[9.5px] text-canvas-text2 font-mono">{subtitle}</div>}
      </div>
      <div>{children}</div>
    </section>
  );
}

function CanvasStageRow({ idx, def, state }: { idx: number; def: StageDef; state: StageState | null }) {
  const status = state?.status ?? "queued";
  const progress = state?.progress ?? 0;
  const { pillCls, icon } = pillFor(status, idx);
  return (
    <div className={clsx(
      "px-3 py-2 flex items-start gap-3 border-b border-[#dcdcd6] last:border-b-0",
      status === "running" && "bg-accent-soft",
      status === "paused"  && "bg-warn/10",
    )}>
      <span className={clsx(
        "w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-mono font-medium flex-shrink-0",
        pillCls,
      )}>{icon}</span>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          {def.band && <span className="text-[9.5px] font-mono text-canvas-text2 uppercase tracking-[0.06em]">{def.band}</span>}
          <span className={clsx("text-[11.5px]",
            status === "done" ? "text-canvas-text"
            : status === "running" || status === "paused" ? "text-canvas-text font-medium"
            : "text-canvas-text2",
          )}>{def.label}</span>
          {status === "running" && (
            <span className="text-[10px] font-mono text-accent-strong tabular-nums">{Math.round(progress * 100)}%</span>
          )}
        </div>
        <div className="text-[10px] text-canvas-text2 mt-0.5">{def.subtitle}</div>
        {status === "running" && (
          <div className="mt-1 h-0.5 bg-[#e8e8e0] overflow-hidden">
            <div className="h-full bg-accent" style={{ width: progress * 100 + "%" }} />
          </div>
        )}
      </div>
    </div>
  );
}

function CanvasLaneCard({ def, state }: { def: StageDef; state: StageState | null }) {
  const status = state?.status ?? "queued";
  const progress = state?.progress ?? 0;
  return (
    <div className={clsx(
      "border border-[#dcdcd6] p-2.5 bg-white flex flex-col gap-1.5 min-h-[80px]",
      status === "running" && "border-accent bg-accent-soft",
      status === "done"    && "border-pass/60 bg-pass/10",
    )}>
      <div className="flex items-baseline justify-between">
        <span className={clsx(
          "text-[9.5px] font-mono uppercase tracking-[0.06em]",
          status === "done" ? "text-pass" : status === "running" ? "text-accent-strong" : "text-canvas-text2",
        )}>{def.band}</span>
        <span className={clsx(
          "text-[10.5px] font-mono tabular-nums",
          status === "done" ? "text-pass" : status === "running" ? "text-accent-strong" : "text-canvas-text2",
        )}>
          {status === "done" ? "✓" : status === "running" ? `${Math.round(progress * 100)}%` : "—"}
        </span>
      </div>
      <div className="text-[11px] leading-tight text-canvas-text font-medium">{def.label}</div>
      <div className="text-[9.5px] text-canvas-text2 leading-snug line-clamp-2">{def.subtitle}</div>
      <div className="mt-auto h-0.5 bg-[#e8e8e0]">
        <div className={clsx("h-full", status === "done" ? "bg-pass" : "bg-accent")}
             style={{ width: (status === "done" ? 100 : progress * 100) + "%" }} />
      </div>
    </div>
  );
}

function CanvasEnforceCard({ def, state }: { def: StageDef; state: StageState | null }) {
  const status = state?.status ?? "queued";
  return (
    <div className={clsx(
      "border border-[#dcdcd6] p-2.5 bg-white flex flex-col gap-1.5 min-h-[70px]",
      status === "running" && "border-warn bg-warn/10",
      status === "done"    && "border-pass/60 bg-pass/10",
    )}>
      <div className="flex items-baseline justify-between">
        <span className={clsx(
          "text-[9.5px] font-mono uppercase tracking-[0.06em]",
          status === "done" ? "text-pass" : status === "running" ? "text-warn" : "text-canvas-text2",
        )}>Enforce</span>
        <span className={clsx("text-[10.5px] font-mono tabular-nums",
          status === "done" ? "text-pass" : status === "running" ? "text-warn" : "text-canvas-text2")}>
          {status === "done" ? "✓" : status === "running" ? "…" : "—"}
        </span>
      </div>
      <div className="text-[11px] leading-tight text-canvas-text font-medium">{def.label}</div>
      <div className="text-[9.5px] text-canvas-text2 leading-snug line-clamp-2">{def.subtitle}</div>
    </div>
  );
}

function CanvasGateRow({
  def, state, atGate, busy, onRelease, projectId,
}: {
  def: StageDef; state: StageState | null;
  atGate: boolean; busy: boolean; onRelease: () => void; projectId: string;
}) {
  const status = state?.status ?? "queued";
  return (
    <div className={clsx("px-3 py-3", atGate && "bg-warn/10")}>
      <div className="flex items-start gap-3">
        <span className={clsx(
          "w-7 h-7 rounded-full flex items-center justify-center text-[13px] flex-shrink-0",
          atGate ? "bg-warn text-chrome-darkest" : status === "done" ? "bg-pass text-chrome-darkest" : "bg-[#dcdcd6] text-canvas-text2",
        )}>{atGate ? "⏸" : status === "done" ? "✓" : "·"}</span>
        <div className="flex-1 min-w-0">
          <div className="text-[12px] text-canvas-text font-medium">{def.label}</div>
          <div className="text-[10.5px] text-canvas-text2 mt-0.5 leading-snug">{def.subtitle}</div>
          {atGate && (
            <div className="mt-2 flex items-center gap-2">
              <button onClick={onRelease} disabled={busy}
                className="bg-accent text-chrome-darkest font-medium px-3 py-1.5 text-[11px] rounded-[1px] hover:bg-accent-strong">
                {busy ? "Releasing…" : "Approve and continue →"}
              </button>
              <Link href={`/projects/${projectId}/review`}
                    className="text-[11px] text-info hover:text-accent">Open review queue</Link>
            </div>
          )}
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
  return { pillCls: "bg-[#dcdcd6] text-canvas-text2", icon: <span>{idx}</span> };
}
