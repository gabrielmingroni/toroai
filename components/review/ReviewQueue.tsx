"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import clsx from "clsx";
import type { Project } from "@/lib/projects/types";
import type { ExtractedRoom } from "@/lib/intake/types";
import { ROOM_TYPE_LABEL } from "@/lib/intake/types";
import type { PlacementState, ApprovalState } from "@/lib/placement/types";
import type { ComplianceResult, ComplianceRule } from "@/lib/results/types";
import type { PipelineRun } from "@/lib/pipeline/types";
import { STAGE_DEFS } from "@/lib/pipeline/types";
import type { Sheet, SheetMarkupCounts } from "@/lib/markup/types";
import { placementClient } from "@/lib/placement/client";
import { pipelineClient } from "@/lib/pipeline/client";

/** Pipeline state from the review-queue's perspective. */
type PipelinePhase =
  | "none"        // no run started yet
  | "pre_gate"    // run in motion, hasn't hit the gate
  | "at_gate"     // paused at the RCDD review gate — release is enabled
  | "post_gate"   // gate released, drawings/PDF/upload still running
  | "complete";   // all stages done

function phaseOf(run: PipelineRun | null): PipelinePhase {
  if (!run) return "none";
  if (run.completedAt) return "complete";
  if (run.currentStage === "rcdd_review_gate" && !run.gateReleasedAt) return "at_gate";
  if (run.gateReleasedAt) return "post_gate";
  return "pre_gate";
}

export function ReviewQueue({
  project, placements, rooms, compliance, initialRun, sheets, sheetCounts,
}: {
  project: Project;
  placements: PlacementState | null;
  rooms: ExtractedRoom[];
  compliance: ComplianceResult | null;
  initialRun: PipelineRun | null;
  sheets: Sheet[];
  sheetCounts: Record<string, SheetMarkupCounts>;
}) {
  const router = useRouter();

  // Local state for the placement state — we mutate this as the user approves
  const [state, setState] = useState<PlacementState | null>(placements);
  // Per-advisory acknowledgement (UI state only — would persist in real backend)
  const [ackd, setAckd] = useState<Set<string>>(new Set());
  // Sign-off checklist
  const [sign, setSign] = useState({ placements: false, advisories: false, standards: false });

  // Live pipeline run snapshot — server passes the initial value, then we poll
  // so the UI flips to "at gate" as soon as pre-gate stages finish, without a
  // manual reload.
  const [run, setRun] = useState<PipelineRun | null>(initialRun);
  const phase = phaseOf(run);
  const atGate = phase === "at_gate";

  // Poll only while the pipeline is in motion. Once we're paused at the gate
  // nothing changes server-side until release, and once we're post_gate the
  // user is redirected to /pipeline anyway.
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  useEffect(() => {
    function stop() { if (pollRef.current) { clearInterval(pollRef.current); pollRef.current = null; } }
    if (phase !== "pre_gate" && phase !== "post_gate") { stop(); return; }
    if (pollRef.current) return;
    pollRef.current = setInterval(async () => {
      const res = await pipelineClient.status(project.id);
      if (res.ok) setRun(res.run ?? null);
    }, 800);
    return stop;
  }, [phase, project.id]);

  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Derive pending sets
  const pendingOutlets = useMemo(
    () => state?.outlets.filter(o => o.approval === "pending") ?? [],
    [state]
  );
  const pendingWaps = useMemo(
    () => state?.waps.filter(w => w.approval === "pending") ?? [],
    [state]
  );

  const advisories = useMemo<ComplianceRule[]>(
    () => compliance?.rules.filter(r => r.status === "advisory" || r.status === "fail") ?? [],
    [compliance]
  );

  const advisoriesPending = advisories.filter(a => !ackd.has(a.code));
  const allPlacementsCleared = pendingOutlets.length === 0 && pendingWaps.length === 0;
  const allAdvisoriesCleared = advisoriesPending.length === 0;

  // Can we release the gate? Only if everything is cleared AND user signed off
  const canRelease = allPlacementsCleared && allAdvisoriesCleared
    && sign.placements && sign.advisories && sign.standards;

  function roomNameFor(roomId: string | null): string {
    if (!roomId) return "—";
    const r = rooms.find(x => x.id === roomId);
    return r ? r.overrideName ?? r.name : roomId;
  }

  async function setOutletApproval(id: string, approval: ApprovalState) {
    setBusy(true);
    const res = await placementClient.setOutletApproval(project.id, id, approval);
    if (res.ok && res.state) setState(res.state);
    setBusy(false);
  }
  async function setWapApproval(id: string, approval: ApprovalState) {
    setBusy(true);
    const res = await placementClient.setWapApproval(project.id, id, approval);
    if (res.ok && res.state) setState(res.state);
    setBusy(false);
  }
  async function approveAllPending() {
    setBusy(true);
    const res = await placementClient.approveAllPending(project.id);
    if (res.ok && res.state) setState(res.state);
    setBusy(false);
  }

  function ackOne(code: string)  { setAckd(prev => new Set(prev).add(code)); }
  function ackAll()              { setAckd(new Set(advisories.map(a => a.code))); }

  async function releaseGate() {
    setError(null);
    if (!canRelease) return;
    setBusy(true);
    if (phase === "at_gate") {
      const res = await pipelineClient.releaseGate(project.id);
      if (!res.ok) {
        setError(res.error?.message ?? "Could not release gate.");
        setBusy(false);
        return;
      }
      router.push(`/projects/${project.id}/pipeline`);
      router.refresh();
    } else if (phase === "complete") {
      router.push(`/projects/${project.id}/results`);
    } else {
      // pre_gate, post_gate, or none — nothing to release yet. Send the user
      // to the pipeline page so they can either watch progress or start a run.
      router.push(`/projects/${project.id}/pipeline`);
    }
    setBusy(false);
  }

  // ── Empty / not-ready state ─────────────────────────────────────────────
  if (!state || !compliance) {
    return (
      <div className="h-full overflow-y-auto p-6">
        <div className="max-w-[700px]">
          <h1 className="text-[20px] font-semibold mb-1">RCDD Review</h1>
          <p className="text-[11.5px] text-text3 font-mono mb-4">
            Review is computed from the project state — intake + design parameters + placements must be complete first.
          </p>
          <div className="card p-5 text-[12px] text-text2">
            Open the project and finish intake + Pre-Design before opening review.
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full overflow-y-auto">
      <div className="p-6 max-w-[1000px]">

        {/* Header */}
        <header className="mb-5 flex items-start justify-between gap-4">
          <div>
            <h1 className="text-[20px] font-semibold mb-1">RCDD Review queue</h1>
            <p className="text-[11.5px] text-text3 font-mono">
              {project.name} · {project.number}
              <PhaseChip phase={phase} />
            </p>
          </div>
          <div className="flex items-center gap-3">
            <SummaryBadge label="Placements"  count={pendingOutlets.length + pendingWaps.length} clearedCount={state.outlets.length + state.waps.length - pendingOutlets.length - pendingWaps.length} />
            <SummaryBadge label="Advisories"  count={advisoriesPending.length}                   clearedCount={advisories.length - advisoriesPending.length} />
          </div>
        </header>

        <PhaseBanner phase={phase} run={run} projectId={project.id} />

        {/* Pending placements */}
        <section className="card mb-5">
          <div className="card-header">
            <div className="card-title">Pending placements · {pendingOutlets.length + pendingWaps.length}</div>
            {(pendingOutlets.length + pendingWaps.length) > 0 && (
              <button onClick={approveAllPending} disabled={busy}
                      className="text-[10.5px] text-pass hover:text-text font-mono">
                Approve all
              </button>
            )}
          </div>
          {pendingOutlets.length + pendingWaps.length === 0 ? (
            <div className="card-body text-[11.5px] text-pass">
              ✓ All placements have been approved or rejected.
            </div>
          ) : (
            <div className="divide-y divide-chrome-dark">
              {pendingOutlets.map(o => (
                <PendingRow
                  key={o.id}
                  kind="Outlet"
                  id={o.id}
                  detail={`${roomNameFor(o.roomId)} · ${o.ports}-port · Floor ${o.floor}`}
                  source={o.source}
                  onApprove={() => setOutletApproval(o.id, "approved")}
                  onReject={() => setOutletApproval(o.id, "rejected")}
                  busy={busy}
                />
              ))}
              {pendingWaps.map(w => (
                <PendingRow
                  key={w.id}
                  kind="WAP"
                  id={w.id}
                  detail={`${roomNameFor(w.roomId)} · ${w.coverageRadiusFt} ft coverage · Floor ${w.floor}`}
                  source={w.source}
                  onApprove={() => setWapApproval(w.id, "approved")}
                  onReject={() => setWapApproval(w.id, "rejected")}
                  busy={busy}
                />
              ))}
            </div>
          )}
        </section>

        {/* Compliance advisories */}
        <section className="card mb-5">
          <div className="card-header">
            <div className="card-title">Compliance · {advisoriesPending.length} pending</div>
            {advisoriesPending.length > 0 && (
              <button onClick={ackAll} disabled={busy}
                      className="text-[10.5px] text-warn hover:text-text font-mono">
                Acknowledge all
              </button>
            )}
          </div>
          {advisories.length === 0 ? (
            <div className="card-body text-[11.5px] text-pass">
              ✓ All 20 BICSI / TIA / NEC checks passing.
            </div>
          ) : (
            <div className="divide-y divide-chrome-dark">
              {advisories.map(a => (
                <AdvisoryRow
                  key={a.code}
                  rule={a}
                  acknowledged={ackd.has(a.code)}
                  onAck={() => ackOne(a.code)}
                  projectId={project.id}
                />
              ))}
            </div>
          )}
        </section>

        {/* Drawing sheets — markup workflow */}
        <section className="card mb-5">
          <div className="card-header">
            <div className="card-title">
              Drawing sheets · {sheets.length}
              {(() => {
                const openTotal = sheets.reduce((s, sh) => s + (sheetCounts[sh.id]?.open ?? 0) + (sheetCounts[sh.id]?.in_review ?? 0), 0);
                return openTotal > 0
                  ? <span className="ml-2 text-[10.5px] text-warn font-mono">· {openTotal} open markup{openTotal === 1 ? "" : "s"}</span>
                  : <span className="ml-2 text-[10.5px] text-pass font-mono">· no open markups</span>;
              })()}
            </div>
            <span className="text-[10px] text-text4 font-mono uppercase tracking-[0.06em]">Markup · Bluebeam-style</span>
          </div>
          {sheets.length === 0 ? (
            <div className="card-body text-[11.5px] text-text3">No sheets in the set yet.</div>
          ) : (
            <div className="divide-y divide-chrome-dark">
              {sheets.map(sh => {
                const c = sheetCounts[sh.id] ?? { open: 0, in_review: 0, resolved: 0, wont_fix: 0, total: 0 };
                const openish = c.open + c.in_review;
                return (
                  <Link
                    key={sh.id}
                    href={`/projects/${project.id}/review/sheets/${sh.id}`}
                    className="flex items-center gap-3 px-4 py-2.5 hover:bg-chrome-dark transition-colors group"
                  >
                    <span className="text-[11.5px] text-text2 font-mono w-[60px] flex-shrink-0">{sh.number}</span>
                    <span className="text-[11.5px] text-text2 flex-1 truncate group-hover:text-text">{sh.title}</span>
                    {sh.revision && (
                      <span className="text-[9.5px] font-mono text-text4 border border-chrome-lighter px-1.5 rounded-[2px]">
                        REV {sh.revision}
                      </span>
                    )}
                    <span className="text-[9.5px] font-mono text-text4 uppercase tracking-[0.06em]">{sh.size}-size</span>
                    <span className={clsx(
                      "text-[10.5px] font-mono tabular-nums w-[80px] text-right",
                      openish > 0 ? "text-warn" : c.total > 0 ? "text-pass" : "text-text4",
                    )}>
                      {c.total === 0 ? "—" : openish > 0 ? `${openish} open` : `${c.resolved} ✓`}
                    </span>
                    <span className="text-text4 group-hover:text-accent text-[14px] transition-colors">→</span>
                  </Link>
                );
              })}
            </div>
          )}
        </section>

        {/* TR confirmation summary */}
        <section className="card mb-5">
          <div className="card-header"><div className="card-title">Telecom rooms · confirmed via intake</div></div>
          <div className="card-body">
            {rooms.filter(r => (r.overrideType ?? r.type) === "mdf" || (r.overrideType ?? r.type) === "idf").length === 0 ? (
              <div className="text-[11.5px] text-warn">No TRs confirmed.</div>
            ) : (
              <ul className="space-y-1.5">
                {rooms.filter(r => (r.overrideType ?? r.type) === "mdf" || (r.overrideType ?? r.type) === "idf").map(r => (
                  <li key={r.id} className="flex items-center gap-3 text-[11.5px]">
                    <span className="text-pass text-[13px]">✓</span>
                    <span className="text-text2 flex-1">{r.overrideName ?? r.name}</span>
                    <span className="text-text4 font-mono text-[10.5px]">{ROOM_TYPE_LABEL[(r.overrideType ?? r.type)] ?? r.type}</span>
                    <span className="text-text4 font-mono text-[10.5px]">Floor {r.floor}</span>
                    <span className="text-text4 font-mono text-[10.5px]">{r.area} SF</span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </section>

        {/* Sign-off */}
        <section className="card mb-5 border-l-2 border-l-accent">
          <div className="card-header"><div className="card-title">RCDD sign-off</div></div>
          <div className="card-body space-y-2">
            <SignRow
              checked={sign.placements}
              disabled={!allPlacementsCleared}
              onChange={(v) => setSign(s => ({ ...s, placements: v }))}
              label="I have reviewed all outlet and WAP placements."
              hint={allPlacementsCleared ? undefined : "Clear pending placements first."}
            />
            <SignRow
              checked={sign.advisories}
              disabled={!allAdvisoriesCleared}
              onChange={(v) => setSign(s => ({ ...s, advisories: v }))}
              label="I have acknowledged all compliance advisories."
              hint={allAdvisoriesCleared ? undefined : "Acknowledge pending advisories first."}
            />
            <SignRow
              checked={sign.standards}
              onChange={(v) => setSign(s => ({ ...s, standards: v }))}
              label="I confirm this design meets BICSI TDMM 15, applicable TIA standards (568/569/607), and NEC Article 800."
            />
          </div>
        </section>

        {error && (
          <div className="mb-3 text-[12px] text-fail bg-fail/10 border border-fail/30 rounded-[2px] px-3 py-2">{error}</div>
        )}

        <div className="flex items-center gap-3">
          <button
            onClick={releaseGate}
            disabled={!canRelease || busy}
            className="btn btn-primary text-[13px] px-5 py-2.5 font-medium disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {busy
              ? "Releasing…"
              : phase === "at_gate"   ? "Release pipeline gate →"
              : phase === "pre_gate"  ? "Pre-sign (gate not yet reached)"
              : phase === "post_gate" ? "Drawings generating…"
              : phase === "complete"  ? "Pipeline already complete"
              :                         "Pre-sign (no pipeline running)"}
          </button>
          <Link href={`/projects/${project.id}/pipeline`} className="btn btn-ghost text-[11.5px]">
            {phase === "complete" ? "Open results" : "Back to pipeline"}
          </Link>
          <span className="ml-auto text-[10.5px] text-text4 font-mono">
            {!canRelease && "Clear all sections and check all three boxes to enable release."}
          </span>
        </div>

      </div>
    </div>
  );
}

// ── Subcomponents ──────────────────────────────────────────────────────────

function SummaryBadge({ label, count, clearedCount }: { label: string; count: number; clearedCount: number }) {
  const total = count + clearedCount;
  return (
    <div className="text-right">
      <div className="text-[9.5px] uppercase tracking-[0.06em] text-text4 font-mono">{label}</div>
      <div className={clsx("text-[16px] font-semibold tabular-nums leading-tight", count === 0 ? "text-pass" : "text-warn")}>
        {count === 0 ? "✓" : count}
        <span className="text-text4 text-[12px] font-normal"> / {total}</span>
      </div>
    </div>
  );
}

function PendingRow({
  kind, id, detail, source, onApprove, onReject, busy,
}: {
  kind: "Outlet" | "WAP"; id: string; detail: string;
  source: "ai" | "rcdd";
  onApprove: () => void; onReject: () => void; busy: boolean;
}) {
  return (
    <div className="flex items-center gap-3 px-4 py-2.5">
      <span className={clsx(
        "text-[9.5px] font-mono uppercase tracking-[0.06em] px-1.5 py-0.5 rounded-[2px]",
        kind === "Outlet" ? "bg-info/10 text-info" : "bg-pass/10 text-pass",
      )}>{kind}</span>
      <span className="text-[10.5px] text-text3 font-mono">{id}</span>
      <span className="text-[11.5px] text-text2 flex-1 truncate">{detail}</span>
      <span className="text-[9.5px] font-mono text-text4 uppercase tracking-[0.06em]">{source}</span>
      <div className="flex items-center gap-1">
        <button onClick={onApprove} disabled={busy}
                className="px-2.5 py-1 text-[10.5px] bg-pass/15 text-pass hover:bg-pass/25 rounded-[2px] font-medium">
          ✓ Approve
        </button>
        <button onClick={onReject} disabled={busy}
                className="px-2.5 py-1 text-[10.5px] text-text3 hover:text-fail font-mono">
          Reject
        </button>
      </div>
    </div>
  );
}

function AdvisoryRow({
  rule, acknowledged, onAck, projectId,
}: {
  rule: ComplianceRule; acknowledged: boolean; onAck: () => void; projectId: string;
}) {
  return (
    <div className={clsx("px-4 py-3 flex items-start gap-3", acknowledged && "opacity-60")}>
      <span className={clsx(
        "w-5 h-5 rounded-full flex items-center justify-center text-[11px] flex-shrink-0",
        acknowledged
          ? "bg-pass/15 text-pass"
          : rule.status === "fail" ? "bg-fail/15 text-fail" : "bg-warn/15 text-warn",
      )}>
        {acknowledged ? "✓" : rule.status === "fail" ? "✕" : "!"}
      </span>
      <div className="flex-1 min-w-0">
        <div className="flex items-baseline gap-2">
          <span className="text-[12px] text-text2 font-medium">{rule.code}</span>
          <span className="text-[10.5px] text-text4 font-mono">{rule.citation}</span>
        </div>
        <div className="text-[11.5px] text-text3 mt-0.5">{rule.description}</div>
        {rule.message && (
          <div className={clsx("text-[11px] mt-1 font-mono", rule.status === "fail" ? "text-fail" : "text-warn")}>
            {rule.message}
          </div>
        )}
      </div>
      <div className="flex flex-col gap-1 items-end flex-shrink-0">
        {!acknowledged && (
          <button onClick={onAck}
                  className="px-2.5 py-1 text-[10.5px] bg-warn/15 text-warn hover:bg-warn/25 rounded-[2px] font-medium">
            Acknowledge
          </button>
        )}
        {rule.locate && (
          <Link href={`/projects/${projectId}/floor-plan`}
                className="text-[10px] text-text4 hover:text-accent font-mono">
            Locate ↗
          </Link>
        )}
      </div>
    </div>
  );
}

function SignRow({
  checked, disabled, onChange, label, hint,
}: {
  checked: boolean; disabled?: boolean; onChange: (v: boolean) => void;
  label: string; hint?: string;
}) {
  return (
    <label className={clsx(
      "flex items-start gap-2.5 cursor-pointer p-2 rounded-[2px] -mx-1",
      disabled && "opacity-40 cursor-not-allowed",
      !disabled && checked && "bg-accent/5",
    )}>
      <input
        type="checkbox"
        checked={checked}
        disabled={disabled}
        onChange={(e) => onChange(e.target.checked)}
        className="w-3.5 h-3.5 mt-0.5 accent-accent"
      />
      <div>
        <div className={clsx("text-[11.5px]", checked ? "text-text" : "text-text2")}>{label}</div>
        {hint && <div className="text-[10.5px] text-warn font-mono mt-0.5">{hint}</div>}
      </div>
    </label>
  );
}

// ── Pipeline phase indicators ──────────────────────────────────────────────

function PhaseChip({ phase }: { phase: PipelinePhase }) {
  switch (phase) {
    case "pre_gate":  return <span className="text-info ml-2">· pipeline running</span>;
    case "at_gate":   return <span className="text-warn ml-2">· pipeline paused at gate</span>;
    case "post_gate": return <span className="text-accent ml-2">· drawings generating</span>;
    case "complete":  return <span className="text-pass ml-2">· pipeline complete</span>;
    case "none":      return <span className="text-text4 ml-2">· no pipeline run</span>;
  }
}

/**
 * Banner shown above the review sections. Mirrors the gate-pause card on the
 * Pipeline page but adapts copy for each phase so the RCDD always knows
 * *whether the release button will do anything* before they get to it.
 */
function PhaseBanner({
  phase, run, projectId,
}: { phase: PipelinePhase; run: PipelineRun | null; projectId: string }) {
  if (phase === "none") {
    return (
      <div className="mb-5 px-4 py-3 border-l-2 border-l-chrome-lighter bg-chrome-darkest rounded-[2px]">
        <div className="text-[10px] uppercase tracking-[0.06em] text-text4 font-mono mb-1">No pipeline run</div>
        <div className="text-[12px] text-text2">
          You can pre-sign placements and advisories here. Start the pipeline from the{" "}
          <Link href={`/projects/${projectId}/pipeline`} className="text-accent hover:underline">Pipeline page</Link>{" "}
          to reach the RCDD review gate.
        </div>
      </div>
    );
  }

  if (phase === "pre_gate") {
    const overallPct = Math.round((run?.overallProgress ?? 0) * 100);
    const currentLabel = STAGE_DEFS.find(d => d.id === run?.currentStage)?.label ?? "Initializing";
    return (
      <div className="mb-5 px-4 py-3 border-l-2 border-l-info bg-info/5 rounded-[2px]">
        <div className="flex items-baseline justify-between gap-3 mb-1">
          <div className="text-[10px] uppercase tracking-[0.06em] text-info font-mono">Pipeline running</div>
          <div className="text-[10.5px] font-mono text-info tabular-nums">{overallPct}%</div>
        </div>
        <div className="text-[12px] text-text2 mb-2">
          {currentLabel} — release button enables when the pipeline pauses at the RCDD review gate.
        </div>
        <div className="h-0.5 bg-chrome-darkest rounded-full overflow-hidden">
          <div className="h-full bg-info transition-all duration-300" style={{ width: overallPct + "%" }} />
        </div>
      </div>
    );
  }

  if (phase === "at_gate") {
    return (
      <div className="mb-5 px-4 py-3 border-l-2 border-l-warn bg-warn/5 rounded-[2px]">
        <div className="text-[10px] uppercase tracking-[0.06em] text-warn font-mono mb-1">Pipeline paused</div>
        <div className="text-[12px] text-text2">
          Clear all pending items + sign off below, then click <span className="text-text">Release pipeline gate</span> to continue.
        </div>
      </div>
    );
  }

  if (phase === "post_gate") {
    const overallPct = Math.round((run?.overallProgress ?? 0) * 100);
    return (
      <div className="mb-5 px-4 py-3 border-l-2 border-l-accent bg-accent/5 rounded-[2px]">
        <div className="flex items-baseline justify-between gap-3 mb-1">
          <div className="text-[10px] uppercase tracking-[0.06em] text-accent font-mono">Gate released — drawings generating</div>
          <div className="text-[10.5px] font-mono text-accent tabular-nums">{overallPct}%</div>
        </div>
        <div className="text-[12px] text-text2 mb-2">
          Construction drawings, PDF export, and S3 upload are running.{" "}
          <Link href={`/projects/${projectId}/pipeline`} className="text-accent hover:underline">Watch progress →</Link>
        </div>
        <div className="h-0.5 bg-chrome-darkest rounded-full overflow-hidden">
          <div className="h-full bg-accent transition-all duration-300" style={{ width: overallPct + "%" }} />
        </div>
      </div>
    );
  }

  // complete
  return (
    <div className="mb-5 px-4 py-3 border-l-2 border-l-pass bg-pass/5 rounded-[2px]">
      <div className="text-[10px] uppercase tracking-[0.06em] text-pass font-mono mb-1">Pipeline complete</div>
      <div className="text-[12px] text-text2">
        All artifacts uploaded. Open{" "}
        <Link href={`/projects/${projectId}/results`} className="text-pass hover:underline">Results</Link>{" "}
        to apply the stamp.
      </div>
    </div>
  );
}
