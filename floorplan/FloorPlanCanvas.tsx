"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { ExtractedRoom } from "@/lib/intake/types";
import type { OutletPlacement, WapPlacement } from "@/lib/placement/types";
import { CANVAS_W, CANVAS_H } from "@/lib/intake/types";
import { deriveDoors, type Side } from "@/lib/floorplan/geometry";
import { OutletSymbol, WapSymbol, WapCoverage, LadderTraySegment } from "./symbols";
import { CableRuns } from "./CableRuns";
import { ColumnGrid } from "./ColumnGrid";
import { NorthArrowScale } from "./NorthArrowScale";
import { TrEquipment } from "./TrEquipment";
import type { LayerState } from "./LayerPanel";
import type { Tool } from "./FloorPlanToolbar";
import type { SelectionSet } from "./FloorPlanWorkspace";

const SCALE = 8; // px per grid unit

const ROOM_FILL: Record<string, string> = {
  mdf: "#e7eef8", idf: "#e7eef8",
  open_office:    "#fcfcfa",
  private_office: "#fcfcfa",
  conference:     "#f4f7fc",
  reception:      "#fdf8ed",
  corridor:       "#f4f4f0",
  storage:        "#f7f6ef",
  classroom:      "#f3f7ec",
  lab:            "#f4f2fa",
  patient_room:   "#fdf2eb",
  exam_room:      "#fdf2eb",
  electrical:     "#fcf2e0",
  mechanical:     "#fcf2e0",
  restroom:       "#f3f3ef",
  kitchen:        "#fdf7d8",
  stairwell:      "#ecece8",
  elevator:       "#ecece8",
  unknown:        "#fafafa",
};

// Margin around the floor plan inside the SVG so column-grid bubbles + title block fit.
const MARGIN_X = 14; // grid units
const MARGIN_Y = 14;

export function FloorPlanCanvas({
  rooms, outlets, waps, tool, selection, layers, projectNumber, floor,
  onCanvasClick, onSelect, onBoxSelect,
}: {
  rooms: ExtractedRoom[];
  outlets: OutletPlacement[];
  waps: WapPlacement[];
  tool: Tool;
  selection: SelectionSet;
  layers: LayerState;
  projectNumber: string;
  floor: number;
  onCanvasClick: (gridX: number, gridY: number, additive: boolean) => void;
  onSelect: (kind: "room" | "outlet" | "wap", id: string, additive: boolean) => void;
  onBoxSelect: (x1: number, y1: number, x2: number, y2: number, additive: boolean) => void;
}) {
  const svgRef = useRef<SVGSVGElement | null>(null);
  const doors = useMemo(() => deriveDoors(rooms), [rooms]);

  // Pan / zoom state
  const [view, setView] = useState({ tx: 0, ty: 0, zoom: 1 });
  const [panning, setPanning] = useState(false);
  const panStart = useRef<{ mx: number; my: number; tx: number; ty: number } | null>(null);
  const [spaceHeld, setSpaceHeld] = useState(false);

  // Drag-rectangle select
  const [dragRect, setDragRect] = useState<{ x1: number; y1: number; x2: number; y2: number; additive: boolean } | null>(null);
  const dragStart = useRef<{ x: number; y: number; additive: boolean } | null>(null);

  // Total drawing dimensions (canvas + margins for bubbles + title block)
  const TOTAL_W = (CANVAS_W + MARGIN_X * 2) * SCALE;
  const TOTAL_H = (CANVAS_H + MARGIN_Y * 2) * SCALE;

  // Title block position — bottom-right corner of the drawing
  const TB_W = 38, TB_H = 22;
  const tbX = (CANVAS_W - TB_W + 4) * SCALE;
  const tbY = (CANVAS_H - TB_H - 1) * SCALE;

  // Building perimeter — min/max of all room bounds
  const buildingBounds = useMemo(() => {
    if (!rooms.length) return null;
    const minX = Math.min(...rooms.map(r => r.x));
    const minY = Math.min(...rooms.map(r => r.y));
    const maxX = Math.max(...rooms.map(r => r.x + r.w));
    const maxY = Math.max(...rooms.map(r => r.y + r.h));
    return { minX, minY, maxX, maxY };
  }, [rooms]);

  // outlet-side lookup (for triangle orientation)
  const outletSides = useMemo(() => {
    const map = new Map<string, Side>();
    for (const o of outlets) {
      if (!o.roomId) continue;
      const r = rooms.find(x => x.id === o.roomId);
      if (!r) continue;
      const dTop = o.y - r.y, dBot = (r.y + r.h) - o.y, dL = o.x - r.x, dR = (r.x + r.w) - o.x;
      const m = Math.min(dTop, dBot, dL, dR);
      map.set(o.id, m === dTop ? "top" : m === dBot ? "bottom" : m === dL ? "left" : "right");
    }
    return map;
  }, [outlets, rooms]);

  // ── Pointer math ────────────────────────────────────────────────────────────
  const screenToGrid = useCallback((sx: number, sy: number): { x: number; y: number } => {
    const svg = svgRef.current;
    if (!svg) return { x: 0, y: 0 };
    const pt = svg.createSVGPoint();
    pt.x = sx; pt.y = sy;
    const ctm = svg.getScreenCTM();
    if (!ctm) return { x: 0, y: 0 };
    const local = pt.matrixTransform(ctm.inverse());
    // Reverse the viewport transform manually since SVG transform isn't on the root
    const gx = (local.x - view.tx) / view.zoom / SCALE - MARGIN_X;
    const gy = (local.y - view.ty) / view.zoom / SCALE - MARGIN_Y;
    return { x: gx, y: gy };
  }, [view]);

  // ── Wheel zoom (around cursor) ──────────────────────────────────────────────
  useEffect(() => {
    const svg = svgRef.current;
    if (!svg) return;
    const handler = (e: WheelEvent) => {
      e.preventDefault();
      const factor = e.deltaY < 0 ? 1.1 : 1 / 1.1;
      setView(v => {
        const newZoom = Math.max(0.3, Math.min(4, v.zoom * factor));
        const rect = svg.getBoundingClientRect();
        const mx = e.clientX - rect.left;
        const my = e.clientY - rect.top;
        // Adjust translation so the point under the cursor stays put
        const k = newZoom / v.zoom;
        const tx = mx - (mx - v.tx) * k;
        const ty = my - (my - v.ty) * k;
        return { tx, ty, zoom: newZoom };
      });
    };
    svg.addEventListener("wheel", handler, { passive: false });
    return () => svg.removeEventListener("wheel", handler);
  }, []);

  // ── Space-held tracking for pan mode ────────────────────────────────────────
  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.code === "Space" && !spaceHeld && (e.target as HTMLElement)?.tagName !== "INPUT") {
        e.preventDefault(); setSpaceHeld(true);
      }
    };
    const up = (e: KeyboardEvent) => { if (e.code === "Space") setSpaceHeld(false); };
    window.addEventListener("keydown", down);
    window.addEventListener("keyup", up);
    return () => { window.removeEventListener("keydown", down); window.removeEventListener("keyup", up); };
  }, [spaceHeld]);

  // ── Mouse handlers ──────────────────────────────────────────────────────────
  function onMouseDown(e: React.MouseEvent<SVGSVGElement>) {
    // Middle-mouse OR space-held → pan
    if (e.button === 1 || spaceHeld) {
      e.preventDefault();
      setPanning(true);
      panStart.current = { mx: e.clientX, my: e.clientY, tx: view.tx, ty: view.ty };
      return;
    }
    // Left button + select tool + empty canvas → start drag-rectangle
    if (e.button === 0 && tool === "select") {
      const target = e.target as Element;
      // Only start drag-rect if clicking on grid/background, not on an element group
      const onElement = target.closest("[data-element]");
      if (!onElement) {
        const { x, y } = screenToGrid(e.clientX, e.clientY);
        dragStart.current = { x, y, additive: e.shiftKey };
        setDragRect({ x1: x, y1: y, x2: x, y2: y, additive: e.shiftKey });
      }
    }
  }

  function onMouseMove(e: React.MouseEvent<SVGSVGElement>) {
    if (panning && panStart.current) {
      const dx = e.clientX - panStart.current.mx;
      const dy = e.clientY - panStart.current.my;
      setView(v => ({ ...v, tx: panStart.current!.tx + dx, ty: panStart.current!.ty + dy }));
      return;
    }
    if (dragRect && dragStart.current) {
      const { x, y } = screenToGrid(e.clientX, e.clientY);
      setDragRect({ x1: dragStart.current.x, y1: dragStart.current.y, x2: x, y2: y, additive: dragStart.current.additive });
    }
  }

  function onMouseUp(e: React.MouseEvent<SVGSVGElement>) {
    if (panning) { setPanning(false); panStart.current = null; return; }
    if (dragRect && dragStart.current) {
      const dx = Math.abs(dragRect.x2 - dragRect.x1);
      const dy = Math.abs(dragRect.y2 - dragRect.y1);
      if (dx > 1 || dy > 1) {
        const x1 = Math.min(dragRect.x1, dragRect.x2);
        const y1 = Math.min(dragRect.y1, dragRect.y2);
        const x2 = Math.max(dragRect.x1, dragRect.x2);
        const y2 = Math.max(dragRect.y1, dragRect.y2);
        onBoxSelect(x1, y1, x2, y2, dragRect.additive);
      } else {
        // Click without drag — treat as canvas click for placement OR clear selection
        const { x, y } = screenToGrid(e.clientX, e.clientY);
        onCanvasClick(x, y, e.shiftKey);
      }
      setDragRect(null);
      dragStart.current = null;
      return;
    }
    // No active drag-rect — single click → placement or deselect
    if (tool !== "select" && !panning && !spaceHeld) {
      const { x, y } = screenToGrid(e.clientX, e.clientY);
      onCanvasClick(x, y, e.shiftKey);
    }
  }

  // ── Click filters: only fire in Select mode ─────────────────────────────────
  const onElementClick = (e: React.MouseEvent, kind: "room" | "outlet" | "wap", id: string) => {
    if (tool !== "select") return;  // let bubble up to placer
    e.stopPropagation();
    onSelect(kind, id, e.shiftKey || e.ctrlKey || e.metaKey);
  };

  // Sel-set helpers
  const isSel = (k: "room" | "outlet" | "wap", id: string) => selection.has(`${k}:${id}`);

  const cursor =
    panning ? "grabbing" :
    spaceHeld ? "grab" :
    tool === "select" ? "default" :
    "crosshair";

  return (
    <div className="flex-1 min-w-0 bg-[#7a7a72] overflow-auto relative">
      <div className="m-4 bg-white shadow-[0_8px_30px_rgba(0,0,0,0.30)] inline-block">
        <svg
          ref={svgRef}
          width={TOTAL_W}
          height={TOTAL_H}
          style={{ display: "block", cursor }}
          onMouseDown={onMouseDown}
          onMouseMove={onMouseMove}
          onMouseUp={onMouseUp}
          onMouseLeave={() => { setPanning(false); setDragRect(null); panStart.current = null; dragStart.current = null; }}
        >
          <defs>
            <pattern id="grid" width={SCALE * 5} height={SCALE * 5} patternUnits="userSpaceOnUse">
              <path d={`M ${SCALE * 5} 0 L 0 0 0 ${SCALE * 5}`} fill="none" stroke="#ebebe4" strokeWidth={0.4} />
            </pattern>
            <pattern id="hatchEM" width={6} height={6} patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
              <line x1={0} y1={0} x2={0} y2={6} stroke="#c9b58a" strokeWidth={0.8} />
            </pattern>
          </defs>

          {/* Paper background */}
          <rect width={TOTAL_W} height={TOTAL_H} fill="white" />

          {/* All content gets the pan/zoom transform */}
          <g transform={`translate(${view.tx}, ${view.ty}) scale(${view.zoom})`}>
            <g transform={`translate(${MARGIN_X * SCALE}, ${MARGIN_Y * SCALE})`}>

              {/* Light grid */}
              <rect width={CANVAS_W * SCALE} height={CANVAS_H * SCALE} fill="url(#grid)" />

              {/* Column grid + bubbles */}
              {layers.grid && <ColumnGrid scale={SCALE} />}

              {/* Room fills */}
              {layers.rooms && rooms.map((r) => {
                const type = r.overrideType ?? r.type;
                const fill = ROOM_FILL[type] ?? "#fafafa";
                return (
                  <g key={"fill_" + r.id} data-element="room"
                     onClick={(e) => onElementClick(e, "room", r.id)}>
                    <rect x={r.x * SCALE} y={r.y * SCALE} width={r.w * SCALE} height={r.h * SCALE} fill={fill} stroke="none" />
                    {(type === "electrical" || type === "mechanical") && (
                      <rect x={r.x * SCALE} y={r.y * SCALE} width={r.w * SCALE} height={r.h * SCALE}
                            fill="url(#hatchEM)" opacity={0.40} pointerEvents="none" />
                    )}
                  </g>
                );
              })}

              {/* Room labels */}
              {rooms.map((r) => (
                <g key={"lbl_" + r.id} pointerEvents="none">
                  <text x={(r.x + r.w / 2) * SCALE} y={(r.y + r.h / 2) * SCALE - 4}
                        textAnchor="middle" fontSize={r.w < 14 ? 7 : 9.5} fontWeight={500} fill="#2a2a2a"
                        style={{ fontFamily: "Inter, sans-serif" }}>
                    {r.overrideName ?? r.name}
                  </text>
                  <text x={(r.x + r.w / 2) * SCALE} y={(r.y + r.h / 2) * SCALE + 7}
                        textAnchor="middle" fontSize={r.w < 14 ? 6 : 7.5} fill="#666"
                        style={{ fontFamily: "JetBrains Mono, monospace" }}>
                    {r.area.toLocaleString()} SF
                  </text>
                </g>
              ))}

              {/* TR equipment */}
              {layers.trEquipment && rooms
                .filter(r => (r.overrideType ?? r.type) === "mdf" || (r.overrideType ?? r.type) === "idf")
                .map(r => <TrEquipment key={"trk_" + r.id} room={r} scale={SCALE} />)}

              {/* Cable tray spine (Floor 1) */}
              {layers.tray && rooms.length > 0 && rooms[0].floor === 1 && (
                <LadderTraySegment x1={4} x2={CANVAS_W - 8} y={24} scale={SCALE} />
              )}

              {/* WAP coverage halos */}
              {layers.coverage && layers.waps && waps.map((w) => <WapCoverage key={"cov_" + w.id} wap={w} scale={SCALE} />)}

              {/* Cable runs */}
              {layers.cableRuns && (
                <CableRuns rooms={rooms} outlets={layers.outlets ? outlets : []} waps={layers.waps ? waps : []} scale={SCALE} />
              )}

              {/* Walls */}
              {layers.walls && rooms.map((r) => {
                const type = r.overrideType ?? r.type;
                const isCorridor = type === "corridor";
                const sw = isCorridor ? 1.4 : 1.8;
                return (
                  <rect key={"wall_" + r.id}
                    x={r.x * SCALE} y={r.y * SCALE} width={r.w * SCALE} height={r.h * SCALE}
                    fill="none" stroke="#222" strokeWidth={sw} pointerEvents="none"
                  />
                );
              })}

              {/* Building exterior — thicker stroke around the bounding rectangle */}
              {layers.walls && buildingBounds && (
                <rect
                  x={buildingBounds.minX * SCALE - 2}
                  y={buildingBounds.minY * SCALE - 2}
                  width={(buildingBounds.maxX - buildingBounds.minX) * SCALE + 4}
                  height={(buildingBounds.maxY - buildingBounds.minY) * SCALE + 4}
                  fill="none" stroke="#000" strokeWidth={3} pointerEvents="none"
                />
              )}

              {/* Doors */}
              {layers.doors && doors.map((d, i) => {
                const dw = d.width * SCALE;
                const eraserT = 3.6;
                let ex: number, ey: number, ew: number, eh: number;
                if (d.side === "top" || d.side === "bottom") {
                  ex = (d.cx - d.width / 2) * SCALE;
                  ey = d.cy * SCALE - eraserT / 2;
                  ew = dw; eh = eraserT;
                } else {
                  ex = d.cx * SCALE - eraserT / 2;
                  ey = (d.cy - d.width / 2) * SCALE;
                  ew = eraserT; eh = dw;
                }
                const arcR = d.width * SCALE;
                let sx: number, sy: number, exA: number, eyA: number, sweep = 1, hx: number, hy: number;
                if (d.side === "top") {
                  hx = (d.cx - d.width / 2) * SCALE; hy = d.cy * SCALE;
                  sx = hx + arcR; sy = hy;
                  exA = hx; eyA = hy + arcR;
                } else if (d.side === "bottom") {
                  hx = (d.cx - d.width / 2) * SCALE; hy = d.cy * SCALE;
                  sx = hx + arcR; sy = hy;
                  exA = hx; eyA = hy - arcR;
                  sweep = 0;
                } else if (d.side === "left") {
                  hx = d.cx * SCALE; hy = (d.cy - d.width / 2) * SCALE;
                  sx = hx; sy = hy + arcR;
                  exA = hx + arcR; eyA = hy;
                } else {
                  hx = d.cx * SCALE; hy = (d.cy - d.width / 2) * SCALE;
                  sx = hx; sy = hy + arcR;
                  exA = hx - arcR; eyA = hy;
                  sweep = 0;
                }
                return (
                  <g key={"door_" + i} pointerEvents="none">
                    <rect x={ex} y={ey} width={ew} height={eh} fill="#ffffff" />
                    <line x1={hx} y1={hy} x2={sx} y2={sy} stroke="#666" strokeWidth={0.9} />
                    <path d={`M ${sx} ${sy} A ${arcR} ${arcR} 0 0 ${sweep} ${exA} ${eyA}`}
                          fill="none" stroke="#666" strokeWidth={0.7} />
                  </g>
                );
              })}

              {/* Outlets */}
              {layers.outlets && outlets.map((o) => (
                <g key={"o_" + o.id} data-element="outlet">
                  <OutletSymbol
                    outlet={o}
                    scale={SCALE}
                    selected={isSel("outlet", o.id)}
                    side={outletSides.get(o.id)}
                    onClick={(e) => onElementClick(e, "outlet", o.id)}
                  />
                </g>
              ))}

              {/* WAPs */}
              {layers.waps && waps.map((w) => (
                <g key={"w_" + w.id} data-element="wap">
                  <WapSymbol
                    wap={w}
                    scale={SCALE}
                    selected={isSel("wap", w.id)}
                    onClick={(e) => onElementClick(e, "wap", w.id)}
                  />
                </g>
              ))}

              {/* Selection highlight rects (rooms) */}
              {rooms.filter(r => isSel("room", r.id)).map(r => (
                <rect key={"sel_" + r.id}
                  x={r.x * SCALE} y={r.y * SCALE} width={r.w * SCALE} height={r.h * SCALE}
                  fill="none" stroke="#f6a623" strokeWidth={2} pointerEvents="none"
                />
              ))}

              {/* Drag-rect overlay */}
              {dragRect && (
                <rect
                  x={Math.min(dragRect.x1, dragRect.x2) * SCALE}
                  y={Math.min(dragRect.y1, dragRect.y2) * SCALE}
                  width={Math.abs(dragRect.x2 - dragRect.x1) * SCALE}
                  height={Math.abs(dragRect.y2 - dragRect.y1) * SCALE}
                  fill="rgba(246,166,35,0.08)"
                  stroke="#f6a623"
                  strokeWidth={0.8}
                  strokeDasharray="3,2"
                  pointerEvents="none"
                />
              )}

              {/* Title block — drawn last so it sits on top */}
              {layers.titleBlock && (
                <g transform={`translate(${tbX}, ${tbY})`}>
                  <NorthArrowScale
                    scale={SCALE}
                    projectNumber={projectNumber}
                    drawingTitle={`FLOOR ${floor} PLAN — ICT`}
                    sheetNumber={`ICT-${String(floor).padStart(3, "0")}`}
                  />
                </g>
              )}

            </g>
          </g>
        </svg>
      </div>

      {/* Pan/zoom HUD */}
      <div className="absolute bottom-3 left-4 bg-chrome-dark/90 border border-chrome-lighter rounded-[2px] px-2.5 py-1 text-[10.5px] text-text3 font-mono flex items-center gap-2">
        <span>{Math.round(view.zoom * 100)}%</span>
        <span className="text-text4">·</span>
        <button onClick={() => setView({ tx: 0, ty: 0, zoom: 1 })} className="text-text3 hover:text-text">Reset view</button>
        <span className="text-text4">·</span>
        <span className="text-text4">Space + drag to pan · wheel to zoom · Shift+drag to add to selection</span>
      </div>
    </div>
  );
}
