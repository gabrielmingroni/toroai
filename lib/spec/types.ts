// CSI MasterFormat Division 27 specification text domain.
//
// A SpecDocument is the project's written technical specifications — the
// document attached to the construction drawings that tells the installer
// what to buy, how to install it, and how to verify it. RCDDs spend hours
// per project copy-pasting from past project specs and editing clauses;
// this generator produces a real first draft they can edit instead.
//
// Each section follows the standard CSI 3-part structure:
//   Part 1 — General        (scope, references, submittals, QA, warranty)
//   Part 2 — Products       (manufacturers, materials, performance reqs)
//   Part 3 — Execution      (preparation, installation, field QC, cleaning)
//
// The generator emphasizes Part 2 and Part 3 because that's where most
// project-specific value lives. Part 1 references TIA / NEC / BICSI / UFC
// standards from the standards corpus.

import type { CsiSection } from "@/lib/catalog/products";

export type SpecPartId = "part1_general" | "part2_products" | "part3_execution";

export const SPEC_PART_LABEL: Record<SpecPartId, string> = {
  part1_general:    "Part 1 — General",
  part2_products:   "Part 2 — Products",
  part3_execution:  "Part 3 — Execution",
};

export interface SpecArticle {
  /** Article number, e.g., "1.01", "2.03". */
  number: string;
  /** Article title, e.g., "SECTION INCLUDES", "MANUFACTURERS". */
  title: string;
  /** Article body — plain text. May contain bullet points or numbered lists
   *  formatted as a single string with newlines. */
  body: string;
}

export interface SpecPart {
  id: SpecPartId;
  articles: SpecArticle[];
}

export interface SpecSection {
  /** CSI MasterFormat section identifier (matches lib/catalog CsiSection). */
  section: CsiSection;
  /** Section number, e.g. "27 13 23". */
  number: string;
  /** Section title, e.g. "Communications Optical Fiber Backbone Cabling". */
  title: string;
  parts: SpecPart[];
}

export interface SpecDocument {
  projectId: string;
  generatedAt: string;
  /** Strategy used by the generator. */
  strategy: "deterministic_mock" | "live_anthropic_api";
  sections: SpecSection[];
  /** Token usage when generated via Claude (zero when mocked). */
  tokens?: { input: number; output: number };
  /** Warnings collected during generation (e.g., live call fallback). */
  warnings?: string[];
}

export interface SpecResponse {
  ok: boolean;
  document?: SpecDocument;
  error?: { code: string; message: string };
}

/** Sections we generate by default — the most commonly-spec'd Division 27 work. */
export const DEFAULT_SECTIONS: Array<{ section: CsiSection; number: string; title: string }> = [
  {
    section: "27 05 26 — Grounding and Bonding for Communications",
    number: "27 05 26",
    title: "Grounding and Bonding for Communications",
  },
  {
    section: "27 05 28 — Pathways for Communications",
    number: "27 05 28",
    title: "Pathways for Communications",
  },
  {
    section: "27 11 16 — Communications Racks, Frames, and Enclosures",
    number: "27 11 16",
    title: "Communications Racks, Frames, and Enclosures",
  },
  {
    section: "27 13 23 — Communications Optical Fiber Backbone Cabling",
    number: "27 13 23",
    title: "Communications Optical Fiber Backbone Cabling",
  },
  {
    section: "27 15 13 — Communications Copper Horizontal Cabling",
    number: "27 15 13",
    title: "Communications Copper Horizontal Cabling",
  },
];
