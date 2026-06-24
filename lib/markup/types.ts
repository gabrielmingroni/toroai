// Sheet-markup domain — Bluebeam-style annotations on drawing sheets.
//
// A "sheet" is one printable drawing in the construction document set
// (T-101 cable plan, T-102 rack elevation, A-101 arch background, etc.).
// A "markup" is an annotation overlaid on top: cloud, callout, text,
// dimension, stamp, or highlight. Markups carry a comment thread so the
// RCDD and design team can resolve issues in-line without leaving a paper
// trail of emails.
//
// Geometry is stored in sheet coordinates (the SVG viewBox). The sheet's
// `width` / `height` give the coordinate system size; markup coordinates
// are in those same units regardless of zoom level.

// ── Sheets ────────────────────────────────────────────────────────────────

/** Discipline prefix per AIA CAD layer / sheet conventions. */
export type SheetDiscipline =
  | "A"   // architectural
  | "T"   // telecom
  | "E"   // electrical
  | "M"   // mechanical
  | "P"   // plumbing
  | "S"   // structural
  | "FP"; // fire protection

export interface Sheet {
  id: string;
  /** Sheet number per AIA — e.g. "T-101", "T-102", "A-101". */
  number: string;
  /** Human title. */
  title: string;
  discipline: SheetDiscipline;
  /** Drawing scale label (rendered in the title block). */
  scale: string;
  /** Sheet revision letter (A, B, C…). New sheets are blank. */
  revision: string | null;
  /** Sheet size — D = 24×36, E = 36×48, etc. */
  size: "B" | "C" | "D" | "E";
  /** SVG viewBox dimensions in drawing units (inches × 100 keeps geometry crisp). */
  width: number;
  height: number;
  /** Order within the set. */
  index: number;
  /** True once issued for construction. */
  issued: boolean;
}

// ── Markups ───────────────────────────────────────────────────────────────

export type MarkupType =
  | "cloud"      // revision cloud — calls out a region needing change
  | "callout"    // arrow + bubble pointing to a specific feature
  | "text"       // free text comment, no leader
  | "dimension"  // measurement line with annotation
  | "stamp"      // pre-defined stamp graphic (REVIEWED, APPROVED, REVISE)
  | "highlight"; // colored rectangle, semi-transparent

export type MarkupStatus =
  | "open"        // raised, no resolution yet
  | "in_review"   // assigned, work in progress
  | "resolved"    // closed satisfactorily
  | "wont_fix";   // declined / deferred

/** Standard stamps available in the stamp dropdown. */
export type StampKind = "reviewed" | "approved" | "revise" | "as_built" | "void";

export interface MarkupAuthor {
  id: string;
  name: string;
  /** RCDD, PE, designer, owner-rep, etc. */
  role: string;
}

/** Geometry — discriminated by markup type. */
export type MarkupGeometry =
  | { kind: "cloud";     x: number; y: number; w: number; h: number }
  | { kind: "callout";   anchor: { x: number; y: number }; label: { x: number; y: number; w: number; h: number } }
  | { kind: "text";      x: number; y: number; w: number; h: number }
  | { kind: "dimension"; from: { x: number; y: number }; to: { x: number; y: number } }
  | { kind: "stamp";     x: number; y: number; w: number; h: number; stamp: StampKind }
  | { kind: "highlight"; x: number; y: number; w: number; h: number };

export interface MarkupComment {
  id: string;
  author: MarkupAuthor;
  /** ISO timestamp. */
  createdAt: string;
  body: string;
}

export interface Markup {
  id: string;
  sheetId: string;
  type: MarkupType;
  geometry: MarkupGeometry;
  /** Display color — falls back to a type-default if not set. */
  color?: string;
  /** Primary text on the markup (the cloud's "Verify 90 m max…" comment etc.). */
  title: string;
  /** Optional richer description; threaded replies live in `comments`. */
  body?: string;
  status: MarkupStatus;
  author: MarkupAuthor;
  /** ISO timestamps. */
  createdAt: string;
  updatedAt: string;
  /** Optional assignee — who's expected to resolve it. */
  assignedTo?: MarkupAuthor;
  /** Replies / discussion thread. */
  comments: MarkupComment[];
}

// ── Aggregates ────────────────────────────────────────────────────────────

/** Aggregate counts shown in the sheet browser / review queue. */
export interface SheetMarkupCounts {
  open: number;
  in_review: number;
  resolved: number;
  wont_fix: number;
  total: number;
}

export function emptyCounts(): SheetMarkupCounts {
  return { open: 0, in_review: 0, resolved: 0, wont_fix: 0, total: 0 };
}

// ── Display helpers ───────────────────────────────────────────────────────

export const MARKUP_TYPE_LABEL: Record<MarkupType, string> = {
  cloud:     "Revision cloud",
  callout:   "Callout",
  text:      "Text note",
  dimension: "Dimension",
  stamp:     "Stamp",
  highlight: "Highlight",
};

export const MARKUP_STATUS_LABEL: Record<MarkupStatus, string> = {
  open:      "Open",
  in_review: "In review",
  resolved:  "Resolved",
  wont_fix:  "Won't fix",
};

export const STAMP_LABEL: Record<StampKind, string> = {
  reviewed: "REVIEWED",
  approved: "APPROVED",
  revise:   "REVISE & RESUBMIT",
  as_built: "AS-BUILT",
  void:     "VOID",
};

/** Tailwind text color class per markup type — used in toolbar + list. */
export const MARKUP_TYPE_TONE: Record<MarkupType, string> = {
  cloud:     "text-fail",
  callout:   "text-warn",
  text:      "text-info",
  dimension: "text-text2",
  stamp:     "text-pass",
  highlight: "text-accent",
};

/** Tailwind text + dot color class per status. */
export const MARKUP_STATUS_TONE: Record<MarkupStatus, string> = {
  open:      "text-warn",
  in_review: "text-info",
  resolved:  "text-pass",
  wont_fix:  "text-text4",
};

// ── API response envelope (matches other lib/* modules in this repo) ──────

export interface MarkupResponse {
  ok: boolean;
  markup?: Markup;
  markups?: Markup[];
  sheets?: Sheet[];
  error?: { code: string; message: string };
}
