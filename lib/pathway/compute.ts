// Pathway computations — segment length, channel length, TIA-568 validation,
// and material BOM rollup. All inputs use the floor-plan grid where 1 unit
// ≈ 1 ft, so polyline distances ≈ feet without conversion.

import type {
  PathwaySegment, CableRun, CableRunValidation, PathwayMaterials,
  RunStatus, PathwayNode,
} from "./types";
import {
  TIA568_MAX_FT, TIA568_WARN_FT, BICSI_SLACK_FT, OUTLET_HEIGHT_AFF_FT,
} from "./types";

// ── Geometry helpers ─────────────────────────────────────────────────────

function dist(a: PathwayNode, b: PathwayNode): number {
  const dx = b.x - a.x, dy = b.y - a.y;
  return Math.hypot(dx, dy);
}

/** Total polyline length for one pathway segment, in ft. */
export function segmentLengthFt(seg: PathwaySegment): number {
  if (seg.type === "riser") {
    // For risers the horizontal polyline is decorative — actual length is the
    // floor-to-floor delta (assume 12 ft per floor as a defensible default).
    const floors = Math.abs((seg.toFloor ?? seg.fromFloor ?? seg.floor) - (seg.fromFloor ?? seg.floor));
    return floors * 12;
  }
  let total = 0;
  for (let i = 1; i < seg.nodes.length; i++) {
    total += dist(seg.nodes[i - 1], seg.nodes[i]);
  }
  return total;
}

// ── Cable run length ─────────────────────────────────────────────────────

/**
 * Total channel length for a cable run:
 *   = drop at outlet (pathway height − outlet height)
 *   + sum of segment polyline lengths
 *   + drop at TR end (back down to patch panel — assume same drop magnitude)
 *   + BICSI 10 ft slack
 *
 * The outlet-end drop is computed from the first segment in the run; if the
 * pathway has multiple segments at different heights, we use the average.
 */
export function runLengthFt(run: CableRun, segments: PathwaySegment[]): number {
  if (run.lengthOverrideFt !== undefined) return run.lengthOverrideFt;

  const segs = run.segmentIds
    .map(id => segments.find(s => s.id === id))
    .filter((s): s is PathwaySegment => !!s);
  if (segs.length === 0) return 0;

  const horizontal = segs.reduce((sum, s) => sum + segmentLengthFt(s), 0);
  const avgHeight = segs.reduce((sum, s) => sum + s.heightFt, 0) / segs.length;
  const dropPerEnd = Math.max(0, avgHeight - OUTLET_HEIGHT_AFF_FT);
  return horizontal + dropPerEnd * 2 + BICSI_SLACK_FT;
}

// ── TIA-568 validation ───────────────────────────────────────────────────

export function validateRun(run: CableRun, segments: PathwaySegment[]): CableRunValidation {
  const lengthFt = runLengthFt(run, segments);
  let status: RunStatus = "pass";
  let reason: string | undefined;
  if (lengthFt > TIA568_MAX_FT) {
    status = "fail";
    reason = `Exceeds TIA-568 90 m horizontal limit (${lengthFt.toFixed(1)} ft > ${TIA568_MAX_FT} ft). Reroute through a closer TR or add an IDF.`;
  } else if (lengthFt > TIA568_WARN_FT) {
    status = "warn";
    reason = `Within 33 ft of the TIA-568 90 m limit (${lengthFt.toFixed(1)} ft). Consider rerouting before adding outlets to this run.`;
  }
  return { runId: run.id, lengthFt, status, reason };
}

export function validateAllRuns(runs: CableRun[], segments: PathwaySegment[]): CableRunValidation[] {
  return runs.map(r => validateRun(r, segments));
}

// ── Material BOM rollup ──────────────────────────────────────────────────

const J_HOOK_SPACING_FT = 5;     // BICSI-recommended J-hook spacing

export function materialRollup(segments: PathwaySegment[], runs: CableRun[]): PathwayMaterials {
  const trayLfByWidth: Record<string, number>     = {};
  const conduitLfBySize: Record<string, number>   = {};
  const cableLfByType: Record<string, number>     = {};
  let jHookCount = 0;
  let riserLf = 0;

  for (const s of segments) {
    const lf = segmentLengthFt(s);
    if (s.type === "cable_tray") {
      const key = String(s.trayWidthIn ?? 12);
      trayLfByWidth[key] = (trayLfByWidth[key] ?? 0) + lf;
    } else if (s.type === "conduit") {
      const key = s.conduitSize ?? "1";
      conduitLfBySize[key] = (conduitLfBySize[key] ?? 0) + lf;
    } else if (s.type === "j_hook") {
      jHookCount += Math.ceil(lf / J_HOOK_SPACING_FT);
    } else if (s.type === "riser") {
      riserLf += lf;
    }
  }

  for (const r of runs) {
    const lf = runLengthFt(r, segments);
    cableLfByType[r.cableType] = (cableLfByType[r.cableType] ?? 0) + lf;
  }

  return { trayLfByWidth, conduitLfBySize, jHookCount, riserLf, cableLfByType };
}

// ── Status counts (useful for dashboard / project page) ──────────────────

export interface RunStatusCounts { pass: number; warn: number; fail: number; total: number }

export function countByStatus(validations: CableRunValidation[]): RunStatusCounts {
  const c: RunStatusCounts = { pass: 0, warn: 0, fail: 0, total: validations.length };
  for (const v of validations) c[v.status] += 1;
  return c;
}
