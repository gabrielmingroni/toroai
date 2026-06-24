// Cable run from-to schedule generator.
//
// This is the document cable installers actually pull cable against. Each row
// is one horizontal cable run with: TIA-606-C hierarchical label, source
// (TR/rack/U/port), destination (outlet ID / floor / room), cable type,
// computed length (horizontal pathway + drop + 10 ft slack per BICSI TDMM),
// and TIA-568 channel-length status.
//
// Algorithm: for each outlet, assign to the nearest suggested TR within
// reach, route through a notional ceiling tray at 10 ft AFF + drop to outlet
// at 1.5 ft AFF, sum the geometry. If no TR within 295 ft, flag as fail.

import type { ExtractedRoom } from "@/lib/intake/types";
import type { OutletPlacement } from "@/lib/placement/types";
import type { TrSuggestion } from "./tr-suggester";

/** Mounting heights per BICSI TDMM. */
const CEILING_PATHWAY_HEIGHT_FT = 10;
const OUTLET_HEIGHT_AFF_FT     = 1.5;
const BICSI_SLACK_FT           = 10;
const TIA568_MAX_FT            = 295;

export interface CableScheduleRow {
  /** TIA-606-C label, e.g. "1-A-001". */
  label: string;
  /** Source TR label (e.g. "MDF" or "IDF-A"). */
  sourceTrLabel: string;
  /** Rack + U + port at source. */
  sourceRack: string;
  sourcePort: string;
  /** Destination outlet. */
  outletId: string;
  /** Floor + room of the destination. */
  destFloor: number;
  destRoomName: string;
  /** Cable type — Cat 6A horizontal by default, OS2 fiber for backbone. */
  cableType: "Cat 6A" | "Cat 6" | "OS2 SM" | "OM4 MM";
  /** Computed length: drop at outlet + horizontal pathway + drop at TR + slack. */
  lengthFt: number;
  /** Channel-budget status. */
  status: "pass" | "warn" | "fail";
  reason?: string;
}

export interface CableScheduleResult {
  rows: CableScheduleRow[];
  /** Sum of all cable lengths. */
  totalCableLf: number;
  /** Stats. */
  stats: { pass: number; warn: number; fail: number; total: number };
  generatedAt: string;
}

// ── Helpers ──────────────────────────────────────────────────────────────

function dist(ax: number, ay: number, bx: number, by: number): number {
  return Math.hypot(ax - bx, ay - by);
}

function roomNameFor(rooms: ExtractedRoom[], roomId: string | null): string {
  if (!roomId) return "—";
  const r = rooms.find(x => x.id === roomId);
  return r ? (r.overrideName ?? r.name) : roomId;
}

/** Manhattan-route distance (along corridor + drop) — approximates a real
 *  cable-tray pull. We add the two vertical drops + slack. */
function channelLengthFt(
  outlet: { x: number; y: number }, tr: { x: number; y: number },
): number {
  const horizontal = Math.abs(outlet.x - tr.x) + Math.abs(outlet.y - tr.y);
  const dropPerEnd = CEILING_PATHWAY_HEIGHT_FT - OUTLET_HEIGHT_AFF_FT;
  return horizontal + dropPerEnd * 2 + BICSI_SLACK_FT;
}

// ── Main entry ───────────────────────────────────────────────────────────

export interface BuildCableScheduleInput {
  rooms: ExtractedRoom[];
  outlets: OutletPlacement[];
  trSuggestions: TrSuggestion[];
}

export function buildCableSchedule(input: BuildCableScheduleInput): CableScheduleResult {
  const rows: CableScheduleRow[] = [];
  const portsByTr: Record<string, number> = {};

  // Sort outlets in a stable order so labels are deterministic.
  const sorted = [...input.outlets].sort((a, b) => {
    if (a.floor !== b.floor) return a.floor - b.floor;
    if (a.y !== b.y) return a.y - b.y;
    return a.x - b.x;
  });

  for (const outlet of sorted) {
    // Assign outlet to nearest TR on the same floor.
    const sameFloorTrs = input.trSuggestions.filter(t => t.candidate.floor === outlet.floor);
    let bestTr: TrSuggestion | null = null;
    let bestDist = Infinity;
    for (const t of sameFloorTrs) {
      const d = dist(t.candidate.x, t.candidate.y, outlet.x, outlet.y);
      if (d < bestDist) { bestDist = d; bestTr = t; }
    }
    // Fall back to any TR if none on the same floor.
    if (!bestTr) {
      for (const t of input.trSuggestions) {
        const d = dist(t.candidate.x, t.candidate.y, outlet.x, outlet.y);
        if (d < bestDist) { bestDist = d; bestTr = t; }
      }
    }
    if (!bestTr) continue;

    // Compute channel length.
    const lengthFt = channelLengthFt(outlet, bestTr.candidate);
    let status: CableScheduleRow["status"] = "pass";
    let reason: string | undefined;
    if (lengthFt > TIA568_MAX_FT) { status = "fail"; reason = `Channel length ${lengthFt.toFixed(0)} ft exceeds TIA-568 295 ft limit.`; }
    else if (lengthFt > 262) { status = "warn"; reason = `Channel length ${lengthFt.toFixed(0)} ft within 33 ft of TIA-568 limit.`; }

    // Assign a port within this TR. Port = sequential per TR.
    const portIdx = (portsByTr[bestTr.label] ?? 0) + 1;
    portsByTr[bestTr.label] = portIdx;

    // TIA-606-C hierarchical label.
    // Format: <floor>-<TR letter>-<port>
    const trLetter = bestTr.label === "MDF" ? "M" : bestTr.label.split("-")[1] ?? "I";
    const label = `${outlet.floor}-${trLetter}-${portIdx.toString().padStart(3, "0")}`;

    // Rack + U placement — assume 1 rack per TR, 24-port panels stacked U22, U23, U24…
    const panelIdx = Math.ceil(portIdx / 24);
    const portInPanel = ((portIdx - 1) % 24) + 1;
    const sourceRack = `${bestTr.label}-R1`;
    const sourcePort = `U${22 + panelIdx}-P${portInPanel.toString().padStart(2, "0")}`;

    rows.push({
      label,
      sourceTrLabel: bestTr.label,
      sourceRack,
      sourcePort,
      outletId: outlet.id,
      destFloor: outlet.floor,
      destRoomName: roomNameFor(input.rooms, outlet.roomId),
      cableType: "Cat 6A",
      lengthFt: Math.round(lengthFt * 10) / 10,
      status,
      reason,
    });
  }

  const totalCableLf = rows.reduce((s, r) => s + r.lengthFt, 0);
  const stats = {
    pass: rows.filter(r => r.status === "pass").length,
    warn: rows.filter(r => r.status === "warn").length,
    fail: rows.filter(r => r.status === "fail").length,
    total: rows.length,
  };

  return {
    rows,
    totalCableLf: Math.round(totalCableLf),
    stats,
    generatedAt: new Date().toISOString(),
  };
}
