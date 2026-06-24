"use client";

// Pathway editor — CAD-style three-pane viewer for cable tray / conduit /
// J-hook design. The center canvas renders the floor plan + pathway carrier
// geometry; the left panel lists cable runs with TIA-568 status; the right
// panel rolls up the carrier + cable BOM.
//
// Drawing tools are wired: clicking each node of a tray/conduit/j_hook/riser
// builds a polyline; double-click or Enter finalises; Escape cancels. Snap
// targets nearest pathway nodes + outlet/TR endpoints within ~2 ft for clean
// topology. Compute (run lengths, TIA-568 90 m validation, BOM rollup) is
// recomputed client-side as the user edits.

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import clsx from "clsx";
import type { Project } from "@/lib/projects/types";
import type { ExtractedRoom } from "@/lib/intake/types";
import type {
  PathwaySegment, CableRun, CableRunValidation, PathwayMaterials, PathwayType, RunStatus,
} from "@/lib/pathway/types";
import {
  PATHWAY_TYPE_LABEL, CABLE_TYPE_LABEL,
  TIA568_MAX_FT, TIA568_WARN_FT,
} from "@/lib/pathway/types";
import { validateAllRuns, materialRollup } from "@/lib/pathway/compute";
import { pathwayClient } from "@/lib/pathway/client";
import { CANVAS_W, CANVAS_H } from "@/lib/intake/types";

// ── Drawing tools + state machine ───────────────────────────────────────

type Tool = "select" | "tray" | "conduit" | "j_hook" | "riser";

const TOOL_TO_PATHWAY_TYPE: Record<Exclude<Tool, "select">, PathwayType> = {
  tray:    "cable_tray",
  conduit: "conduit",
  j_hook:  "j_hook",
  riser:   "riser",
};

interface Point { x: number; y: number }

type Gesture =
  | { kind: "idle" }
  | { kind: "drawing"; tool: Exclude<Tool, "select">; nodes: Point[]; cursor: Point | null; snap: SnapTarget | null };

interface SnapTarget {
  x: number;
  y: number;
  /** Description rendered next to the snap indicator. */
  label: string;
}

const SNAP_RADIUS = 2.0;        // ft — within this distance, snap activates
const DEFAULT_HEIGHT_FT = 10;   // overhead pathway default
const DEFAULT_RISER_HEIGHT_FT = 12;
const DEFAULT_TRAY_WIDTH_IN = 12;
const DEFAULT_CONDUIT_SIZE  = "1";
const TRAY_WIDTH_OPTIONS = [6, 12, 18, 24] as const;
const CONDUIT_SIZE_OPTIONS = ["3/4", "1", "1-1/4", "1-1/2", "2"] as const;

// ── Display constants ────────────────────────────────────────────────────

const PATHWAY_STROKE: Record<PathwayType, { color: string; width: number; dash?: string }> = {
  cable_tray: { color: "#d68a3a", width: 1.4 },                    // accent orange-yellow
  conduit:    { color: "#2c5aa0", width: 1.0 },                    // info blue
  j_hook:     { color: "#c89818", width: 0.8, dash: "1.5 1.5" },   // warn yellow, dashed
  riser:      { color: "#2a8a5c", width: 1.6 },                    // pass green
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

const STATUS_TONE: Record<RunStatus, string> = {
  pass: "text-pass",
  warn: "text-warn",
  fail: "text-fail",
};
const STATUS_BG: Record<RunStatus, string> = {
  pass: "bg-pass/15",
  warn: "bg-warn/15",
  fail: "bg-fail/15",
};

// ── Main component ──────────────────────────────────────────────────────

export function PathwayEditor({
  project, rooms, segments: initialSegments, runs, validations: initialValidations, materials: initialMaterials,
}: {
  project: Project;
  rooms: ExtractedRoom[];
  segments: PathwaySegment[];
  runs: CableRun[];
  validations: CableRunValidation[];
  materials: PathwayMaterials;
}) {
  // Local segment state — mutated by the drawing tools and segment delete.
  const [segments, setSegments] = useState<PathwaySegment[]>(initialSegments);

  const [selectedRunId, setSelectedRunId] = useState<string | null>(null);
  const [selectedSegmentId, setSelectedSegmentId] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<RunStatus | "all">("all");
  const [showRooms, setShowRooms] = useState(true);
  const [showLabels, setShowLabels] = useState(true);
  const [units, setUnits] = useState<"ft" | "m">("ft");
  const [tool, setTool] = useState<Tool>("select");

  // Tool default properties — used when drawing a new segment.
  const [trayWidthIn, setTrayWidthIn] = useState<number>(DEFAULT_TRAY_WIDTH_IN);
  const [conduitSize, setConduitSize] = useState<string>(DEFAULT_CONDUIT_SIZE);

  // Active drawing gesture.
  const [gesture, setGesture] = useState<Gesture>({ kind: "idle" });
  const [error, setError] = useState<string | null>(null);

  // Recompute validations + materials locally as segments change. The seed
  // initialValidations / initialMaterials are only used on first render to
  // avoid a layout flicker before client compute runs.
  const validations = useMemo(
    () => (segments === initialSegments ? initialValidations : validateAllRuns(runs, segments)),
    [runs, segments, initialSegments, initialValidations],
  );
  const materials = useMemo(
    () => (segments === initialSegments ? initialMaterials : materialRollup(segments, runs)),
    [runs, segments, initialSegments, initialMaterials],
  );

  const validationByRun = useMemo(() => {
    const m: Record<string, CableRunValidation> = {};
    for (const v of validations) m[v.runId] = v;
    return m;
  }, [validations]);

  const visibleRuns = useMemo(
    () => statusFilter === "all" ? runs : runs.filter(r => validationByRun[r.id]?.status === statusFilter),
    [runs, statusFilter, validationByRun],
  );

  const selectedRun = runs.find(r => r.id === selectedRunId) ?? null;
  const selectedSegmentIds = new Set(selectedRun?.segmentIds ?? []);

  // Validation counts
  const counts = useMemo(() => {
    const c = { pass: 0, warn: 0, fail: 0 };
    for (const v of validations) c[v.status]++;
    return c;
  }, [validations]);

  // Per-floor filter — for now we just render floor 1, but the structure is here
  const floorSegments = segments.filter(s => s.floor === 1);
  const floorRooms    = rooms.filter(r => r.floor === 1);

  // Reset gesture when the tool changes.
  useEffect(() => { setGesture({ kind: "idle" }); }, [tool]);

  // ── Keyboard shortcuts ───────────────────────────────────────────────
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const t = e.target as HTMLElement | null;
      if (t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.tagName === "SELECT" || t.isContentEditable)) return;
      if (e.metaKey || e.ctrlKey || e.altKey) return;

      // Tool switching
      const map: Record<string, Tool> = { v: "select", t: "tray", c: "conduit", j: "j_hook", r: "riser" };
      const key = e.key.toLowerCase();
      if (map[key]) { e.preventDefault(); setTool(map[key]); return; }

      // Finish polyline
      if (e.key === "Enter") {
        e.preventDefault();
        finishDrawing();
        return;
      }
      // Cancel
      if (e.key === "Escape") {
        e.preventDefault();
        setGesture({ kind: "idle" });
        setTool("select");
        return;
      }
      // Delete selected segment
      if ((e.key === "Delete" || e.key === "Backspace") && selectedSegmentId) {
        e.preventDefault();
        void deleteSelectedSegment();
        return;
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gesture, selectedSegmentId]);

  // ── Drawing helpers ──────────────────────────────────────────────────

  function defaultsFor(t: Exclude<Tool, "select">) {
    switch (t) {
      case "tray":    return { type: "cable_tray" as const, heightFt: DEFAULT_HEIGHT_FT, trayWidthIn };
      case "conduit": return { type: "conduit"    as const, heightFt: DEFAULT_HEIGHT_FT, conduitSize };
      case "j_hook":  return { type: "j_hook"     as const, heightFt: DEFAULT_HEIGHT_FT };
      case "riser":   return { type: "riser"      as const, heightFt: DEFAULT_RISER_HEIGHT_FT, fromFloor: 1, toFloor: 2 };
    }
  }

  function addNode(p: Point) {
    if (tool === "select") return;
    const drawTool = tool;
    setGesture(prev => {
      if (prev.kind === "drawing" && prev.tool === drawTool) {
        return { ...prev, nodes: [...prev.nodes, p], cursor: null };
      }
      return { kind: "drawing", tool: drawTool, nodes: [p], cursor: null, snap: null };
    });
  }

  function updateCursor(p: Point, snap: SnapTarget | null) {
    setGesture(prev => {
      if (prev.kind !== "drawing") return prev;
      return { ...prev, cursor: p, snap };
    });
  }

  async function finishDrawing() {
    if (gesture.kind !== "drawing") return;
    if (gesture.nodes.length < 2) {
      // Not enough nodes — cancel cleanly.
      setGesture({ kind: "idle" });
      return;
    }
    const defaults = defaultsFor(gesture.tool);
    setGesture({ kind: "idle" });
    setError(null);
    const res = await pathwayClient.createSegment(project.id, {
      type: defaults.type,
      nodes: gesture.nodes,
      floor: 1,
      heightFt: defaults.heightFt,
      ...("trayWidthIn" in defaults ? { trayWidthIn: defaults.trayWidthIn } : {}),
      ...("conduitSize" in defaults ? { conduitSize: defaults.conduitSize } : {}),
      ...("fromFloor"  in defaults ? { fromFloor:  defaults.fromFloor  } : {}),
      ...("toFloor"    in defaults ? { toFloor:    defaults.toFloor    } : {}),
    });
    if (res.ok && res.segment) {
      setSegments(prev => [...prev, res.segment!]);
      setSelectedSegmentId(res.segment.id);
      setTool("select");
    } else {
      setError(res.error?.message ?? "Could not create pathway segment.");
    }
  }

  async function deleteSelectedSegment() {
    if (!selectedSegmentId) return;
    const idToRemove = selectedSegmentId;
    // Optimistic
    setSegments(prev => prev.filter(s => s.id !== idToRemove));
    setSelectedSegmentId(null);
    const res = await pathwayClient.removeSegment(project.id, idToRemove);
    if (!res.ok) setError(res.error?.message ?? "Could not delete pathway segment.");
  }

  // Per-tool usage hint shown at the bottom of the canvas.
  const toolHint: Record<Tool, string> = {
    select:  "click to select · Delete to remove",
    tray:    "click each node · Enter to finish",
    conduit: "click each node · Enter to finish",
    j_hook:  "click each node · Enter to finish",
    riser:   "click two points · Enter to finish",
  };

  // Endpoints (outlets + TRs) flattened for snap detection and rendering.
  const endpoints = useMemo(() => {
    const m = new Map<string, { x: number; y: number; label: string; kind: "outlet" | "tr" }>();
    for (const r of runs) {
      m.set(r.outlet.id, { x: r.outlet.x, y: r.outlet.y, label: r.outlet.label, kind: "outlet" });
      m.set(r.tr.id,     { x: r.tr.x,     y: r.tr.y,     label: r.tr.label,     kind: "tr"     });
    }
    return [...m.values()];
  }, [runs]);

  return (
    <div className="h-full flex flex-col bg-chrome-darkest">
      {/* ── Toolbar ─────────────────────────────────────────────────── */}
      <PathwayToolbar
        project={project}
        tool={tool} onTool={setTool}
        trayWidthIn={trayWidthIn} onTrayWidth={setTrayWidthIn}
        conduitSize={conduitSize} onConduitSize={setConduitSize}
        statusFilter={statusFilter} onStatusFilter={setStatusFilter}
        showRooms={showRooms} onShowRooms={setShowRooms}
        showLabels={showLabels} onShowLabels={setShowLabels}
        units={units} onUnits={setUnits}
        counts={counts} total={runs.length}
      />

      <div className="flex-1 flex min-h-0">
        {/* ── Left: run list ──────────────────────────────────────── */}
        <RunListPanel
          runs={visibleRuns}
          validationByRun={validationByRun}
          selectedId={selectedRunId}
          onSelect={(id) => setSelectedRunId(prev => prev === id ? null : id)}
          units={units}
        />

        {/* ── Center: canvas ──────────────────────────────────────── */}
        <div className="flex-1 min-w-0 bg-chrome-dark overflow-auto relative">
          <PathwayCanvas
            segments={floorSegments}
            rooms={showRooms ? floorRooms : []}
            endpoints={endpoints}
            selectedRun={selectedRun}
            selectedSegmentIds={selectedSegmentIds}
            selectedSegmentId={selectedSegmentId}
            showLabels={showLabels}
            tool={tool}
            gesture={gesture}
            onAddNode={addNode}
            onUpdateCursor={updateCursor}
            onFinishDrawing={finishDrawing}
            onSelectSegment={(id) => setSelectedSegmentId(prev => prev === id ? null : id)}
            onDeselectAll={() => setSelectedSegmentId(null)}
          />
          <div className="absolute bottom-2 left-3 text-[10px] text-text4 font-mono uppercase tracking-[0.06em] pointer-events-none">
            <span>Floor 1 · grid = 1 ft</span>
            <span className="ml-3 text-text3">Tool: {toolHint[tool]}</span>
            {tool !== "select" && <span className="ml-2 text-text4">· Esc to cancel</span>}
          </div>
          {error && (
            <div className="absolute top-3 left-1/2 -translate-x-1/2 px-3 py-1.5 bg-fail/15 border border-fail/40 text-[11px] text-fail font-mono rounded-[2px]">
              {error}
              <button onClick={() => setError(null)} className="ml-3 text-text4 hover:text-text">✕</button>
            </div>
          )}
        </div>

        {/* ── Right: material BOM + validation ────────────────────── */}
        <BomPanel
          materials={materials} counts={counts} total={runs.length} units={units}
          selectedSegment={segments.find(s => s.id === selectedSegmentId) ?? null}
          onDeleteSelected={deleteSelectedSegment}
        />
      </div>
    </div>
  );
}

// ── Toolbar ──────────────────────────────────────────────────────────────

const TOOL_DEFS: Array<{ id: Tool; glyph: string; label: string; shortcut: string }> = [
  { id: "select",  glyph: "↖", label: "Select",  shortcut: "V" },
  { id: "tray",    glyph: "▭", label: "Tray",    shortcut: "T" },
  { id: "conduit", glyph: "—", label: "Conduit", shortcut: "C" },
  { id: "j_hook",  glyph: "⌒", label: "J-hook",  shortcut: "J" },
  { id: "riser",   glyph: "⇅", label: "Riser",   shortcut: "R" },
];

function PathwayToolbar({
  project, tool, onTool,
  trayWidthIn, onTrayWidth, conduitSize, onConduitSize,
  statusFilter, onStatusFilter, showRooms, onShowRooms,
  showLabels, onShowLabels, units, onUnits, counts, total,
}: {
  project: Project;
  tool: Tool; onTool: (t: Tool) => void;
  trayWidthIn: number; onTrayWidth: (n: number) => void;
  conduitSize: string; onConduitSize: (s: string) => void;
  statusFilter: RunStatus | "all"; onStatusFilter: (s: RunStatus | "all") => void;
  showRooms: boolean; onShowRooms: (v: boolean) => void;
  showLabels: boolean; onShowLabels: (v: boolean) => void;
  units: "ft" | "m"; onUnits: (u: "ft" | "m") => void;
  counts: { pass: number; warn: number; fail: number }; total: number;
}) {
  return (
    <div className="flex items-stretch border-b border-chrome-dark bg-chrome-darkest h-[44px] flex-shrink-0">
      {/* Tools */}
      <div className="flex items-stretch border-r border-chrome-dark px-1.5 gap-0.5">
        {TOOL_DEFS.map(t => (
          <button
            key={t.id}
            onClick={() => onTool(t.id)}
            title={`${t.label}  (${t.shortcut})`}
            className={clsx(
              "flex flex-col items-center justify-center px-2 w-[52px] rounded-[2px] my-1 transition-colors",
              tool === t.id
                ? "bg-accent/15 text-accent border border-accent/40"
                : "text-text3 hover:bg-chrome-dark hover:text-text border border-transparent",
            )}
          >
            <span className="text-[14px] leading-none">{t.glyph}</span>
            <span className="text-[8.5px] uppercase tracking-[0.06em] font-mono mt-0.5">{t.label}</span>
          </button>
        ))}
      </div>

      {/* Tool-specific properties */}
      {tool === "tray" && (
        <div className="flex items-center border-r border-chrome-dark px-3 gap-1.5">
          <span className="text-[9.5px] text-text4 font-mono uppercase tracking-[0.06em]">Width</span>
          <select
            value={trayWidthIn}
            onChange={(e) => onTrayWidth(Number(e.target.value))}
            className="bg-chrome-dark text-text2 text-[11px] font-mono border border-chrome-lighter rounded-[2px] px-1.5 py-1"
          >
            {TRAY_WIDTH_OPTIONS.map(w => <option key={w} value={w}>{w}″</option>)}
          </select>
        </div>
      )}
      {tool === "conduit" && (
        <div className="flex items-center border-r border-chrome-dark px-3 gap-1.5">
          <span className="text-[9.5px] text-text4 font-mono uppercase tracking-[0.06em]">Size</span>
          <select
            value={conduitSize}
            onChange={(e) => onConduitSize(e.target.value)}
            className="bg-chrome-dark text-text2 text-[11px] font-mono border border-chrome-lighter rounded-[2px] px-1.5 py-1"
          >
            {CONDUIT_SIZE_OPTIONS.map(s => <option key={s} value={s}>{s}″ EMT</option>)}
          </select>
        </div>
      )}

      {/* Filter / display toggles */}
      <div className="flex items-center border-r border-chrome-dark px-3 gap-2">
        <span className="text-[9.5px] text-text4 font-mono uppercase tracking-[0.06em]">Filter</span>
        <select
          value={statusFilter}
          onChange={(e) => onStatusFilter(e.target.value as RunStatus | "all")}
          className="bg-chrome-dark text-text2 text-[11px] font-mono border border-chrome-lighter rounded-[2px] px-1.5 py-1"
        >
          <option value="all">All runs</option>
          <option value="fail">Failing only</option>
          <option value="warn">Warning only</option>
          <option value="pass">Passing only</option>
        </select>
        <span className="text-[10px] font-mono tabular-nums text-text4 ml-1">{counts.pass + counts.warn + counts.fail}/{total}</span>
      </div>

      <div className="flex items-center border-r border-chrome-dark px-3 gap-3">
        <label className="flex items-center gap-1.5 text-[10px] text-text3 font-mono uppercase tracking-[0.06em] cursor-pointer">
          <input type="checkbox" checked={showRooms} onChange={(e) => onShowRooms(e.target.checked)}
                 className="w-3 h-3 accent-accent" />
          Rooms
        </label>
        <label className="flex items-center gap-1.5 text-[10px] text-text3 font-mono uppercase tracking-[0.06em] cursor-pointer">
          <input type="checkbox" checked={showLabels} onChange={(e) => onShowLabels(e.target.checked)}
                 className="w-3 h-3 accent-accent" />
          Labels
        </label>
      </div>

      {/* Units */}
      <div className="flex items-center border-r border-chrome-dark px-3 gap-1.5">
        <span className="text-[9.5px] text-text4 font-mono uppercase tracking-[0.06em]">Units</span>
        <button onClick={() => onUnits("ft")}
                className={clsx("px-1.5 py-0.5 text-[10.5px] font-mono rounded-[2px]",
                  units === "ft" ? "bg-accent/15 text-accent border border-accent/40" : "text-text3 border border-transparent hover:text-text")}>ft</button>
        <button onClick={() => onUnits("m")}
                className={clsx("px-1.5 py-0.5 text-[10.5px] font-mono rounded-[2px]",
                  units === "m" ? "bg-accent/15 text-accent border border-accent/40" : "text-text3 border border-transparent hover:text-text")}>m</button>
      </div>

      {/* Project identity */}
      <div className="flex-1 flex items-center px-4 min-w-0">
        <div className="min-w-0">
          <div className="text-[12px] text-text font-medium truncate">Pathway design · {project.name}</div>
          <div className="text-[10px] text-text4 font-mono truncate">
            {project.number} · TIA-568.2-D channel limit {TIA568_MAX_FT} ft (90 m) · BICSI TDMM 15
          </div>
        </div>
      </div>

      {/* Back link */}
      <div className="flex items-center px-3">
        <Link href={`/projects/${project.id}`} className="btn btn-ghost text-[11px]">← Project</Link>
      </div>
    </div>
  );
}

// ── Left panel — cable run list ─────────────────────────────────────────

function formatLen(ft: number, units: "ft" | "m"): string {
  return units === "ft" ? `${ft.toFixed(1)} ft` : `${(ft * 0.3048).toFixed(1)} m`;
}

function statusGlyph(s: RunStatus): string {
  return s === "pass" ? "✓" : s === "warn" ? "!" : "✕";
}

function RunListPanel({
  runs, validationByRun, selectedId, onSelect, units,
}: {
  runs: CableRun[];
  validationByRun: Record<string, CableRunValidation>;
  selectedId: string | null;
  onSelect: (id: string) => void;
  units: "ft" | "m";
}) {
  // Sort: failing first, then warn, then pass — most important runs at top.
  const sorted = useMemo(() => [...runs].sort((a, b) => {
    const order = { fail: 0, warn: 1, pass: 2 } as const;
    const va = validationByRun[a.id]?.status ?? "pass";
    const vb = validationByRun[b.id]?.status ?? "pass";
    return order[va] - order[vb];
  }), [runs, validationByRun]);

  return (
    <aside className="w-[300px] flex-shrink-0 border-r border-chrome-dark bg-chrome-darkest flex flex-col">
      <div className="px-3 py-2 border-b border-chrome-dark flex items-center justify-between">
        <span className="text-[9.5px] text-text4 font-mono uppercase tracking-[0.06em]">Cable runs · {runs.length}</span>
      </div>
      <div className="flex-1 overflow-y-auto">
        {sorted.length === 0 ? (
          <div className="px-3 py-4 text-[11px] text-text4 font-mono">No runs match the filter.</div>
        ) : sorted.map(r => {
          const v = validationByRun[r.id];
          const status = v?.status ?? "pass";
          const selected = r.id === selectedId;
          return (
            <button
              key={r.id}
              onClick={() => onSelect(r.id)}
              className={clsx(
                "w-full text-left px-3 py-2 border-b border-chrome-dark/50 transition-colors",
                selected ? "bg-accent/10 border-l-2 border-l-accent" : "hover:bg-chrome-dark",
              )}
            >
              <div className="flex items-center gap-2 mb-1">
                <span className={clsx(
                  "w-4 h-4 rounded-full flex items-center justify-center text-[10px]",
                  STATUS_BG[status], STATUS_TONE[status],
                )}>
                  {statusGlyph(status)}
                </span>
                <span className="text-[11px] text-text2 font-mono truncate flex-1">{r.label}</span>
                <span className={clsx("text-[10px] font-mono tabular-nums", STATUS_TONE[status])}>
                  {v ? formatLen(v.lengthFt, units) : "—"}
                </span>
              </div>
              <div className="text-[9.5px] text-text4 font-mono pl-6">
                {CABLE_TYPE_LABEL[r.cableType]} · {r.outlet.label} → {r.tr.label}
              </div>
              {v?.reason && (
                <div className={clsx("text-[10px] mt-1 pl-6 leading-snug", STATUS_TONE[status])}>
                  {v.reason}
                </div>
              )}
            </button>
          );
        })}
      </div>
    </aside>
  );
}

// ── Center: SVG canvas ───────────────────────────────────────────────────

function PathwayCanvas({
  segments, rooms, endpoints, selectedRun, selectedSegmentIds, selectedSegmentId,
  showLabels, tool, gesture, onAddNode, onUpdateCursor, onFinishDrawing,
  onSelectSegment, onDeselectAll,
}: {
  segments: PathwaySegment[];
  rooms: ExtractedRoom[];
  endpoints: Array<{ x: number; y: number; label: string; kind: "outlet" | "tr" }>;
  selectedRun: CableRun | null;
  selectedSegmentIds: Set<string>;
  selectedSegmentId: string | null;
  showLabels: boolean;
  tool: Tool;
  gesture: Gesture;
  onAddNode: (p: Point) => void;
  onUpdateCursor: (p: Point, snap: SnapTarget | null) => void;
  onFinishDrawing: () => void;
  onSelectSegment: (id: string) => void;
  onDeselectAll: () => void;
}) {
  const MARGIN = 8; // grid units around the canvas
  const viewW = CANVAS_W + MARGIN * 2;
  const viewH = CANVAS_H + MARGIN * 2;
  const svgRef = useRef<SVGSVGElement>(null);

  // Build the per-segment polyline path string.
  function polylinePath(s: PathwaySegment): string {
    return s.nodes
      .map((n, i) => `${i === 0 ? "M" : "L"} ${n.x + MARGIN} ${n.y + MARGIN}`)
      .join(" ");
  }

  // Convert clientX/Y to grid coords (subtracting the margin offset).
  function svgPoint(e: { clientX: number; clientY: number }): Point {
    const svg = svgRef.current;
    if (!svg || !svg.getScreenCTM) return { x: 0, y: 0 };
    const pt = svg.createSVGPoint();
    pt.x = e.clientX;
    pt.y = e.clientY;
    const ctm = svg.getScreenCTM();
    if (!ctm) return { x: 0, y: 0 };
    const p = pt.matrixTransform(ctm.inverse());
    return { x: p.x - MARGIN, y: p.y - MARGIN };
  }

  // Find a snap target near `p` — nearest pathway node, outlet, or TR within
  // SNAP_RADIUS. Returns null if nothing's close.
  function findSnap(p: Point): SnapTarget | null {
    let best: SnapTarget | null = null;
    let bestD = SNAP_RADIUS;
    function consider(x: number, y: number, label: string) {
      const d = Math.hypot(x - p.x, y - p.y);
      if (d < bestD) { bestD = d; best = { x, y, label }; }
    }
    for (const s of segments) {
      for (let i = 0; i < s.nodes.length; i++) {
        consider(s.nodes[i].x, s.nodes[i].y, `${s.label ?? s.type} · node ${i + 1}`);
      }
    }
    for (const e of endpoints) consider(e.x, e.y, e.label);
    return best;
  }

  function onCanvasMouseMove(e: React.MouseEvent) {
    if (gesture.kind !== "drawing") return;
    const p = svgPoint(e);
    const snap = findSnap(p);
    onUpdateCursor(snap ? { x: snap.x, y: snap.y } : p, snap);
  }

  function onCanvasMouseDown(e: React.MouseEvent) {
    if (e.button !== 0) return;
    if (tool === "select") return;        // selection handled per-segment
    e.stopPropagation();
    const raw = svgPoint(e);
    const snap = findSnap(raw);
    const p = snap ? { x: snap.x, y: snap.y } : raw;
    onAddNode(p);
  }

  function onCanvasDoubleClick(e: React.MouseEvent) {
    if (gesture.kind !== "drawing") return;
    e.stopPropagation();
    onFinishDrawing();
  }

  // Compute the in-progress polyline (existing nodes + cursor) for the preview.
  const draftNodes = gesture.kind === "drawing" ? gesture.nodes : [];
  const draftCursor = gesture.kind === "drawing" ? gesture.cursor : null;
  const draftStyle =
    gesture.kind === "drawing" ? PATHWAY_STROKE[TOOL_TO_PATHWAY_TYPE[gesture.tool]] : null;

  const cursor =
    tool === "select" ? "default"
    : gesture.kind === "drawing" ? "crosshair"
    : "crosshair";

  return (
    <div className="min-h-full min-w-full flex items-center justify-center p-6"
         onClick={() => onDeselectAll()}>
      <div
        className="bg-[#fafaf7] shadow-[0_0_0_1px_rgba(255,255,255,0.05),0_8px_24px_rgba(0,0,0,0.4)] w-full max-w-[1400px]"
        style={{ aspectRatio: viewW / viewH }}
        onClick={(e) => e.stopPropagation()}
      >
        <svg ref={svgRef} viewBox={`0 0 ${viewW} ${viewH}`} className="w-full h-full block"
             preserveAspectRatio="xMidYMid meet"
             style={{ cursor }}
             onMouseDown={onCanvasMouseDown}
             onMouseMove={onCanvasMouseMove}
             onDoubleClick={onCanvasDoubleClick}>
          {/* Grid */}
          <Grid w={viewW} h={viewH} margin={MARGIN} />

          {/* Drawing border */}
          <rect x={MARGIN} y={MARGIN} width={CANVAS_W} height={CANVAS_H}
                fill="none" stroke="#2c2c28" strokeWidth={0.4} />

          {/* Rooms (if intake data present) */}
          {rooms.length > 0 && (
            <g>
              {rooms.map(r => {
                const type = r.overrideType ?? r.type;
                return (
                  <g key={r.id}>
                    <rect
                      x={r.x + MARGIN} y={r.y + MARGIN}
                      width={r.w} height={r.h}
                      fill={ROOM_FILL[type] ?? "#fafafa"} stroke="#bbb" strokeWidth={0.25}
                    />
                    {showLabels && r.w > 6 && r.h > 4 && (
                      <text x={r.x + MARGIN + r.w / 2} y={r.y + MARGIN + r.h / 2}
                            textAnchor="middle" dominantBaseline="middle"
                            fontSize={1.4} fill="#888" fontFamily="monospace">
                        {r.overrideName ?? r.name}
                      </text>
                    )}
                  </g>
                );
              })}
            </g>
          )}

          {/* Pathway segments */}
          <g>
            {segments.map(s => {
              const inRun = selectedSegmentIds.has(s.id);
              const isSelectedSegment = s.id === selectedSegmentId;
              const sel = inRun || isSelectedSegment;
              const style = PATHWAY_STROKE[s.type];
              // Only interactive in Select mode — otherwise the canvas owns mousedown.
              const interactive = tool === "select";
              return (
                <g
                  key={s.id}
                  onClick={interactive ? (e) => { e.stopPropagation(); onSelectSegment(s.id); } : undefined}
                  style={{ cursor: interactive ? "pointer" : "inherit", pointerEvents: interactive ? "auto" : "none" }}
                >
                  {/* Invisible wider hit target so clicks on thin lines are easier */}
                  {interactive && (
                    <path d={polylinePath(s)} fill="none" stroke="transparent" strokeWidth={2.4} strokeLinecap="round" />
                  )}
                  <path
                    d={polylinePath(s)}
                    fill="none"
                    stroke={isSelectedSegment ? "#1d4ed8" : style.color}
                    strokeWidth={sel ? style.width * 2 : style.width}
                    strokeDasharray={style.dash}
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    opacity={sel ? 1 : 0.85}
                  />
                  {/* Node markers */}
                  {s.nodes.map((n, i) => (
                    <circle key={i} cx={n.x + MARGIN} cy={n.y + MARGIN}
                            r={sel ? 0.6 : 0.35}
                            fill={isSelectedSegment ? "#1d4ed8" : style.color} opacity={0.9} />
                  ))}
                  {showLabels && s.label && s.nodes.length >= 2 && (
                    <text
                      x={s.nodes[Math.floor(s.nodes.length / 2)].x + MARGIN}
                      y={s.nodes[Math.floor(s.nodes.length / 2)].y + MARGIN - 1.4}
                      textAnchor="middle"
                      fontSize={1.4} fontFamily="monospace" fill={style.color}
                    >
                      {s.label}
                    </text>
                  )}
                </g>
              );
            })}
          </g>

          {/* Selected run overlay — connect outlet → first segment → ... → TR */}
          {selectedRun && (
            <RunOverlay run={selectedRun} segments={segments} margin={MARGIN} />
          )}

          {/* Draft polyline preview — committed nodes + leg to cursor */}
          {draftStyle && draftNodes.length > 0 && (
            <g pointerEvents="none">
              {/* Committed legs */}
              {draftNodes.slice(1).map((n, i) => (
                <line key={`d-${i}`}
                      x1={draftNodes[i].x + MARGIN}   y1={draftNodes[i].y + MARGIN}
                      x2={n.x + MARGIN}                y2={n.y + MARGIN}
                      stroke={draftStyle.color}
                      strokeWidth={draftStyle.width * 1.5}
                      strokeDasharray={draftStyle.dash}
                      strokeLinecap="round" />
              ))}
              {/* Leg from last committed node to cursor */}
              {draftCursor && (
                <line
                  x1={draftNodes[draftNodes.length - 1].x + MARGIN}
                  y1={draftNodes[draftNodes.length - 1].y + MARGIN}
                  x2={draftCursor.x + MARGIN}
                  y2={draftCursor.y + MARGIN}
                  stroke={draftStyle.color}
                  strokeWidth={draftStyle.width}
                  strokeDasharray="1.2 0.8"
                  opacity={0.6}
                />
              )}
              {/* Committed-node markers */}
              {draftNodes.map((n, i) => (
                <circle key={`dm-${i}`} cx={n.x + MARGIN} cy={n.y + MARGIN} r={0.5}
                        fill={draftStyle.color} />
              ))}
            </g>
          )}

          {/* Snap indicator */}
          {gesture.kind === "drawing" && gesture.snap && (
            <g pointerEvents="none">
              <circle
                cx={gesture.snap.x + MARGIN}
                cy={gesture.snap.y + MARGIN}
                r={1.2}
                fill="none" stroke="#2a8a5c" strokeWidth={0.35}
              />
              <text
                x={gesture.snap.x + MARGIN + 1.8}
                y={gesture.snap.y + MARGIN - 0.6}
                fontSize={1.2} fontFamily="monospace" fill="#2a8a5c"
              >
                snap · {gesture.snap.label}
              </text>
            </g>
          )}

          {/* Endpoints — outlets + TRs */}
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
                <>
                  <rect x={e.x + MARGIN - 0.5} y={e.y + MARGIN - 0.5} width={1} height={1}
                        fill="#2c5aa0" />
                  {showLabels && (
                    <text x={e.x + MARGIN + 1} y={e.y + MARGIN + 0.3}
                          fontSize={1.0} fontFamily="monospace" fill="#2c5aa0" opacity={0.85}>
                      {e.label}
                    </text>
                  )}
                </>
              )}
            </g>
          ))}

          {/* Legend */}
          <Legend margin={MARGIN} viewW={viewW} viewH={viewH} />
        </svg>
      </div>
    </div>
  );
}

function Grid({ w, h, margin }: { w: number; h: number; margin: number }) {
  // Grid every 10 ft, lighter every 1 ft on the canvas surface.
  const lines: React.ReactNode[] = [];
  for (let x = margin; x <= CANVAS_W + margin; x += 10) {
    lines.push(<line key={`vx-${x}`} x1={x} y1={margin} x2={x} y2={CANVAS_H + margin} stroke="#dcd9cd" strokeWidth={0.15} />);
  }
  for (let y = margin; y <= CANVAS_H + margin; y += 10) {
    lines.push(<line key={`hy-${y}`} x1={margin} y1={y} x2={CANVAS_W + margin} y2={y} stroke="#dcd9cd" strokeWidth={0.15} />);
  }
  return (
    <>
      <rect x={0} y={0} width={w} height={h} fill="#fafaf7" />
      <g opacity={0.8}>{lines}</g>
    </>
  );
}

function RunOverlay({
  run, segments, margin,
}: { run: CableRun; segments: PathwaySegment[]; margin: number }) {
  // For each segment in the run, build the polyline. Connect outlet → first
  // node of first segment, then walk each segment, then last node → TR.
  const segs = run.segmentIds
    .map(id => segments.find(s => s.id === id))
    .filter((s): s is PathwaySegment => !!s);
  if (segs.length === 0) return null;

  // Find nearest node of each segment to the previous endpoint to pick the
  // entry side. Simple nearest-point heuristic.
  function nearestNode(seg: PathwaySegment, from: { x: number; y: number }) {
    let best = 0, bestD = Infinity;
    seg.nodes.forEach((n, i) => {
      const d = Math.hypot(n.x - from.x, n.y - from.y);
      if (d < bestD) { bestD = d; best = i; }
    });
    return best;
  }

  // Build leg list — outlet → seg0 → seg1 → ... → tr
  const legs: Array<{ from: { x: number; y: number }; to: { x: number; y: number } }> = [];
  let prev = { x: run.outlet.x, y: run.outlet.y };
  for (const seg of segs) {
    const entryIdx = nearestNode(seg, prev);
    // Connect prev → entry node
    legs.push({ from: prev, to: seg.nodes[entryIdx] });
    // Walk the polyline from entry to the opposite end
    const exitIdx = entryIdx === 0 ? seg.nodes.length - 1 : 0;
    const step = entryIdx === 0 ? 1 : -1;
    for (let i = entryIdx; i !== exitIdx; i += step) {
      legs.push({ from: seg.nodes[i], to: seg.nodes[i + step] });
    }
    prev = seg.nodes[exitIdx];
  }
  legs.push({ from: prev, to: { x: run.tr.x, y: run.tr.y } });

  return (
    <g pointerEvents="none">
      {legs.map((l, i) => (
        <line
          key={i}
          x1={l.from.x + margin} y1={l.from.y + margin}
          x2={l.to.x + margin}   y2={l.to.y + margin}
          stroke="#1d4ed8" strokeWidth={0.7}
          strokeLinecap="round" strokeDasharray="0.8 0.5"
        />
      ))}
      <circle cx={run.outlet.x + margin} cy={run.outlet.y + margin} r={1.3}
              fill="none" stroke="#1d4ed8" strokeWidth={0.4} />
      <circle cx={run.tr.x + margin} cy={run.tr.y + margin} r={2.4}
              fill="none" stroke="#1d4ed8" strokeWidth={0.4} />
    </g>
  );
}

function Legend({ margin, viewW, viewH }: { margin: number; viewW: number; viewH: number }) {
  const items: Array<{ type: PathwayType; label: string }> = [
    { type: "cable_tray", label: PATHWAY_TYPE_LABEL.cable_tray },
    { type: "conduit",    label: PATHWAY_TYPE_LABEL.conduit    },
    { type: "j_hook",     label: PATHWAY_TYPE_LABEL.j_hook     },
    { type: "riser",      label: PATHWAY_TYPE_LABEL.riser      },
  ];
  const x = viewW - margin - 26, y = margin + 1;
  return (
    <g>
      <rect x={x} y={y} width={24} height={11} fill="#fafaf7" stroke="#bbb" strokeWidth={0.2} />
      <text x={x + 1.2} y={y + 2.3} fontSize={1.4} fontFamily="monospace" fill="#666">LEGEND</text>
      {items.map((it, i) => {
        const style = PATHWAY_STROKE[it.type];
        return (
          <g key={it.type} transform={`translate(${x + 1.2} ${y + 3.5 + i * 1.8})`}>
            <line x1={0} y1={0.4} x2={4} y2={0.4} stroke={style.color}
                  strokeWidth={style.width} strokeDasharray={style.dash} strokeLinecap="round" />
            <text x={5} y={0.9} fontSize={1.3} fontFamily="monospace" fill="#333">{it.label}</text>
          </g>
        );
      })}
    </g>
  );
}

// ── Right panel — material BOM + validation summary ─────────────────────

function BomPanel({
  materials, counts, total, units, selectedSegment, onDeleteSelected,
}: {
  materials: PathwayMaterials;
  counts: { pass: number; warn: number; fail: number };
  total: number;
  units: "ft" | "m";
  selectedSegment: PathwaySegment | null;
  onDeleteSelected: () => void;
}) {
  return (
    <aside className="w-[300px] flex-shrink-0 border-l border-chrome-dark bg-chrome-darkest flex flex-col">
      {/* Selected segment detail */}
      {selectedSegment && (
        <div className="border-b border-chrome-dark bg-chrome-dark/50">
          <div className="px-3 py-2 border-b border-chrome-dark flex items-center justify-between">
            <span className="text-[9.5px] text-accent font-mono uppercase tracking-[0.06em]">Selected segment</span>
            <button onClick={onDeleteSelected}
                    className="text-[10px] font-mono uppercase tracking-[0.06em] text-text4 hover:text-fail">
              ✕ Delete
            </button>
          </div>
          <div className="px-3 py-2 space-y-1">
            <div className="text-[12px] text-text font-medium">{selectedSegment.label ?? PATHWAY_TYPE_LABEL[selectedSegment.type]}</div>
            <div className="text-[10.5px] text-text3 font-mono">{PATHWAY_TYPE_LABEL[selectedSegment.type]}</div>
            <div className="text-[10px] text-text4 font-mono">
              {selectedSegment.nodes.length} nodes · {selectedSegment.heightFt} ft AFF
              {selectedSegment.trayWidthIn ? ` · ${selectedSegment.trayWidthIn}″ wide` : ""}
              {selectedSegment.conduitSize ? ` · ${selectedSegment.conduitSize}″ EMT` : ""}
            </div>
          </div>
        </div>
      )}

      {/* Validation summary */}
      <div className="border-b border-chrome-dark">
        <div className="px-3 py-2 border-b border-chrome-dark">
          <span className="text-[9.5px] text-text4 font-mono uppercase tracking-[0.06em]">TIA-568 channel · 90 m</span>
        </div>
        <div className="px-3 py-3 flex items-center gap-3">
          <ValidationDot label="Pass" value={counts.pass} tone="pass" />
          <ValidationDot label="Warn" value={counts.warn} tone="warn" />
          <ValidationDot label="Fail" value={counts.fail} tone="fail" />
          <div className="ml-auto text-[10px] text-text4 font-mono">/ {total}</div>
        </div>
        <div className="px-3 pb-3 text-[10px] text-text4 font-mono leading-snug">
          Warn threshold {formatLen(TIA568_WARN_FT, units)} · Fail {formatLen(TIA568_MAX_FT, units)}.
          Service-loop slack 10 ft included per BICSI TDMM 15.
        </div>
      </div>

      {/* Carrier BOM */}
      <div className="border-b border-chrome-dark">
        <div className="px-3 py-2 border-b border-chrome-dark">
          <span className="text-[9.5px] text-text4 font-mono uppercase tracking-[0.06em]">Carrier BOM</span>
        </div>
        <BomTable items={[
          ...Object.entries(materials.trayLfByWidth)
            .sort(([a],[b]) => Number(b)-Number(a))
            .map(([width, lf]) => ({
              label: `Cable tray · ${width}" ladder`, value: formatLen(lf, units),
            })),
          ...Object.entries(materials.conduitLfBySize)
            .map(([size, lf]) => ({
              label: `Conduit · ${size}" EMT`, value: formatLen(lf, units),
            })),
          ...(materials.jHookCount > 0 ? [{
            label: "J-hooks (5 ft spacing)", value: `${materials.jHookCount} ea`,
          }] : []),
          ...(materials.riserLf > 0 ? [{
            label: "Riser sleeves", value: formatLen(materials.riserLf, units),
          }] : []),
        ]} />
      </div>

      {/* Cable BOM */}
      <div className="flex-1 min-h-0 overflow-y-auto">
        <div className="px-3 py-2 border-b border-chrome-dark">
          <span className="text-[9.5px] text-text4 font-mono uppercase tracking-[0.06em]">Cable BOM</span>
        </div>
        <BomTable items={Object.entries(materials.cableLfByType).map(([type, lf]) => ({
          label: CABLE_TYPE_LABEL[type as keyof typeof CABLE_TYPE_LABEL] ?? type,
          value: formatLen(lf, units),
        }))} />
        <div className="px-3 py-2 text-[10px] text-text4 font-mono leading-snug">
          Cable LF includes drops + 10 ft slack per run. Distributor pricing not yet
          wired — see roadmap item: <span className="text-text3">Live vendor pricing</span>.
        </div>
      </div>
    </aside>
  );
}

function ValidationDot({ label, value, tone }: { label: string; value: number; tone: RunStatus }) {
  return (
    <div className="text-center">
      <div className={clsx("text-[18px] font-semibold leading-tight tabular-nums", STATUS_TONE[tone])}>{value}</div>
      <div className="text-[9px] text-text4 font-mono uppercase tracking-[0.06em] mt-0.5">{label}</div>
    </div>
  );
}

function BomTable({ items }: { items: Array<{ label: string; value: string }> }) {
  if (items.length === 0) {
    return <div className="px-3 py-2 text-[10.5px] text-text4 font-mono">—</div>;
  }
  return (
    <div>
      {items.map((it, i) => (
        <div key={i} className="px-3 py-1.5 flex items-baseline justify-between text-[11px] border-b border-chrome-dark/40 last:border-b-0">
          <span className="text-text3">{it.label}</span>
          <span className="text-text2 font-mono tabular-nums">{it.value}</span>
        </div>
      ))}
    </div>
  );
}
