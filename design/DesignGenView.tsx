// Design Generation view — Lane 1 of the patent claim made real.
//
// Shows the suggested TR layout (MDF + IDFs with served-outlet sets and
// worst-case channel lengths) and the auto-derived cable run from-to
// schedule (the document cable installers pull cable against).
//
// Both are computed from real project state: intake rooms + placed outlets.
// No fixtures, no hardcoded fallbacks.

import type { Project } from "@/lib/projects/types";
import type { ExtractedRoom } from "@/lib/intake/types";
import type { OutletPlacement } from "@/lib/placement/types";
import type { TrSuggestionResult, TrSuggestion } from "@/lib/design/tr-suggester";
import type { CableScheduleResult, CableScheduleRow } from "@/lib/design/cable-schedule";

export function DesignGenView({
  project, rooms, outlets, trResult, schedule,
}: {
  project: Project;
  rooms: ExtractedRoom[];
  outlets: OutletPlacement[];
  trResult: TrSuggestionResult;
  schedule: CableScheduleResult;
}) {
  const csv = scheduleToCsv(project, schedule);
  return (
    <div className="p-6 max-w-[1200px] mx-auto">

      {/* Header */}
      <header className="mb-5 flex items-start justify-between gap-4">
        <div>
          <h1 className="text-[20px] font-semibold mb-1">Design Generation</h1>
          <p className="text-[11.5px] text-text3 font-mono">
            TR location suggester · cable run from-to schedule · 90 m TIA-568.2-D horizontal validation
          </p>
        </div>
        <a
          href={`data:text/csv;charset=utf-8,${encodeURIComponent(csv)}`}
          download={`${project.number}-cable-schedule.csv`}
          className="btn btn-ghost text-[11.5px]"
        >Download cable schedule .csv</a>
      </header>

      {/* Empty state */}
      {rooms.length === 0 && outlets.length === 0 && (
        <div className="card mb-5 border-l-2 border-l-warn">
          <div className="card-body">
            <div className="text-[10px] uppercase tracking-[0.06em] text-warn font-mono mb-1">No design state</div>
            <p className="text-[12px] text-text2 mb-2">
              This project has no intake rooms and no placed outlets. The design generator
              needs at least one of those to produce TR locations + a cable schedule.
            </p>
            <p className="text-[11px] text-text3">
              Go to Upload (to confirm rooms from the floor plan) or Floor Plan (to place outlets manually) first.
            </p>
          </div>
        </div>
      )}

      {/* Summary tiles */}
      {(rooms.length > 0 || outlets.length > 0) && (
        <>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-2.5 mb-5">
            <Tile label="Rooms"             value={String(rooms.length)} />
            <Tile label="Outlets placed"    value={String(outlets.length)} />
            <Tile label="Suggested TRs"     value={`${trResult.stats.mdfCount} MDF · ${trResult.stats.idfCount} IDF`} />
            <Tile label="Coverage"          value={`${trResult.stats.coveragePct}%`}
                  tone={trResult.uncovered.length > 0 ? "warn" : "pass"} />
          </div>

          {/* TR suggestions */}
          <section className="card mb-5">
            <div className="card-header">
              <div className="card-title">TR location suggestions</div>
              <span className="text-[9.5px] text-text4 font-mono uppercase tracking-[0.06em]">
                TIA-568 90 m radius · worst case {trResult.stats.maxWorstCaseFt} ft
              </span>
            </div>
            {trResult.suggestions.length === 0 ? (
              <div className="card-body text-[11.5px] text-text3">No TR locations needed for this project.</div>
            ) : (
              <div className="divide-y divide-chrome-dark">
                {trResult.suggestions.map(tr => <TrRow key={tr.label} tr={tr} rooms={rooms} />)}
              </div>
            )}
            {trResult.uncovered.length > 0 && (
              <div className="card-body bg-warn/10 border-t border-warn/30 text-[11px]">
                <div className="text-warn font-medium mb-1">⚠ {trResult.uncovered.length} demand point(s) uncovered</div>
                <p className="text-text3 leading-snug">
                  These outlets cannot reach any TR within the 90 m horizontal radius.
                  Consider adding another IDF, or splitting the largest TR's zone.
                </p>
              </div>
            )}
          </section>

          {/* Cable schedule */}
          <section className="card mb-5">
            <div className="card-header">
              <div className="card-title">Cable run from-to schedule · {schedule.rows.length} runs</div>
              <span className="text-[9.5px] text-text4 font-mono uppercase tracking-[0.06em]">
                {schedule.totalCableLf.toLocaleString()} LF · TIA-606-C labels
              </span>
            </div>
            <div className="px-4 py-2 border-b border-chrome-dark flex items-baseline gap-3 text-[11px]">
              <span className="text-pass">{schedule.stats.pass} pass</span>
              <span className="text-warn">{schedule.stats.warn} warn</span>
              <span className="text-fail">{schedule.stats.fail} fail</span>
              <span className="text-text4 ml-auto font-mono">Total cable {schedule.totalCableLf.toLocaleString()} LF</span>
            </div>
            {schedule.rows.length === 0 ? (
              <div className="card-body text-[11.5px] text-text3">No cable runs — place outlets first.</div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-[10.5px]">
                  <thead>
                    <tr className="border-b border-chrome-dark text-[9.5px] uppercase tracking-[0.06em] text-text4 font-mono">
                      <th className="text-left  px-3 py-1.5 w-[100px]">Label</th>
                      <th className="text-left  px-3 py-1.5">Source</th>
                      <th className="text-left  px-3 py-1.5">Destination</th>
                      <th className="text-left  px-3 py-1.5 w-[80px]">Cable</th>
                      <th className="text-right px-3 py-1.5 w-[80px]">Length</th>
                      <th className="text-left  px-3 py-1.5 w-[180px]">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {schedule.rows.map(r => <ScheduleRow key={r.label} row={r} />)}
                  </tbody>
                </table>
              </div>
            )}
          </section>

          {/* TIA-568 reference */}
          <div className="text-[10.5px] text-text4 font-mono leading-snug">
            Schedule length = horizontal pathway (Manhattan) + 2 × 8.5 ft drops + 10 ft BICSI slack.
            Warn at 262 ft / Fail at 295 ft per TIA-568.2-D §4.2.5.
            TR positions chosen greedily from candidate sites
            (preferring electrical / storage / mechanical rooms for repurposing).
          </div>
        </>
      )}
    </div>
  );
}

// ── Atoms ───────────────────────────────────────────────────────────────

function Tile({ label, value, tone = "text" }: {
  label: string; value: string; tone?: "text" | "pass" | "warn" | "fail";
}) {
  const cls = tone === "pass" ? "text-pass" : tone === "warn" ? "text-warn"
            : tone === "fail" ? "text-fail" : "text-text2";
  return (
    <div className="border border-chrome-dark rounded-[2px] p-3 bg-chrome-darkest">
      <div className="text-[9.5px] uppercase tracking-[0.06em] text-text4 font-mono">{label}</div>
      <div className={"text-[18px] font-semibold leading-tight tabular-nums mt-1 " + cls}>{value}</div>
    </div>
  );
}

function TrRow({ tr, rooms }: { tr: TrSuggestion; rooms: ExtractedRoom[] }) {
  const room = tr.candidate.roomId ? rooms.find(r => r.id === tr.candidate.roomId) : null;
  return (
    <div className="px-4 py-3">
      <div className="flex items-baseline justify-between gap-3 mb-1">
        <div className="flex items-baseline gap-3">
          <span className={
            "inline-flex items-center justify-center w-[60px] h-6 rounded-[2px] text-[11px] font-mono font-medium " +
            (tr.kind === "mdf" ? "bg-accent text-chrome-darkest" : "bg-info text-chrome-darkest")
          }>{tr.label}</span>
          <div>
            <div className="text-[12px] text-text font-medium">
              {room ? (room.overrideName ?? room.name) : "Synthetic location"}
            </div>
            <div className="text-[10px] text-text4 font-mono mt-0.5">
              Floor {tr.candidate.floor} · ({tr.candidate.x.toFixed(0)}, {tr.candidate.y.toFixed(0)}) ft
            </div>
          </div>
        </div>
        <div className="text-right">
          <div className={"text-[11.5px] font-mono tabular-nums " + (tr.withinTia568 ? "text-pass" : "text-fail")}>
            {tr.outletsServed} outlet{tr.outletsServed === 1 ? "" : "s"}
          </div>
          <div className="text-[10px] text-text4 font-mono">
            Worst case {Math.round(tr.worstCaseFt)} ft
          </div>
        </div>
      </div>
      <div className="text-[10.5px] text-text3 leading-snug mt-1">{tr.candidate.rationale}</div>
    </div>
  );
}

function ScheduleRow({ row }: { row: CableScheduleRow }) {
  const cls = row.status === "fail" ? "text-fail" : row.status === "warn" ? "text-warn" : "text-pass";
  return (
    <tr className="border-b border-chrome-dark/40">
      <td className="px-3 py-1.5 font-mono text-text2">{row.label}</td>
      <td className="px-3 py-1.5">
        <div className="text-text2">{row.sourceTrLabel}</div>
        <div className="text-text4 font-mono text-[10px]">{row.sourceRack} · {row.sourcePort}</div>
      </td>
      <td className="px-3 py-1.5">
        <div className="text-text2">{row.destRoomName}</div>
        <div className="text-text4 font-mono text-[10px]">Floor {row.destFloor} · {row.outletId}</div>
      </td>
      <td className="px-3 py-1.5 font-mono text-text3">{row.cableType}</td>
      <td className="px-3 py-1.5 text-right font-mono tabular-nums text-text2">{row.lengthFt} ft</td>
      <td className="px-3 py-1.5">
        <div className={"font-mono text-[10px] uppercase tracking-[0.06em] " + cls}>{row.status}</div>
        {row.reason && <div className="text-text4 text-[10px] mt-0.5 leading-snug">{row.reason}</div>}
      </td>
    </tr>
  );
}

// ── CSV export ──────────────────────────────────────────────────────────

function scheduleToCsv(project: { number: string; name: string }, s: CableScheduleResult): string {
  const rows: string[] = [];
  rows.push(`# Cable Run From-To Schedule — ${project.name} (${project.number})`);
  rows.push(`# Generated ${new Date(s.generatedAt).toISOString()} · ${s.rows.length} runs · ${s.totalCableLf} LF total`);
  rows.push("");
  rows.push("Label,Source TR,Source Rack,Source Port,Outlet ID,Dest Floor,Dest Room,Cable Type,Length ft,Status,Reason");
  function esc(s: string) {
    if (!s) return "";
    if (s.includes(",") || s.includes("\"") || s.includes("\n")) return `"${s.replace(/"/g, "\"\"")}"`;
    return s;
  }
  for (const r of s.rows) {
    rows.push([
      esc(r.label), esc(r.sourceTrLabel), esc(r.sourceRack), esc(r.sourcePort),
      esc(r.outletId), r.destFloor, esc(r.destRoomName), esc(r.cableType),
      r.lengthFt, esc(r.status), esc(r.reason ?? ""),
    ].join(","));
  }
  return rows.join("\n");
}
