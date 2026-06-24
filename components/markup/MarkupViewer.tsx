"use client";

// Bluebeam-style sheet markup viewer.
//
// Four-region CAD layout:
//   ┌───────────────────────────────────────────────────────────────┐
//   │  Toolbar (tools · zoom · status filter)                       │
//   ├──────────┬─────────────────────────────────────┬──────────────┤
//   │  Sheets  │           Drawing canvas            │  Markup list │
//   │          │  (SVG sheet + markup overlay)       │  + selected  │
//   │          │                                     │  markup +    │
//   │          │                                     │  comments    │
//   └──────────┴─────────────────────────────────────┴──────────────┘
//
// This is the horizontal-sketch slice: all data lives in local React state
// (seeded from server props). Drawing tools render their button states but
// don't yet create new markup geometry on click — that comes when we wire
// the canvas drawing handlers in the next iteration. Existing markup is
// fully interactive: click to select, change status, reply in thread.

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import clsx from "clsx";
import type { Project } from "@/lib/projects/types";
import type {
  Sheet, Markup, MarkupComment, MarkupAuthor, MarkupStatus, MarkupType,
  MarkupGeometry, StampKind,
} from "@/lib/markup/types";
import {
  MARKUP_TYPE_LABEL, MARKUP_STATUS_LABEL, MARKUP_STATUS_TONE,
  STAMP_LABEL,
} from "@/lib/markup/types";
import { markupClient } from "@/lib/markup/client";

// ── Tool palette ─────────────────────────────────────────────────────────

type ToolId = "pointer" | "cloud" | "callout" | "text" | "dimension" | "stamp" | "highlight";

interface ToolDef {
  id: ToolId;
  label: string;
  glyph: string;     // single-char or short symbol
  shortcut?: string;
}

const TOOLS: ToolDef[] = [
  { id: "pointer",   label: "Select",        glyph: "↖",  shortcut: "V" },
  { id: "cloud",     label: "Revision cloud", glyph: "☁",  shortcut: "C" },
  { id: "callout",   label: "Callout",        glyph: "↗",  shortcut: "A" },
  { id: "text",      label: "Text",           glyph: "T",  shortcut: "T" },
  { id: "dimension", label: "Dimension",      glyph: "↔",  shortcut: "D" },
  { id: "stamp",     label: "Stamp",          glyph: "▣",  shortcut: "S" },
  { id: "highlight", label: "Highlight",      glyph: "▮",  shortcut: "H" },
];

// ── Main component ──────────────────────────────────────────────────────

export function MarkupViewer({
  project, sheet, allSheets, allCounts, initialMarkups, currentAuthor,
}: {
  project: Project;
  sheet: Sheet;
  allSheets: Sheet[];
  allCounts: Record<string, { open: number; in_review: number; resolved: number; wont_fix: number; total: number }>;
  initialMarkups: Markup[];
  currentAuthor: MarkupAuthor;
}) {
  const [markups, setMarkups] = useState<Markup[]>(initialMarkups);
  const [tool, setTool] = useState<ToolId>("pointer");
  const [stampKind, setStampKind] = useState<StampKind>("reviewed");
  const [selectedId, setSelectedId] = useState<string | null>(initialMarkups[0]?.id ?? null);
  /** Used to autofocus the title input when a brand-new markup is selected. */
  const [justCreatedId, setJustCreatedId] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<MarkupStatus | "all">("all");
  const [zoom, setZoom] = useState(1);            // 1 = fit-to-page; 2 = 200% etc.
  const [error, setError] = useState<string | null>(null);

  const visibleMarkups = useMemo(
    () => markups.filter(m => statusFilter === "all" || m.status === statusFilter),
    [markups, statusFilter],
  );

  const selected = markups.find(m => m.id === selectedId) ?? null;

  // ── Mutations — optimistic local state + API persistence ──────────────

  async function createMarkup(type: MarkupType, geometry: MarkupGeometry) {
    setError(null);
    const res = await markupClient.create(project.id, { sheetId: sheet.id, type, geometry });
    if (res.ok && res.markup) {
      setMarkups(prev => [...prev, res.markup!]);
      setSelectedId(res.markup.id);
      setJustCreatedId(res.markup.id);
      // Auto-switch back to pointer so the user can immediately edit the title
      setTool("pointer");
    } else {
      setError(res.error?.message ?? "Could not create markup.");
    }
  }

  function setStatus(markupId: string, status: MarkupStatus) {
    // Optimistic
    setMarkups(prev => prev.map(m =>
      m.id === markupId ? { ...m, status, updatedAt: new Date().toISOString() } : m,
    ));
    markupClient.update(project.id, markupId, { status }).catch(() => {/* swallow — TODO surface */});
  }

  function updateFields(markupId: string, patch: { title?: string; body?: string }) {
    setMarkups(prev => prev.map(m =>
      m.id === markupId ? { ...m, ...patch, updatedAt: new Date().toISOString() } : m,
    ));
    markupClient.update(project.id, markupId, patch).catch(() => {/* swallow — TODO surface */});
  }

  function updateGeometry(markupId: string, geometry: MarkupGeometry) {
    setMarkups(prev => prev.map(m =>
      m.id === markupId ? { ...m, geometry, updatedAt: new Date().toISOString() } : m,
    ));
    markupClient.update(project.id, markupId, { geometry }).catch(() => {/* swallow — TODO surface */});
  }

  async function deleteMarkup(markupId: string) {
    setError(null);
    // Optimistic
    setMarkups(prev => prev.filter(m => m.id !== markupId));
    if (selectedId === markupId) setSelectedId(null);
    const res = await markupClient.remove(project.id, markupId);
    if (!res.ok) setError(res.error?.message ?? "Could not delete markup.");
  }

  async function addComment(markupId: string, body: string) {
    // We rely on the server to assign comment id + timestamp, so this is non-optimistic.
    const res = await markupClient.addComment(project.id, markupId, body);
    if (res.ok && res.markup) {
      setMarkups(prev => prev.map(m => (m.id === markupId ? res.markup! : m)));
    } else {
      setError(res.error?.message ?? "Could not post reply.");
    }
  }

  // Per-tool usage hint shown in the bottom-left of the canvas.
  const toolHint: Record<ToolId, string> = {
    pointer:   "click to select · drag to move",
    cloud:     "click-drag to draw",
    highlight: "click-drag to draw",
    text:      "click to place",
    stamp:     "click to place",
    callout:   "click anchor, then click label position",
    dimension: "click first point, then second point",
  };

  // ── Tool-switching keyboard shortcuts ─────────────────────────────────
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      // Ignore when the user is typing in any form control.
      const t = e.target as HTMLElement | null;
      if (t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.tagName === "SELECT" || t.isContentEditable)) {
        return;
      }
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      const map: Record<string, ToolId> = {
        v: "pointer", c: "cloud", a: "callout", t: "text",
        d: "dimension", s: "stamp", h: "highlight",
      };
      const key = e.key.toLowerCase();
      if (map[key]) {
        e.preventDefault();
        setTool(map[key]);
      } else if (e.key === "Escape") {
        setTool("pointer");
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  return (
    <div className="h-full flex flex-col bg-chrome-darkest">
      {/* ── Toolbar ─────────────────────────────────────────────────────── */}
      <Toolbar
        project={project} sheet={sheet}
        tool={tool} onTool={setTool}
        stampKind={stampKind} onStampKind={setStampKind}
        zoom={zoom} onZoom={setZoom}
        statusFilter={statusFilter} onStatusFilter={setStatusFilter}
        visibleCount={visibleMarkups.length} totalCount={markups.length}
      />

      <div className="flex-1 flex min-h-0">

        {/* ── Sheet browser (left) ──────────────────────────────────────── */}
        <SheetBrowser
          projectId={project.id}
          sheets={allSheets}
          currentSheetId={sheet.id}
          counts={allCounts}
        />

        {/* ── Drawing canvas (center) ──────────────────────────────────── */}
        <div className="flex-1 min-w-0 relative bg-chrome-dark overflow-auto">
          <SheetCanvas
            sheet={sheet}
            markups={visibleMarkups}
            selectedId={selectedId}
            tool={tool}
            zoom={zoom}
            stampKind={stampKind}
            onSelect={(id) => setSelectedId(id)}
            onCreate={createMarkup}
            onMoveCommit={updateGeometry}
          />
          {/* Cursor hint in the bottom-left */}
          <div className="absolute bottom-2 left-3 text-[10px] text-text4 font-mono uppercase tracking-[0.06em] pointer-events-none">
            Tool: {TOOLS.find(t => t.id === tool)?.label}
            <span className="ml-2 text-text3">· {toolHint[tool]}</span>
            {tool !== "pointer" && <span className="ml-2 text-text4">· Esc to cancel</span>}
          </div>
          {/* Error toast */}
          {error && (
            <div className="absolute top-3 left-1/2 -translate-x-1/2 px-3 py-1.5 bg-fail/15 border border-fail/40 text-[11px] text-fail font-mono rounded-[2px]">
              {error}
              <button onClick={() => setError(null)} className="ml-3 text-text4 hover:text-text">✕</button>
            </div>
          )}
        </div>

        {/* ── Right panel: markup list + selected detail + comments ────── */}
        <aside className="w-[340px] flex-shrink-0 border-l border-chrome-dark flex flex-col bg-chrome-darkest min-h-0">
          <MarkupListPanel
            markups={visibleMarkups}
            selectedId={selectedId}
            onSelect={(id) => setSelectedId(id)}
          />
          <MarkupDetailPanel
            markup={selected}
            currentAuthor={currentAuthor}
            autoFocusTitle={selected?.id === justCreatedId}
            onAutoFocusConsumed={() => setJustCreatedId(null)}
            onStatusChange={(s) => selected && setStatus(selected.id, s)}
            onAddComment={(body) => selected && addComment(selected.id, body)}
            onUpdateFields={(patch) => selected && updateFields(selected.id, patch)}
            onDelete={() => selected && deleteMarkup(selected.id)}
          />
        </aside>
      </div>
    </div>
  );
}

// ── Toolbar ──────────────────────────────────────────────────────────────

function Toolbar({
  project, sheet, tool, onTool, stampKind, onStampKind,
  zoom, onZoom, statusFilter, onStatusFilter,
  visibleCount, totalCount,
}: {
  project: Project; sheet: Sheet;
  tool: ToolId; onTool: (t: ToolId) => void;
  stampKind: StampKind; onStampKind: (k: StampKind) => void;
  zoom: number; onZoom: (z: number) => void;
  statusFilter: MarkupStatus | "all"; onStatusFilter: (s: MarkupStatus | "all") => void;
  visibleCount: number; totalCount: number;
}) {
  return (
    <div className="flex items-stretch border-b border-chrome-dark bg-chrome-darkest h-[44px] flex-shrink-0">
      {/* Tool group */}
      <div className="flex items-stretch border-r border-chrome-dark px-1.5 gap-0.5">
        {TOOLS.map(t => (
          <button
            key={t.id}
            onClick={() => onTool(t.id)}
            title={`${t.label}${t.shortcut ? `  (${t.shortcut})` : ""}`}
            className={clsx(
              "flex flex-col items-center justify-center px-2 w-[52px] rounded-[2px] my-1 transition-colors",
              tool === t.id
                ? "bg-accent/15 text-accent border border-accent/40"
                : "text-text3 hover:bg-chrome-dark hover:text-text border border-transparent",
            )}
          >
            <span className="text-[16px] leading-none">{t.glyph}</span>
            <span className="text-[8.5px] uppercase tracking-[0.06em] font-mono mt-0.5">{t.label}</span>
          </button>
        ))}
      </div>

      {/* Stamp picker — only shown while the Stamp tool is active */}
      {tool === "stamp" && (
        <div className="flex items-center border-r border-chrome-dark px-3 gap-1.5">
          <span className="text-[9.5px] text-text4 font-mono uppercase tracking-[0.06em]">Stamp</span>
          <select
            value={stampKind}
            onChange={(e) => onStampKind(e.target.value as StampKind)}
            className="bg-chrome-dark text-text2 text-[11px] font-mono border border-chrome-lighter rounded-[2px] px-1.5 py-1"
          >
            <option value="reviewed">{STAMP_LABEL.reviewed}</option>
            <option value="approved">{STAMP_LABEL.approved}</option>
            <option value="revise">{STAMP_LABEL.revise}</option>
            <option value="as_built">{STAMP_LABEL.as_built}</option>
            <option value="void">{STAMP_LABEL.void}</option>
          </select>
        </div>
      )}

      {/* Zoom group */}
      <div className="flex items-center border-r border-chrome-dark px-3 gap-2">
        <button onClick={() => onZoom(Math.max(0.5, zoom - 0.25))}
                className="w-7 h-7 flex items-center justify-center text-text3 hover:text-text hover:bg-chrome-dark rounded-[2px] text-[14px]">−</button>
        <span className="text-[11px] text-text2 font-mono tabular-nums w-12 text-center">{Math.round(zoom * 100)}%</span>
        <button onClick={() => onZoom(Math.min(4, zoom + 0.25))}
                className="w-7 h-7 flex items-center justify-center text-text3 hover:text-text hover:bg-chrome-dark rounded-[2px] text-[14px]">+</button>
        <button onClick={() => onZoom(1)}
                className="ml-1 px-2 h-7 text-[10px] text-text3 hover:text-text font-mono uppercase tracking-[0.06em]">Fit</button>
      </div>

      {/* Status filter */}
      <div className="flex items-center border-r border-chrome-dark px-3 gap-1.5">
        <span className="text-[9.5px] text-text4 font-mono uppercase tracking-[0.06em]">Status</span>
        <select
          value={statusFilter}
          onChange={(e) => onStatusFilter(e.target.value as MarkupStatus | "all")}
          className="bg-chrome-dark text-text2 text-[11px] font-mono border border-chrome-lighter rounded-[2px] px-1.5 py-1"
        >
          <option value="all">All</option>
          <option value="open">Open</option>
          <option value="in_review">In review</option>
          <option value="resolved">Resolved</option>
          <option value="wont_fix">Won't fix</option>
        </select>
        <span className="text-[10.5px] text-text4 font-mono tabular-nums ml-1">{visibleCount}/{totalCount}</span>
      </div>

      {/* Sheet identity */}
      <div className="flex-1 flex items-center px-4 min-w-0">
        <div className="min-w-0">
          <div className="text-[12px] text-text font-medium truncate">
            {sheet.number} · {sheet.title}
            {sheet.revision && <span className="ml-2 text-[10px] text-text4 font-mono">Rev {sheet.revision}</span>}
          </div>
          <div className="text-[10px] text-text4 font-mono truncate">
            {project.name} · {project.number} · Scale {sheet.scale}
          </div>
        </div>
      </div>

      {/* Back link */}
      <div className="flex items-center px-3">
        <Link href={`/projects/${project.id}/review`}
              className="btn btn-ghost text-[11px]">← Review queue</Link>
      </div>
    </div>
  );
}

// ── Sheet browser ────────────────────────────────────────────────────────

function SheetBrowser({
  projectId, sheets, currentSheetId, counts,
}: {
  projectId: string;
  sheets: Sheet[];
  currentSheetId: string;
  counts: Record<string, { open: number; in_review: number; resolved: number; wont_fix: number; total: number }>;
}) {
  return (
    <aside className="w-[220px] flex-shrink-0 border-r border-chrome-dark bg-chrome-darkest flex flex-col">
      <div className="px-3 py-2 border-b border-chrome-dark flex items-center justify-between">
        <span className="text-[9.5px] text-text4 font-mono uppercase tracking-[0.06em]">Sheets · {sheets.length}</span>
      </div>
      <div className="flex-1 overflow-y-auto">
        {sheets.map(s => {
          const c = counts[s.id] ?? { open: 0, in_review: 0, resolved: 0, wont_fix: 0, total: 0 };
          const isCurrent = s.id === currentSheetId;
          return (
            <Link
              key={s.id}
              href={`/projects/${projectId}/review/sheets/${s.id}`}
              className={clsx(
                "block px-3 py-2 border-b border-chrome-dark/50 transition-colors",
                isCurrent ? "bg-accent/10 border-l-2 border-l-accent" : "hover:bg-chrome-dark",
              )}
            >
              <div className="flex items-center gap-2">
                <span className={clsx("text-[11.5px] font-mono", isCurrent ? "text-accent" : "text-text2")}>{s.number}</span>
                {s.revision && (
                  <span className="text-[9px] text-text4 font-mono border border-chrome-lighter px-1 rounded-[2px]">REV {s.revision}</span>
                )}
                {c.open + c.in_review > 0 && (
                  <span className="ml-auto text-[10px] text-warn font-mono tabular-nums">{c.open + c.in_review}</span>
                )}
              </div>
              <div className={clsx("text-[10.5px] mt-0.5 truncate", isCurrent ? "text-text" : "text-text3")}>
                {s.title}
              </div>
              {c.total > 0 && (
                <div className="text-[9.5px] text-text4 font-mono mt-0.5">
                  {c.open}o · {c.in_review}r · {c.resolved}✓
                </div>
              )}
            </Link>
          );
        })}
      </div>
    </aside>
  );
}

// ── Sheet canvas ────────────────────────────────────────────────────────

// Canvas gesture state machine.
//   idle         — no interaction
//   dragRect     — cloud/highlight: mousedown..mouseup drag
//   twoClick     — callout/dimension: click 1 sets anchor, click 2 commits
//   pendingMove  — pointer mousedown on a markup, awaiting either click or drag
//   moving       — pendingMove escalated past threshold; markup follows cursor
type Point = { x: number; y: number };
type Gesture =
  | { kind: "idle" }
  | { kind: "dragRect"; tool: "cloud" | "highlight"; start: Point; current: Point }
  | { kind: "twoClick"; tool: "callout" | "dimension"; first: Point; current: Point }
  | { kind: "pendingMove"; markupId: string; start: Point; current: Point }
  | { kind: "moving";      markupId: string; start: Point; current: Point };

const MIN_RECT       = 50;   // sheet units (≈0.5") — reject micro-drags
const MIN_DIMENSION  = 50;
const MOVE_THRESHOLD = 30;   // sheet units before pendingMove → moving
const DEFAULT_CALLOUT_W = 720;
const DEFAULT_CALLOUT_H = 240;

/** Apply a (dx, dy) translation to any geometry kind. */
function translateGeometry(g: MarkupGeometry, dx: number, dy: number): MarkupGeometry {
  switch (g.kind) {
    case "cloud":     return { ...g, x: g.x + dx, y: g.y + dy };
    case "highlight": return { ...g, x: g.x + dx, y: g.y + dy };
    case "text":      return { ...g, x: g.x + dx, y: g.y + dy };
    case "stamp":     return { ...g, x: g.x + dx, y: g.y + dy };
    case "callout":
      return {
        kind: "callout",
        anchor: { x: g.anchor.x + dx, y: g.anchor.y + dy },
        label:  { x: g.label.x + dx,  y: g.label.y + dy, w: g.label.w, h: g.label.h },
      };
    case "dimension":
      return {
        kind: "dimension",
        from: { x: g.from.x + dx, y: g.from.y + dy },
        to:   { x: g.to.x + dx,   y: g.to.y + dy },
      };
  }
}

function SheetCanvas({
  sheet, markups, selectedId, tool, zoom, stampKind, onSelect, onCreate, onMoveCommit,
}: {
  sheet: Sheet;
  markups: Markup[];
  selectedId: string | null;
  tool: ToolId;
  zoom: number;
  stampKind: StampKind;
  onSelect: (id: string | null) => void;
  onCreate: (type: MarkupType, geometry: MarkupGeometry) => void;
  onMoveCommit: (markupId: string, geometry: MarkupGeometry) => void;
}) {
  // viewBox covers the full sheet at all zoom levels; we scale the wrapper
  // div to implement zoom (so the SVG stays vector-crisp at any level).
  const aspect = sheet.width / sheet.height;

  const svgRef = useRef<SVGSVGElement>(null);
  const [gesture, setGesture] = useState<Gesture>({ kind: "idle" });

  // Reset gesture whenever the user switches tools.
  useEffect(() => { setGesture({ kind: "idle" }); }, [tool]);

  // Escape cancels any in-progress gesture.
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setGesture({ kind: "idle" });
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  /** Convert clientX/clientY to sheet (viewBox) coordinates. */
  function svgPoint(e: { clientX: number; clientY: number }): Point {
    const svg = svgRef.current;
    if (!svg || !svg.getScreenCTM) return { x: 0, y: 0 };
    const pt = svg.createSVGPoint();
    pt.x = e.clientX;
    pt.y = e.clientY;
    const ctm = svg.getScreenCTM();
    if (!ctm) return { x: 0, y: 0 };
    const p = pt.matrixTransform(ctm.inverse());
    return { x: p.x, y: p.y };
  }

  // Window-level mousemove/up for move drags so dragging outside the SVG works.
  useEffect(() => {
    if (gesture.kind !== "pendingMove" && gesture.kind !== "moving") return;
    function onMove(e: MouseEvent) {
      const p = svgPoint(e);
      setGesture(prev => {
        if (prev.kind === "pendingMove") {
          const d = Math.hypot(p.x - prev.start.x, p.y - prev.start.y);
          if (d > MOVE_THRESHOLD) {
            return { kind: "moving", markupId: prev.markupId, start: prev.start, current: p };
          }
          return { ...prev, current: p };
        }
        if (prev.kind === "moving") return { ...prev, current: p };
        return prev;
      });
    }
    function onUp() {
      setGesture(prev => {
        if (prev.kind === "moving") {
          const dx = prev.current.x - prev.start.x;
          const dy = prev.current.y - prev.start.y;
          const m = markups.find(x => x.id === prev.markupId);
          if (m && (Math.abs(dx) > 0.1 || Math.abs(dy) > 0.1)) {
            onMoveCommit(prev.markupId, translateGeometry(m.geometry, dx, dy));
          }
        }
        return { kind: "idle" };
      });
    }
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
    return () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gesture.kind, markups]);

  // ── Canvas-level mouse handlers (rect drag + two-click) ───────────────
  function onCanvasMouseDown(e: React.MouseEvent) {
    if (tool === "pointer") return;                         // selection handled per-shape
    if (e.button !== 0) return;                             // left-click only
    const p = svgPoint(e);

    if (tool === "text") {
      const w = 800, h = 120;
      onCreate("text", { kind: "text", x: p.x - w / 2, y: p.y - h / 2, w, h });
      return;
    }
    if (tool === "stamp") {
      const w = 700, h = 350;
      onCreate("stamp", { kind: "stamp", x: p.x - w / 2, y: p.y - h / 2, w, h, stamp: stampKind });
      return;
    }
    if (tool === "cloud" || tool === "highlight") {
      setGesture({ kind: "dragRect", tool, start: p, current: p });
      return;
    }
    if (tool === "callout" || tool === "dimension") {
      if (gesture.kind === "twoClick" && gesture.tool === tool) {
        // Second click — commit
        const first = gesture.first;
        if (tool === "callout") {
          onCreate("callout", {
            kind: "callout",
            anchor: first,
            label:  { x: p.x - DEFAULT_CALLOUT_W / 2, y: p.y - DEFAULT_CALLOUT_H / 2, w: DEFAULT_CALLOUT_W, h: DEFAULT_CALLOUT_H },
          });
        } else {
          const d = Math.hypot(p.x - first.x, p.y - first.y);
          if (d >= MIN_DIMENSION) {
            onCreate("dimension", { kind: "dimension", from: first, to: p });
          }
        }
        setGesture({ kind: "idle" });
      } else {
        // First click
        setGesture({ kind: "twoClick", tool, first: p, current: p });
      }
      return;
    }
  }

  function onCanvasMouseMove(e: React.MouseEvent) {
    if (gesture.kind === "dragRect" || gesture.kind === "twoClick") {
      const p = svgPoint(e);
      setGesture(prev => prev.kind === "idle" || prev.kind === "pendingMove" || prev.kind === "moving"
        ? prev
        : { ...prev, current: p });
    }
  }

  function onCanvasMouseUp(e: React.MouseEvent) {
    if (gesture.kind !== "dragRect") return;
    e.stopPropagation();
    const { start, current, tool: gTool } = gesture;
    const x = Math.min(start.x, current.x);
    const y = Math.min(start.y, current.y);
    const w = Math.abs(current.x - start.x);
    const h = Math.abs(current.y - start.y);
    if (w >= MIN_RECT && h >= MIN_RECT) {
      onCreate(gTool, { kind: gTool, x, y, w, h });
    }
    setGesture({ kind: "idle" });
  }

  function onCanvasMouseLeave() {
    // Cancel pending click-drag gestures when the cursor exits the SVG. Move
    // gestures are tracked at the window level so they survive an exit.
    setGesture(prev => (prev.kind === "dragRect" || prev.kind === "twoClick" ? { kind: "idle" } : prev));
  }

  // ── Markup-level mousedown — selects + maybe initiates move ───────────
  function onMarkupMouseDown(e: React.MouseEvent, markupId: string) {
    if (tool !== "pointer") return;
    if (e.button !== 0) return;
    e.stopPropagation();
    const p = svgPoint(e);
    onSelect(markupId);
    setGesture({ kind: "pendingMove", markupId, start: p, current: p });
  }

  // ── Derived preview geometry (for visual feedback during a gesture) ───
  const dragRectPreview = gesture.kind === "dragRect" ? {
    x: Math.min(gesture.start.x, gesture.current.x),
    y: Math.min(gesture.start.y, gesture.current.y),
    w: Math.abs(gesture.current.x - gesture.start.x),
    h: Math.abs(gesture.current.y - gesture.start.y),
    tool: gesture.tool,
  } : null;

  const twoClickPreview = gesture.kind === "twoClick" ? {
    first: gesture.first,
    current: gesture.current,
    tool: gesture.tool,
  } : null;

  /** When dragging a markup, render the moved version instead of the original. */
  function withMoveOverlay(m: Markup): Markup {
    if (gesture.kind === "moving" && gesture.markupId === m.id) {
      const dx = gesture.current.x - gesture.start.x;
      const dy = gesture.current.y - gesture.start.y;
      return { ...m, geometry: translateGeometry(m.geometry, dx, dy) };
    }
    return m;
  }

  const cursor =
    tool === "pointer" && (gesture.kind === "moving" || gesture.kind === "pendingMove") ? "grabbing"
    : tool === "pointer" ? "default"
    : tool === "text"    ? "text"
    : "crosshair";

  return (
    <div className="min-h-full min-w-full flex items-center justify-center p-6"
         onClick={() => onSelect(null)}>
      <div
        className="bg-[#fafaf7] shadow-[0_0_0_1px_rgba(255,255,255,0.05),0_8px_24px_rgba(0,0,0,0.4)]"
        style={{
          width:  `min(${zoom * 100}%, ${zoom * 95}vh * ${aspect})`,
          aspectRatio: aspect,
          transition: "width 0.15s ease-out",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <svg
          ref={svgRef}
          viewBox={`0 0 ${sheet.width} ${sheet.height}`}
          className="w-full h-full block"
          preserveAspectRatio="xMidYMid meet"
          style={{ cursor }}
          onMouseDown={onCanvasMouseDown}
          onMouseMove={onCanvasMouseMove}
          onMouseUp={onCanvasMouseUp}
          onMouseLeave={onCanvasMouseLeave}
        >
          {/* Sheet background — paper white with grid */}
          <SheetBackground sheet={sheet} />
          {/* Drawing content (stub geometry, varies by discipline) */}
          <SheetContent sheet={sheet} />
          {/* Title block in bottom-right */}
          <TitleBlock sheet={sheet} />
          {/* Existing markups (with optional move-overlay translation) */}
          {markups.map(m => {
            const display = withMoveOverlay(m);
            return (
              <MarkupShape
                key={m.id}
                markup={display}
                selected={m.id === selectedId}
                tool={tool}
                onSelect={(e) => { e.stopPropagation(); onSelect(m.id); }}
                onMouseDown={(e) => onMarkupMouseDown(e, m.id)}
              />
            );
          })}
          {/* Draft preview during click-drag */}
          {dragRectPreview && dragRectPreview.tool === "cloud" && (
            <rect x={dragRectPreview.x} y={dragRectPreview.y} width={dragRectPreview.w} height={dragRectPreview.h}
                  fill="none" stroke="#c84545" strokeWidth={8} strokeDasharray="24 14" />
          )}
          {dragRectPreview && dragRectPreview.tool === "highlight" && (
            <rect x={dragRectPreview.x} y={dragRectPreview.y} width={dragRectPreview.w} height={dragRectPreview.h}
                  fill="#f5d76e" opacity={0.25}
                  stroke="#c89818" strokeWidth={5} strokeDasharray="24 14" />
          )}
          {/* Preview during two-click gestures */}
          {twoClickPreview && twoClickPreview.tool === "callout" && (
            <g opacity={0.7}>
              <line x1={twoClickPreview.first.x} y1={twoClickPreview.first.y}
                    x2={twoClickPreview.current.x} y2={twoClickPreview.current.y}
                    stroke="#d68a3a" strokeWidth={5} strokeDasharray="16 10" />
              <circle cx={twoClickPreview.first.x} cy={twoClickPreview.first.y} r={22} fill="#d68a3a" />
              <rect
                x={twoClickPreview.current.x - DEFAULT_CALLOUT_W / 2}
                y={twoClickPreview.current.y - DEFAULT_CALLOUT_H / 2}
                width={DEFAULT_CALLOUT_W} height={DEFAULT_CALLOUT_H}
                fill="#fff4dd" stroke="#d68a3a" strokeWidth={5} strokeDasharray="16 10"
              />
            </g>
          )}
          {twoClickPreview && twoClickPreview.tool === "dimension" && (
            <g opacity={0.7} stroke="#444" strokeWidth={4} fill="#444">
              <line x1={twoClickPreview.first.x} y1={twoClickPreview.first.y}
                    x2={twoClickPreview.current.x} y2={twoClickPreview.current.y}
                    strokeDasharray="16 10" />
              <circle cx={twoClickPreview.first.x} cy={twoClickPreview.first.y} r={10} />
              <circle cx={twoClickPreview.current.x} cy={twoClickPreview.current.y} r={10} />
            </g>
          )}
        </svg>
      </div>
    </div>
  );
}

// ── Sheet background (paper + grid) ──────────────────────────────────────

function SheetBackground({ sheet }: { sheet: Sheet }) {
  // Grid every 200 units (≈2") — light gray on paper.
  const lines: React.ReactNode[] = [];
  for (let x = 0; x <= sheet.width; x += 200) {
    lines.push(<line key={`vx-${x}`} x1={x} y1={0} x2={x} y2={sheet.height} stroke="#e8e6df" strokeWidth={1} />);
  }
  for (let y = 0; y <= sheet.height; y += 200) {
    lines.push(<line key={`hy-${y}`} x1={0} y1={y} x2={sheet.width} y2={y} stroke="#e8e6df" strokeWidth={1} />);
  }
  return (
    <>
      <rect x={0} y={0} width={sheet.width} height={sheet.height} fill="#fafaf7" />
      <g opacity={0.7}>{lines}</g>
      {/* Drawing border */}
      <rect x={80} y={80} width={sheet.width - 160} height={sheet.height - 160}
            fill="none" stroke="#2c2c28" strokeWidth={4} />
    </>
  );
}

// ── Drawing content — stub geometry per sheet number ─────────────────────

function SheetContent({ sheet }: { sheet: Sheet }) {
  if (sheet.number === "T-101") return <CableLayoutContent />;
  if (sheet.number === "T-102") return <RackElevationContent />;
  if (sheet.number === "T-501") return <DetailsContent />;
  if (sheet.number === "A-101") return <ArchBackgroundContent />;
  return null;
}

function CableLayoutContent() {
  return (
    <g stroke="#1f1f1c" fill="none" strokeWidth={2}>
      {/* Building outline */}
      <rect x={200} y={200} width={3200} height={1900} strokeWidth={3} />
      {/* Corridor */}
      <line x1={200} y1={1100} x2={3400} y2={1100} strokeDasharray="20 12" />
      {/* Rooms (vertical dividers) */}
      <line x1={900}  y1={200} x2={900}  y2={1100} />
      <line x1={1700} y1={200} x2={1700} y2={1100} />
      <line x1={2500} y1={200} x2={2500} y2={1100} />
      <line x1={900}  y1={1100} x2={900}  y2={2100} />
      <line x1={1700} y1={1100} x2={1700} y2={2100} />
      <line x1={2500} y1={1100} x2={2500} y2={2100} />
      {/* IDF closet (top-right) */}
      <rect x={3100} y={300} width={300} height={400} fill="#dcd9cd" />
      <text x={3250} y={520} textAnchor="middle" fontSize={70} fill="#1f1f1c" fontFamily="monospace">IDF-A</text>
      {/* Outlets — small squares */}
      <g fill="#2c5aa0">
        {Array.from({ length: 8 }, (_, i) => (
          <rect key={i} x={400 + i * 350} y={550} width={40} height={40} />
        ))}
        {Array.from({ length: 8 }, (_, i) => (
          <rect key={i + 100} x={400 + i * 350} y={1400} width={40} height={40} />
        ))}
        {Array.from({ length: 6 }, (_, i) => (
          <rect key={i + 200} x={400 + i * 450} y={1900} width={40} height={40} />
        ))}
      </g>
      {/* WAPs — circles */}
      <g fill="#2a8a5c">
        <circle cx={600}  cy={1100} r={50} />
        <circle cx={1300} cy={1100} r={50} />
        <circle cx={2100} cy={1100} r={50} />
        <circle cx={2900} cy={1100} r={50} />
      </g>
      {/* Title-area annotation */}
      <text x={250} y={170} fontSize={50} fontFamily="monospace" fill="#1f1f1c">
        LEVEL 1 — TELECOM CABLE LAYOUT
      </text>
    </g>
  );
}

function RackElevationContent() {
  return (
    <g stroke="#1f1f1c" fill="none" strokeWidth={2}>
      {/* MDF rack */}
      <rect x={600} y={400} width={500} height={1700} strokeWidth={3} />
      <text x={850} y={350} textAnchor="middle" fontSize={50} fontFamily="monospace" fill="#1f1f1c">MDF</text>
      {/* 42U slots */}
      {Array.from({ length: 42 }, (_, i) => (
        <line key={i} x1={600} y1={400 + i * 40} x2={1100} y2={400 + i * 40} stroke="#bbb6a3" strokeWidth={0.5} />
      ))}
      {/* Patch panels */}
      <rect x={620} y={420} width={460} height={80} fill="#dcd9cd" />
      <text x={850} y={470} textAnchor="middle" fontSize={28} fontFamily="monospace" fill="#1f1f1c">24-PORT · B-SERIES</text>
      <rect x={620} y={510} width={460} height={80} fill="#dcd9cd" />
      <text x={850} y={560} textAnchor="middle" fontSize={28} fontFamily="monospace" fill="#1f1f1c">24-PORT · A-SERIES</text>
      <rect x={620} y={600} width={460} height={80} fill="#dcd9cd" />
      <text x={850} y={650} textAnchor="middle" fontSize={28} fontFamily="monospace" fill="#1f1f1c">24-PORT · C-SERIES</text>
      {/* Switch */}
      <rect x={620} y={700} width={460} height={120} fill="#3a3a35" />
      <text x={850} y={770} textAnchor="middle" fontSize={28} fontFamily="monospace" fill="#fafaf7">48-PORT SW · CAT 9300</text>

      {/* IDF rack */}
      <rect x={2000} y={400} width={500} height={1700} strokeWidth={3} />
      <text x={2250} y={350} textAnchor="middle" fontSize={50} fontFamily="monospace" fill="#1f1f1c">IDF-A</text>
      {Array.from({ length: 42 }, (_, i) => (
        <line key={i} x1={2000} y1={400 + i * 40} x2={2500} y2={400 + i * 40} stroke="#bbb6a3" strokeWidth={0.5} />
      ))}
      <rect x={2020} y={420} width={460} height={80} fill="#dcd9cd" />
      <rect x={2020} y={510} width={460} height={80} fill="#dcd9cd" />
      <rect x={2020} y={600} width={460} height={120} fill="#3a3a35" />

      <text x={250} y={170} fontSize={50} fontFamily="monospace" fill="#1f1f1c">
        TELECOM RACK ELEVATIONS — MDF + IDF-A
      </text>
    </g>
  );
}

function DetailsContent() {
  return (
    <g stroke="#1f1f1c" fill="none" strokeWidth={2}>
      <text x={250} y={170} fontSize={50} fontFamily="monospace" fill="#1f1f1c">TELECOM DETAILS + SCHEDULES</text>
      {/* Detail blocks */}
      {Array.from({ length: 6 }, (_, i) => {
        const col = i % 3, row = Math.floor(i / 3);
        const x = 250 + col * 1100, y = 300 + row * 900;
        return (
          <g key={i}>
            <rect x={x} y={y} width={1000} height={800} />
            <text x={x + 20} y={y + 50} fontSize={32} fontFamily="monospace" fill="#1f1f1c">DETAIL {i + 1}</text>
          </g>
        );
      })}
    </g>
  );
}

function ArchBackgroundContent() {
  return (
    <g stroke="#1f1f1c" fill="none" strokeWidth={2}>
      <rect x={200} y={200} width={3200} height={1900} strokeWidth={3} />
      <line x1={200}  y1={1100} x2={3400} y2={1100} />
      <line x1={1100} y1={200}  x2={1100} y2={2100} />
      <line x1={2200} y1={200}  x2={2200} y2={2100} />
      <text x={250} y={170} fontSize={50} fontFamily="monospace" fill="#1f1f1c">
        ARCHITECTURAL BACKGROUND — LEVEL 1
      </text>
      {/* Column grid markers */}
      {[600, 1100, 1700, 2200, 2800].map((x, i) => (
        <g key={i}>
          <circle cx={x} cy={140} r={40} fill="#fafaf7" />
          <text x={x} y={155} textAnchor="middle" fontSize={32} fontFamily="monospace" fill="#1f1f1c">{String.fromCharCode(65 + i)}</text>
        </g>
      ))}
    </g>
  );
}

// ── Title block (bottom-right corner) ────────────────────────────────────

function TitleBlock({ sheet }: { sheet: Sheet }) {
  const x = sheet.width - 880, y = sheet.height - 380, w = 800, h = 300;
  return (
    <g>
      <rect x={x} y={y} width={w} height={h} fill="#fafaf7" stroke="#1f1f1c" strokeWidth={3} />
      <line x1={x} y1={y + 80} x2={x + w} y2={y + 80} stroke="#1f1f1c" strokeWidth={2} />
      <line x1={x + 500} y1={y} x2={x + 500} y2={y + h} stroke="#1f1f1c" strokeWidth={2} />
      <text x={x + 20} y={y + 55} fontSize={32} fontFamily="monospace" fill="#1f1f1c" fontWeight={700}>
        {sheet.number}
      </text>
      <text x={x + 200} y={y + 55} fontSize={28} fontFamily="monospace" fill="#1f1f1c">
        {sheet.title}
      </text>
      <text x={x + 20} y={y + 130} fontSize={22} fontFamily="monospace" fill="#444">SCALE</text>
      <text x={x + 20} y={y + 170} fontSize={26} fontFamily="monospace" fill="#1f1f1c">{sheet.scale}</text>
      <text x={x + 20} y={y + 230} fontSize={22} fontFamily="monospace" fill="#444">SIZE</text>
      <text x={x + 20} y={y + 270} fontSize={26} fontFamily="monospace" fill="#1f1f1c">{sheet.size}-size</text>
      <text x={x + 520} y={y + 130} fontSize={22} fontFamily="monospace" fill="#444">REVISION</text>
      <text x={x + 520} y={y + 180} fontSize={48} fontFamily="monospace" fill="#1f1f1c" fontWeight={700}>{sheet.revision ?? "—"}</text>
      <text x={x + 520} y={y + 230} fontSize={22} fontFamily="monospace" fill="#444">ISSUED</text>
      <text x={x + 520} y={y + 270} fontSize={26} fontFamily="monospace" fill="#1f1f1c">{sheet.issued ? "Yes" : "Working"}</text>
    </g>
  );
}

// ── Markup shape renderer ───────────────────────────────────────────────

function MarkupShape({
  markup, selected, tool, onSelect, onMouseDown,
}: {
  markup: Markup; selected: boolean; tool: ToolId;
  onSelect: (e: React.MouseEvent) => void;
  onMouseDown: (e: React.MouseEvent) => void;
}) {
  const dim = markup.status === "resolved" || markup.status === "wont_fix" ? 0.5 : 1;
  // When a drawing tool is active, let the canvas underneath capture the
  // mousedown so the user can draw over existing markups. The Pointer tool
  // re-enables selection + drag-to-move on the markup.
  const interactive = tool === "pointer";
  return (
    <g
      opacity={dim}
      onClick={interactive ? onSelect : undefined}
      onMouseDown={interactive ? onMouseDown : undefined}
      style={{
        cursor: interactive ? "move" : "inherit",
        pointerEvents: interactive ? "auto" : "none",
      }}
    >
      {markup.geometry.kind === "cloud"     && <Cloud     g={markup.geometry} selected={selected} />}
      {markup.geometry.kind === "highlight" && <Highlight g={markup.geometry} selected={selected} />}
      {markup.geometry.kind === "callout"   && <Callout   g={markup.geometry} title={markup.title} selected={selected} />}
      {markup.geometry.kind === "text"      && <TextNote  g={markup.geometry} title={markup.title} selected={selected} />}
      {markup.geometry.kind === "dimension" && <Dimension g={markup.geometry} title={markup.title} selected={selected} />}
      {markup.geometry.kind === "stamp"     && <Stamp     g={markup.geometry} selected={selected} />}
    </g>
  );
}

/** A scalloped revision cloud — built from arcs around the rectangle perimeter. */
function Cloud({ g, selected }: { g: Extract<Markup["geometry"], { kind: "cloud" }>; selected: boolean }) {
  const r = 50; // scallop radius
  const path = scallopedRect(g.x, g.y, g.w, g.h, r);
  return (
    <path d={path}
          fill="none"
          stroke="#c84545"
          strokeWidth={selected ? 14 : 9}
          strokeLinejoin="round" />
  );
}

function scallopedRect(x: number, y: number, w: number, h: number, r: number): string {
  // Draw a rounded "cloud" by chaining arcs of radius `r` along each edge.
  const steps = (len: number) => Math.max(2, Math.round(len / (r * 1.6)));
  const parts: string[] = [];
  parts.push(`M ${x} ${y + r}`);
  // Top edge — arcs going right
  const topSteps = steps(w);
  for (let i = 0; i < topSteps; i++) {
    const cx = x + ((i + 1) * w) / topSteps;
    const cy = y;
    parts.push(`A ${r} ${r} 0 0 1 ${cx} ${cy + r}`);
  }
  // Right edge — arcs going down
  const sideSteps = steps(h);
  for (let i = 0; i < sideSteps; i++) {
    const cx = x + w;
    const cy = y + ((i + 1) * h) / sideSteps;
    parts.push(`A ${r} ${r} 0 0 1 ${cx - r} ${cy}`);
  }
  // Bottom edge — arcs going left
  for (let i = 0; i < topSteps; i++) {
    const cx = x + w - ((i + 1) * w) / topSteps;
    const cy = y + h;
    parts.push(`A ${r} ${r} 0 0 1 ${cx} ${cy - r}`);
  }
  // Left edge — arcs going up
  for (let i = 0; i < sideSteps; i++) {
    const cx = x;
    const cy = y + h - ((i + 1) * h) / sideSteps;
    parts.push(`A ${r} ${r} 0 0 1 ${cx + r} ${cy}`);
  }
  return parts.join(" ");
}

function Highlight({ g, selected }: { g: Extract<Markup["geometry"], { kind: "highlight" }>; selected: boolean }) {
  return (
    <rect x={g.x} y={g.y} width={g.w} height={g.h}
          fill="#f5d76e" opacity={0.35}
          stroke={selected ? "#c89818" : "transparent"} strokeWidth={6} />
  );
}

function Callout({ g, title, selected }: {
  g: Extract<Markup["geometry"], { kind: "callout" }>; title: string; selected: boolean;
}) {
  const { anchor, label } = g;
  // leader from anchor to nearest corner of label box
  const lx = label.x + label.w / 2, ly = label.y + label.h / 2;
  return (
    <g>
      <line x1={anchor.x} y1={anchor.y} x2={lx} y2={ly}
            stroke="#d68a3a" strokeWidth={selected ? 8 : 5} />
      <circle cx={anchor.x} cy={anchor.y} r={selected ? 28 : 22} fill="#d68a3a" />
      <rect x={label.x} y={label.y} width={label.w} height={label.h}
            fill="#fff4dd" stroke="#d68a3a" strokeWidth={selected ? 8 : 5} />
      <foreignObject x={label.x + 12} y={label.y + 8} width={label.w - 24} height={label.h - 16}>
        <div style={{
          fontFamily: "ui-monospace, monospace",
          fontSize: 28, color: "#1f1f1c", lineHeight: 1.2,
        }}>{title}</div>
      </foreignObject>
    </g>
  );
}

function TextNote({ g, title, selected }: {
  g: Extract<Markup["geometry"], { kind: "text" }>; title: string; selected: boolean;
}) {
  return (
    <g>
      <rect x={g.x} y={g.y} width={g.w} height={g.h}
            fill={selected ? "#dbe9f8" : "#eaf2fb"}
            stroke="#2c5aa0" strokeWidth={selected ? 8 : 4} />
      <foreignObject x={g.x + 12} y={g.y + 8} width={g.w - 24} height={g.h - 16}>
        <div style={{
          fontFamily: "ui-monospace, monospace",
          fontSize: 26, color: "#1f1f1c", lineHeight: 1.2,
        }}>{title}</div>
      </foreignObject>
    </g>
  );
}

function Dimension({ g, title, selected }: {
  g: Extract<Markup["geometry"], { kind: "dimension" }>; title: string; selected: boolean;
}) {
  const { from, to } = g;
  const midX = (from.x + to.x) / 2, midY = (from.y + to.y) / 2;
  return (
    <g stroke="#444" strokeWidth={selected ? 8 : 4} fill="#444">
      <line x1={from.x} y1={from.y} x2={to.x} y2={to.y} />
      <circle cx={from.x} cy={from.y} r={12} />
      <circle cx={to.x}   cy={to.y}   r={12} />
      <text x={midX} y={midY - 20} textAnchor="middle" fontSize={32} fontFamily="monospace">{title}</text>
    </g>
  );
}

function Stamp({ g, selected }: {
  g: Extract<Markup["geometry"], { kind: "stamp" }>; selected: boolean;
}) {
  const label = STAMP_LABEL[g.stamp];
  const color = g.stamp === "approved" || g.stamp === "reviewed" ? "#2a8a5c"
             : g.stamp === "void" ? "#777"
             : "#c84545";
  return (
    <g transform={`rotate(-12 ${g.x + g.w / 2} ${g.y + g.h / 2})`}>
      <rect x={g.x} y={g.y} width={g.w} height={g.h}
            fill="none" stroke={color} strokeWidth={selected ? 18 : 12} />
      <text x={g.x + g.w / 2} y={g.y + g.h / 2 + 25}
            textAnchor="middle" fontSize={70} fontWeight={700}
            fontFamily="monospace" fill={color}>{label}</text>
    </g>
  );
}

// ── Right-panel: markup list ────────────────────────────────────────────

function MarkupListPanel({
  markups, selectedId, onSelect,
}: {
  markups: Markup[]; selectedId: string | null; onSelect: (id: string) => void;
}) {
  return (
    <div className="flex-1 min-h-0 flex flex-col border-b border-chrome-dark">
      <div className="px-3 py-2 border-b border-chrome-dark flex items-center justify-between">
        <span className="text-[9.5px] text-text4 font-mono uppercase tracking-[0.06em]">Markups · {markups.length}</span>
      </div>
      <div className="flex-1 overflow-y-auto">
        {markups.length === 0 ? (
          <div className="px-3 py-4 text-[11px] text-text4 font-mono">No markups match this filter.</div>
        ) : markups.map(m => (
          <button
            key={m.id}
            onClick={() => onSelect(m.id)}
            className={clsx(
              "w-full text-left px-3 py-2 border-b border-chrome-dark/50 transition-colors",
              m.id === selectedId ? "bg-accent/10 border-l-2 border-l-accent" : "hover:bg-chrome-dark",
            )}
          >
            <div className="flex items-center gap-2 mb-0.5">
              <span className={clsx("w-1.5 h-1.5 rounded-full", statusDotClass(m.status))} />
              <span className={clsx("text-[9.5px] font-mono uppercase tracking-[0.06em]", MARKUP_STATUS_TONE[m.status])}>
                {MARKUP_STATUS_LABEL[m.status]}
              </span>
              <span className="text-[9.5px] text-text4 font-mono ml-auto">{MARKUP_TYPE_LABEL[m.type]}</span>
            </div>
            <div className="text-[11px] text-text2 line-clamp-2">{m.title}</div>
            <div className="text-[9.5px] text-text4 font-mono mt-0.5">
              {m.author.name}
              {m.comments.length > 0 && <span className="ml-2">· {m.comments.length} {m.comments.length === 1 ? "reply" : "replies"}</span>}
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}

function statusDotClass(s: MarkupStatus): string {
  switch (s) {
    case "open":      return "bg-warn";
    case "in_review": return "bg-info";
    case "resolved":  return "bg-pass";
    case "wont_fix":  return "bg-text4";
  }
}

// ── Right-panel: selected markup detail + comments ──────────────────────

function MarkupDetailPanel({
  markup, currentAuthor, autoFocusTitle, onAutoFocusConsumed,
  onStatusChange, onAddComment, onUpdateFields, onDelete,
}: {
  markup: Markup | null;
  currentAuthor: MarkupAuthor;
  autoFocusTitle: boolean;
  onAutoFocusConsumed: () => void;
  onStatusChange: (s: MarkupStatus) => void;
  onAddComment: (body: string) => void;
  onUpdateFields: (patch: { title?: string; body?: string }) => void;
  onDelete: () => void;
}) {
  const [draft, setDraft] = useState("");
  // Locally-edited title/body — synced from the markup prop when the
  // selection changes. Committed via onUpdateFields on blur.
  const [titleDraft, setTitleDraft] = useState(markup?.title ?? "");
  const [bodyDraft, setBodyDraft]   = useState(markup?.body ?? "");
  const [confirmDelete, setConfirmDelete] = useState(false);
  const titleRef = useRef<HTMLInputElement>(null);

  // When the selected markup changes, reset local edit drafts to its values.
  useEffect(() => {
    setTitleDraft(markup?.title ?? "");
    setBodyDraft(markup?.body ?? "");
    setConfirmDelete(false);
  }, [markup?.id]);

  // Auto-focus + select the title when a brand-new markup was just created,
  // so the user can immediately type a real title over the placeholder.
  useEffect(() => {
    if (autoFocusTitle && titleRef.current) {
      titleRef.current.focus();
      titleRef.current.select();
      onAutoFocusConsumed();
    }
  }, [autoFocusTitle, onAutoFocusConsumed]);

  if (!markup) {
    return (
      <div className="px-3 py-4 text-[11px] text-text4 font-mono">
        Select a markup to view details, change status, and reply.
      </div>
    );
  }

  function submitComment() {
    const body = draft.trim();
    if (!body) return;
    onAddComment(body);
    setDraft("");
  }
  function commitTitle() {
    const t = titleDraft.trim();
    if (t && t !== markup!.title) onUpdateFields({ title: t });
    else if (!t) setTitleDraft(markup!.title); // revert empty
  }
  function commitBody() {
    if (bodyDraft !== (markup!.body ?? "")) onUpdateFields({ body: bodyDraft });
  }

  return (
    <div className="flex-1 min-h-0 flex flex-col">
      <div className="px-3 py-2 border-b border-chrome-dark">
        <div className="flex items-center gap-2 mb-2">
          <span className={clsx("w-1.5 h-1.5 rounded-full", statusDotClass(markup.status))} />
          <span className={clsx("text-[9.5px] font-mono uppercase tracking-[0.06em]", MARKUP_STATUS_TONE[markup.status])}>
            {MARKUP_STATUS_LABEL[markup.status]}
          </span>
          <span className="text-[9.5px] text-text4 font-mono ml-auto">{MARKUP_TYPE_LABEL[markup.type]}</span>
        </div>

        {/* Editable title */}
        <input
          ref={titleRef}
          value={titleDraft}
          onChange={(e) => setTitleDraft(e.target.value)}
          onBlur={commitTitle}
          onKeyDown={(e) => {
            if (e.key === "Enter")  { e.preventDefault(); (e.target as HTMLInputElement).blur(); }
            if (e.key === "Escape") { setTitleDraft(markup.title); (e.target as HTMLInputElement).blur(); }
          }}
          className="w-full bg-transparent text-[12px] text-text font-medium leading-snug border border-transparent hover:border-chrome-lighter focus:border-accent rounded-[2px] px-1.5 py-1 -mx-1.5 focus:outline-none"
          placeholder="Markup title"
        />

        {/* Editable body */}
        <textarea
          value={bodyDraft}
          onChange={(e) => setBodyDraft(e.target.value)}
          onBlur={commitBody}
          rows={3}
          className="mt-1.5 w-full bg-transparent text-[11px] text-text3 leading-relaxed border border-transparent hover:border-chrome-lighter focus:border-accent rounded-[2px] px-1.5 py-1 -mx-1.5 resize-none focus:outline-none placeholder:text-text4/60"
          placeholder="Add a longer description, recommendation, or rationale…"
        />

        <div className="text-[10px] text-text4 font-mono mt-2">
          {markup.author.name} · {new Date(markup.createdAt).toLocaleString(undefined, { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}
        </div>
        {markup.assignedTo && (
          <div className="text-[10px] text-text4 font-mono mt-1">
            Assigned: <span className="text-text3">{markup.assignedTo.name}</span>
          </div>
        )}

        {/* Status changer */}
        <div className="mt-3 flex items-center gap-1.5 flex-wrap">
          {(["open", "in_review", "resolved", "wont_fix"] as MarkupStatus[]).map(s => (
            <button
              key={s}
              onClick={() => onStatusChange(s)}
              className={clsx(
                "text-[9.5px] font-mono uppercase tracking-[0.06em] px-2 py-1 rounded-[2px] transition-colors",
                markup.status === s
                  ? "bg-accent/15 text-accent border border-accent/40"
                  : "text-text3 hover:text-text border border-chrome-lighter hover:border-text4",
              )}
            >{MARKUP_STATUS_LABEL[s]}</button>
          ))}
        </div>
      </div>

      {/* Comments thread */}
      <div className="flex-1 overflow-y-auto">
        {markup.comments.length === 0 ? (
          <div className="px-3 py-3 text-[10.5px] text-text4 font-mono">No replies yet.</div>
        ) : markup.comments.map(c => (
          <CommentRow key={c.id} comment={c} />
        ))}
      </div>

      {/* Compose */}
      <div className="border-t border-chrome-dark p-2.5 flex flex-col gap-1.5">
        <textarea
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          rows={2}
          placeholder={`Reply as ${currentAuthor.name}…`}
          className="w-full bg-chrome-dark text-[11px] text-text2 font-mono border border-chrome-lighter rounded-[2px] px-2 py-1.5 resize-none focus:outline-none focus:border-accent"
          onKeyDown={(e) => {
            if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) { e.preventDefault(); submitComment(); }
          }}
        />
        <div className="flex items-center gap-2">
          <button
            onClick={submitComment}
            disabled={!draft.trim()}
            className="btn btn-primary text-[10.5px] px-2.5 py-1 disabled:opacity-40 disabled:cursor-not-allowed"
          >Post reply</button>
          <span className="text-[9.5px] text-text4 font-mono">⌘+Enter to send</span>
          {confirmDelete ? (
            <span className="ml-auto flex items-center gap-1.5">
              <button
                onClick={onDelete}
                className="text-[10px] font-mono uppercase tracking-[0.06em] px-2 py-1 bg-fail/20 text-fail hover:bg-fail/30 rounded-[2px]"
              >Confirm delete</button>
              <button
                onClick={() => setConfirmDelete(false)}
                className="text-[10px] text-text4 hover:text-text font-mono"
              >Cancel</button>
            </span>
          ) : (
            <button
              onClick={() => setConfirmDelete(true)}
              className="ml-auto text-[10px] text-text4 hover:text-fail font-mono uppercase tracking-[0.06em]"
              title="Delete this markup"
            >✕ Delete</button>
          )}
        </div>
      </div>
    </div>
  );
}

function CommentRow({ comment }: { comment: MarkupComment }) {
  return (
    <div className="px-3 py-2 border-b border-chrome-dark/50">
      <div className="text-[10px] text-text4 font-mono mb-1">
        {comment.author.name} <span className="ml-1 text-text4">· {new Date(comment.createdAt).toLocaleString(undefined, { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}</span>
      </div>
      <div className="text-[11px] text-text2 leading-snug whitespace-pre-wrap">{comment.body}</div>
    </div>
  );
}
