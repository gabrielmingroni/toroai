// Realistic ICT product catalog.
//
// Each entry is a real-world manufacturer + SKU that an RCDD would specify
// on a Division 27 submittal. Pricing is mid-2025 distributor-list-ish in
// USD cents; production swaps this for live Anixter / Graybar / CDW pricing.
// CSI MasterFormat Division 27 spec sections are used as the grouping key.

export type ProductCategory =
  | "fiber_cable" | "fiber_pigtail" | "fiber_connector" | "fiber_splice_tray"
  | "copper_horizontal_cable" | "copper_jack" | "faceplate"
  | "patch_panel" | "patch_cord" | "rack" | "vertical_manager"
  | "cable_tray_section" | "cable_tray_fitting"
  | "conduit_emt" | "conduit_fitting" | "innerduct" | "j_hook"
  | "grounding" | "label" | "firestop"
  | "misc";

/** CSI MasterFormat Division 27 spec sections used in the BOM grouping. */
export const CSI_SECTIONS = [
  "27 05 26 — Grounding and Bonding for Communications",
  "27 05 28 — Pathways for Communications",
  "27 05 36 — Cable Trays for Communications",
  "27 11 16 — Communications Racks, Frames, and Enclosures",
  "27 13 13 — Communications Copper Backbone Cabling",
  "27 13 23 — Communications Optical Fiber Backbone Cabling",
  "27 15 13 — Communications Copper Horizontal Cabling",
  "27 15 43 — Communications Faceplates and Connectors",
  "27 16 19 — Communications Patch Cords",
] as const;

export type CsiSection = typeof CSI_SECTIONS[number];

export interface CatalogItem {
  sku: string;
  manufacturer: string;
  description: string;
  category: ProductCategory;
  specSection: CsiSection;
  unit: "EA" | "LF" | "ROLL" | "REEL" | "PR" | "HR" | "KIT";
  unitCostCents: number;
  /** Optional URL pointer to the manufacturer's data sheet for the submittal. */
  dataSheetUrl?: string;
  /** Optional notes — e.g. "LC/UPC mandatory per TDD §5.5". */
  notes?: string;
}

// ── Fiber backbone — 27 13 23 ────────────────────────────────────────────

export const CATALOG: CatalogItem[] = [

  {
    sku: "BLD-7814A-12", manufacturer: "Belden",
    description: "Single-mode OS2 12-strand armored indoor/outdoor fiber, plenum",
    category: "fiber_cable", specSection: "27 13 23 — Communications Optical Fiber Backbone Cabling",
    unit: "LF", unitCostCents: 285,
    dataSheetUrl: "https://www.belden.com/products/cable/fiber",
  },
  {
    sku: "BLD-7814A-24", manufacturer: "Belden",
    description: "Single-mode OS2 24-strand armored indoor/outdoor fiber, plenum",
    category: "fiber_cable", specSection: "27 13 23 — Communications Optical Fiber Backbone Cabling",
    unit: "LF", unitCostCents: 442,
  },
  {
    sku: "CMS-OM4-12", manufacturer: "CommScope",
    description: "Multi-mode OM4 12-strand riser-rated fiber",
    category: "fiber_cable", specSection: "27 13 23 — Communications Optical Fiber Backbone Cabling",
    unit: "LF", unitCostCents: 218,
  },
  {
    sku: "PAN-FX-LU-LU-3M", manufacturer: "Panduit",
    description: "Fiber pigtail, single-mode OS2, LC/UPC, 3 m, OFNP jacket",
    category: "fiber_pigtail", specSection: "27 13 23 — Communications Optical Fiber Backbone Cabling",
    unit: "EA", unitCostCents: 1180,
    notes: "LC/UPC mandatory per TDD §5.5 — LC/APC explicitly prohibited.",
  },
  {
    sku: "PAN-FL-12-A-LU", manufacturer: "Panduit",
    description: "Fiber splice tray, 12-port LC duplex, OFNP enclosure",
    category: "fiber_splice_tray", specSection: "27 13 23 — Communications Optical Fiber Backbone Cabling",
    unit: "EA", unitCostCents: 4250,
  },

  // ── Copper horizontal — 27 15 13 ────────────────────────────────────────

  {
    sku: "CMS-CAT6A-1000", manufacturer: "CommScope NetConnect",
    description: "Cat 6A UTP horizontal cable, plenum (CMP), 1000 ft box",
    category: "copper_horizontal_cable", specSection: "27 15 13 — Communications Copper Horizontal Cabling",
    unit: "ROLL", unitCostCents: 38500,
  },
  {
    sku: "BLD-2413-1000", manufacturer: "Belden",
    description: "Cat 6 UTP horizontal cable, plenum (CMP), 1000 ft box",
    category: "copper_horizontal_cable", specSection: "27 15 13 — Communications Copper Horizontal Cabling",
    unit: "ROLL", unitCostCents: 26800,
  },

  // ── Outlets + faceplates — 27 15 43 ─────────────────────────────────────

  {
    sku: "PAN-CJ688TGYL", manufacturer: "Panduit",
    description: "Cat 6A keystone jack, Mini-Com, yellow",
    category: "copper_jack", specSection: "27 15 43 — Communications Faceplates and Connectors",
    unit: "EA", unitCostCents: 920,
  },
  {
    sku: "HUB-IFP12W", manufacturer: "Hubbell iSTATION",
    description: "Faceplate, 2-port, single-gang, white",
    category: "faceplate", specSection: "27 15 43 — Communications Faceplates and Connectors",
    unit: "EA", unitCostCents: 420,
  },
  {
    sku: "HUB-IFP14W", manufacturer: "Hubbell iSTATION",
    description: "Faceplate, 4-port, single-gang, white",
    category: "faceplate", specSection: "27 15 43 — Communications Faceplates and Connectors",
    unit: "EA", unitCostCents: 540,
  },

  // ── Patch panels + racks — 27 11 16 ─────────────────────────────────────

  {
    sku: "LEV-69586-U24", manufacturer: "Leviton Atlas-X1",
    description: "Patch panel, 24-port Cat 6A, 1U, shielded",
    category: "patch_panel", specSection: "27 11 16 — Communications Racks, Frames, and Enclosures",
    unit: "EA", unitCostCents: 28500,
  },
  {
    sku: "PAN-FAP24WBLLCZ", manufacturer: "Panduit",
    description: "Fiber adapter panel, 24-port LC duplex, OS2 zirconia",
    category: "patch_panel", specSection: "27 11 16 — Communications Racks, Frames, and Enclosures",
    unit: "EA", unitCostCents: 18600,
  },
  {
    sku: "CPI-55053-703", manufacturer: "Chatsworth (CPI)",
    description: "4-post open rack, 42U × 19\", aluminum, black",
    category: "rack", specSection: "27 11 16 — Communications Racks, Frames, and Enclosures",
    unit: "EA", unitCostCents: 89500,
  },
  {
    sku: "CPI-30130-703", manufacturer: "Chatsworth (CPI)",
    description: "Vertical cable manager, single-sided, 84\" × 6\" × 16\"",
    category: "vertical_manager", specSection: "27 11 16 — Communications Racks, Frames, and Enclosures",
    unit: "EA", unitCostCents: 38200,
  },

  // ── Patch cords — 27 16 19 ──────────────────────────────────────────────

  {
    sku: "BLD-CA21106-007", manufacturer: "Belden",
    description: "Cat 6A patch cord, 7 ft, blue, factory-terminated",
    category: "patch_cord", specSection: "27 16 19 — Communications Patch Cords",
    unit: "EA", unitCostCents: 1450,
  },
  {
    sku: "PAN-F5E10P-3M-BU", manufacturer: "Panduit",
    description: "Fiber patch cord, LC/UPC duplex single-mode OS2, 3 m, yellow",
    category: "patch_cord", specSection: "27 16 19 — Communications Patch Cords",
    unit: "EA", unitCostCents: 2890,
  },

  // ── Cable tray — 27 05 36 ───────────────────────────────────────────────

  {
    sku: "BLN-KP24-10", manufacturer: "B-Line (Eaton)",
    description: "Ladder cable tray, 24\" wide × 4\" deep, 10 ft section, aluminum",
    category: "cable_tray_section", specSection: "27 05 36 — Cable Trays for Communications",
    unit: "EA", unitCostCents: 18950,
  },
  {
    sku: "BLN-KP12-10", manufacturer: "B-Line (Eaton)",
    description: "Ladder cable tray, 12\" wide × 4\" deep, 10 ft section, aluminum",
    category: "cable_tray_section", specSection: "27 05 36 — Cable Trays for Communications",
    unit: "EA", unitCostCents: 12450,
  },
  {
    sku: "BLN-KP90-24", manufacturer: "B-Line (Eaton)",
    description: "Cable tray 90° horizontal elbow, 24\" wide, 24\" radius",
    category: "cable_tray_fitting", specSection: "27 05 36 — Cable Trays for Communications",
    unit: "EA", unitCostCents: 8650,
  },

  // ── Conduit + fittings — 27 05 28 ───────────────────────────────────────

  {
    sku: "CRH-EMT-2", manufacturer: "Crouse-Hinds (Eaton)",
    description: "EMT conduit, 2\" trade size, 10 ft section, galvanized",
    category: "conduit_emt", specSection: "27 05 28 — Pathways for Communications",
    unit: "EA", unitCostCents: 4280,
  },
  {
    sku: "CRH-EMT-125", manufacturer: "Crouse-Hinds (Eaton)",
    description: "EMT conduit, 1-1/4\" trade size, 10 ft section, galvanized",
    category: "conduit_emt", specSection: "27 05 28 — Pathways for Communications",
    unit: "EA", unitCostCents: 2640,
  },
  {
    sku: "BPT-EMT-90-2", manufacturer: "Bridgeport",
    description: "EMT 90° set-screw elbow, 2\" trade size",
    category: "conduit_fitting", specSection: "27 05 28 — Pathways for Communications",
    unit: "EA", unitCostCents: 920,
  },
  {
    sku: "BPT-EMT-CPL-2", manufacturer: "Bridgeport",
    description: "EMT set-screw coupling, 2\" trade size",
    category: "conduit_fitting", specSection: "27 05 28 — Pathways for Communications",
    unit: "EA", unitCostCents: 245,
  },
  {
    sku: "DUR-MDPE-125", manufacturer: "Duraline",
    description: "Innerduct, 1.25\" HDPE, plenum-rated, 1000 ft reel",
    category: "innerduct", specSection: "27 05 28 — Pathways for Communications",
    unit: "REEL", unitCostCents: 64500,
  },
  {
    sku: "ERC-CAT64HP", manufacturer: "Erico Caddy",
    description: "J-hook, 4\" with hammer-on flange, 1/4\" capacity for fiber/Cat 6A",
    category: "j_hook", specSection: "27 05 28 — Pathways for Communications",
    unit: "EA", unitCostCents: 425,
  },

  // ── Grounding — 27 05 26 ────────────────────────────────────────────────

  {
    sku: "HAR-TGB-10", manufacturer: "Harger",
    description: "Telecom Grounding Busbar (TGB), 1/4\" × 2\" × 10\", copper",
    category: "grounding", specSection: "27 05 26 — Grounding and Bonding for Communications",
    unit: "EA", unitCostCents: 14500,
  },
  {
    sku: "HAR-TMGB-20", manufacturer: "Harger",
    description: "Telecom Main Grounding Busbar (TMGB), 1/4\" × 4\" × 20\", copper, insulators",
    category: "grounding", specSection: "27 05 26 — Grounding and Bonding for Communications",
    unit: "EA", unitCostCents: 32500,
  },
  {
    sku: "ERC-BCWB6-25", manufacturer: "Erico (nVent)",
    description: "Bonding conductor, 6 AWG green-insulated copper, 25 ft",
    category: "grounding", specSection: "27 05 26 — Grounding and Bonding for Communications",
    unit: "EA", unitCostCents: 5400,
  },

  // ── Labels + firestop — 27 05 26 / misc ─────────────────────────────────

  {
    sku: "BRD-PTL-1-426", manufacturer: "Brady",
    description: "Self-laminating cable labels, white, 1\" × 2.25\", TIA-606-C compliant",
    category: "label", specSection: "27 05 28 — Pathways for Communications",
    unit: "ROLL", unitCostCents: 11800,
    notes: "TIA-606-C hierarchical label format required.",
  },
  {
    sku: "STI-FSP-2", manufacturer: "STI (Specified Technologies)",
    description: "Firestop pillow, 2\" × 3\" × 9\", intumescent, UL 1479 listed",
    category: "firestop", specSection: "27 05 28 — Pathways for Communications",
    unit: "EA", unitCostCents: 1875,
  },
  {
    sku: "STI-FSC-CK", manufacturer: "STI",
    description: "Firestop sealant kit — 10.1 oz tube + applicator, UL listed",
    category: "firestop", specSection: "27 05 28 — Pathways for Communications",
    unit: "KIT", unitCostCents: 4250,
  },
];

// ── Lookup helpers ───────────────────────────────────────────────────────

export function findCatalogItem(sku: string): CatalogItem | undefined {
  return CATALOG.find(i => i.sku === sku);
}

export function findByCategory(category: ProductCategory): CatalogItem[] {
  return CATALOG.filter(i => i.category === category);
}

/** Default-pick helper — when the BOM compute wants "a fiber cable for 12-strand SM",
 *  this returns the canonical SKU. Add/replace by category in one place. */
export const CATALOG_DEFAULTS = {
  fiber_sm_12:         "BLD-7814A-12",
  fiber_sm_24:         "BLD-7814A-24",
  fiber_mm_om4_12:     "CMS-OM4-12",
  fiber_pigtail_lc_upc:"PAN-FX-LU-LU-3M",
  fiber_splice_tray:   "PAN-FL-12-A-LU",
  cat6a_horizontal:    "CMS-CAT6A-1000",
  cat6_horizontal:     "BLD-2413-1000",
  copper_jack:         "PAN-CJ688TGYL",
  faceplate_2port:     "HUB-IFP12W",
  faceplate_4port:     "HUB-IFP14W",
  patch_panel_copper:  "LEV-69586-U24",
  patch_panel_fiber:   "PAN-FAP24WBLLCZ",
  rack_42u:            "CPI-55053-703",
  vertical_manager:    "CPI-30130-703",
  patch_cord_cat6a_7ft:"BLD-CA21106-007",
  patch_cord_fiber_3m: "PAN-F5E10P-3M-BU",
  tray_24in_10ft:      "BLN-KP24-10",
  tray_12in_10ft:      "BLN-KP12-10",
  tray_90_elbow_24:    "BLN-KP90-24",
  emt_2in_10ft:        "CRH-EMT-2",
  emt_125in_10ft:      "CRH-EMT-125",
  emt_90_2in:          "BPT-EMT-90-2",
  emt_cpl_2in:         "BPT-EMT-CPL-2",
  innerduct_125:       "DUR-MDPE-125",
  jhook_cat64:         "ERC-CAT64HP",
  tgb:                 "HAR-TGB-10",
  tmgb:                "HAR-TMGB-20",
  bonding_6awg_25ft:   "ERC-BCWB6-25",
  labels_tia606:       "BRD-PTL-1-426",
  firestop_pillow:     "STI-FSP-2",
  firestop_sealant:    "STI-FSC-CK",
} as const;
