/**
 * Pure design computation. Same inputs → same outputs. No side effects.
 * Backbone strand formula follows BICSI TDMM 15 §13.2.
 *
 * This file ships verbatim into the FastAPI backend port (it'll be transliterated
 * to Python). Keep math explicit and avoid runtime dependencies.
 */

import type { Project } from "@/lib/projects/types";
import type { ExtractedRoom } from "@/lib/intake/types";
import type { DesignParameters, DesignResults } from "./types";

const WORKAREA_ROOM_TYPES = new Set([
  "open_office", "private_office", "conference", "classroom",
  "patient_room", "exam_room", "lab",
]);

// Unit prices (cents) — same magnitudes as the v8 demo BOM.
const PRICES_CENTS = {
  cat6a_lf:           38,     // $0.38/LF
  patch_cord_6ft:     850,
  om4_lf:             210,    // $2.10/LF
  lc_connector:       420,
  outlet_2port:       1850,
  outlet_4port:       2800,
  floor_box:          14500,
  faceplate:          425,
  tray_10ft:          4200,
  panel_48port:       28500,
  rack_42u:           42000,
  wap_ax:             38500,   // 802.11ax
  wap_be:             52000,   // 802.11be
  tmgb:               14500,
  firestop_kit:       3200,
};

// NECA MLU labor units — hours per element.
const LABOR_HOURS = {
  per_outlet:       1.6,
  per_wap:          1.2,
  per_panel:        2.0,
  per_strand_term:  0.35,
  per_tray_10ft:    0.6,
};
const LABOR_RATE_CENTS_PER_HR = 11500; // $115/hr blended

function roundUpTo12(n: number): number {
  return Math.ceil(n / 12) * 12;
}

function roundCents(n: number): number {
  return Math.round(n);
}

export function computeDesign(
  params: DesignParameters,
  project: Project,
  confirmedRooms: ExtractedRoom[],
): DesignResults {
  // 1. Workarea SF — sum of confirmed (non-excluded) workarea-eligible rooms
  const workareaRooms = confirmedRooms.filter(
    (r) => !r.excluded && WORKAREA_ROOM_TYPES.has(r.overrideType ?? r.type),
  );
  const workareaSf = workareaRooms.reduce((s, r) => s + r.area, 0)
    || Math.round(project.totalSf * 0.55); // fallback when intake has no workarea rooms

  // 2. Design positions
  const basePositions = Math.ceil(workareaSf / params.workareaDensity);
  const growthPositions = Math.ceil(basePositions * params.growthFactor);
  const designPositions = basePositions + growthPositions;

  // 3. Outlets — one per WA position
  const outlets = designPositions;
  const ports = outlets * params.portsPerOutlet;

  // 4. WAPs — circle coverage model
  const wapCoverageArea = Math.PI * Math.pow(params.wapCoverageRadiusFt, 2);
  const waps = Math.max(2, Math.ceil(project.totalSf / wapCoverageArea));

  // 5. Backbone strands — BICSI TDMM 15 §13.2
  const active = Math.max(6, Math.ceil(designPositions / 24) * 2);
  const spare  = Math.ceil(active * params.growthFactor);
  const total  = roundUpTo12(active + spare);
  const perRiser = Math.max(12, total);
  const formula =
    `active = max(6, ⌈${designPositions} drops / 24⌉ × 2) = ${active}\n` +
    `spare  = ⌈${active} × ${(params.growthFactor * 100).toFixed(0)}%⌉ = ${spare}\n` +
    `total  = round_up_to_12(${active} + ${spare}) = ${total}\n` +
    `per riser = max(12, ${total}) = ${perRiser}`;

  // 6. Equipment counts
  const panelsRequired = Math.ceil(ports / 48);
  // Rough: 12 panels per rack
  const racksRequired = Math.max(1, Math.ceil(panelsRequired / 12));

  // 7. Cable lengths
  // Horizontal cable per outlet — assume average pull = sqrt(workareaSf/2) feet
  const avgPullFt = Math.sqrt(workareaSf / 2);
  const horizontalLf = Math.round(outlets * avgPullFt);

  // Tray length — perimeter approximation + spine; assume sqrt(SF) per floor as spine length
  const trayLength = Math.round(Math.sqrt(workareaSf) * project.floors);

  // 8. BOM
  const horizontalCost = horizontalLf * PRICES_CENTS.cat6a_lf
                       + outlets * PRICES_CENTS.patch_cord_6ft;
  const backboneCost   = perRiser * (project.floors - 1) * 50 * PRICES_CENTS.om4_lf // ~50 LF between floors
                       + active * 2 * PRICES_CENTS.lc_connector;
  const outletCost     = outlets * (params.outletType === "4port_surface"
                                      ? PRICES_CENTS.outlet_4port
                                      : params.outletType === "floor_box"
                                      ? PRICES_CENTS.floor_box
                                      : PRICES_CENTS.outlet_2port)
                       + outlets * PRICES_CENTS.faceplate;
  const trayCost       = Math.ceil(trayLength / 10) * PRICES_CENTS.tray_10ft;
  const panelCost      = panelsRequired * PRICES_CENTS.panel_48port;
  const rackCost       = racksRequired * PRICES_CENTS.rack_42u;
  const wapCost        = waps * (params.wapStandard === "802_11be" ? PRICES_CENTS.wap_be : PRICES_CENTS.wap_ax);
  const groundingCost  = PRICES_CENTS.tmgb * project.floors;
  const firestopCost   = PRICES_CENTS.firestop_kit * project.floors * 2;

  const materialCents = horizontalCost + backboneCost + outletCost
                      + trayCost + panelCost + rackCost
                      + wapCost + groundingCost + firestopCost;

  // 9. Labor (NECA MLU)
  const laborHours = outlets * LABOR_HOURS.per_outlet
                   + waps    * LABOR_HOURS.per_wap
                   + panelsRequired * LABOR_HOURS.per_panel
                   + active  * LABOR_HOURS.per_strand_term
                   + Math.ceil(trayLength / 10) * LABOR_HOURS.per_tray_10ft;
  const laborCents = Math.round(laborHours * LABOR_RATE_CENTS_PER_HR);

  const grandTotalCents = materialCents + laborCents;

  return {
    workareaSf,
    basePositions, growthPositions, designPositions,
    outlets, ports, waps,
    backbone: { activeStrands: active, spareStrands: spare, totalStrands: total, perRiser, formula },
    panelsRequired, racksRequired, trayLength,
    bom: {
      materialCents: roundCents(materialCents),
      laborHours: Math.round(laborHours),
      laborCents: roundCents(laborCents),
      grandTotalCents: roundCents(grandTotalCents),
    },
  };
}
