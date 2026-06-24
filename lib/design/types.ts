// Design parameter types. Defaults derive from project sector per BICSI TDMM 15.

import type { Sector } from "@/lib/projects/types";

export type HorizontalMedia = "cat6a" | "cat6" | "cat8";
export type BackboneMedia   = "om4" | "om5" | "os2";
export type WapStandard     = "802_11ax" | "802_11be";
export type TargetSpeed     = "1g" | "10g" | "25g" | "40g";
export type Redundancy      = "N" | "N+1" | "2N";
export type OutletType      = "2port_flush" | "4port_surface" | "floor_box";

export interface StandardsLock {
  bicsi:    "TDMM 15";
  tia568:   "TIA-568.1-D" | "TIA-568.1-E";
  tia569:   "TIA-569-D" | "TIA-569-E";
  tia607:   "TIA-607-C";
  nec:      "2017" | "2020" | "2023";
  poePlus:  "802.3at" | "802.3bt";
}

export interface DesignParameters {
  projectId: string;

  // Workarea
  workareaDensity: number;       // SF per WS — sector default
  growthFactor: number;          // 0..1 (e.g. 0.30 = 30%)

  // Cabling
  horizontalMedia: HorizontalMedia;
  backboneMedia:   BackboneMedia;
  portsPerOutlet:  1 | 2 | 3 | 4;
  outletType:      OutletType;

  // Wireless
  wapStandard:        WapStandard;
  wapCoverageRadiusFt: number;   // ft

  // Network
  targetPortSpeed: TargetSpeed;
  redundancy:      Redundancy;

  // Lifecycle
  lifecycleYears: 15 | 20 | 25;

  // Compliance
  trayFillTarget: 0.30 | 0.40;
  standards: StandardsLock;

  updatedAt: string;
}

export interface DesignResults {
  // Workarea
  workareaSf: number;            // sum of room SF for workarea types
  basePositions: number;
  growthPositions: number;
  designPositions: number;       // = base + growth

  // Layout counts
  outlets: number;
  ports:   number;               // = outlets × portsPerOutlet
  waps:    number;

  // Backbone — BICSI TDMM 15 §13.2
  backbone: {
    activeStrands: number;
    spareStrands:  number;
    totalStrands:  number;       // rounded up to 12
    perRiser:      number;
    formula:       string;       // human-readable rendition
  };

  // Equipment
  panelsRequired: number;        // 48-port patch panels
  racksRequired:  number;
  trayLength:     number;        // LF estimate

  // Cost
  bom: {
    materialCents:    number;
    laborHours:       number;
    laborCents:       number;    // NECA MLU
    grandTotalCents:  number;
  };
}

// ── Label maps ──────────────────────────────────────────────────────────────
export const HORIZONTAL_LABEL: Record<HorizontalMedia, string> = {
  cat6a: "Cat6A UTP (10 Gbps · PoE++)",
  cat6:  "Cat6 UTP (1 Gbps · legacy)",
  cat8:  "Cat8 (25/40 Gbps · short reach)",
};
export const BACKBONE_LABEL: Record<BackboneMedia, string> = {
  om4: "OM4 multimode 50/125 (10G · 550 m)",
  om5: "OM5 wideband multimode (100G SWDM)",
  os2: "OS2 single-mode 9/125 (long reach)",
};
export const WAP_LABEL: Record<WapStandard, string> = {
  "802_11ax": "802.11ax (Wi-Fi 6 / 6E)",
  "802_11be": "802.11be (Wi-Fi 7)",
};
export const SPEED_LABEL: Record<TargetSpeed, string> = {
  "1g":  "1 Gbps",
  "10g": "10 Gbps",
  "25g": "25 Gbps",
  "40g": "40 Gbps",
};
export const REDUNDANCY_LABEL: Record<Redundancy, string> = {
  "N":    "N — no redundancy",
  "N+1":  "N+1 — single fault tolerant",
  "2N":   "2N — fully redundant",
};
export const OUTLET_LABEL: Record<OutletType, string> = {
  "2port_flush":     "2-port flush wall mount",
  "4port_surface":   "4-port surface mount",
  "floor_box":       "Floor box (open office)",
};

// ── Sector defaults (BICSI TDMM 15 guidance) ────────────────────────────────
export interface SectorDefaults {
  workareaDensity: number;       // SF per WS
  growthFactor: number;
  wapCoverageRadiusFt: number;
  portsPerOutlet: 1 | 2 | 3 | 4;
  redundancy: Redundancy;
  rationale: string;             // one-liner explaining the default
}

export const SECTOR_DEFAULTS: Record<Sector, SectorDefaults> = {
  healthcare: {
    workareaDensity: 90, growthFactor: 0.30, wapCoverageRadiusFt: 30, portsPerOutlet: 3, redundancy: "N+1",
    rationale: "Healthcare: dense bedside / nurse-station outlets; N+1 backbone for patient-care continuity.",
  },
  education_k12: {
    workareaDensity: 40, growthFactor: 0.30, wapCoverageRadiusFt: 50, portsPerOutlet: 2, redundancy: "N+1",
    rationale: "K-12: 1:1 device program demands ~40 SF/WS; high-density wireless coverage.",
  },
  education_higher_ed: {
    workareaDensity: 50, growthFactor: 0.30, wapCoverageRadiusFt: 40, portsPerOutlet: 2, redundancy: "N+1",
    rationale: "Higher ed: mixed lecture / lab / office mix; standard density.",
  },
  government_federal: {
    workareaDensity: 100, growthFactor: 0.30, wapCoverageRadiusFt: 45, portsPerOutlet: 2, redundancy: "N+1",
    rationale: "Federal: open office + private offices; standard BICSI density.",
  },
  government_state: {
    workareaDensity: 100, growthFactor: 0.30, wapCoverageRadiusFt: 45, portsPerOutlet: 2, redundancy: "N+1",
    rationale: "State / municipal office: standard 100 SF/WS.",
  },
  government_local: {
    workareaDensity: 100, growthFactor: 0.30, wapCoverageRadiusFt: 45, portsPerOutlet: 2, redundancy: "N+1",
    rationale: "Local government: standard 100 SF/WS density.",
  },
  commercial_office: {
    workareaDensity: 100, growthFactor: 0.30, wapCoverageRadiusFt: 50, portsPerOutlet: 2, redundancy: "N+1",
    rationale: "Office: BICSI default 100 SF/WS; 30% growth; standard PoE wireless.",
  },
  commercial_retail: {
    workareaDensity: 200, growthFactor: 0.20, wapCoverageRadiusFt: 50, portsPerOutlet: 2, redundancy: "N",
    rationale: "Retail: low-density WA (POS only); high WAP coverage for inventory + guest Wi-Fi.",
  },
  commercial_hospitality: {
    workareaDensity: 120, growthFactor: 0.25, wapCoverageRadiusFt: 40, portsPerOutlet: 2, redundancy: "N+1",
    rationale: "Hospitality: per-room outlets + lobby/MICE rooms; coverage per guest room.",
  },
  industrial_manufacturing: {
    workareaDensity: 400, growthFactor: 0.20, wapCoverageRadiusFt: 60, portsPerOutlet: 1, redundancy: "N",
    rationale: "Manufacturing: sparse desk WA; coverage WAPs for shop-floor scanners / mobile.",
  },
  industrial_warehouse: {
    workareaDensity: 1500, growthFactor: 0.15, wapCoverageRadiusFt: 80, portsPerOutlet: 1, redundancy: "N",
    rationale: "Warehouse: minimal WA; high-ceiling outdoor-rated WAPs for ASRS / forklift terminals.",
  },
  mixed_use: {
    workareaDensity: 110, growthFactor: 0.30, wapCoverageRadiusFt: 45, portsPerOutlet: 2, redundancy: "N+1",
    rationale: "Mixed use: averaged office / retail density; per-tenant adjustments expected.",
  },
  residential_multifamily: {
    workareaDensity: 250, growthFactor: 0.20, wapCoverageRadiusFt: 35, portsPerOutlet: 1, redundancy: "N",
    rationale: "Multifamily: per-unit outlet + amenity Wi-Fi.",
  },
  data_center: {
    workareaDensity: 1000, growthFactor: 0.40, wapCoverageRadiusFt: 80, portsPerOutlet: 1, redundancy: "2N",
    rationale: "Data center: WA model doesn't apply; rack-and-row drives port count. 2N posture.",
  },
  transportation: {
    workareaDensity: 150, growthFactor: 0.25, wapCoverageRadiusFt: 50, portsPerOutlet: 2, redundancy: "N+1",
    rationale: "Transportation hubs: agent positions + traveler concourse coverage.",
  },
};
