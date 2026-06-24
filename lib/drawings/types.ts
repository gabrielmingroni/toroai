// Drawing sheet domain — the actual D-size construction documents an RCDD
// stamps and hands to a contractor. ANSI D = 24″×36″ = 1728×2592 pt at 72
// dpi but we render in inches (24×36) and scale via SVG viewBox.

export type SheetSize = "ANSI_D" | "ANSI_C" | "ARCH_D" | "ARCH_E";

/** Sheet size in inches (width × height, landscape). */
export const SHEET_SIZE_IN: Record<SheetSize, { w: number; h: number; label: string }> = {
  ANSI_D: { w: 36, h: 24, label: "ANSI D (24×36)" },
  ANSI_C: { w: 24, h: 18, label: "ANSI C (18×24)" },
  ARCH_D: { w: 36, h: 24, label: "Arch D (24×36)" },
  ARCH_E: { w: 42, h: 30, label: "Arch E (30×42)" },
};

/** Kinds of sheets in a telecom drawing set. */
export type SheetKind =
  | "cover"            // T-001 — cover & sheet index, general notes
  | "symbols"          // T-002 — symbols, abbreviations, legend
  | "floor_plan"       // T-100 series — floor plans
  | "enlarged_plan"    // T-300 series — enlarged TR/MDF plans
  | "riser"            // T-200 series — riser / system diagram
  | "schedule"         // T-400 series — cable schedule, BOM, equipment schedule
  | "details";         // T-500 series — connection details, mounting, grounding

export const SHEET_KIND_LABEL: Record<SheetKind, string> = {
  cover:         "Cover & Sheet Index",
  symbols:       "Symbols & Abbreviations",
  floor_plan:    "Floor Plan",
  enlarged_plan: "Enlarged Plan",
  riser:         "Riser Diagram",
  schedule:      "Schedule",
  details:       "Details",
};

/** Discipline prefix per CSI MasterFormat convention. Telecom = T. */
export type Discipline = "T" | "E" | "M" | "A";

/** Revision entry per sheet. */
export interface SheetRevision {
  /** Revision letter or number (Δ1, A, etc.) */
  tag: string;
  /** ISO date the revision was issued. */
  date: string;
  /** Short description rendered in the revision block. */
  description: string;
  /** Initials of the person responsible. */
  by: string;
}

/** Issuance metadata — a document set is "issued" for some purpose. */
export interface SheetIssuance {
  /** Label, e.g. "50% Design Review", "Issued for Construction", "Permit". */
  label: string;
  /** ISO date. */
  date: string;
  /** Initials. */
  by: string;
}

/** Plot scale, expressed in arch units. */
export interface PlotScale {
  /** e.g. 1/8 = 0.125 → "1/8\" = 1'-0\"". */
  ratio: number;
  /** Display string for the title block. */
  label: string;
}

export const COMMON_SCALES: PlotScale[] = [
  { ratio: 1 / 16, label: "1/16\" = 1'-0\"" },
  { ratio: 1 / 8,  label: "1/8\" = 1'-0\"" },
  { ratio: 1 / 4,  label: "1/4\" = 1'-0\"" },
  { ratio: 1 / 2,  label: "1/2\" = 1'-0\"" },
  { ratio: 1,      label: "NTS" },
];

/** A single drawing sheet in a project's set. */
export interface DrawingSheet {
  id: string;
  /** Sheet number e.g. "T-100". */
  number: string;
  /** Discipline prefix character. */
  discipline: Discipline;
  /** Sheet title rendered in the title block, e.g. "FIRST FLOOR — POWER & TELECOM". */
  title: string;
  kind: SheetKind;
  size: SheetSize;
  /** Scale for the drawing on this sheet. */
  scale: PlotScale;
  /** Floor or area this sheet documents (for filtering). */
  floor: number | null;
  /** Revision history, newest last. Empty array = no revisions yet. */
  revisions: SheetRevision[];
  /** Date this sheet was first drafted. */
  draftedAt: string;
  /** Date this sheet last changed. */
  updatedAt: string;
}

/** Full sheet set for a project. */
export interface DrawingSet {
  projectId: string;
  /** Sheets in plot order. */
  sheets: DrawingSheet[];
  /** Issuance records, newest last. */
  issuances: SheetIssuance[];
  /** General notes rendered on the cover. */
  generalNotes: string[];
  /** Optional symbols legend for T-002 (rendered lazily by the symbols sheet). */
  symbolsLegend: {
    symbol: string;        // glyph or short code
    label: string;
    description: string;
  }[];
}
