"use client";

import type { ApprovalState, OutletPlacement, WapPlacement } from "@/lib/placement/types";
import type { Side } from "@/lib/floorplan/geometry";

// All symbols draw in the canvas's grid space; the parent <svg> handles px scaling.

function outletColor(approval: ApprovalState, source: OutletPlacement["source"]): { fill: string; stroke: string } {
  if (approval === "approved") return { fill: "#1d4ed8", stroke: "#0a3a8c" };
  if (approval === "rejected") return { fill: "#ffffff", stroke: "#c44a4a" };
  return source === "ai"
    ? { fill: "#fde9b3", stroke: "#c9931f" }
    : { fill: "#ffffff", stroke: "#5a5e66" };
}

/**
 * BICSI-style data outlet symbol: an isosceles triangle pointing INTO the room
 * (away from the wall), with a short connection lead back to the wall.
 *
 *           ┌──── lead (~1u along normal back to wall) ────┐
 *           │
 *           ▽   (filled triangle pointing into room)
 *
 * `side` determines triangle orientation; the lead always points OUT of the
 * room (toward the wall).
 */
export function OutletSymbol({
  outlet, scale, selected, side, onClick,
}: {
  outlet: OutletPlacement;
  scale: number;
  selected: boolean;
  side?: Side;
  onClick?: (e: React.MouseEvent) => void;
}) {
  const { fill, stroke } = outletColor(outlet.approval, outlet.source);
  // Determine triangle direction: triangle apex points INTO the room.
  // If `side` is the wall the outlet sits on, normal points away from that wall.
  const nx = side === "left" ? 1 : side === "right" ? -1 : 0;
  const ny = side === "top"  ? 1 : side === "bottom" ? -1 : 0;
  // Triangle size in grid units
  const SZ = 1.6;
  // Triangle base sits at outlet center; apex extends along (nx, ny)
  const cx = outlet.x;
  const cy = outlet.y;
  // For top/bottom walls, base is horizontal; for left/right, base is vertical
  let p1x: number, p1y: number, p2x: number, p2y: number, apexX: number, apexY: number;
  if (ny !== 0) {
    // horizontal base
    p1x = cx - SZ / 2; p1y = cy;
    p2x = cx + SZ / 2; p2y = cy;
    apexX = cx; apexY = cy + ny * SZ;
  } else if (nx !== 0) {
    // vertical base
    p1x = cx; p1y = cy - SZ / 2;
    p2x = cx; p2y = cy + SZ / 2;
    apexX = cx + nx * SZ; apexY = cy;
  } else {
    // fallback — point down (room interior assumed below)
    p1x = cx - SZ / 2; p1y = cy;
    p2x = cx + SZ / 2; p2y = cy;
    apexX = cx; apexY = cy + SZ;
  }
  // Lead: short stub from outlet base back toward wall (opposite direction)
  const leadX = cx - nx * 0.9 - (ny === 0 ? 0 : 0);
  const leadY = cy - ny * 0.9;

  return (
    <g
      onClick={onClick}
      style={{ cursor: "pointer" }}
      transform={`translate(${cx * scale}, ${cy * scale})`}
    >
      {/* Lead (back to wall) */}
      <line
        x1={(leadX - cx) * scale} y1={(leadY - cy) * scale}
        x2={0} y2={0}
        stroke={stroke} strokeWidth={1.2}
      />
      {/* Triangle */}
      <polygon
        points={`${(p1x - cx) * scale},${(p1y - cy) * scale} ${(p2x - cx) * scale},${(p2y - cy) * scale} ${(apexX - cx) * scale},${(apexY - cy) * scale}`}
        fill={fill} stroke={stroke} strokeWidth={1.2}
        strokeLinejoin="round"
      />
      {/* Port count badge above the triangle base */}
      <text
        x={0} y={-1.2 * scale}
        textAnchor="middle" fontSize={6} fill="#333"
        style={{ fontFamily: "JetBrains Mono, monospace", pointerEvents: "none" }}
      >
        {outlet.ports}p
      </text>
      {selected && (
        <rect
          x={-SZ * scale} y={-SZ * scale} width={SZ * 2 * scale} height={SZ * 2 * scale}
          fill="none" stroke="#f6a623" strokeWidth={0.8} strokeDasharray="2,2"
        />
      )}
    </g>
  );
}

/**
 * Wi-Fi access point: small filled circle base + 3 concentric arcs above it.
 * Coverage halo is drawn separately (see `WapCoverage`).
 */
export function WapSymbol({
  wap, scale, selected, onClick,
}: {
  wap: WapPlacement;
  scale: number;
  selected: boolean;
  onClick?: (e: React.MouseEvent) => void;
}) {
  const approved = wap.approval === "approved";
  const rejected = wap.approval === "rejected";
  const aiPending = wap.approval === "pending" && wap.source === "ai";
  const color = approved ? "#0d6e3a" : rejected ? "#c44a4a" : aiPending ? "#c9931f" : "#5a5e66";

  return (
    <g
      onClick={onClick}
      style={{ cursor: "pointer" }}
      transform={`translate(${wap.x * scale}, ${wap.y * scale}) rotate(-45)`}
    >
      {/* Center dot */}
      <circle cx={0} cy={0} r={2} fill={color} />
      {/* Three Wi-Fi arcs above */}
      <path d="M -3 0 A 3 3 0 0 1 3 0"   fill="none" stroke={color} strokeWidth={1.4} strokeLinecap="round" />
      <path d="M -5.5 0 A 5.5 5.5 0 0 1 5.5 0" fill="none" stroke={color} strokeWidth={1.2} strokeLinecap="round" />
      <path d="M -8 0 A 8 8 0 0 1 8 0"   fill="none" stroke={color} strokeWidth={1.0} strokeLinecap="round" />
      {selected && (
        <circle cx={0} cy={0} r={11} fill="none" stroke="#f6a623" strokeWidth={0.9} strokeDasharray="2,2" />
      )}
    </g>
  );
}

/** Dashed coverage halo drawn under the WAPs */
export function WapCoverage({ wap, scale }: { wap: WapPlacement; scale: number }) {
  // 3.5 ft/grid-unit (approximate). coverageRadiusFt → grid units → px
  const r = wap.coverageRadiusFt / 3.5;
  return (
    <circle
      cx={wap.x * scale} cy={wap.y * scale}
      r={r * scale}
      fill="rgba(13, 110, 58, 0.05)"
      stroke="rgba(13, 110, 58, 0.30)"
      strokeWidth={0.6}
      strokeDasharray="3,2"
      pointerEvents="none"
    />
  );
}

/** Hatched square with TR/IDF label. Used for TR placements drawn over the canvas. */
export function TrSymbol({ x, y, label, scale }: { x: number; y: number; label: string; scale: number }) {
  const S = 6; // grid units
  return (
    <g transform={`translate(${x * scale}, ${y * scale})`}>
      <rect x={-S * scale / 2} y={-S * scale / 2} width={S * scale} height={S * scale} fill="#dbeafe" stroke="#0a3a8c" strokeWidth={1.4} />
      {/* Diagonal corner mark */}
      <line x1={-S * scale / 2} y1={-S * scale / 2} x2={S * scale / 2} y2={S * scale / 2} stroke="#0a3a8c" strokeWidth={0.6} />
      <line x1={-S * scale / 2} y1={ S * scale / 2} x2={S * scale / 2} y2={-S * scale / 2} stroke="#0a3a8c" strokeWidth={0.6} />
      <text x={0} y={2} textAnchor="middle" fontSize={9} fontWeight={600} fill="#0a3a8c"
            style={{ fontFamily: "Inter, sans-serif", pointerEvents: "none" }}>{label}</text>
    </g>
  );
}

/**
 * Ladder cable tray: two parallel rails with regularly-spaced cross rungs.
 * Used for the floor-1 spine. Direction is horizontal for simplicity (TIA standard
 * ICT drawings render trays as long parallel rails along corridor centerlines).
 */
export function LadderTraySegment({
  x1, x2, y, scale, rungSpacing = 2.5, railSpacing = 2,
}: {
  x1: number; x2: number; y: number; scale: number;
  rungSpacing?: number; railSpacing?: number;
}) {
  const yTop = y - railSpacing / 2;
  const yBot = y + railSpacing / 2;
  const rungs: number[] = [];
  for (let x = x1; x <= x2; x += rungSpacing) rungs.push(x);

  return (
    <g pointerEvents="none">
      {/* Top rail */}
      <line x1={x1 * scale} y1={yTop * scale} x2={x2 * scale} y2={yTop * scale}
            stroke="#0a5cad" strokeWidth={1.3} />
      {/* Bottom rail */}
      <line x1={x1 * scale} y1={yBot * scale} x2={x2 * scale} y2={yBot * scale}
            stroke="#0a5cad" strokeWidth={1.3} />
      {/* Rungs */}
      {rungs.map((rx, i) => (
        <line key={i}
          x1={rx * scale} y1={yTop * scale} x2={rx * scale} y2={yBot * scale}
          stroke="#0a5cad" strokeWidth={0.7}
        />
      ))}
      {/* Label */}
      <text x={((x1 + x2) / 2) * scale} y={(yTop - 1.2) * scale}
            textAnchor="middle" fontSize={7} fill="#0a5cad"
            style={{ fontFamily: "JetBrains Mono, monospace" }}>
        12&quot; LADDER TRAY · TIA-569-D
      </text>
    </g>
  );
}
