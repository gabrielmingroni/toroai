"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { Project } from "@/lib/projects/types";
import type { IntakeJob } from "@/lib/intake/types";
import { ROOM_TYPE_LABEL } from "@/lib/intake/types";
import { intakeClient } from "@/lib/intake/client";

export function ConfirmStep({
  project, job, onConfirmed, onBack,
}: {
  project: Project;
  job: IntakeJob;
  onConfirmed: () => void;
  onBack: () => void;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const confirmed   = job.rooms.filter(r => !r.excluded && r.reviewed);
  const excluded    = job.rooms.filter(r => r.excluded);
  const approvedTrs = job.trCandidates.filter(c => c.approved === true);

  // Group rooms by type for the summary
  const typeCounts: Record<string, number> = {};
  for (const r of confirmed) {
    const t = r.overrideType ?? r.type;
    typeCounts[t] = (typeCounts[t] ?? 0) + 1;
  }
  const sortedTypes = Object.entries(typeCounts).sort((a, b) => b[1] - a[1]);

  async function confirm() {
    setBusy(true); setError(null);
    const res = await intakeClient.confirm(project.id);
    if (!res.ok) {
      setError(res.error?.message || "Could not confirm intake.");
      setBusy(false);
      return;
    }
    router.refresh();
    onConfirmed();
  }

  return (
    <div>
      <header className="mb-4 flex items-start justify-between gap-4">
        <div>
          <h1 className="text-[18px] font-semibold mb-0.5">Finalize document intake</h1>
          <p className="text-[11.5px] text-text3 font-mono">
            Confirm locks the room schedule, advances the project to <span className="text-text2">In Progress</span>, and unlocks the design canvas.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={onBack} className="btn btn-ghost text-[11.5px]">← Back to TRs</button>
        </div>
      </header>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
        <SummaryCard label="Rooms confirmed"   value={confirmed.length}   sub={`${excluded.length} excluded`} />
        <SummaryCard label="TRs approved"      value={approvedTrs.length} sub={`across ${new Set(job.rooms.filter(r => approvedTrs.some(t => t.roomId === r.id)).map(r => r.floor)).size} floors`} />
        <SummaryCard label="Pages ingested"    value={job.diagnostics.pagesExtracted} sub={`${job.files.length} file${job.files.length !== 1 ? "s" : ""}`} />
      </div>

      {/* Room mix */}
      <div className="card mb-4">
        <div className="card-header"><div className="card-title">Room mix · confirmed</div></div>
        <div className="card-body">
          {sortedTypes.length === 0 ? (
            <div className="text-[11.5px] text-text3">No rooms confirmed.</div>
          ) : (
            <div className="grid grid-cols-2 md:grid-cols-3 gap-x-6 gap-y-1.5">
              {sortedTypes.map(([type, count]) => (
                <div key={type} className="flex justify-between text-[11.5px] py-0.5 border-b border-chrome-dark">
                  <span className="text-text3">{ROOM_TYPE_LABEL[type as keyof typeof ROOM_TYPE_LABEL] ?? type}</span>
                  <span className="text-text2 font-mono tabular-nums">{count}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Approved TRs list */}
      <div className="card mb-5">
        <div className="card-header"><div className="card-title">Approved telecom rooms</div></div>
        <div className="card-body p-0">
          {approvedTrs.length === 0 ? (
            <div className="p-4 text-[11.5px] text-warn">
              No TRs approved. Go back and approve at least one telecom room per floor.
            </div>
          ) : (
            <ul>
              {approvedTrs.map(tr => {
                const r = job.rooms.find(x => x.id === tr.roomId);
                if (!r) return null;
                return (
                  <li key={tr.roomId} className="flex items-center gap-4 px-4 py-2.5 border-b border-chrome-dark last:border-b-0">
                    <div className="text-[10.5px] text-text4 font-mono w-14">Floor {r.floor}</div>
                    <div className="flex-1 text-[12px] text-text2">{r.overrideName ?? r.name}</div>
                    <div className="text-[10.5px] text-text3 font-mono">Score {tr.score} / 100</div>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </div>

      {error && (
        <div className="mb-3 text-[12px] text-fail bg-fail/10 border border-fail/30 rounded-[2px] px-3 py-2">{error}</div>
      )}

      {job.stage === "confirmed" ? (
        <div className="flex items-center gap-3">
          <div className="text-[12px] text-pass font-mono">✓ Intake confirmed · project advanced</div>
          <button onClick={onConfirmed} className="btn btn-primary text-[12px] px-4 py-2">
            Open project →
          </button>
        </div>
      ) : (
        <div className="flex items-center gap-3">
          <button
            onClick={confirm}
            disabled={busy || approvedTrs.length === 0}
            className="btn btn-primary px-5 py-2.5 text-[13px] font-medium disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {busy ? "Confirming…" : "Confirm and launch design"}
          </button>
          <span className="text-[10.5px] text-text4 font-mono">
            Project transitions <span className="text-text3">draft → in_progress</span>
          </span>
        </div>
      )}
    </div>
  );
}

function SummaryCard({ label, value, sub }: { label: string; value: number; sub?: string }) {
  return (
    <div className="bg-chrome-dark border border-chrome-dark rounded-[2px] p-3.5">
      <div className="text-[10px] uppercase tracking-[0.06em] text-text3 font-mono">{label}</div>
      <div className="mt-1 text-[26px] font-semibold tabular-nums text-accent">{value.toLocaleString()}</div>
      {sub && <div className="mt-0.5 text-[10.5px] text-text4 font-mono">{sub}</div>}
    </div>
  );
}
