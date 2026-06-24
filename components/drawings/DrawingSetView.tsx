"use client";

// Sheet-set browser. Left rail: sheet index. Main pane: scrollable canvas
// rendering the active D-size sheet. Modeled on Bluebeam Revu / AutoCAD
// Layout tabs / PDF.js sidebars.

import { useMemo, useRef, useState, useEffect } from "react";
import Link from "next/link";
import type { Project } from "@/lib/projects/types";
import type { AuthUser } from "@/lib/auth/types";
import type { ExtractedRoom } from "@/lib/intake/types";
import type { CableScheduleRow } from "@/lib/design/cable-schedule";
import type { DrawingSet, DrawingSheet } from "@/lib/drawings/types";
import { SHEET_KIND_LABEL } from "@/lib/drawings/types";
import { SheetCanvas } from "./SheetCanvas";
import { CoverSheet } from "./sheets/CoverSheet";
import { SymbolsSheet } from "./sheets/SymbolsSheet";
import { FloorPlanSheet } from "./sheets/FloorPlanSheet";
import { RiserSheet } from "./sheets/RiserSheet";
import { ScheduleSheet } from "./sheets/ScheduleSheet";
import { EnlargedTrSheet } from "./sheets/EnlargedTrSheet";
import { RackElevationSheet } from "./sheets/RackElevationSheet";

interface Props {
  project: Project;
  rcdd: AuthUser;
  set: DrawingSet;
  rooms: ExtractedRoom[];
  scheduleRows: CableScheduleRow[];
  scheduleTotalLf: number;
  /** Outlet count from placement (drives rack elevation patch-panel sizing). */
  outletCount: number;
}

const ZOOM_PRESETS = [
  { label: "Fit", value: 0 },        // 0 = compute fit-to-width
  { label: "50%", value: 0.5 },
  { label: "75%", value: 0.75 },
  { label: "100%", value: 1.0 },
  { label: "150%", value: 1.5 },
];

const SHEET_DISPLAY_BASE_H = 1400; // px height at 100% zoom

export function DrawingSetView({
  project, rcdd, set, rooms, scheduleRows, scheduleTotalLf, outletCount,
}: Props) {
  const [activeId, setActiveId] = useState<string>(set.sheets[0]?.id ?? "");
  const [zoom, setZoom] = useState<number>(0); // 0 = fit
  const containerRef = useRef<HTMLDivElement>(null);
  const [fitHeight, setFitHeight] = useState<number>(700);

  const activeSheet = useMemo(
    () => set.sheets.find(s => s.id === activeId) ?? set.sheets[0],
    [activeId, set.sheets],
  );

  const latestIssuance = set.issuances[set.issuances.length - 1];

  // Recompute fit-to-container height on resize. D-size aspect 36:24 = 3:2.
  useEffect(() => {
    if (!containerRef.current) return;
    function recompute() {
      const el = containerRef.current;
      if (!el) return;
      const cw = el.clientWidth - 48;        // padding
      const ch = el.clientHeight - 48;
      // Fit by whichever dimension is more constraining.
      const fitByW = cw * (24 / 36);
      const fitByH = ch;
      setFitHeight(Math.max(400, Math.min(fitByW, fitByH)));
    }
    recompute();
    const ro = new ResizeObserver(recompute);
    ro.observe(containerRef.current);
    return () => ro.disconnect();
  }, []);

  const displayHeight = zoom === 0 ? fitHeight : SHEET_DISPLAY_BASE_H * zoom;

  function gotoIndex(delta: number) {
    const idx = set.sheets.findIndex(s => s.id === activeId);
    const next = set.sheets[idx + delta];
    if (next) setActiveId(next.id);
  }

  if (!activeSheet) return null;

  return (
    <div className="flex h-full">
      {/* Left rail — sheet index */}
      <aside className="w-[280px] flex-shrink-0 border-r border-chrome-dark flex flex-col">
        <div className="px-3 py-2 border-b border-chrome-dark flex items-center justify-between">
          <div>
            <div className="text-[10px] uppercase tracking-[0.06em] text-text4 font-mono">Sheet Set</div>
            <div className="text-[12px] text-text">{set.sheets.length} sheets</div>
          </div>
          <Link href={`/projects/${project.id}`}
                className="text-[10.5px] text-text3 hover:text-accent font-mono">
            ← Project
          </Link>
        </div>
        <ul className="overflow-y-auto flex-1">
          {set.sheets.map(s => {
            const isActive = s.id === activeId;
            return (
              <li key={s.id}>
                <button
                  type="button"
                  onClick={() => setActiveId(s.id)}
                  className={
                    "w-full text-left px-3 py-2.5 border-b border-chrome-dark transition-colors " +
                    (isActive ? "bg-accent/15 border-l-2 border-l-accent" : "hover:bg-chrome-dark")
                  }
                >
                  <div className="flex items-baseline justify-between">
                    <span className={"text-[12px] font-mono " + (isActive ? "text-accent" : "text-text")}>
                      {s.number}
                    </span>
                    {s.revisions.length > 0 && (
                      <span className="text-[9.5px] text-warn font-mono">
                        {s.revisions[s.revisions.length - 1].tag}
                      </span>
                    )}
                  </div>
                  <div className={"text-[11px] mt-0.5 " + (isActive ? "text-text" : "text-text2")}>
                    {s.title}
                  </div>
                  <div className="text-[9.5px] text-text4 font-mono mt-0.5">
                    {SHEET_KIND_LABEL[s.kind]} · {s.scale.label}
                  </div>
                </button>
              </li>
            );
          })}
        </ul>

        {/* Issuance footer */}
        <div className="px-3 py-2 border-t border-chrome-dark text-[10px] text-text4 font-mono">
          <div className="uppercase tracking-[0.06em] mb-1 text-text3">Issuances</div>
          {set.issuances.length === 0 ? (
            <div className="text-text4">No issuances logged.</div>
          ) : (
            set.issuances.map((iss, i) => (
              <div key={i}>
                {formatShortDate(iss.date)} · {iss.label}
              </div>
            ))
          )}
        </div>
      </aside>

      {/* Main pane */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Toolbar */}
        <div className="border-b border-chrome-dark flex items-center justify-between px-3 py-2 gap-3">
          <div className="flex items-center gap-1">
            <button type="button" onClick={() => gotoIndex(-1)}
                    className="btn btn-ghost text-[11px] px-2 py-1 disabled:opacity-40"
                    disabled={set.sheets.findIndex(s => s.id === activeId) === 0}>
              <i className="ti ti-chevron-left" style={{ fontSize: 12 }} aria-hidden="true" /> Prev
            </button>
            <button type="button" onClick={() => gotoIndex(1)}
                    className="btn btn-ghost text-[11px] px-2 py-1 disabled:opacity-40"
                    disabled={set.sheets.findIndex(s => s.id === activeId) === set.sheets.length - 1}>
              Next <i className="ti ti-chevron-right" style={{ fontSize: 12 }} aria-hidden="true" />
            </button>
            <div className="mx-2 h-5 w-px bg-chrome-dark" />
            <span className="text-[11px] text-text2 font-mono">
              {activeSheet.number} · <span className="text-text3">{activeSheet.title}</span>
            </span>
          </div>

          {/* Zoom presets */}
          <div className="flex items-center gap-1">
            <span className="text-[10px] text-text4 font-mono uppercase tracking-[0.06em] mr-1">Zoom</span>
            {ZOOM_PRESETS.map(p => (
              <button
                type="button" key={p.label}
                onClick={() => setZoom(p.value)}
                className={
                  "text-[10.5px] font-mono px-2 py-1 rounded-[2px] transition-colors " +
                  (zoom === p.value ? "bg-accent text-chrome-darkest" : "text-text3 hover:bg-chrome-dark")
                }
              >{p.label}</button>
            ))}
          </div>

          <div className="flex items-center gap-2">
            <a
              href={`/api/projects/${project.id}/drawings/${activeSheet.id}.svg`}
              target="_blank" rel="noreferrer"
              className="btn btn-ghost text-[11px] px-2 py-1"
              title="Open this sheet as a standalone SVG"
            >
              <i className="ti ti-external-link" style={{ fontSize: 12 }} aria-hidden="true" /> Open SVG
            </a>
            <button type="button" onClick={() => window.print()}
                    className="btn btn-primary text-[11px] px-3 py-1">
              <i className="ti ti-printer" style={{ fontSize: 12 }} aria-hidden="true" /> Print / PDF
            </button>
          </div>
        </div>

        {/* Canvas */}
        <div ref={containerRef} className="flex-1 overflow-auto bg-chrome-darkest">
          <div className="min-h-full flex items-center justify-center p-6">
            <SheetCanvas
              project={project}
              sheet={activeSheet}
              rcdd={rcdd}
              issuance={latestIssuance}
              displayHeightPx={displayHeight}
            >
              {(region) => renderSheetContent({
                sheet: activeSheet, project, set, rooms, scheduleRows, scheduleTotalLf,
                outletCount, region,
              })}
            </SheetCanvas>
          </div>
        </div>
      </div>
    </div>
  );
}

function renderSheetContent({
  sheet, project, set, rooms, scheduleRows, scheduleTotalLf, outletCount, region,
}: {
  sheet: DrawingSheet;
  project: Project;
  set: DrawingSet;
  rooms: ExtractedRoom[];
  scheduleRows: CableScheduleRow[];
  scheduleTotalLf: number;
  outletCount: number;
  region: { w: number; h: number };
}) {
  switch (sheet.kind) {
    case "cover":         return <CoverSheet project={project} set={set} region={region} />;
    case "symbols":       return <SymbolsSheet set={set} region={region} />;
    case "floor_plan":    return <FloorPlanSheet rooms={rooms} region={region} />;
    case "enlarged_plan": return <EnlargedTrSheet project={project} rooms={rooms} region={region} />;
    case "riser":         return <RiserSheet project={project} rooms={rooms} region={region} />;
    case "schedule":      return <ScheduleSheet rows={scheduleRows} totalLf={scheduleTotalLf} region={region} />;
    case "details":       return <RackElevationSheet project={project} outletCount={outletCount} region={region} />;
    default:
      return (
        <text x="40" y="80" fontSize="24" fill="#888">
          Sheet kind {sheet.kind} is not yet rendered.
        </text>
      );
  }
}

function formatShortDate(iso: string): string {
  const d = new Date(iso);
  const yy = String(d.getFullYear()).slice(2);
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${mm}/${dd}/${yy}`;
}
