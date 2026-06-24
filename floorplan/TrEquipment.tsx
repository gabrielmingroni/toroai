"use client";

import type { ExtractedRoom } from "@/lib/intake/types";

/**
 * Draw equipment inside the TR/MDF room rectangle:
 *   - 2 server racks along one wall
 *   - A patch-panel ladder rack on the opposite wall
 *   - A TMGB ground bar near the entrance
 *   - Label "MDF" (or "IDF") in the center
 */
export function TrEquipment({ room, scale }: { room: ExtractedRoom; scale: number }) {
  const type = room.overrideType ?? room.type;
  if (type !== "mdf" && type !== "idf") return null;
  const isMdf = type === "mdf";

  // Inset by 1 grid unit on each side
  const ix = room.x + 1;
  const iy = room.y + 1;
  const iw = room.w - 2;
  const ih = room.h - 2;

  // Two racks along the right wall, half-depth each (rack ≈ 24"D × 23"W ⇒ small rect)
  const rackW = 2.5;
  const rackH = 1.8;
  const rack1X = ix + iw - rackW - 0.4;
  const rack1Y = iy + 1;
  const rack2X = rack1X;
  const rack2Y = rack1Y + rackH + 0.4;

  // Patch-panel ladder rack along the left wall — represented as a series of thin horizontal lines
  const pX = ix + 0.4;
  const pW = 2.0;
  const pY = iy + 1;
  const pH = ih - 2;
  const panels = 6;

  // TMGB bar — small filled rect bottom-left
  const tmgbW = 1.4;
  const tmgbH = 0.5;
  const tmgbX = ix + 0.5;
  const tmgbY = iy + ih - tmgbH - 0.5;

  return (
    <g pointerEvents="none">
      {/* Patch-panel ladder rack */}
      <rect x={pX * scale} y={pY * scale} width={pW * scale} height={pH * scale}
            fill="none" stroke="#222" strokeWidth={0.6} />
      {Array.from({ length: panels }).map((_, i) => {
        const ty = pY + (i + 0.5) * (pH / panels);
        return (
          <line key={i}
            x1={pX * scale} y1={ty * scale}
            x2={(pX + pW) * scale} y2={ty * scale}
            stroke="#1d4ed8" strokeWidth={0.6}
          />
        );
      })}
      {/* Rack 1 */}
      <rect x={rack1X * scale} y={rack1Y * scale} width={rackW * scale} height={rackH * scale}
            fill="#dbeafe" stroke="#0a3a8c" strokeWidth={0.7} />
      <text x={(rack1X + rackW / 2) * scale} y={(rack1Y + rackH / 2 + 0.3) * scale}
            textAnchor="middle" fontSize={5.5} fontWeight={600} fill="#0a3a8c"
            style={{ fontFamily: "JetBrains Mono, monospace" }}>RK-1</text>
      {/* Rack 2 */}
      <rect x={rack2X * scale} y={rack2Y * scale} width={rackW * scale} height={rackH * scale}
            fill="#dbeafe" stroke="#0a3a8c" strokeWidth={0.7} />
      <text x={(rack2X + rackW / 2) * scale} y={(rack2Y + rackH / 2 + 0.3) * scale}
            textAnchor="middle" fontSize={5.5} fontWeight={600} fill="#0a3a8c"
            style={{ fontFamily: "JetBrains Mono, monospace" }}>RK-2</text>
      {/* TMGB ground bar */}
      <rect x={tmgbX * scale} y={tmgbY * scale} width={tmgbW * scale} height={tmgbH * scale}
            fill="#b8860b" stroke="#5a3f00" strokeWidth={0.4} />
      <text x={(tmgbX + tmgbW + 0.3) * scale} y={(tmgbY + tmgbH) * scale}
            fontSize={4.5} fill="#5a3f00"
            style={{ fontFamily: "JetBrains Mono, monospace" }}>TMGB</text>
      {/* Room type tag (small ribbon in upper-left corner) */}
      <g transform={`translate(${(ix + 0.3) * scale}, ${(iy + 0.3) * scale})`}>
        <rect x={0} y={0} width={4 * scale} height={1.5 * scale} fill="#0a3a8c" />
        <text x={(2) * scale} y={1.1 * scale} textAnchor="middle" fontSize={5.5} fontWeight={700} fill="white"
              style={{ fontFamily: "Inter, sans-serif" }}>
          {isMdf ? "MDF" : "IDF"}
        </text>
      </g>
    </g>
  );
}
