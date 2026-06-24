"use client";

import type { ExtractedRoom } from "@/lib/intake/types";
import type { OutletPlacement, WapPlacement } from "@/lib/placement/types";

/**
 * Cable run visualization — every outlet/WAP gets a routed polyline
 * back to the MDF/IDF on the floor. Approved runs render solid,
 * pending runs dashed, rejected runs hidden.
 *
 * Routing model (simplified for the mock):
 *   - Floor 1 has a tray spine at y=24 along the corridor
 *   - Floor N (N>1) routes directly to the IDF via L-shape
 *   - Each outlet: (outlet) → drop to tray → along tray → drop to TR
 */
export function CableRuns({
  rooms, outlets, waps, scale,
}: {
  rooms: ExtractedRoom[];
  outlets: OutletPlacement[];
  waps: WapPlacement[];
  scale: number;
}) {
  if (!rooms.length) return null;
  const tr = rooms.find(r => (r.overrideType ?? r.type) === "mdf")
          || rooms.find(r => (r.overrideType ?? r.type) === "idf");
  if (!tr) return null;

  const floor = rooms[0].floor;
  const trayY = floor === 1 ? 24 : null;
  const trCx = tr.x + tr.w / 2;
  const trCy = tr.y + tr.h / 2;

  function pathFor(x: number, y: number): string {
    // If tray present and the source is on the opposite side of the tray
    // from the TR, route via tray; otherwise direct L-route.
    if (trayY !== null) {
      const pts: [number, number][] = [
        [x, y],
        [x, trayY],
        [trCx, trayY],
        [trCx, trCy],
      ];
      return pts.map((p, i) => (i === 0 ? "M" : "L") + " " + (p[0] * scale).toFixed(1) + " " + (p[1] * scale).toFixed(1)).join(" ");
    }
    // No tray — L-route at outlet's Y
    return `M ${x * scale} ${y * scale} L ${trCx * scale} ${y * scale} L ${trCx * scale} ${trCy * scale}`;
  }

  function strokeFor(state: "approved" | "rejected" | "pending"): { color: string; dash: string | undefined; opacity: number } {
    if (state === "approved") return { color: "#1d4ed8", dash: undefined, opacity: 0.55 };
    if (state === "rejected") return { color: "#c44a4a", dash: "1,3", opacity: 0.0 };
    return { color: "#c9931f", dash: "2,2", opacity: 0.45 };
  }

  return (
    <g pointerEvents="none">
      {/* Cable runs — drawn underneath outlets/WAPs so the symbols overlay them */}
      {outlets.map((o) => {
        const { color, dash, opacity } = strokeFor(o.approval);
        if (opacity === 0) return null;
        return (
          <path
            key={"r_o_" + o.id}
            d={pathFor(o.x, o.y)}
            fill="none"
            stroke={color}
            strokeWidth={0.5}
            strokeDasharray={dash}
            opacity={opacity}
          />
        );
      })}
      {waps.map((w) => {
        const { color, dash, opacity } = strokeFor(w.approval);
        if (opacity === 0) return null;
        return (
          <path
            key={"r_w_" + w.id}
            d={pathFor(w.x, w.y)}
            fill="none"
            stroke={color}
            strokeWidth={0.5}
            strokeDasharray={dash}
            opacity={opacity * 0.85}
          />
        );
      })}
    </g>
  );
}
