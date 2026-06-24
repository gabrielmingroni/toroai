"use client";

import { useState } from "react";
import clsx from "clsx";
import type { Project } from "@/lib/projects/types";
import type { IntakeJob, TrCandidate, TrFactor } from "@/lib/intake/types";
import { intakeClient } from "@/lib/intake/client";

function scoreClass(score: number): string {
  if (score >= 70) return "text-pass";
  if (score >= 50) return "text-warn";
  return "text-fail";
}

export function TrReviewStep({
  project, job, onJobUpdate, onNext, onBack,
}: {
  project: Project;
  job: IntakeJob;
  onJobUpdate: (j: IntakeJob) => void;
  onNext: () => void;
  onBack: () => void;
}) {
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  // Group candidates by floor
  const byFloor = job.trCandidates.reduce<Record<number, TrCandidate[]>>((acc, c) => {
    const room = job.rooms.find(r => r.id === c.roomId);
    const f = room?.floor ?? 0;
    (acc[f] = acc[f] || []).push(c);
    return acc;
  }, {});
  const floors = Object.keys(byFloor).map(Number).sort((a, b) => a - b);

  async function setApproval(roomId: string, approved: boolean | null) {
    setBusy(true);
    const res = await intakeClient.setTr(project.id, roomId, approved);
    if (res.ok && res.job) onJobUpdate(res.job);
    setBusy(false);
  }

  const approvedPerFloor = floors.map(f => ({
    floor: f,
    approved: byFloor[f].filter(c => c.approved === true).length,
  }));
  const allFloorsCovered = approvedPerFloor.every(p => p.approved >= 1);

  return (
    <div>
      <header className="mb-4 flex items-start justify-between gap-4">
        <div>
          <h1 className="text-[18px] font-semibold mb-0.5">Confirm telecom rooms</h1>
          <p className="text-[11.5px] text-text3 font-mono">
            13-factor scoring ranks each candidate against BICSI TDMM 15 §11 + TIA-568.1-D §6.4. Approve at least one TR per floor.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={onBack} className="btn btn-ghost text-[11.5px]">← Back to rooms</button>
          <button
            onClick={onNext} disabled={!allFloorsCovered}
            className="btn btn-primary text-[12px] px-3 py-2 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Continue to finalize →
          </button>
        </div>
      </header>

      {/* Per-floor coverage summary */}
      <div className="card mb-4">
        <div className="card-body py-3 flex flex-wrap gap-3">
          {approvedPerFloor.map(p => (
            <div key={p.floor} className={clsx(
              "px-3 py-1.5 rounded-[2px] text-[11px] font-mono border",
              p.approved >= 1 ? "border-pass/40 text-pass bg-pass/5" : "border-warn/40 text-warn bg-warn/5",
            )}>
              Floor {p.floor}: {p.approved >= 1 ? `✓ ${p.approved} approved` : "no TR approved"}
            </div>
          ))}
        </div>
      </div>

      {/* Per-floor candidates */}
      {floors.map(f => (
        <section key={f} className="mb-5">
          <div className="flex items-baseline gap-3 mb-2">
            <h2 className="text-[13px] font-medium text-text">Floor {f}</h2>
            <div className="text-[10.5px] text-text3 font-mono">
              {byFloor[f].length} candidate{byFloor[f].length !== 1 ? "s" : ""} ranked
            </div>
          </div>
          <div className="card overflow-hidden">
            {byFloor[f].map((c, i) => {
              const room = job.rooms.find(r => r.id === c.roomId);
              if (!room) return null;
              const expanded = expandedId === c.roomId;
              return (
                <div key={c.roomId} className={clsx("border-b border-chrome-dark last:border-b-0", c.recommended && "bg-accent/5")}>
                  <div className="flex items-center gap-4 px-4 py-3">
                    {/* Rank badge */}
                    <div className={clsx(
                      "w-8 h-8 rounded-full flex items-center justify-center text-[11px] font-mono font-medium flex-shrink-0",
                      c.recommended ? "bg-accent text-chrome-darkest" : "bg-chrome-dark border border-chrome-lighter text-text2",
                    )}>
                      #{c.rank}
                    </div>

                    {/* Room name + meta */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <div className="text-[12.5px] text-text font-medium">{room.overrideName ?? room.name}</div>
                        {c.recommended && (
                          <span className="text-[9.5px] font-mono uppercase tracking-[0.06em] text-accent bg-accent/10 px-1.5 py-0.5 rounded-[2px]">
                            recommended
                          </span>
                        )}
                      </div>
                      <div className="text-[10.5px] text-text3 font-mono mt-0.5">
                        {room.area} SF · {room.id} · type: {room.overrideType ?? room.type}
                      </div>
                    </div>

                    {/* Composite score */}
                    <div className="flex-shrink-0 text-right">
                      <div className={clsx("text-[22px] font-semibold tabular-nums", scoreClass(c.score))}>{c.score}</div>
                      <div className="text-[9px] text-text4 font-mono uppercase tracking-[0.06em]">Score / 100</div>
                    </div>

                    {/* Actions */}
                    <div className="flex-shrink-0 flex items-center gap-1">
                      {c.approved === true ? (
                        <button onClick={() => setApproval(c.roomId, null)} disabled={busy}
                          className="px-2.5 py-1 text-[10.5px] bg-pass/15 text-pass rounded-[2px] font-medium hover:bg-pass/25">
                          ✓ Approved
                        </button>
                      ) : c.approved === false ? (
                        <button onClick={() => setApproval(c.roomId, null)} disabled={busy}
                          className="px-2.5 py-1 text-[10.5px] bg-fail/15 text-fail rounded-[2px] font-mono hover:bg-fail/25">
                          ✕ Rejected
                        </button>
                      ) : (
                        <>
                          <button onClick={() => setApproval(c.roomId, true)} disabled={busy}
                            className="px-2.5 py-1 text-[10.5px] bg-pass/15 text-pass rounded-[2px] font-medium hover:bg-pass/25">
                            Approve
                          </button>
                          <button onClick={() => setApproval(c.roomId, false)} disabled={busy}
                            className="px-2.5 py-1 text-[10.5px] text-text3 hover:text-fail font-mono">
                            Reject
                          </button>
                        </>
                      )}
                      <button
                        onClick={() => setExpandedId(expanded ? null : c.roomId)}
                        className="ml-1 text-text3 hover:text-text text-[14px] px-1"
                        aria-label="Toggle 13-factor breakdown"
                      >
                        {expanded ? "▾" : "▸"}
                      </button>
                    </div>
                  </div>

                  {expanded && (
                    <FactorBreakdown factors={c.factors} />
                  )}
                </div>
              );
            })}
          </div>
        </section>
      ))}
    </div>
  );
}

function FactorBreakdown({ factors }: { factors: TrFactor[] }) {
  return (
    <div className="bg-chrome-darkest px-4 py-3 border-t border-chrome-dark">
      <div className="text-[10px] font-mono uppercase tracking-[0.06em] text-text4 mb-2">
        13-factor breakdown
      </div>
      <div className="space-y-1.5">
        {factors.map(f => (
          <div key={f.key} className="flex items-center gap-3 text-[11px]">
            <div className="text-[10.5px] text-text4 font-mono w-10 text-right tabular-nums">
              w{(f.weight * 100).toFixed(0)}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-baseline gap-2">
                <div className="text-text2 truncate">{f.label}</div>
                <div className="text-text4 text-[10px] font-mono truncate">— {f.rationale}</div>
              </div>
            </div>
            <div className="text-[10.5px] text-text3 font-mono tabular-nums w-32 text-right">{f.value}</div>
            <div className="w-24 h-1 bg-chrome-dark rounded-full overflow-hidden">
              <div className={clsx(
                "h-full",
                f.score >= 0.7 ? "bg-pass" : f.score >= 0.4 ? "bg-warn" : "bg-fail",
              )} style={{ width: (f.score * 100) + "%" }} />
            </div>
            <div className={clsx("w-10 text-right text-[10.5px] font-mono tabular-nums",
              f.score >= 0.7 ? "text-pass" : f.score >= 0.4 ? "text-warn" : "text-fail",
            )}>
              {(f.score * 100).toFixed(0)}%
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
