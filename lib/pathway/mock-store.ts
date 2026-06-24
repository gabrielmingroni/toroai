// In-memory pathway store, keyed by projectId.
// Lazily seeds a realistic example layout on first access so the editor
// renders meaningful content without depending on the intake or placement
// flows being run first.

import { randomBytes } from "crypto";
import type {
  PathwayState, PathwaySegment, CableRun, RunEndpoint,
} from "./types";

function id(prefix: string) { return prefix + "_" + randomBytes(4).toString("hex"); }

// ── Seed layout ──────────────────────────────────────────────────────────
//
// Floor coordinate system: 145 × 82, 1 unit ≈ 1 ft (matches floor-plan grid).
//
// The seeded layout below depicts a single-story office floor with:
//   ▸ MDF in the upper-left at (12, 24)
//   ▸ IDF-A at the far east end at (132, 24)
//   ▸ A 24" cable tray spine running the full corridor at y=24
//   ▸ Branch trays into wings
//   ▸ Conduit risers from outlet locations
//   ▸ 8 cable runs of varying lengths — three of them designed to trip the
//     TIA-568 90 m thresholds so the validation panel does real work
//
// Producing a *failing* run requires ~300 ft of total length. We achieve
// that by routing one run from the far east end of the building back to the
// MDF (most of the floor traversed), plus drops and slack.

function seedSegments(): PathwaySegment[] {
  const now = new Date().toISOString();
  return [
    // Main horizontal cable-tray spine — 24" tray @ 10 ft AFF, full length of floor
    {
      id: "seg_spine",
      type: "cable_tray",
      nodes: [{ x: 12, y: 24 }, { x: 132, y: 24 }],
      floor: 1,
      heightFt: 10,
      trayWidthIn: 24,
      label: "Tray-MAIN · 24\" ladder",
      source: "ai",
      createdAt: now,
    },
    // North branch — 12" tray into the north wing
    {
      id: "seg_north",
      type: "cable_tray",
      nodes: [{ x: 60, y: 24 }, { x: 60, y: 10 }, { x: 90, y: 10 }],
      floor: 1,
      heightFt: 10,
      trayWidthIn: 12,
      label: "Tray-N · 12\" ladder",
      source: "ai",
      createdAt: now,
    },
    // South branch — 12" tray into the south wing
    {
      id: "seg_south",
      type: "cable_tray",
      nodes: [{ x: 40, y: 24 }, { x: 40, y: 60 }],
      floor: 1,
      heightFt: 10,
      trayWidthIn: 12,
      label: "Tray-S · 12\" ladder",
      source: "ai",
      createdAt: now,
    },
    // J-hook run for low-density utility branch
    {
      id: "seg_jhook_e",
      type: "j_hook",
      nodes: [{ x: 110, y: 24 }, { x: 110, y: 55 }, { x: 125, y: 55 }],
      floor: 1,
      heightFt: 10,
      label: "J-hook-E · 5 ft spacing",
      source: "ai",
      createdAt: now,
    },
    // EMT conduit from MDF into the lab
    {
      id: "seg_conduit_mdf",
      type: "conduit",
      nodes: [{ x: 12, y: 24 }, { x: 12, y: 50 }, { x: 28, y: 50 }],
      floor: 1,
      heightFt: 10,
      conduitSize: "2",
      label: "Conduit-MDF · 2\" EMT",
      source: "rcdd",
      createdAt: now,
    },
  ];
}

// Endpoints for the seeded cable runs. Position used to draw drops on the canvas.
const MDF: RunEndpoint  = { id: "tr_mdf",  x: 12,  y: 24, floor: 1, label: "MDF"    };
const IDFA: RunEndpoint = { id: "tr_idfa", x: 132, y: 24, floor: 1, label: "IDF-A"  };

function makeOutlet(id: string, x: number, y: number, label: string): RunEndpoint {
  return { id, x, y, floor: 1, label };
}

function seedRuns(): CableRun[] {
  const now = new Date().toISOString();
  return [
    // North-wing office outlet → MDF via spine (typical pass)
    {
      id: id("run"),
      outlet: makeOutlet("o_n1", 88, 12, "1-N-A01"),
      tr:     MDF,
      segmentIds: ["seg_north", "seg_spine"],
      cableType: "cat6a",
      label: "1-N-A01 → MDF",
      createdAt: now,
    },
    // South-wing patient room → MDF (typical pass)
    {
      id: id("run"),
      outlet: makeOutlet("o_s1", 42, 56, "1-S-A02"),
      tr:     MDF,
      segmentIds: ["seg_south", "seg_spine"],
      cableType: "cat6a",
      label: "1-S-A02 → MDF",
      createdAt: now,
    },
    // Lab outlet → MDF via dedicated conduit (short, pass)
    {
      id: id("run"),
      outlet: makeOutlet("o_lab", 30, 50, "1-L-B01"),
      tr:     MDF,
      segmentIds: ["seg_conduit_mdf"],
      cableType: "om4_fiber",
      label: "1-L-B01 → MDF (fiber)",
      createdAt: now,
    },
    // East patient room → IDF-A (close — pass)
    {
      id: id("run"),
      outlet: makeOutlet("o_e1", 122, 18, "1-E-A03"),
      tr:     IDFA,
      segmentIds: ["seg_spine"],
      cableType: "cat6a",
      label: "1-E-A03 → IDF-A",
      createdAt: now,
    },
    // East utility outlet via J-hook to IDF-A (medium pass)
    {
      id: id("run"),
      outlet: makeOutlet("o_e2", 125, 55, "1-E-B04"),
      tr:     IDFA,
      segmentIds: ["seg_jhook_e", "seg_spine"],
      cableType: "cat6",
      label: "1-E-B04 → IDF-A",
      createdAt: now,
    },
    // South-wing outlet → IDF-A via south branch then full spine (WARN).
    // Override length includes measured vertical jogs around the south-wing
    // ductwork that the simple 2D path doesn't capture.
    {
      id: id("run"),
      outlet: makeOutlet("o_s2", 40, 58, "1-S-C01"),
      tr:     IDFA,
      segmentIds: ["seg_south", "seg_spine"],
      cableType: "cat6a",
      label: "1-S-C01 → IDF-A  ⚠",
      lengthOverrideFt: 278,    // 80–90 m band → WARN
      createdAt: now,
    },
    // North-wing remote outlet → MDF — too far. Demonstrates a FAIL that
    // would require either rerouting to IDF-A or adding a new IDF.
    {
      id: id("run"),
      outlet: makeOutlet("o_n2", 92, 8, "1-N-C02"),
      tr:     MDF,
      segmentIds: ["seg_north", "seg_spine"],
      cableType: "cat6a",
      label: "1-N-C02 → MDF  ✕ over 90 m",
      lengthOverrideFt: 318,    // > 90 m → FAIL
      createdAt: now,
    },
    // Conference-room outlet → MDF via short south branch (pass)
    {
      id: id("run"),
      outlet: makeOutlet("o_c1", 40, 36, "1-C-A05"),
      tr:     MDF,
      segmentIds: ["seg_south", "seg_spine"],
      cableType: "cat6a",
      label: "1-C-A05 → MDF",
      createdAt: now,
    },
  ];
}

// ── Store ────────────────────────────────────────────────────────────────

const byProject = new Map<string, PathwayState>();

function ensure(projectId: string): PathwayState {
  let s = byProject.get(projectId);
  if (!s) {
    s = {
      projectId,
      segments: seedSegments(),
      runs: seedRuns(),
      updatedAt: new Date().toISOString(),
    };
    byProject.set(projectId, s);
  }
  return s;
}

export const pathwayStore = {
  get(projectId: string): PathwayState {
    return ensure(projectId);
  },
  reset(projectId: string): void {
    byProject.delete(projectId);
  },
  addSegment(projectId: string, seg: Omit<PathwaySegment, "id" | "createdAt">): PathwaySegment {
    const s = ensure(projectId);
    const full: PathwaySegment = { ...seg, id: id("seg"), createdAt: new Date().toISOString() };
    s.segments.push(full);
    s.updatedAt = new Date().toISOString();
    return full;
  },
  updateSegment(
    projectId: string,
    segmentId: string,
    patch: Partial<Pick<PathwaySegment,
      "nodes" | "heightFt" | "trayWidthIn" | "conduitSize" | "label" | "fromFloor" | "toFloor"
    >>,
  ): PathwaySegment | undefined {
    const s = ensure(projectId);
    const seg = s.segments.find(x => x.id === segmentId);
    if (!seg) return undefined;
    Object.assign(seg, patch);
    s.updatedAt = new Date().toISOString();
    return seg;
  },
  removeSegment(projectId: string, segmentId: string): boolean {
    const s = ensure(projectId);
    const before = s.segments.length;
    s.segments = s.segments.filter(x => x.id !== segmentId);
    // Also strip any run references to the deleted segment.
    s.runs.forEach(r => { r.segmentIds = r.segmentIds.filter(sid => sid !== segmentId); });
    s.updatedAt = new Date().toISOString();
    return s.segments.length !== before;
  },
};
