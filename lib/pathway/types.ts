// Pathway domain — cable trays, conduits, J-hooks, and risers that physically
// carry the telecom cables from outlets to the telecom rooms.
//
// Without an explicit pathway model the BOM under-counts the carrier (tray
// sections, conduit, fittings, J-hooks — easily 15–30 % of installed cost)
// AND the TIA-568 90 m horizontal rule cannot be validated. Both are the
// reason this is a P0 feature.
//
// Coordinate system: same 145 × 82 grid as the rest of the floor plan, with
// 1 grid unit ≈ 1 ft. Heights are in feet above finished floor (AFF).

// ── Pathway carrier types ────────────────────────────────────────────────

export type PathwayType =
  | "cable_tray"   // overhead ladder/basket/wire-basket — for bulk runs
  | "conduit"      // EMT/IMC/RMC raceway — for in-wall or branch runs
  | "j_hook"       // discrete saddle hangers — low-density support
  | "riser";       // vertical between floors (sleeves, slots, sleeves+penetrations)

export const PATHWAY_TYPE_LABEL: Record<PathwayType, string> = {
  cable_tray: "Cable tray",
  conduit:    "Conduit",
  j_hook:     "J-hook run",
  riser:      "Riser",
};

/** Display color per pathway type — used in canvas + legend + list. */
export const PATHWAY_TYPE_TONE: Record<PathwayType, string> = {
  cable_tray: "text-accent",
  conduit:    "text-info",
  j_hook:     "text-warn",
  riser:      "text-pass",
};

// ── Cable types — what the pathway carries ───────────────────────────────

export type CableType = "cat6" | "cat6a" | "om4_fiber" | "om5_fiber";

export const CABLE_TYPE_LABEL: Record<CableType, string> = {
  cat6:      "Cat 6",
  cat6a:     "Cat 6A",
  om4_fiber: "OM4 fiber",
  om5_fiber: "OM5 fiber",
};

// ── Geometry ─────────────────────────────────────────────────────────────

export interface PathwayNode {
  /** Grid coordinates (ft). */
  x: number;
  y: number;
}

/**
 * A pathway segment is a polyline of one or more straight runs. Each leg is
 * the line between consecutive nodes. Adjacency to outlets / TRs is computed
 * separately by joining to the placement store via the cable run.
 */
export interface PathwaySegment {
  id: string;
  type: PathwayType;
  nodes: PathwayNode[];
  floor: number;
  /** Mounting height above finished floor (ft). Used to compute drop length. */
  heightFt: number;
  /** Tray-only: width in inches (typical 6, 12, 18, 24). */
  trayWidthIn?: number;
  /** Conduit-only: nominal trade size (e.g. "3/4", "1", "1-1/4", "2"). */
  conduitSize?: string;
  /** Riser-only: connected floor numbers. */
  fromFloor?: number;
  toFloor?: number;
  /** Optional label rendered next to the pathway. */
  label?: string;
  source: "ai" | "rcdd";
  createdAt: string;
}

// ── Cable runs — outlet ↔ TR via pathway segments ────────────────────────

/** Length & code-compliance computed per cable run. */
export type RunStatus = "pass" | "warn" | "fail";

/**
 * Endpoint for a cable run. In production this is a join key into the
 * placement store; for seed data we keep positions denormalized so the
 * pathway view is self-contained.
 */
export interface RunEndpoint {
  id: string;
  x: number;
  y: number;
  floor: number;
  label: string;
}

export interface CableRun {
  id: string;
  outlet: RunEndpoint;
  tr: RunEndpoint;
  /** Pathway segments traversed, in order from outlet → TR. */
  segmentIds: string[];
  cableType: CableType;
  /** Optional override of the computed length (rare — typically derived). */
  lengthOverrideFt?: number;
  /** Stable label used on schedules + drawings (TIA-606 hierarchical). */
  label: string;
  createdAt: string;
}

export interface CableRunValidation {
  runId: string;
  /** Total channel length in ft (drops + horizontal pathway + slack). */
  lengthFt: number;
  status: RunStatus;
  /** Human-readable reason for warn/fail. */
  reason?: string;
}

// ── Material BOM rollup ──────────────────────────────────────────────────

/** Summary of carrier + cable consumed across all pathway segments / runs. */
export interface PathwayMaterials {
  /** Linear feet of cable tray, keyed by width in inches ("12", "18", "24"). */
  trayLfByWidth: Record<string, number>;
  /** Linear feet of conduit, keyed by trade size ("3/4", "1", …). */
  conduitLfBySize: Record<string, number>;
  /** Total J-hook count (1 hook per ~5 ft of j_hook pathway). */
  jHookCount: number;
  /** Riser feet (penetration count proxied separately). */
  riserLf: number;
  /** Cable LF by cable type — for the cable spool BOM. */
  cableLfByType: Record<string, number>;
}

// ── Aggregate state ──────────────────────────────────────────────────────

export interface PathwayState {
  projectId: string;
  segments: PathwaySegment[];
  runs: CableRun[];
  updatedAt: string;
}

export interface PathwayResponse {
  ok: boolean;
  state?: PathwayState;
  validations?: CableRunValidation[];
  materials?: PathwayMaterials;
  error?: { code: string; message: string };
}

// ── TIA-568 constants ────────────────────────────────────────────────────

/** Hard limit per ANSI/TIA-568.2-D for horizontal cable channel length. */
export const TIA568_MAX_FT = 295;        // ~90 m
/** Warning threshold — getting close to the limit. */
export const TIA568_WARN_FT = 262;       // ~80 m
/** Recommended service-loop / slack per BICSI TDMM. */
export const BICSI_SLACK_FT = 10;
/** Default outlet faceplate height above finished floor. */
export const OUTLET_HEIGHT_AFF_FT = 1.5;
