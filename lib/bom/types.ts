// Bill of Materials document types.
//
// A BomDocument is a Division 27 submittal-grade itemized BOM with grouping
// by CSI MasterFormat spec section, manufacturer SKUs, quantity derivations,
// section subtotals, labor estimate, and grand total. This is what gets
// attached to a bid and submitted with the construction set.

import type { CsiSection, ProductCategory } from "@/lib/catalog/products";

export interface BomLine {
  /** 1-based line number within the document, used for the submittal cover sheet. */
  lineNo: number;
  csiSection: CsiSection;
  /** Manufacturer SKU. */
  sku: string;
  manufacturer: string;
  description: string;
  category: ProductCategory;
  unit: "EA" | "LF" | "ROLL" | "REEL" | "PR" | "HR" | "KIT";
  quantity: number;
  unitCostCents: number;
  extendedCents: number;
  /** Human-readable description of where this quantity came from. */
  derivedFrom: string;
  /** Optional callouts (e.g. "LC/UPC mandatory — TDD §5.5"). */
  notes?: string;
}

export interface BomSectionRollup {
  section: CsiSection;
  itemCount: number;
  /** Sum of all extendedCents in this section. */
  subtotalCents: number;
}

export interface BomDocument {
  projectId: string;
  generatedAt: string;
  /** Project-context echo for the document header. */
  project: {
    number: string;
    name: string;
    owner: string;
    address: string;
  };
  lineItems: BomLine[];
  sections: BomSectionRollup[];
  /** Sum of material lineItems. */
  materialSubtotalCents: number;
  /** Total labor hours required, with a per-task breakdown. */
  labor: {
    hours: number;
    breakdown: { task: string; hours: number }[];
    /** Blended labor rate (cents/hr) — Davis-Bacon-corrected average. */
    blendedRateCentsPerHr: number;
    subtotalCents: number;
  };
  /** Sales tax (jurisdiction-aware in production; flat rate here). */
  tax: { rate: number; cents: number };
  /** Grand total = material + labor + tax. */
  grandTotalCents: number;
}

export interface BomResponse {
  ok: boolean;
  document?: BomDocument;
  error?: { code: string; message: string };
}
