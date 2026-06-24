// TR location suggester.
//
// Given a building's intake rooms (and optionally placed outlets), suggest
// where MDF and IDFs should sit so that every work-area outlet stays within
// the TIA-568 90 m (≈ 295 ft) horizontal-cabling radius of an assigned TR.
//
// Approach — greedy coverage clustering:
//   1. Identify "demand points" — either placed outlets, or room centroids
//      weighted by room area (proxy for outlet density).
//   2. Identify "candidate TR sites" — rooms of type electrical / storage /
//      mechanical / corridor that could be repurposed as a TR, plus the
//      raw demand-point set as fallbacks.
//   3. Repeatedly: pick the candidate site covering the most uncovered
//      demand within the 90 m radius. Mark those demand points covered.
//      Continue until all demand is covered or candidate set exhausted.
//   4. The first TR placed is the MDF (sized for the largest demand pool);
//      subsequent TRs are IDFs.
//   5. Validate: report the worst-case run-length per TR and flag any
//      uncovered demand.
//
// All distances are in floor-plan grid units where 1 unit ≈ 1 ft.

import type { ExtractedRoom } from "@/lib/intake/types";

/** TIA-568.2-D §4.2.5 — 90 m max horizontal-cable channel = 295 ft. */
export const TR_COVERAGE_RADIUS_FT = 295;

/** Room types we'd prefer to repurpose as a TR. Ranked best-first. */
const PREFERRED_TR_ROOM_TYPES = [
  "electrical", "mechanical", "storage", "corridor",
] as const;

export interface DemandPoint {
  /** Stable ID — either an outlet ID or `room:<id>` for a room centroid. */
  id: string;
  x: number;
  y: number;
  floor: number;
  /** Demand weight — number of outlets this point represents. */
  weight: number;
  source: "outlet" | "room-centroid";
}

export interface TrCandidate {
  /** Either an existing room (preferred) or a synthetic point. */
  kind: "room" | "synthetic";
  /** roomId when kind = room; null for synthetic. */
  roomId: string | null;
  /** Where the TR would physically sit. */
  x: number;
  y: number;
  floor: number;
  /** Why this candidate exists (room type, fallback, etc.). */
  rationale: string;
}

export interface TrSuggestion {
  /** Stable label — "MDF" or "IDF-A", "IDF-B", … */
  label: string;
  kind: "mdf" | "idf";
  candidate: TrCandidate;
  /** IDs of demand points this TR serves. */
  servedDemandIds: string[];
  /** Number of outlets served (sum of weights). */
  outletsServed: number;
  /** Worst-case (max) distance from this TR to any served outlet. */
  worstCaseFt: number;
  /** TIA-568 validation against the 295 ft horizontal cable rule. */
  withinTia568: boolean;
}

export interface TrSuggestionResult {
  suggestions: TrSuggestion[];
  /** Demand points NOT covered — none if the algorithm succeeded. */
  uncovered: DemandPoint[];
  /** Total outlets / rooms considered. */
  totalDemand: number;
  /** Summary statistics. */
  stats: {
    coveragePct: number;
    mdfCount: number;
    idfCount: number;
    maxWorstCaseFt: number;
  };
}

// ── Helpers ──────────────────────────────────────────────────────────────

function dist(ax: number, ay: number, bx: number, by: number): number {
  return Math.hypot(ax - bx, ay - by);
}

function roomCenter(r: ExtractedRoom): { x: number; y: number } {
  return { x: r.x + r.w / 2, y: r.y + r.h / 2 };
}

/** A rough proxy for outlet count if no outlets are placed yet — 1 outlet
 *  per 100 SF for office space, 1 per 150 for support spaces. */
function estimatedOutletDemand(r: ExtractedRoom): number {
  const t = r.overrideType ?? r.type;
  if (["open_office", "private_office", "conference", "classroom",
       "patient_room", "exam_room", "lab", "reception"].includes(t)) {
    return Math.max(1, Math.ceil(r.area / 100));
  }
  if (["storage", "kitchen", "stairwell", "elevator", "restroom"].includes(t)) {
    return 0; // No work-area outlets needed
  }
  // Unknown / corridor / mechanical / electrical etc — minimal demand.
  return Math.max(0, Math.ceil(r.area / 800));
}

// ── Main entry ───────────────────────────────────────────────────────────

export interface SuggestTrInput {
  rooms: ExtractedRoom[];
  /** Optional — when outlets are placed, use them as demand points directly. */
  outletPositions?: Array<{ id: string; x: number; y: number; floor: number }>;
  /** Maximum radius from a TR to any served outlet. Defaults to TIA-568. */
  coverageRadiusFt?: number;
}

export function suggestTrLocations(input: SuggestTrInput): TrSuggestionResult {
  const radius = input.coverageRadiusFt ?? TR_COVERAGE_RADIUS_FT;
  const floors = [...new Set(input.rooms.map(r => r.floor))].sort();

  // ── Build demand points across all floors ────────────────────────────
  const demand: DemandPoint[] = [];
  if (input.outletPositions && input.outletPositions.length > 0) {
    // Outlets are placed — use them as 1-weight demand points.
    for (const o of input.outletPositions) {
      demand.push({ id: o.id, x: o.x, y: o.y, floor: o.floor, weight: 1, source: "outlet" });
    }
  } else {
    // No outlets yet — synthesize demand from room centroids weighted by area.
    for (const r of input.rooms.filter(r => !r.excluded)) {
      const w = estimatedOutletDemand(r);
      if (w === 0) continue;
      const c = roomCenter(r);
      demand.push({ id: "room:" + r.id, x: c.x, y: c.y, floor: r.floor, weight: w, source: "room-centroid" });
    }
  }

  // ── Build candidate TR sites ─────────────────────────────────────────
  // Preferred sites: rooms whose type matches PREFERRED_TR_ROOM_TYPES.
  // Fallbacks: any of the demand points themselves (synthetic TR location).
  const candidates: TrCandidate[] = [];
  for (const r of input.rooms.filter(r => !r.excluded)) {
    const t = r.overrideType ?? r.type;
    if (PREFERRED_TR_ROOM_TYPES.includes(t as typeof PREFERRED_TR_ROOM_TYPES[number])) {
      const c = roomCenter(r);
      candidates.push({
        kind: "room", roomId: r.id, x: c.x, y: c.y, floor: r.floor,
        rationale: `Repurpose ${r.overrideName ?? r.name} (${t}) as TR — ${Math.round(r.area)} SF available.`,
      });
    }
  }
  // Add synthetic candidates at demand-point locations (in case no preferred room exists).
  for (const d of demand) {
    candidates.push({
      kind: "synthetic", roomId: null, x: d.x, y: d.y, floor: d.floor,
      rationale: "Synthetic TR location at demand-point centroid (no electrical/storage room nearby).",
    });
  }

  // ── Greedy coverage clustering, floor by floor ───────────────────────
  const suggestions: TrSuggestion[] = [];
  const uncovered: DemandPoint[] = [];
  let mdfPlaced = false;
  let idfLetter = 65;   // 'A'

  for (const floor of floors) {
    const floorDemand = demand.filter(d => d.floor === floor);
    const remaining = new Set(floorDemand.map(d => d.id));
    const floorCandidates = candidates.filter(c => c.floor === floor);

    while (remaining.size > 0) {
      // Score each candidate: count of remaining demand within radius.
      let best: { cand: TrCandidate; served: string[]; weight: number; worst: number } | null = null;
      for (const c of floorCandidates) {
        const served: string[] = [];
        let worst = 0;
        let weight = 0;
        for (const id of remaining) {
          const d = floorDemand.find(x => x.id === id)!;
          const distFt = dist(c.x, c.y, d.x, d.y);
          if (distFt <= radius) {
            served.push(id);
            weight += d.weight;
            if (distFt > worst) worst = distFt;
          }
        }
        if (served.length > 0 && (!best || weight > best.weight)) {
          best = { cand: c, served, weight, worst };
        }
      }
      if (!best) {
        // No candidate can reach any remaining demand — mark as uncovered.
        for (const id of remaining) {
          const d = floorDemand.find(x => x.id === id)!;
          uncovered.push(d);
        }
        break;
      }

      // Place a TR at this candidate. First overall = MDF.
      const isMdf = !mdfPlaced;
      const label = isMdf ? "MDF" : ("IDF-" + String.fromCharCode(idfLetter++));
      suggestions.push({
        label,
        kind: isMdf ? "mdf" : "idf",
        candidate: best.cand,
        servedDemandIds: best.served,
        outletsServed: best.weight,
        worstCaseFt: best.worst,
        withinTia568: best.worst <= radius,
      });
      mdfPlaced = true;
      for (const id of best.served) remaining.delete(id);
    }
  }

  // ── Stats ────────────────────────────────────────────────────────────
  const totalDemand = demand.reduce((s, d) => s + d.weight, 0);
  const servedTotal = suggestions.reduce((s, t) => s + t.outletsServed, 0);
  const coveragePct = totalDemand === 0 ? 100 : (servedTotal / totalDemand) * 100;
  const maxWorstCaseFt = suggestions.length === 0 ? 0
    : Math.max(...suggestions.map(s => s.worstCaseFt));

  return {
    suggestions,
    uncovered,
    totalDemand,
    stats: {
      coveragePct: Math.round(coveragePct * 10) / 10,
      mdfCount: suggestions.filter(s => s.kind === "mdf").length,
      idfCount: suggestions.filter(s => s.kind === "idf").length,
      maxWorstCaseFt: Math.round(maxWorstCaseFt),
    },
  };
}
