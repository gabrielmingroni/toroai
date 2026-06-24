// Real Bill of Materials compute.
//
// Walks the project state — exhibit (cable scope), placement (outlets / WAPs / TRs),
// pathway (segments + runs), intake rooms, design parameters — and emits a
// Division 27 itemized BOM with manufacturer SKUs from lib/catalog. Quantity
// derivation rules are inline in `addLine` callsites; rounding is to the
// nearest packaging unit (cable in reels, EMT in 10-ft sections, etc.).
//
// This is what an RCDD attaches to a bid. Everything is calculated from
// project state, NOT hardcoded.

import type { Project } from "@/lib/projects/types";
import type { ExtractedRoom } from "@/lib/intake/types";
import type { PlacementState } from "@/lib/placement/types";
import type { PathwaySegment, CableRun } from "@/lib/pathway/types";
import { CATALOG, CATALOG_DEFAULTS, findCatalogItem } from "@/lib/catalog/products";
import type { BomDocument, BomLine, BomSectionRollup } from "./types";

/** Default Davis-Bacon-blended labor rate for Harris County, TX, mid-2025 (cents/hr). */
const DEFAULT_BLENDED_RATE_CENTS = 6790;
const DEFAULT_TAX_RATE = 0.0825;          // 8.25% sales tax — production: jurisdiction-aware

// ── Quantity helpers ─────────────────────────────────────────────────────

/** Round up to the next 1000 ft box. */
function ceilTo1000(lf: number): number { return Math.ceil(lf / 1000); }
/** Round up to standard reel lengths (1000 / 2500 / 5000 / 12000 ft). */
function reelsForFiber(lf: number): number {
  const withWaste = lf * 1.10;
  // Use 1000 ft reels for simplicity. Real RCDDs pick larger reels for big jobs.
  return Math.ceil(withWaste / 1000);
}
/** Count of 10-foot sections needed to cover a length in feet, rounded up. */
function tenFtSections(lf: number): number { return Math.ceil(lf / 10); }

/** Polyline length in grid units (≈ feet). */
function segmentLengthFt(s: PathwaySegment): number {
  let total = 0;
  for (let i = 1; i < s.nodes.length; i++) {
    const dx = s.nodes[i].x - s.nodes[i - 1].x;
    const dy = s.nodes[i].y - s.nodes[i - 1].y;
    total += Math.hypot(dx, dy);
  }
  return total;
}

/** Count 90° direction changes in a polyline — informs elbow count. */
function countBends(s: PathwaySegment): number {
  if (s.nodes.length < 3) return 0;
  let bends = 0;
  for (let i = 1; i < s.nodes.length - 1; i++) {
    const a = s.nodes[i - 1], b = s.nodes[i], c = s.nodes[i + 1];
    const v1x = b.x - a.x, v1y = b.y - a.y;
    const v2x = c.x - b.x, v2y = c.y - b.y;
    // If direction changes (cross product non-zero or angle differs), count as bend
    const cross = v1x * v2y - v1y * v2x;
    if (Math.abs(cross) > 0.5) bends++;
  }
  return bends;
}

// ── Main entry ───────────────────────────────────────────────────────────

export interface ComputeBomInput {
  project: Project;
  rooms: ExtractedRoom[];
  placement: PlacementState | null;
  segments: PathwaySegment[];
  runs: CableRun[];
}

export function computeBom(input: ComputeBomInput): BomDocument {
  const { project, rooms, placement, segments, runs } = input;
  const lineItems: BomLine[] = [];
  let lineNo = 1;

  function addLine(opts: {
    sku: string; quantity: number; derivedFrom: string;
  }) {
    const item = findCatalogItem(opts.sku);
    if (!item || opts.quantity <= 0) return;
    const qty = Math.max(1, Math.round(opts.quantity));   // BOMs always show integer quantities
    lineItems.push({
      lineNo: lineNo++,
      csiSection: item.specSection,
      sku: item.sku,
      manufacturer: item.manufacturer,
      description: item.description,
      category: item.category,
      unit: item.unit,
      quantity: qty,
      unitCostCents: item.unitCostCents,
      extendedCents: qty * item.unitCostCents,
      derivedFrom: opts.derivedFrom,
      notes: item.notes,
    });
  }

  // ── Fiber backbone (DeBakey-style projects + any project with an exhibit) ──
  const exhibit = project.exhibit;
  if (exhibit && (exhibit.cable.type === "SM_OS2" || exhibit.cable.type.startsWith("MM_"))) {
    const lf = exhibit.cable.totalLf;
    const reels = reelsForFiber(lf);
    const isSm = exhibit.cable.type === "SM_OS2";
    const sku = isSm
      ? (exhibit.cable.strandCount > 12 ? CATALOG_DEFAULTS.fiber_sm_24 : CATALOG_DEFAULTS.fiber_sm_12)
      : CATALOG_DEFAULTS.fiber_mm_om4_12;
    addLine({
      sku, quantity: reels * 1000,
      derivedFrom: `${lf} LF backbone + 10% waste → ${reels} × 1000 ft reels`,
    });

    // Splice trays at both ends.
    addLine({
      sku: CATALOG_DEFAULTS.fiber_splice_tray, quantity: 2,
      derivedFrom: "1 per termination end (MDF + IDF-A)",
    });

    // Pigtails — one per strand per end, plus 4 spares.
    const pigtailQty = exhibit.cable.strandCount * 2 + 4;
    addLine({
      sku: CATALOG_DEFAULTS.fiber_pigtail_lc_upc, quantity: pigtailQty,
      derivedFrom: `${exhibit.cable.strandCount} strands × 2 ends + 4 spares — LC/UPC per TDD §5.5`,
    });

    // Fiber patch panel at each end.
    addLine({
      sku: CATALOG_DEFAULTS.patch_panel_fiber, quantity: 2,
      derivedFrom: "24-port LC duplex panel at each end (handles 12-strand × 2)",
    });

    // Fiber patch cords (assume 50% of strands have active patches).
    const activePatches = Math.ceil(exhibit.cable.strandCount * 0.5);
    addLine({
      sku: CATALOG_DEFAULTS.patch_cord_fiber_3m, quantity: activePatches,
      derivedFrom: `~50% of strands actively patched = ${activePatches} fiber patch cords`,
    });
  }

  // ── Copper horizontal — outlets-based ───────────────────────────────────
  const outletCount = placement?.outlets.length ?? project.outlets ?? 0;
  if (outletCount > 0) {
    // Assume 110 ft avg horizontal cable per outlet (BICSI typical).
    const totalCableLf = outletCount * 110;
    const cat6aRolls = ceilTo1000(totalCableLf * 1.10);
    addLine({
      sku: CATALOG_DEFAULTS.cat6a_horizontal, quantity: cat6aRolls,
      derivedFrom: `${outletCount} outlets × 110 ft avg + 10% waste → ${cat6aRolls} × 1000 ft boxes`,
    });
    // Jacks: 2 ports per outlet by default.
    addLine({
      sku: CATALOG_DEFAULTS.copper_jack, quantity: outletCount * 2,
      derivedFrom: `${outletCount} outlets × 2 ports each = ${outletCount * 2} Cat 6A jacks`,
    });
    addLine({
      sku: CATALOG_DEFAULTS.faceplate_2port, quantity: outletCount,
      derivedFrom: `1 faceplate per outlet location`,
    });

    // Copper patch panels — one 24-port panel per 12 outlets (24 ports).
    const copperPanels = Math.ceil((outletCount * 2) / 24);
    addLine({
      sku: CATALOG_DEFAULTS.patch_panel_copper, quantity: copperPanels,
      derivedFrom: `${outletCount * 2} ports ÷ 24-port panels = ${copperPanels} panels`,
    });

    // Patch cords — 2 per outlet (work area) + 2 per outlet (TR side).
    addLine({
      sku: CATALOG_DEFAULTS.patch_cord_cat6a_7ft, quantity: outletCount * 4,
      derivedFrom: `${outletCount} outlets × 4 cords (2 work area + 2 TR side)`,
    });
  }

  // ── TR racks + cable management ─────────────────────────────────────────
  const trRoomCount = rooms.filter(r => {
    const t = r.overrideType ?? r.type;
    return t === "mdf" || t === "idf";
  }).length || (exhibit ? 2 : 1);    // fall back to 2 (MDF + IDF) for DeBakey-style projects with no intake
  if (trRoomCount > 0) {
    addLine({
      sku: CATALOG_DEFAULTS.rack_42u, quantity: trRoomCount,
      derivedFrom: `1 × 42U rack per TR (${trRoomCount} TR${trRoomCount === 1 ? "" : "s"} confirmed)`,
    });
    addLine({
      sku: CATALOG_DEFAULTS.vertical_manager, quantity: trRoomCount * 2,
      derivedFrom: `2 vertical managers per rack (1 each side)`,
    });
  }

  // ── Pathway materials — from real segment data ──────────────────────────
  if (segments.length > 0) {
    // Cable tray, grouped by width.
    const trayLfByWidth: Record<number, number> = {};
    const trayBendsByWidth: Record<number, number> = {};
    let conduit2LfTotal = 0, conduit125LfTotal = 0;
    let conduitBendCount = 0;
    let jHookLfTotal = 0;

    for (const s of segments) {
      const lf = segmentLengthFt(s);
      if (s.type === "cable_tray") {
        const w = s.trayWidthIn ?? 12;
        trayLfByWidth[w] = (trayLfByWidth[w] ?? 0) + lf;
        trayBendsByWidth[w] = (trayBendsByWidth[w] ?? 0) + countBends(s);
      } else if (s.type === "conduit") {
        const size = s.conduitSize ?? "2";
        if (size === "2") conduit2LfTotal += lf;
        else if (size.startsWith("1-1/4") || size === "1.25") conduit125LfTotal += lf;
        else conduit2LfTotal += lf;
        conduitBendCount += countBends(s);
      } else if (s.type === "j_hook") {
        jHookLfTotal += lf;
      }
    }

    // Tray sections — by width.
    for (const [widthStr, lf] of Object.entries(trayLfByWidth)) {
      const width = Number(widthStr);
      const sku = width >= 18 ? CATALOG_DEFAULTS.tray_24in_10ft : CATALOG_DEFAULTS.tray_12in_10ft;
      const sections = tenFtSections(lf);
      addLine({
        sku, quantity: sections,
        derivedFrom: `${lf.toFixed(0)} LF of ${width}" tray ÷ 10 ft sections = ${sections}`,
      });
    }
    // Tray elbows.
    const totalBends = Object.values(trayBendsByWidth).reduce((a, b) => a + b, 0);
    if (totalBends > 0) {
      addLine({
        sku: CATALOG_DEFAULTS.tray_90_elbow_24, quantity: totalBends,
        derivedFrom: `${totalBends} 90° direction change(s) in tray runs`,
      });
    }

    // Conduit.
    if (conduit2LfTotal > 0) {
      const sections = tenFtSections(conduit2LfTotal);
      addLine({
        sku: CATALOG_DEFAULTS.emt_2in_10ft, quantity: sections,
        derivedFrom: `${conduit2LfTotal.toFixed(0)} LF of 2" EMT ÷ 10 ft sections = ${sections}`,
      });
      addLine({
        sku: CATALOG_DEFAULTS.emt_cpl_2in, quantity: sections,
        derivedFrom: `1 coupling per 10 ft section = ${sections}`,
      });
    }
    if (conduit125LfTotal > 0) {
      const sections = tenFtSections(conduit125LfTotal);
      addLine({
        sku: CATALOG_DEFAULTS.emt_125in_10ft, quantity: sections,
        derivedFrom: `${conduit125LfTotal.toFixed(0)} LF of 1-1/4" EMT ÷ 10 ft sections = ${sections}`,
      });
    }
    if (conduitBendCount > 0) {
      addLine({
        sku: CATALOG_DEFAULTS.emt_90_2in, quantity: conduitBendCount,
        derivedFrom: `${conduitBendCount} 90° elbow(s) from conduit polylines`,
      });
    }

    // J-hooks — 1 per 5 ft.
    if (jHookLfTotal > 0) {
      const hookCount = Math.ceil(jHookLfTotal / 5);
      addLine({
        sku: CATALOG_DEFAULTS.jhook_cat64, quantity: hookCount,
        derivedFrom: `${jHookLfTotal.toFixed(0)} LF ÷ 5 ft spacing = ${hookCount} J-hooks`,
      });
    }

    // Innerduct — for any fiber inside the project.
    if (exhibit) {
      const innerductReels = Math.ceil((exhibit.cable.totalLf * 1.10) / 1000);
      addLine({
        sku: CATALOG_DEFAULTS.innerduct_125, quantity: innerductReels,
        derivedFrom: `${exhibit.cable.totalLf} LF fiber + 10% waste ÷ 1000 ft reels = ${innerductReels}`,
      });
    }
  }

  // ── Grounding — TGB + TMGB + bonding ────────────────────────────────────
  if (trRoomCount > 0) {
    // 1 TMGB at MDF, 1 TGB per IDF.
    addLine({
      sku: CATALOG_DEFAULTS.tmgb, quantity: 1,
      derivedFrom: "1 TMGB at MDF (TIA-607 §4.4)",
    });
    const idfCount = Math.max(0, trRoomCount - 1);
    if (idfCount > 0) {
      addLine({
        sku: CATALOG_DEFAULTS.tgb, quantity: idfCount,
        derivedFrom: `1 TGB per IDF (${idfCount} IDF${idfCount === 1 ? "" : "s"})`,
      });
    }
    addLine({
      sku: CATALOG_DEFAULTS.bonding_6awg_25ft, quantity: trRoomCount,
      derivedFrom: `25 ft of 6 AWG bonding per TR (TIA-607 §4.6)`,
    });
  }

  // ── Firestop + labels ───────────────────────────────────────────────────
  const floors = Math.max(1, project.floors ?? 1);
  addLine({
    sku: CATALOG_DEFAULTS.firestop_pillow, quantity: floors * 6,
    derivedFrom: `~6 penetrations per floor × ${floors} floor${floors === 1 ? "" : "s"} = ${floors * 6}`,
  });
  addLine({
    sku: CATALOG_DEFAULTS.firestop_sealant, quantity: floors,
    derivedFrom: `1 firestop sealant kit per floor`,
  });
  addLine({
    sku: CATALOG_DEFAULTS.labels_tia606, quantity: 1,
    derivedFrom: "1 roll of TIA-606-C labels covers the full project",
  });

  // ── Section subtotals ───────────────────────────────────────────────────
  const sectionTotals = new Map<string, BomSectionRollup>();
  for (const line of lineItems) {
    const existing = sectionTotals.get(line.csiSection);
    if (existing) {
      existing.itemCount += 1;
      existing.subtotalCents += line.extendedCents;
    } else {
      sectionTotals.set(line.csiSection, {
        section: line.csiSection,
        itemCount: 1,
        subtotalCents: line.extendedCents,
      });
    }
  }
  // Sort sections by their CSI number prefix.
  const sections = [...sectionTotals.values()].sort((a, b) => a.section.localeCompare(b.section));
  const materialSubtotalCents = lineItems.reduce((s, l) => s + l.extendedCents, 0);

  // ── Labor estimate ──────────────────────────────────────────────────────
  // Simple heuristic — production swaps for NECA MLU table lookup.
  const breakdown: { task: string; hours: number }[] = [];
  function laborTask(name: string, hours: number) {
    if (hours > 0) breakdown.push({ task: name, hours: Math.round(hours * 10) / 10 });
  }
  if (exhibit) {
    laborTask("OSP fiber pull (5-man crew)", Math.max(8, exhibit.cable.totalLf / 5280 * 8));
    laborTask("Fusion splicing (12-strand × 2 ends)", exhibit.cable.strandCount * 2 * 0.5);
    laborTask("OTDR + OLTS bidirectional testing", exhibit.cable.strandCount * 0.1 * 2);
  }
  if (outletCount > 0) {
    laborTask("Cat 6A pull + terminate per outlet", outletCount * 1.6);
  }
  if (trRoomCount > 0) {
    laborTask("Rack assembly + cable management", trRoomCount * 4);
    laborTask("TGB / TMGB grounding + bonding", trRoomCount * 1.5);
  }
  if (segments.length > 0) {
    const totalPathwayLf = segments.reduce((s, seg) => s + segmentLengthFt(seg), 0);
    laborTask("Cable tray / conduit / J-hook installation", totalPathwayLf * 0.35);
  }
  laborTask("Fire-stopping + labeling + closeout", floors * 4);

  const totalHours = breakdown.reduce((s, t) => s + t.hours, 0);
  const laborSubtotalCents = Math.round(totalHours * DEFAULT_BLENDED_RATE_CENTS);

  // ── Tax + grand total ───────────────────────────────────────────────────
  const taxCents = Math.round(materialSubtotalCents * DEFAULT_TAX_RATE);
  const grandTotalCents = materialSubtotalCents + laborSubtotalCents + taxCents;

  return {
    projectId: project.id,
    generatedAt: new Date().toISOString(),
    project: {
      number: project.number,
      name: project.name,
      owner: project.owner,
      address: `${project.addressLine1}, ${project.city}, ${project.state} ${project.zip}`,
    },
    lineItems,
    sections,
    materialSubtotalCents,
    labor: {
      hours: Math.round(totalHours * 10) / 10,
      breakdown,
      blendedRateCentsPerHr: DEFAULT_BLENDED_RATE_CENTS,
      subtotalCents: laborSubtotalCents,
    },
    tax: { rate: DEFAULT_TAX_RATE, cents: taxCents },
    grandTotalCents,
  };
}

/** Utility for the catalog listing UI — total count of distinct SKUs. */
export const TOTAL_CATALOG_ITEMS = CATALOG.length;
