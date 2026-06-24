"use client";

// Pathway workspace — Revit-style CAD shell wrapping the pathway canvas.
//
// This is the new shell direction per the visual-direction memory: charcoal
// chrome, light canvas, amber accent, ribbon + project browser + properties
// palette + status bar. Drawing gestures (polyline drawing, snap, dragging)
// stay in PathwayEditor for now — this view focuses on selection +
// inspection, which is enough to validate the shell aesthetic.

import { useMemo, useState } from "react";
import Link from "next/link";
import clsx from "clsx";
import type { Project } from "@/lib/projects/types";
import type { ExtractedRoom } from "@/lib/intake/types";
import type {
  PathwaySegment, CableRun, CableRunValidation, PathwayMaterials, PathwayType,
} from "@/lib/pathway/types";
import {
  PATHWAY_TYPE_LABEL, CABLE_TYPE_LABEL,
  TIA568_MAX_FT, TIA568_WARN_FT,
} from "@/lib/pathway/types";
import { CANVAS_W, CANVAS_H } from "@/lib/intake/types";
import { AppFrame } from "@/components/shell/cad/AppFrame";
import { RibbonBar, type RibbonTabId } from "@/components/shell/cad/RibbonBar";
import { ToolPalette, type ToolGroup } from "@/components/shell/cad/ToolPalette";
import { ProjectBrowser, type BrowserNode } from "@/components/shell/cad/ProjectBrowser";
import { PropertiesPalette, type PropertySection } from "@/components/shell/cad/PropertiesPalette";
import { StatusBar } from "@/components/shell/cad/StatusBar";

// ── Display constants ────────────────────────────────────────────────────

const PATHWAY_STROKE: Record<PathwayType, { color: string; width: number; dash?: string }> = {
  cable_tray: { color: "#f6a623", width: 1.4 },                    // amber accent
  conduit:    { color: "#4a90d6", width: 1.0 },                    // info blue
  j_hook:     { color: "#c9931f", width: 0.8, dash: "1.5 1.5" },   // warn dashed
  riser:      { color: "#3fae5d", width: 1.6 },                    // pass green
};

const ROOM_FILL: Record<string, string> = {
  mdf: "#e7eef8", idf: "#e7eef8",
  open_office: "#fcfcfa", private_office: "#fcfcfa",
  conference: "#f4f7fc", reception: "#fdf8ed",
  corridor: "#f4f4f0", storage: "#f7f6ef",
  classroom: "#f3f7ec", lab: "#f4f2fa",
  patient_room: "#fdf2eb", exam_room: "#fdf2eb",
  electrical: "#fcf2e0", mechanical: "#fcf2e0",
  restroom: "#f3f3ef", kitchen: "#fdf7d8",
  stairwell: "#ecece8", elevator: "#ecece8",
  unknown: "#fafafa",
};

// ── Workspace ────────────────────────────────────────────────────────────

export function PathwayWorkspace({
  project, identity, rooms, segments, runs, validations, materials,
}: {
  project: Project;
  identity?: string;
  rooms: ExtractedRoom[];
  segments: PathwaySegment[];
  runs: CableRun[];
  validations: CableRunValidation[];
  materials: PathwayMaterials;
}) {
  const [activeTab, setActiveTab]   = useState<RibbonTabId>("home");
  const [activeToolId, setActiveToolId] = useState<string>("pointer");
  const [selectedSegId, setSelectedSegId] = useState<string | null>(null);
  const [cursorXY, setCursorXY] = useState<{ x: number; y: number } | null>(null);

  // Endpoints (outlets + TRs) for canvas overlay
  const endpoints = useMemo(() => {
    const m = new Map<string, { x: number; y: number; label: string; kind: "outlet" | "tr" }>();
    for (const r of runs) {
      m.set(r.outlet.id, { x: r.outlet.x, y: r.outlet.y, label: r.outlet.label, kind: "outlet" });
      m.set(r.tr.id,     { x: r.tr.x,     y: r.tr.y,     label: r.tr.label,     kind: "tr"     });
    }
    return [...m.values()];
  }, [runs]);

  const selectedSegment = segments.find(s => s.id === selectedSegId) ?? null;

  // ── Project Browser tree ────────────────────────────────────────────
  const browserSections: BrowserNode[] = [
    {
      id: "floors", label: `Floors (${project.floors})`, icon: "ti-stack",
      children: Array.from({ length: Math.min(project.floors, 6) }, (_, i) => ({
        id: `floor-${i+1}`,
        label: i + 1 === project.floors ? `Level ${i+1} — MDF` : `Level ${i+1}`,
      })),
    },
    {
      id: "views", label: "Views", icon: "ti-eye",
      children: [
        { id: "view-pathway", label: "Pathway Routing", meta: "active" },
        { id: "view-cable-plan", label: "Cable Plan" },
        { id: "view-rack-elev", label: "Rack Elevations" },
        { id: "view-floor-plan", label: "Floor Plan" },
      ],
    },
    {
      id: "sheets", label: "Sheets", icon: "ti-file-stack",
      children: [
        { id: "sheet-t101", label: "T-101 · Cable Layout",      meta: "Rev A" },
        { id: "sheet-t102", label: "T-102 · Rack Elevations",   meta: "Rev A" },
        { id: "sheet-t501", label: "T-501 · Details + Sched.",  meta: "—" },
      ],
    },
    {
      id: "schedules", label: "Schedules", icon: "ti-list",
      children: [
        { id: "sched-cables",   label: "Cable Run Schedule",     meta: `${runs.length}` },
        { id: "sched-bom",      label: "Bill of Materials" },
        { id: "sched-labor",    label: "Labor SOV" },
      ],
    },
    {
      id: "families", label: "Families", icon: "ti-puzzle",
      children: [
        { id: "fam-outlets", label: "Telecom Outlets" },
        { id: "fam-trays",   label: "Cable Trays" },
        { id: "fam-conduit", label: "Conduit Fittings" },
      ],
    },
  ];

  // ── Tool palette (per ribbon tab) ───────────────────────────────────
  const toolGroups: ToolGroup[] = activeTab === "home" ? [
    { id: "select", label: "Select", tools: [
      { id: "pointer",  icon: "ti-pointer",        label: "Modify" },
      { id: "window",   icon: "ti-square-toggle",  label: "Window" },
      { id: "crossing", icon: "ti-section",        label: "Crossing" },
    ]},
    { id: "telecom", label: "Telecom", tools: [
      { id: "tray",    icon: "ti-route",  label: "Tray" },
      { id: "conduit", icon: "ti-line",   label: "Conduit" },
      { id: "outlet",  icon: "ti-point",  label: "Outlet", disabled: true },
      { id: "wap",     icon: "ti-wifi",   label: "WAP",    disabled: true },
    ]},
    { id: "verify", label: "Verify", tools: [
      { id: "tia568",     icon: "ti-shield-check",  label: "TIA-568" },
      { id: "fill",       icon: "ti-percentage",    label: "Fill" },
      { id: "compliance", icon: "ti-clipboard-list", label: "Compliance" },
    ]},
    { id: "ai", label: "AI Assist", tools: [
      { id: "auto-route", icon: "ti-sparkles",   label: "Auto-Route" },
      { id: "bom",        icon: "ti-receipt",    label: "BOM" },
      { id: "p6",         icon: "ti-file-export", label: "P6 Export" },
    ]},
  ] : [
    { id: "placeholder", label: "Coming soon", tools: [
      { id: "x", icon: "ti-tool", label: "Pending", disabled: true },
    ]},
  ];

  // ── Properties palette ──────────────────────────────────────────────
  const propsSections: PropertySection[] = selectedSegment ? [
    {
      id: "constraints", label: "Constraints", defaultOpen: true,
      rows: [
        { label: "Level",     value: `Level ${selectedSegment.floor}` },
        { label: "Height AFF", value: `${selectedSegment.heightFt}' - 0"`, mono: true },
        { label: "Length",    value: `${computeSegmentLengthFt(selectedSegment).toFixed(0)} LF`, mono: true },
      ],
    },
    {
      id: "properties", label: "Properties", defaultOpen: true,
      rows: [
        { label: "Type",  value: PATHWAY_TYPE_LABEL[selectedSegment.type] },
        ...(selectedSegment.trayWidthIn ? [{ label: "Width", value: `${selectedSegment.trayWidthIn}"`, mono: true }] : []),
        ...(selectedSegment.conduitSize  ? [{ label: "Size",  value: `${selectedSegment.conduitSize}" EMT`, mono: true }] : []),
        { label: "Material", value: selectedSegment.type === "cable_tray" ? "Steel, painted" : selectedSegment.type === "conduit" ? "EMT, zinc-coated" : "Saddle hanger" },
        { label: "Source",   value: selectedSegment.source.toUpperCase(), mono: true, tone: "text2" },
      ],
    },
    {
      id: "identity", label: "Identity Data", defaultOpen: true,
      rows: [
        { label: "Mark", value: selectedSegment.id, mono: true },
        { label: "Tag",  value: selectedSegment.label ?? "—" },
      ],
    },
    {
      id: "compliance", label: "Compliance", defaultOpen: false,
      rows: [
        { label: "TIA-568 length", value: "Pass", tone: "pass" },
        { label: "NEC 392.22 fill", value: "28% / 50%", mono: true, tone: "pass" },
      ],
    },
  ] : [];

  // ── Floor + canvas ──────────────────────────────────────────────────
  const floor = 1;
  const floorSegments = segments.filter(s => s.floor === floor);
  const floorRooms    = rooms.filter(r => r.floor === floor);

  const failingRuns = validations.filter(v => v.status === "fail").length;
  const warnRuns    = validations.filter(v => v.status === "warn").length;

  return (
    <AppFrame
      title={`${project.name}.toro`}
      identity={identity ?? `${project.owner} · ${project.number}`}
      ribbon={<RibbonBar active={activeTab} onChange={setActiveTab} />}
      toolPalette={
        <ToolPalette
          groups={toolGroups}
          activeToolId={activeToolId}
          onTool={setActiveToolId}
          trailing={
            <>
              <span className="text-text4">Active sheet:</span>
              <span className="text-text2 font-mono">T-101</span>
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
          currentNodeId="view-pathway"
        />
      }
      canvas={
        <PathwayCanvas
          rooms={floorRooms}
          segments={floorSegments}
          endpoints={endpoints}
          selectedSegId={selectedSegId}
          onSelectSegment={setSelectedSegId}
          onCursor={setCursorXY}
          tool={activeToolId}
        />
      }
      properties={
        <PropertiesPalette
          selectionLabel={selectedSegment ? (selectedSegment.label ?? PATHWAY_TYPE_LABEL[selectedSegment.type]) : undefined}
          selectionSubtitle={selectedSegment ? selectedSegment.id : undefined}
          selectionIcon={
            selectedSegment?.type === "cable_tray" ? "ti-route"
            : selectedSegment?.type === "conduit" ? "ti-line"
            : selectedSegment?.type === "j_hook"  ? "ti-current-location"
            : "ti-stairs"
          }
          selectionTone="accent"
          sections={propsSections}
          empty={
            <div>
              <div className="text-text2 font-medium mb-1">No selection</div>
              <div className="text-text3 leading-snug">
                Pathway design for {project.name}. Click any cable tray, conduit, or J-hook
                segment on the canvas to inspect its properties, mounting height, and compliance status.
              </div>
              <div className="mt-3 text-text4 text-[10.5px]">
                <div>{segments.length} segments · {runs.length} cable runs</div>
                <div>{failingRuns} fail · {warnRuns} warn · {validations.length - failingRuns - warnRuns} pass</div>
              </div>
            </div>
          }
        />
      }
      status={
        <StatusBar
          segments={[
            { kind: "coord", text: `X: ${cursorXY ? cursorXY.x.toFixed(1) : "—"} ft` },
            { kind: "coord", text: `Y: ${cursorXY ? cursorXY.y.toFixed(1) : "—"} ft` },
            { text: "Scale 1/8\" = 1'-0\"" },
            { text: "Snap: Grid 1 ft" },
            { kind: "pass", icon: "ti-circle-check", text: "Saved" },
          ]}
          trailing={[
            { text: `TIA-568: ${failingRuns ? `${failingRuns} fail` : warnRuns ? `${warnRuns} warn` : "all pass"}`,
              kind: failingRuns ? "warn" : warnRuns ? "warn" : "pass" },
            { icon: "ti-tool", text: `Tool: ${toolLabel(activeToolId)}` },
            { text: "| Click an element to inspect" },
          ]}
        />
      }
    />
  );
}

// ── Canvas (light surface, dark linework) ────────────────────────────────

function PathwayCanvas({
  rooms, segments, endpoints, selectedSegId, onSelectSegment, onCursor, tool,
}: {
  rooms: ExtractedRoom[];
  segments: PathwaySegment[];
  endpoints: Array<{ x: number; y: number; label: string; kind: "outlet" | "tr" }>;
  selectedSegId: string | null;
  onSelectSegment: (id: string | null) => void;
  onCursor: (p: { x: number; y: number } | null) => void;
  tool: string;
}) {
  const MARGIN = 8;
  const viewW = CANVAS_W + MARGIN * 2;
  const viewH = CANVAS_H + MARGIN * 2;

  function polylinePath(s: PathwaySegment): string {
    return s.nodes.map((n, i) => `${i === 0 ? "M" : "L"} ${n.x + MARGIN} ${n.y + MARGIN}`).join(" ");
  }

  function handleMove(e: React.MouseEvent<SVGSVGElement>) {
    const svg = e.currentTarget;
    const pt = svg.createSVGPoint();
    pt.x = e.clientX; pt.y = e.clientY;
    const ctm = svg.getScreenCTM();
    if (!ctm) return;
    const p = pt.matrixTransform(ctm.inverse());
    onCursor({ x: p.x - MARGIN, y: p.y - MARGIN });
  }

  function handleLeave() { onCursor(null); }

  return (
    <div className="w-full h-full flex items-center justify-center p-3 bg-chrome-darkest">
      <div className="w-full h-full max-w-[1500px] bg-canvas-bg shadow-[0_0_0_1px_rgba(0,0,0,0.4),0_4px_18px_rgba(0,0,0,0.5)]"
           onClick={() => onSelectSegment(null)}>
        <svg viewBox={`0 0 ${viewW} ${viewH}`}
             preserveAspectRatio="xMidYMid meet"
             className="w-full h-full block"
             style={{ cursor: tool === "pointer" ? "default" : "crosshair" }}
             onMouseMove={handleMove}
             onMouseLeave={handleLeave}
             onClick={(e) => e.stopPropagation()}>

          {/* Grid + paper background */}
          <rect width={viewW} height={viewH} fill="#f4f4f2" />
          <g opacity={0.8} stroke="#dcdcd6" strokeWidth={0.12}>
            {Array.from({ length: Math.floor(viewW / 5) + 1 }, (_, i) => (
              <line key={`vg-${i}`} x1={i * 5} y1={0} x2={i * 5} y2={viewH} />
            ))}
            {Array.from({ length: Math.floor(viewH / 5) + 1 }, (_, i) => (
              <line key={`hg-${i}`} x1={0} y1={i * 5} x2={viewW} y2={i * 5} />
            ))}
          </g>
          <g stroke="#cdcdc6" strokeWidth={0.22}>
            {Array.from({ length: Math.floor(CANVAS_W / 10) + 1 }, (_, i) => (
              <line key={`vg10-${i}`} x1={MARGIN + i * 10} y1={MARGIN} x2={MARGIN + i * 10} y2={MARGIN + CANVAS_H} />
            ))}
            {Array.from({ length: Math.floor(CANVAS_H / 10) + 1 }, (_, i) => (
              <line key={`hg10-${i}`} x1={MARGIN} y1={MARGIN + i * 10} x2={MARGIN + CANVAS_W} y2={MARGIN + i * 10} />
            ))}
          </g>

          {/* Drawing border */}
          <rect x={MARGIN} y={MARGIN} width={CANVAS_W} height={CANVAS_H}
                fill="none" stroke="#1f1f1c" strokeWidth={0.4} />

          {/* Rooms */}
          {rooms.length > 0 && (
            <g>
              {rooms.map(r => {
                const type = r.overrideType ?? r.type;
                return (
                  <g key={r.id}>
                    <rect
                      x={r.x + MARGIN} y={r.y + MARGIN}
                      width={r.w} height={r.h}
                      fill={ROOM_FILL[type] ?? "#fafafa"} stroke="#a8a8a0" strokeWidth={0.22}
                    />
                  </g>
                );
              })}
            </g>
          )}

          {/* Pathway segments — click to select */}
          {segments.map(s => {
            const sel = s.id === selectedSegId;
            const style = PATHWAY_STROKE[s.type];
            return (
              <g key={s.id}
                 onClick={(e) => { e.stopPropagation(); onSelectSegment(s.id); }}
                 style={{ cursor: "pointer" }}>
                {/* Wider invisible hit target */}
                <path d={polylinePath(s)} fill="none" stroke="transparent" strokeWidth={2.4} strokeLinecap="round" />
                <path d={polylinePath(s)}
                      fill="none"
                      stroke={sel ? "#f6a623" : style.color}
                      strokeWidth={sel ? style.width * 2 : style.width}
                      strokeDasharray={style.dash}
                      strokeLinecap="round"
                      strokeLinejoin="round" />
                {s.nodes.map((n, i) => (
                  <circle key={i} cx={n.x + MARGIN} cy={n.y + MARGIN}
                          r={sel ? 0.7 : 0.4}
                          fill={sel ? "#f6a623" : style.color} />
                ))}
                {s.label && (
                  <text
                    x={s.nodes[Math.floor(s.nodes.length / 2)].x + MARGIN}
                    y={s.nodes[Math.floor(s.nodes.length / 2)].y + MARGIN - 1.4}
                    textAnchor="middle"
                    fontSize={1.4} fontFamily="monospace"
                    fill={sel ? "#f6a623" : style.color}
                  >{s.label}</text>
                )}
              </g>
            );
          })}

          {/* Endpoints */}
          {endpoints.map(e => (
            <g key={`${e.kind}-${e.label}`}>
              {e.kind === "tr" ? (
                <>
                  <rect x={e.x + MARGIN - 1.5} y={e.y + MARGIN - 1.5} width={3} height={3}
                        fill="#1f1f1c" stroke="#fafaf7" strokeWidth={0.3} />
                  <text x={e.x + MARGIN + 2.2} y={e.y + MARGIN + 0.4}
                        fontSize={1.6} fontFamily="monospace" fontWeight={700} fill="#1f1f1c">
                    {e.label}
                  </text>
                </>
              ) : (
                <rect x={e.x + MARGIN - 0.5} y={e.y + MARGIN - 0.5} width={1} height={1}
                      fill="#4a90d6" />
              )}
            </g>
          ))}

          {/* Title block */}
          <g>
            <rect x={viewW - 32} y={viewH - 10} width={28} height={8}
                  fill="#fafaf7" stroke="#1f1f1c" strokeWidth={0.25} />
            <text x={viewW - 30} y={viewH - 7} fontSize={1.2} fontFamily="monospace" fill="#1f1f1c">T-101 · TELECOM</text>
            <text x={viewW - 30} y={viewH - 5.5} fontSize={1.2} fontFamily="monospace" fill="#1f1f1c">CABLE LAYOUT</text>
            <text x={viewW - 30} y={viewH - 3.5} fontSize={1.0} fontFamily="monospace" fill="#666">1/8" = 1'-0"</text>
          </g>

        </svg>
      </div>
    </div>
  );
}

// ── Helpers ─────────────────────────────────────────────────────────────

function computeSegmentLengthFt(s: PathwaySegment): number {
  let total = 0;
  for (let i = 1; i < s.nodes.length; i++) {
    const dx = s.nodes[i].x - s.nodes[i - 1].x;
    const dy = s.nodes[i].y - s.nodes[i - 1].y;
    total += Math.hypot(dx, dy);
  }
  return total;
}

function toolLabel(id: string): string {
  const map: Record<string, string> = {
    pointer: "Modify (Select)", window: "Window Select", crossing: "Crossing Select",
    tray: "Cable Tray", conduit: "Conduit", outlet: "Outlet", wap: "WAP",
    tia568: "Run TIA-568 Validation", fill: "Run NEC Fill", compliance: "Run Compliance",
    "auto-route": "AI Auto-Route", bom: "AI BOM Rollup", p6: "Export Primavera P6",
  };
  return map[id] ?? id;
}
