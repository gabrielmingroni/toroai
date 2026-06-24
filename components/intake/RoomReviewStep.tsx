"use client";

import { useMemo, useState } from "react";
import clsx from "clsx";
import type { Project } from "@/lib/projects/types";
import type { IntakeJob, ExtractedRoom, RoomType } from "@/lib/intake/types";
import { ROOM_TYPE_LABEL } from "@/lib/intake/types";
import { intakeClient } from "@/lib/intake/client";

const SOURCE_TONE: Record<ExtractedRoom["source"], string> = {
  CAD: "text-pass bg-pass/10",
  PDF: "text-info bg-info/10",
  OCR: "text-warn bg-warn/10",
  EST: "text-fail bg-fail/10",
};

function confidenceClass(c: number): string {
  if (c >= 0.85) return "text-pass";
  if (c >= 0.65) return "text-warn";
  return "text-fail";
}

type FilterMode = "all" | "low_conf" | "unreviewed" | "excluded";

export function RoomReviewStep({
  project, job, onJobUpdate, onNext,
}: {
  project: Project;
  job: IntakeJob;
  onJobUpdate: (j: IntakeJob) => void;
  onNext: () => void;
}) {
  const [filter, setFilter] = useState<FilterMode>("unreviewed");
  const [floor, setFloor] = useState<number | "all">("all");
  const [busy, setBusy] = useState(false);

  const filtered = useMemo(() => {
    return job.rooms.filter(r => {
      if (floor !== "all" && r.floor !== floor) return false;
      if (filter === "low_conf"   && r.confidence >= 0.65)   return false;
      if (filter === "unreviewed" && r.reviewed)             return false;
      if (filter === "excluded"   && !r.excluded)            return false;
      return true;
    });
  }, [job.rooms, filter, floor]);

  const reviewedCount = job.rooms.filter(r => r.reviewed && !r.excluded).length;
  const excludedCount = job.rooms.filter(r => r.excluded).length;
  const totalConfirmable = job.rooms.length;
  const canProceed = reviewedCount + excludedCount === totalConfirmable && reviewedCount > 0;

  async function patch(roomId: string, p: Parameters<typeof intakeClient.overrideRoom>[2]) {
    setBusy(true);
    const res = await intakeClient.overrideRoom(project.id, roomId, p);
    if (res.ok && res.job) onJobUpdate(res.job);
    setBusy(false);
  }
  async function bulkAccept(threshold: number) {
    setBusy(true);
    const res = await intakeClient.bulkAccept(project.id, threshold);
    if (res.ok && res.job) onJobUpdate(res.job);
    setBusy(false);
  }

  const floors = Array.from(new Set(job.rooms.map(r => r.floor))).sort((a, b) => a - b);

  return (
    <div>
      <header className="mb-4 flex items-start justify-between gap-4">
        <div>
          <h1 className="text-[18px] font-semibold mb-0.5">Review the room schedule</h1>
          <p className="text-[11.5px] text-text3 font-mono">
            ToroAI classified {totalConfirmable} rooms. Confirm or override.
          </p>
        </div>
        <div className="text-right">
          <div className="text-[11.5px] text-text3 font-mono">
            <span className="text-pass">{reviewedCount}</span> reviewed
            {" · "}<span className="text-text4">{excludedCount}</span> excluded
            {" · "}<span className="text-warn">{totalConfirmable - reviewedCount - excludedCount}</span> pending
          </div>
          <div className="text-[10px] text-text4 font-mono mt-0.5">
            {job.diagnostics.classifiedHigh} high-confidence · {job.diagnostics.classifiedLow} low-confidence
          </div>
        </div>
      </header>

      {/* Filter bar */}
      <div className="flex flex-wrap items-center gap-2 mb-3">
        <FilterPill label={`All (${job.rooms.length})`}                value="all"        current={filter} onClick={setFilter} />
        <FilterPill label={`Unreviewed (${job.rooms.filter(r => !r.reviewed && !r.excluded).length})`} value="unreviewed" current={filter} onClick={setFilter} />
        <FilterPill label={`Low confidence (${job.rooms.filter(r => r.confidence < 0.65).length})`} value="low_conf"   current={filter} onClick={setFilter} />
        <FilterPill label={`Excluded (${excludedCount})`}              value="excluded"  current={filter} onClick={setFilter} />

        <select
          className="input w-auto text-[12px] ml-2"
          value={floor}
          onChange={(e) => setFloor(e.target.value === "all" ? "all" : Number(e.target.value))}
        >
          <option value="all">All floors</option>
          {floors.map(f => <option key={f} value={f}>Floor {f}</option>)}
        </select>

        <div className="ml-auto flex items-center gap-2">
          <button onClick={() => bulkAccept(0.85)} disabled={busy}
            className="btn btn-ghost text-[11.5px]">Accept all ≥ 85% confidence</button>
          <button onClick={onNext} disabled={!canProceed}
            className="btn btn-primary text-[12px] px-3 py-2 disabled:opacity-50 disabled:cursor-not-allowed">
            Continue to TR review →
          </button>
        </div>
      </div>

      {/* Table */}
      <div className="card">
        <table className="w-full">
          <thead>
            <tr className="border-b border-chrome-dark">
              <Th>Room</Th>
              <Th>Type</Th>
              <Th className="text-right">SF</Th>
              <Th className="text-center">Floor</Th>
              <Th>Source</Th>
              <Th className="text-right">Confidence</Th>
              <Th className="text-right">Actions</Th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr><td colSpan={7} className="px-4 py-10 text-center text-text3 text-[12px]">Nothing matches this filter.</td></tr>
            ) : filtered.map((r) => {
              const effectiveType = r.overrideType ?? r.type;
              return (
                <tr key={r.id} className={clsx(
                  "border-b border-chrome-dark hover:bg-chrome-light/50 transition-colors",
                  r.excluded && "opacity-50",
                  r.reviewed && !r.excluded && "bg-pass/5",
                )}>
                  <td className="px-3 py-2 align-middle">
                    <div className="text-[12px] text-text2 truncate">{r.overrideName ?? r.name}</div>
                    <div className="text-[10px] text-text4 font-mono">{r.id}</div>
                  </td>
                  <td className="px-3 py-2 align-middle">
                    <select
                      value={effectiveType}
                      disabled={r.excluded || busy}
                      onChange={(e) => patch(r.id, { overrideType: e.target.value === r.type ? null : (e.target.value as RoomType) })}
                      className="input text-[11.5px] py-1 px-2 w-full max-w-[200px]"
                    >
                      {(Object.keys(ROOM_TYPE_LABEL) as RoomType[]).map(t => (
                        <option key={t} value={t}>
                          {t === r.type ? "✓ " : ""}{ROOM_TYPE_LABEL[t]}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td className="px-3 py-2 align-middle text-right text-[11.5px] text-text2 font-mono tabular-nums">{r.area.toLocaleString()}</td>
                  <td className="px-3 py-2 align-middle text-center text-[11.5px] text-text2 font-mono">{r.floor}</td>
                  <td className="px-3 py-2 align-middle">
                    <span className={clsx("text-[10px] font-mono uppercase tracking-[0.06em] px-1.5 py-0.5 rounded-[2px]", SOURCE_TONE[r.source])}>
                      {r.source}
                    </span>
                  </td>
                  <td className={clsx("px-3 py-2 align-middle text-right text-[11.5px] font-mono tabular-nums", confidenceClass(r.confidence))}>
                    {(r.confidence * 100).toFixed(0)}%
                  </td>
                  <td className="px-3 py-2 align-middle text-right">
                    <div className="inline-flex items-center gap-1">
                      {r.excluded ? (
                        <button onClick={() => patch(r.id, { excluded: false })}
                          className="text-[10.5px] text-text3 hover:text-text font-mono" disabled={busy}>
                          Include
                        </button>
                      ) : r.reviewed ? (
                        <button onClick={() => patch(r.id, { reviewed: false })}
                          className="text-[10.5px] text-pass hover:text-text font-mono" disabled={busy}>
                          ✓ Reviewed
                        </button>
                      ) : (
                        <>
                          <button onClick={() => patch(r.id, { reviewed: true })}
                            className="px-2 py-0.5 text-[10.5px] bg-pass/15 text-pass hover:bg-pass/25 rounded-[2px] font-medium" disabled={busy}>
                            Accept
                          </button>
                          <button onClick={() => patch(r.id, { excluded: true })}
                            className="px-2 py-0.5 text-[10.5px] text-text3 hover:text-fail font-mono" disabled={busy}>
                            Exclude
                          </button>
                        </>
                      )}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {!canProceed && (
        <div className="mt-4 text-[11px] text-text3 font-mono">
          Review all rooms (accept or exclude) before continuing.
        </div>
      )}
    </div>
  );
}

function Th({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <th className={clsx("px-3 py-2.5 text-left font-mono text-[10px] uppercase tracking-[0.06em] text-text3 font-medium", className)}>
      {children}
    </th>
  );
}

function FilterPill<T extends string>({ label, value, current, onClick }: { label: string; value: T; current: T; onClick: (v: T) => void }) {
  return (
    <button
      onClick={() => onClick(value)}
      className={clsx(
        "px-2.5 py-1 rounded-[2px] text-[11px] font-mono transition-colors",
        current === value
          ? "bg-accent/15 text-accent border border-accent/40"
          : "border border-chrome-lighter text-text3 hover:text-text",
      )}
    >
      {label}
    </button>
  );
}
