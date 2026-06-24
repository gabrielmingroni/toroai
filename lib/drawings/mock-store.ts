// Drawing set mock store. One DrawingSet per project, seeded the first time
// the project is viewed. Survives HMR via globalThis.

import { randomBytes } from "crypto";
import type { Project } from "@/lib/projects/types";
import type {
  DrawingSet, DrawingSheet, SheetIssuance, SheetRevision,
} from "./types";
import { COMMON_SCALES } from "./types";

const g = globalThis as unknown as {
  __toroaiDrawingSets?: Map<string, DrawingSet>;
};
if (!g.__toroaiDrawingSets) g.__toroaiDrawingSets = new Map();
const setsByProject = g.__toroaiDrawingSets;

function rid(prefix: string) {
  return `${prefix}_${randomBytes(3).toString("hex")}`;
}

/** Build the default sheet set for a freshly seeded project. */
function seedDrawingSet(project: Project): DrawingSet {
  const now = new Date().toISOString();
  const t100Title =
    project.floors > 1
      ? `OVERALL FLOOR PLAN — TELECOMMUNICATIONS`
      : `FLOOR PLAN — TELECOMMUNICATIONS`;

  // Floor-plan scale ramp by total SF — bigger building → smaller scale.
  const planScale =
    project.totalSf > 80_000 ? COMMON_SCALES[0]
    : project.totalSf > 25_000 ? COMMON_SCALES[1]
    : COMMON_SCALES[2];

  const sheets: DrawingSheet[] = [
    {
      id: rid("sht"), number: "T-001", discipline: "T",
      title: "Cover & Sheet Index", kind: "cover",
      size: "ANSI_D", scale: COMMON_SCALES[4], floor: null,
      revisions: [], draftedAt: now, updatedAt: now,
    },
    {
      id: rid("sht"), number: "T-002", discipline: "T",
      title: "Symbols & Abbreviations", kind: "symbols",
      size: "ANSI_D", scale: COMMON_SCALES[4], floor: null,
      revisions: [], draftedAt: now, updatedAt: now,
    },
    {
      id: rid("sht"), number: "T-100", discipline: "T",
      title: t100Title, kind: "floor_plan",
      size: "ANSI_D", scale: planScale, floor: 1,
      revisions: [], draftedAt: now, updatedAt: now,
    },
    {
      id: rid("sht"), number: "T-200", discipline: "T",
      title: "Riser & Backbone Diagram", kind: "riser",
      size: "ANSI_D", scale: COMMON_SCALES[4], floor: null,
      revisions: [], draftedAt: now, updatedAt: now,
    },
    {
      id: rid("sht"), number: "T-300", discipline: "T",
      title: "Enlarged MDF Plan", kind: "enlarged_plan",
      size: "ANSI_D", scale: COMMON_SCALES[3], floor: 1,   // 1/2" = 1'-0"
      revisions: [], draftedAt: now, updatedAt: now,
    },
    {
      id: rid("sht"), number: "T-400", discipline: "T",
      title: "Horizontal Cable Schedule", kind: "schedule",
      size: "ANSI_D", scale: COMMON_SCALES[4], floor: null,
      revisions: [], draftedAt: now, updatedAt: now,
    },
    {
      id: rid("sht"), number: "T-501", discipline: "T",
      title: "MDF Rack Elevation", kind: "details",
      size: "ANSI_D", scale: COMMON_SCALES[4], floor: null,  // NTS
      revisions: [], draftedAt: now, updatedAt: now,
    },
  ];

  // Seed one early-design issuance so the title block has a stamp marker.
  const issuance: SheetIssuance = {
    label: "50% Design Review",
    date: now,
    by: "JT",
  };

  // Seed one Δ1 revision on the floor plan so the revision block isn't empty
  // on the exhibit project.
  if (project.exhibit?.isTddExhibit) {
    const rev: SheetRevision = {
      tag: "Δ1",
      date: now,
      description: "Revised TR placement per coordination review",
      by: "JT",
    };
    const t100 = sheets.find(s => s.number === "T-100");
    if (t100) t100.revisions.push(rev);
  }

  // Federal projects get a Permit issuance row in addition to the design review.
  const issuances: SheetIssuance[] = [issuance];
  if (project.exhibit?.davisBaconApplies) {
    issuances.push({ label: "Permit Submission", date: now, by: "JT" });
  }

  const generalNotes = buildGeneralNotes(project);

  return {
    projectId: project.id,
    sheets,
    issuances,
    generalNotes,
    symbolsLegend: STANDARD_SYMBOLS,
  };
}

function buildGeneralNotes(project: Project): string[] {
  const base = [
    "All telecommunications work shall conform to BICSI TDMM 15th Edition, TIA-568.1-D/2-D, TIA-569-D, TIA-606-C, TIA-607-C, NEC Articles 770 / 800, and applicable AHJ requirements.",
    "All horizontal cable runs shall not exceed 90 m permanent link and 100 m channel per TIA-568.2-D. Provide service loops per BICSI TDMM Chapter 14.",
    "All telecommunications rooms shall be coordinated with electrical, mechanical, and architectural drawings. Verify minimum BICSI clear-floor area before construction.",
    "Pathway penetrations through fire-rated assemblies shall be firestopped per UL 1479 with listed assemblies. Provide labeled firestop card at each penetration.",
    "Contractor shall provide as-built drawings, link-by-link test certifications (DTX-1800 series), and a TIA-606-C labeled schematic upon project close-out.",
  ];
  if (project.exhibit?.davisBaconApplies) {
    base.push(
      "This project is subject to Davis-Bacon Prevailing Wage rates per the applicable wage determination. Contractor shall submit certified payroll weekly per WH-347.",
    );
  }
  return base;
}

const STANDARD_SYMBOLS: DrawingSet["symbolsLegend"] = [
  { symbol: "⏚",   label: "TGB / TBB",    description: "Telecommunications grounding busbar / backbone — TIA-607-C." },
  { symbol: "▣",   label: "MDF",          description: "Main distribution frame — primary equipment room." },
  { symbol: "▢",   label: "IDF",          description: "Intermediate distribution frame — telecom closet." },
  { symbol: "●",   label: "WA Outlet",    description: "Work area outlet — 2-port faceplate unless noted otherwise." },
  { symbol: "◐",   label: "Surface Mount", description: "4-port surface-mounted faceplate." },
  { symbol: "◬",   label: "Floor Box",    description: "Floor-mounted multi-service outlet." },
  { symbol: "▲",   label: "WAP",          description: "Wireless access point — ceiling-mounted." },
  { symbol: "═",   label: "Cable Tray",   description: "Ladder-rack or basket cable tray." },
  { symbol: "▭",   label: "Conduit",      description: "EMT or PVC conduit, size noted on drawing." },
  { symbol: "△",   label: "J-Hook",       description: "Bridle ring or J-hook supporting horizontal cable." },
];

// ──────────────────────────────────────────────────────────────────────────

export const drawingSetStore = {
  /** Get (and lazily seed) the drawing set for a project. */
  get(project: Project): DrawingSet {
    let set = setsByProject.get(project.id);
    if (!set) {
      set = seedDrawingSet(project);
      setsByProject.set(project.id, set);
    }
    return set;
  },
  /** Replace the set (used by future API routes). */
  set(set: DrawingSet) {
    setsByProject.set(set.projectId, set);
  },
  /** Clear the set — useful for tests. */
  clear(projectId: string) {
    setsByProject.delete(projectId);
  },
};
