"use client";

import { CANVAS_W, CANVAS_H } from "@/lib/intake/types";

/**
 * Column grid + grid bubbles — standard architectural notation.
 * Vertical lines labeled A, B, C, … across the top.
 * Horizontal lines labeled 1, 2, 3, … down the left side.
 *
 * Bubble size + label spacing chosen so they're readable but not
 * dominant.
 */
export function ColumnGrid({ scale, padding = 6, spacing = 25 }: { scale: number; padding?: number; spacing?: number }) {
  // X column lines (vertical) — letters across the top
  const xLines: { x: number; label: string }[] = [];
  let letterIdx = 0;
  for (let x = padding; x <= CANVAS_W - padding + 0.001; x += spacing) {
    xLines.push({ x, label: String.fromCharCode(65 + letterIdx) });
    letterIdx++;
  }
  // Y row lines (horizontal) — numbers down the left
  const yLines: { y: number; label: string }[] = [];
  let n = 1;
  for (let y = padding; y <= CANVAS_H - padding + 0.001; y += spacing) {
    yLines.push({ y, label: String(n) });
    n++;
  }

  const BUBBLE_R = 1.6;   // grid units
  const STUB_LEN = 2;     // grid units beyond canvas edge

  return (
    <g pointerEvents="none">
      {/* Vertical grid lines */}
      {xLines.map(({ x, label }) => (
        <g key={"gx_" + x}>
          <line
            x1={x * scale} y1={-STUB_LEN * scale}
            x2={x * scale} y2={CANVAS_H * scale}
            stroke="#9090a0"
            strokeWidth={0.4}
            strokeDasharray="4,2,1,2"
            opacity={0.55}
          />
          {/* Top bubble */}
          <circle cx={x * scale} cy={-(STUB_LEN + BUBBLE_R) * scale} r={BUBBLE_R * scale} fill="white" stroke="#444" strokeWidth={0.8} />
          <text
            x={x * scale} y={-(STUB_LEN + BUBBLE_R) * scale + 3}
            textAnchor="middle" fontSize={9} fontWeight={600} fill="#222"
            style={{ fontFamily: "Inter, sans-serif" }}>
            {label}
          </text>
        </g>
      ))}
      {/* Horizontal grid lines */}
      {yLines.map(({ y, label }) => (
        <g key={"gy_" + y}>
          <line
            x1={-STUB_LEN * scale} y1={y * scale}
            x2={CANVAS_W * scale}    y2={y * scale}
            stroke="#9090a0"
            strokeWidth={0.4}
            strokeDasharray="4,2,1,2"
            opacity={0.55}
          />
          {/* Left bubble */}
          <circle cx={-(STUB_LEN + BUBBLE_R) * scale} cy={y * scale} r={BUBBLE_R * scale} fill="white" stroke="#444" strokeWidth={0.8} />
          <text
            x={-(STUB_LEN + BUBBLE_R) * scale} y={y * scale + 3}
            textAnchor="middle" fontSize={9} fontWeight={600} fill="#222"
            style={{ fontFamily: "Inter, sans-serif" }}>
            {label}
          </text>
        </g>
      ))}
    </g>
  );
}
