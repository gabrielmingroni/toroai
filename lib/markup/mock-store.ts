// In-memory markup store, keyed by projectId.
// Seeded with realistic example data so the markup viewer renders something
// meaningful out of the box. Replaced by backend persistence when the real
// service lands.

import { randomBytes } from "crypto";
import type {
  Sheet, Markup, MarkupAuthor, MarkupStatus, MarkupGeometry, SheetMarkupCounts,
} from "./types";
import { emptyCounts } from "./types";

function id(prefix: string) { return prefix + "_" + randomBytes(4).toString("hex"); }

// ── Authors (mock people) ────────────────────────────────────────────────

const RCDD_AUTHOR: MarkupAuthor = {
  id: "user_rcdd_01",
  name: "Sarah Chen, RCDD",
  role: "RCDD",
};
const PE_AUTHOR: MarkupAuthor = {
  id: "user_pe_01",
  name: "Marcus Reyes, PE",
  role: "Electrical PE",
};
const DESIGNER_AUTHOR: MarkupAuthor = {
  id: "user_designer_01",
  name: "Jordan Patel",
  role: "Senior Designer",
};
const OWNER_AUTHOR: MarkupAuthor = {
  id: "user_owner_01",
  name: "Lisa Torres",
  role: "Owner Rep",
};

// ── Default seed sheets per project ──────────────────────────────────────

function seedSheets(projectId: string): Sheet[] {
  return [
    {
      id: id("sheet"),
      number: "T-101",
      title: "Telecom Cable Layout — Level 1",
      discipline: "T",
      scale: '1/8" = 1\'-0"',
      revision: "A",
      size: "D",
      width: 3600,   // 36 in × 100 unit/in
      height: 2400,  // 24 in × 100 unit/in
      index: 1,
      issued: false,
    },
    {
      id: id("sheet"),
      number: "T-102",
      title: "Rack Elevations — MDF + IDF-A",
      discipline: "T",
      scale: '3/4" = 1\'-0"',
      revision: "A",
      size: "D",
      width: 3600,
      height: 2400,
      index: 2,
      issued: false,
    },
    {
      id: id("sheet"),
      number: "T-501",
      title: "Telecom Details + Schedules",
      discipline: "T",
      scale: "Various",
      revision: null,
      size: "D",
      width: 3600,
      height: 2400,
      index: 3,
      issued: false,
    },
    {
      id: id("sheet"),
      number: "A-101",
      title: "Architectural Background — Level 1",
      discipline: "A",
      scale: '1/8" = 1\'-0"',
      revision: "B",
      size: "D",
      width: 3600,
      height: 2400,
      index: 4,
      issued: false,
    },
  ];
}

// ── Default seed markups for the cable-plan sheet (T-101) ────────────────

function seedMarkups(sheets: Sheet[]): Markup[] {
  const t101 = sheets.find(s => s.number === "T-101")!;
  const t102 = sheets.find(s => s.number === "T-102")!;
  const a101 = sheets.find(s => s.number === "A-101")!;
  const now = new Date();
  const hoursAgo = (h: number) => new Date(now.getTime() - h * 3600_000).toISOString();

  return [
    // T-101 — Cable plan markups
    {
      id: id("mk"),
      sheetId: t101.id,
      type: "cloud",
      geometry: { kind: "cloud", x: 2400, y: 600, w: 700, h: 500 },
      title: "Verify 90 m max horizontal distance from IDF-A",
      body: "Outlets in the east wing measure ~88 m via the proposed pathway. With slack + bend allowance we may exceed the TIA-568 90 m limit. Recommend re-routing through ceiling above corridor 1-12.",
      status: "open",
      author: RCDD_AUTHOR,
      createdAt: hoursAgo(6),
      updatedAt: hoursAgo(2),
      assignedTo: DESIGNER_AUTHOR,
      comments: [
        {
          id: id("c"),
          author: DESIGNER_AUTHOR,
          createdAt: hoursAgo(2),
          body: "Re-measured via pathway routing tool. East-wing worst case is 87.4 m. Will tighten the routing to keep margin and re-issue.",
        },
      ],
    },
    {
      id: id("mk"),
      sheetId: t101.id,
      type: "callout",
      geometry: {
        kind: "callout",
        anchor: { x: 1200, y: 1400 },
        label:  { x: 1500, y: 1200, w: 720, h: 240 },
      },
      title: "WAP coverage gap — verify with predictive heatmap",
      status: "in_review",
      author: RCDD_AUTHOR,
      createdAt: hoursAgo(4),
      updatedAt: hoursAgo(4),
      assignedTo: DESIGNER_AUTHOR,
      comments: [],
    },
    {
      id: id("mk"),
      sheetId: t101.id,
      type: "text",
      geometry: { kind: "text", x: 600, y: 2050, w: 900, h: 100 },
      title: "MDF location not yet coordinated with electrical PE",
      status: "open",
      author: RCDD_AUTHOR,
      createdAt: hoursAgo(8),
      updatedAt: hoursAgo(8),
      assignedTo: PE_AUTHOR,
      comments: [],
    },
    {
      id: id("mk"),
      sheetId: t101.id,
      type: "highlight",
      geometry: { kind: "highlight", x: 2700, y: 1700, w: 600, h: 300 },
      title: "Future expansion zone — leave cable tray capacity",
      status: "resolved",
      author: OWNER_AUTHOR,
      createdAt: hoursAgo(48),
      updatedAt: hoursAgo(12),
      comments: [
        {
          id: id("c"),
          author: RCDD_AUTHOR,
          createdAt: hoursAgo(12),
          body: "Confirmed — sized cable tray to 40 % fill in the east wing to accommodate Phase 2 outlets.",
        },
      ],
    },

    // T-102 — Rack elevation markups
    {
      id: id("mk"),
      sheetId: t102.id,
      type: "cloud",
      geometry: { kind: "cloud", x: 800, y: 800, w: 500, h: 400 },
      title: "Re-order patch panels to match cable schedule label sequence",
      body: "Cable schedule labels A01-A24 should sit on the top patch panel; the current arrangement puts B-series first. This breaks the standard top-down, left-right convention.",
      status: "open",
      author: RCDD_AUTHOR,
      createdAt: hoursAgo(3),
      updatedAt: hoursAgo(3),
      assignedTo: DESIGNER_AUTHOR,
      comments: [],
    },
    {
      id: id("mk"),
      sheetId: t102.id,
      type: "stamp",
      geometry: { kind: "stamp", x: 2900, y: 100, w: 600, h: 300, stamp: "revise" },
      title: "REVISE & RESUBMIT",
      status: "open",
      author: RCDD_AUTHOR,
      createdAt: hoursAgo(3),
      updatedAt: hoursAgo(3),
      comments: [],
    },

    // A-101 — Architectural background markup
    {
      id: id("mk"),
      sheetId: a101.id,
      type: "text",
      geometry: { kind: "text", x: 400, y: 600, w: 1100, h: 100 },
      title: "Coordinate with arch — column grid shifted in latest revision",
      status: "wont_fix",
      author: DESIGNER_AUTHOR,
      createdAt: hoursAgo(72),
      updatedAt: hoursAgo(24),
      comments: [
        {
          id: id("c"),
          author: RCDD_AUTHOR,
          createdAt: hoursAgo(24),
          body: "Latest arch rev B reflects the shift. No telecom impact — outlets stay located off rooms, not column grid. Closing.",
        },
      ],
    },
  ];
}

// ── Store ────────────────────────────────────────────────────────────────

interface ProjectMarkupState {
  sheets: Sheet[];
  markups: Markup[];
  seeded: boolean;
}

const stateByProject = new Map<string, ProjectMarkupState>();

function ensure(projectId: string): ProjectMarkupState {
  let s = stateByProject.get(projectId);
  if (!s) {
    const sheets = seedSheets(projectId);
    s = { sheets, markups: seedMarkups(sheets), seeded: true };
    stateByProject.set(projectId, s);
  }
  return s;
}

export const markupStore = {
  listSheets(projectId: string): Sheet[] {
    return ensure(projectId).sheets;
  },
  getSheet(projectId: string, sheetId: string): Sheet | undefined {
    return ensure(projectId).sheets.find(s => s.id === sheetId);
  },
  /** Look up by sheet number ("T-101") — useful when routing from named links. */
  getSheetByNumber(projectId: string, number: string): Sheet | undefined {
    return ensure(projectId).sheets.find(s => s.number === number);
  },
  listMarkups(projectId: string, sheetId?: string): Markup[] {
    const s = ensure(projectId);
    return sheetId ? s.markups.filter(m => m.sheetId === sheetId) : s.markups;
  },
  countsBySheet(projectId: string): Record<string, SheetMarkupCounts> {
    const s = ensure(projectId);
    const acc: Record<string, SheetMarkupCounts> = {};
    for (const sheet of s.sheets) acc[sheet.id] = emptyCounts();
    for (const m of s.markups) {
      const c = acc[m.sheetId]; if (!c) continue;
      c.total += 1;
      c[m.status] += 1;
    }
    return acc;
  },
  createMarkup(
    projectId: string,
    args: {
      sheetId: string;
      type: Markup["type"];
      geometry: MarkupGeometry;
      title?: string;
      body?: string;
      color?: string;
      author: MarkupAuthor;
    },
  ): Markup | undefined {
    const s = ensure(projectId);
    if (!s.sheets.some(sh => sh.id === args.sheetId)) return undefined;
    const now = new Date().toISOString();
    const m: Markup = {
      id: id("mk"),
      sheetId: args.sheetId,
      type: args.type,
      geometry: args.geometry,
      color: args.color,
      title: args.title ?? "Untitled markup",
      body: args.body,
      status: "open",
      author: args.author,
      createdAt: now,
      updatedAt: now,
      comments: [],
    };
    s.markups.push(m);
    return m;
  },
  updateMarkup(
    projectId: string,
    markupId: string,
    patch: Partial<Pick<Markup, "title" | "body" | "color" | "status" | "assignedTo" | "geometry">>,
  ): Markup | undefined {
    const s = ensure(projectId);
    const m = s.markups.find(x => x.id === markupId);
    if (!m) return undefined;
    Object.assign(m, patch);
    m.updatedAt = new Date().toISOString();
    return m;
  },
  deleteMarkup(projectId: string, markupId: string): boolean {
    const s = ensure(projectId);
    const before = s.markups.length;
    s.markups = s.markups.filter(m => m.id !== markupId);
    return s.markups.length !== before;
  },
  setMarkupStatus(projectId: string, markupId: string, status: MarkupStatus): Markup | undefined {
    return this.updateMarkup(projectId, markupId, { status });
  },
  addComment(projectId: string, markupId: string, author: MarkupAuthor, body: string): Markup | undefined {
    const s = ensure(projectId);
    const m = s.markups.find(x => x.id === markupId);
    if (!m) return undefined;
    m.comments.push({ id: id("c"), author, createdAt: new Date().toISOString(), body });
    m.updatedAt = new Date().toISOString();
    return m;
  },
  /** Reset to seed data — handy when testing. */
  reset(projectId: string): void {
    stateByProject.delete(projectId);
  },
};

// Re-export the canonical "current user" author for the client (in real life
// this comes from the auth session; for the horizontal sketch we use a stub).
export const CURRENT_AUTHOR: MarkupAuthor = RCDD_AUTHOR;
