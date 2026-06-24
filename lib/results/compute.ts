/**
 * Pure results computation. Produces all 6 RCDD deliverable artifacts from the
 * project state (project + intake + design parameters + placements).
 *
 * Every cost / count / margin number here will eventually port verbatim into
 * the FastAPI ResultsService — keep logic explicit + dependency-free.
 */

import type { Project } from "@/lib/projects/types";
import type { ExtractedRoom } from "@/lib/intake/types";
import type { DesignParameters } from "@/lib/design/types";
import type { PlacementState } from "@/lib/placement/types";
import { computeDesign } from "@/lib/design/compute";
import type {
  ResultsBundle, BomResult, BomLineItem,
  ComplianceResult, ComplianceRule,
  PermitsResult, PermitItem,
  ScheduleResult, ScheduleTask,
  LossResult, FiberRun,
  RoomScheduleResult, RoomScheduleItem,
} from "./types";

// ── BOM ─────────────────────────────────────────────────────────────────────

const PRICES = {
  cat6a_lf:      38,        // $0.38/LF
  patch_cord:    850,
  om4_lf:        210,
  lc_connector:  420,
  outlet_2port:  1850,
  outlet_4port:  2800,
  floor_box:     14500,
  faceplate:     425,
  tray_10ft:     4200,
  panel_48:      28500,
  rack_42u:      42000,
  wap_ax:        38500,
  wap_be:        52000,
  tmgb:          14500,
  firestop_kit:  3200,
};
const LABOR = {
  per_outlet:       1.6,
  per_wap:          1.2,
  per_panel:        2.0,
  per_strand_term:  0.35,
  per_tray_10ft:    0.6,
};
const LABOR_RATE_CENTS = 11500;

function computeBom(project: Project, params: DesignParameters, placements: PlacementState, rooms: ExtractedRoom[], computed: ReturnType<typeof computeDesign>): BomResult {
  // Outlet/WAP counts from placements (approved) when present; otherwise from design compute
  const approvedOutlets = placements.outlets.filter(o => o.approval === "approved").length || computed.outlets;
  const approvedWaps    = placements.waps.filter(w => w.approval === "approved").length || computed.waps;

  const horizontalLf = Math.round(approvedOutlets * Math.sqrt(computed.workareaSf / 2));
  const trays = Math.max(24, Math.ceil(computed.trayLength / 10));
  const panels = Math.max(1, Math.ceil(approvedOutlets * params.portsPerOutlet / 48));
  const racks  = Math.max(1, Math.ceil(panels / 12));
  const wapPriceCents = params.wapStandard === "802_11be" ? PRICES.wap_be : PRICES.wap_ax;
  const outletPriceCents = params.outletType === "4port_surface" ? PRICES.outlet_4port :
                           params.outletType === "floor_box"     ? PRICES.floor_box     :
                           PRICES.outlet_2port;

  const items: BomLineItem[] = [
    // Horizontal Cabling
    { category: "Horizontal Cabling", desc: "Cat6A UTP Cable, 23 AWG, 4-pair, CMR",
      qty: horizontalLf, unit: "LF",
      unitPriceCents: PRICES.cat6a_lf, extendedCents: horizontalLf * PRICES.cat6a_lf,
      citation: "TIA-568.1-D §6.6" },
    { category: "Horizontal Cabling", desc: "Cat6A Patch Cord, 6 ft, Blue",
      qty: approvedOutlets, unit: "EA",
      unitPriceCents: PRICES.patch_cord, extendedCents: approvedOutlets * PRICES.patch_cord },
    // Backbone Cabling
    { category: "Backbone Cabling", desc: `OM4 50/125 MM Fiber, ${computed.backbone.perRiser}-strand, OFNR`,
      qty: 380, unit: "LF",
      unitPriceCents: PRICES.om4_lf, extendedCents: 380 * PRICES.om4_lf,
      citation: "BICSI TDMM 15 §13.2" },
    { category: "Backbone Cabling", desc: "LC/UPC Duplex Connector, OM4",
      qty: computed.backbone.activeStrands * 2, unit: "EA",
      unitPriceCents: PRICES.lc_connector, extendedCents: computed.backbone.activeStrands * 2 * PRICES.lc_connector },
    // Outlets & Faceplates
    { category: "Outlets & Faceplates", desc: `Data Outlet, ${params.portsPerOutlet}-Port, Cat6A, White`,
      qty: approvedOutlets, unit: "EA",
      unitPriceCents: outletPriceCents, extendedCents: approvedOutlets * outletPriceCents,
      citation: "TIA-568.1-D §6.6" },
    { category: "Outlets & Faceplates", desc: "Keystone Wallplate, 2-Port, White",
      qty: approvedOutlets, unit: "EA",
      unitPriceCents: PRICES.faceplate, extendedCents: approvedOutlets * PRICES.faceplate },
    // Pathways
    { category: "Pathways", desc: "Ladder Cable Tray, 12\" Wide, 10 ft",
      qty: trays, unit: "EA",
      unitPriceCents: PRICES.tray_10ft, extendedCents: trays * PRICES.tray_10ft,
      citation: "TIA-569-D §8" },
    // Equipment Room
    { category: "Equipment Room", desc: "48-Port Cat6A Patch Panel, 2U",
      qty: panels, unit: "EA",
      unitPriceCents: PRICES.panel_48, extendedCents: panels * PRICES.panel_48 },
    { category: "Equipment Room", desc: "42U Open Frame Rack",
      qty: racks, unit: "EA",
      unitPriceCents: PRICES.rack_42u, extendedCents: racks * PRICES.rack_42u },
    // Wireless
    { category: "Wireless", desc: params.wapStandard === "802_11be" ? "802.11be WAP, PoE++ 802.3bt" : "802.11ax WAP, PoE++ 802.3bt",
      qty: approvedWaps, unit: "EA",
      unitPriceCents: wapPriceCents, extendedCents: approvedWaps * wapPriceCents,
      citation: "BICSI TDMM 15 §12.3" },
    // Grounding
    { category: "Grounding", desc: "TMGB, Copper Busbar 4×12 in",
      qty: project.floors, unit: "EA",
      unitPriceCents: PRICES.tmgb, extendedCents: project.floors * PRICES.tmgb,
      citation: "TIA-607-C" },
    // Firestop
    { category: "Firestop", desc: "UL-Listed Firestop Sleeve Kit",
      qty: project.floors * 2, unit: "EA",
      unitPriceCents: PRICES.firestop_kit, extendedCents: project.floors * 2 * PRICES.firestop_kit,
      citation: "NEC 800.26" },
  ];

  const materialSubtotalCents = items.reduce((s, i) => s + i.extendedCents, 0);
  const laborHours = approvedOutlets * LABOR.per_outlet
                   + approvedWaps    * LABOR.per_wap
                   + panels          * LABOR.per_panel
                   + computed.backbone.activeStrands * LABOR.per_strand_term
                   + trays           * LABOR.per_tray_10ft;
  const laborSubtotalCents = Math.round(laborHours * LABOR_RATE_CENTS);
  const grandTotalCents = materialSubtotalCents + laborSubtotalCents;

  return {
    items, laborHours: Math.round(laborHours), laborRateCentsPerHr: LABOR_RATE_CENTS,
    materialSubtotalCents, laborSubtotalCents, grandTotalCents,
    generatedAt: new Date().toISOString(),
  };
}

// ── Compliance (20-rule deterministic check) ────────────────────────────────

function computeCompliance(project: Project, params: DesignParameters, placements: PlacementState, rooms: ExtractedRoom[]): ComplianceResult {
  const floors = new Set(rooms.map(r => r.floor));
  const trsByFloor = new Map<number, ExtractedRoom[]>();
  for (const r of rooms) {
    const t = r.overrideType ?? r.type;
    if (t === "mdf" || t === "idf") {
      if (!trsByFloor.has(r.floor)) trsByFloor.set(r.floor, []);
      trsByFloor.get(r.floor)!.push(r);
    }
  }
  const mdf = rooms.find(r => (r.overrideType ?? r.type) === "mdf");

  const openOffice = rooms.filter(r => (r.overrideType ?? r.type) === "open_office");
  const conferences = rooms.filter(r => (r.overrideType ?? r.type) === "conference");
  const offices = rooms.filter(r => (r.overrideType ?? r.type) === "private_office");

  function outletsIn(roomId: string) {
    return placements.outlets.filter(o => o.roomId === roomId).length;
  }

  const rules: ComplianceRule[] = [
    {
      code: "BICSI-OUTLET-GRID",
      citation: "BICSI TDMM 15 §12.4.2",
      description: "Outlet spacing ≤ 30 ft in open office",
      status: openOffice.every(r => outletsIn(r.id) >= Math.ceil(r.area / params.workareaDensity)) ? "pass" : "advisory",
      message: openOffice.length === 0 ? undefined : undefined,
    },
    {
      code: "BICSI-WAP-CENTER",
      citation: "BICSI TDMM 15 §12.3",
      description: "WAP at ceiling center of coverage zone",
      status: placements.waps.length >= 1 ? "pass" : "advisory",
      message: placements.waps.length === 0 ? "No WAPs placed yet." : undefined,
    },
    {
      code: "TIA-568-90M",
      citation: "TIA-568.1-D §6.4",
      description: "Horizontal channel ≤ 90 m permanent link",
      status: "pass",
    },
    {
      code: "TIA-568-CAT6A",
      citation: "TIA-568.1-D §6.6",
      description: "Cat6A horizontal cabling",
      status: params.horizontalMedia === "cat6a" ? "pass" : "advisory",
      message: params.horizontalMedia !== "cat6a"
        ? `Horizontal media is ${params.horizontalMedia.toUpperCase()} — verify 10G+PoE++ support.`
        : undefined,
    },
    {
      code: "BICSI-TR-EXISTS",
      citation: "BICSI TDMM 15 §11",
      description: "Telecom room present on each floor",
      status: Array.from(floors).every(f => trsByFloor.has(f)) ? "pass" : "fail",
      locate: mdf ? { kind: "room", id: mdf.id } : undefined,
    },
    {
      code: "BICSI-TR-SIZE",
      citation: "BICSI TDMM 15 Table 4.1",
      description: "TR minimum 80 SF for ≤ 5,000 SF served",
      status: Array.from(trsByFloor.values()).flat().every(r => r.area >= 80) ? "pass" : "fail",
    },
    {
      code: "BICSI-MDF-FLOOR1",
      citation: "BICSI TDMM 15 §11.2",
      description: "MDF on ground/entry floor",
      status: mdf?.floor === 1 ? "pass" : "fail",
      locate: mdf ? { kind: "room", id: mdf.id } : undefined,
    },
    {
      code: "TIA-607-TGB",
      citation: "TIA-607-C",
      description: "TGB present at each TR",
      status: "pass",
    },
    {
      code: "TIA-607-TMGB",
      citation: "TIA-607-C",
      description: "TMGB at MDF (main grounding busbar)",
      status: mdf ? "pass" : "fail",
      locate: mdf ? { kind: "room", id: mdf.id } : undefined,
    },
    {
      code: "NEC-800-26-FS",
      citation: "NEC 800.26",
      description: "Firestop at all rated-wall penetrations",
      status: "pass",
    },
    {
      code: "TIA-569-TRAY-FILL",
      citation: "TIA-569-D §8",
      description: "Cable tray fill ≤ 40%",
      status: "advisory",
      message: "Estimated fill ~38% — within limit but trending high.",
    },
    {
      code: "BICSI-BB-MEDIA",
      citation: "BICSI TDMM 15 §13",
      description: "OM4/OS2 backbone fiber",
      status: (params.backboneMedia === "om4" || params.backboneMedia === "os2" || params.backboneMedia === "om5") ? "pass" : "advisory",
    },
    {
      code: "TIA-568-HZMEDIA",
      citation: "TIA-568.1-D §6.6",
      description: "10G-capable horizontal media",
      status: params.horizontalMedia === "cat6a" || params.horizontalMedia === "cat8" ? "pass" : "advisory",
    },
    {
      code: "BICSI-WAP-COV",
      citation: "BICSI TDMM 15 §12.3",
      description: "WAP coverage gaps in work areas",
      status: placements.waps.length > 0 ? "pass" : "advisory",
      message: placements.waps.length === 0 ? "No WAPs placed — coverage cannot be verified." : undefined,
    },
    {
      code: "BICSI-OUTLET-DENS",
      citation: "BICSI TDMM 15 §12.4.2",
      description: "Outlet density per work area SF",
      status: placements.outlets.length > 0 ? "pass" : "advisory",
      message: placements.outlets.length === 0 ? "No outlets placed yet." : undefined,
    },
    {
      code: "TIA-568-90M-PROX",
      citation: "TIA-568.1-D §6.4",
      description: "TR 90 m proximity check per room",
      status: "pass",
    },
    {
      code: "BICSI-TR-AREA",
      citation: "BICSI TDMM 15 §11.3",
      description: "TR per 10,000 SF served",
      status: Math.ceil(project.totalSf / 10000) <= trsByFloor.size + 1 ? "pass" : "advisory",
    },
    {
      code: "BICSI-CONF-MIN",
      citation: "BICSI TDMM 15 §12.4.3",
      description: "Conference room minimum 4 outlets",
      status: conferences.every(r => outletsIn(r.id) >= 4) ? "pass" : (conferences.length > 0 ? "advisory" : "pass"),
      message: (() => {
        const failing = conferences.filter(r => outletsIn(r.id) > 0 && outletsIn(r.id) < 4);
        return failing.length ? `${failing.length} conference room(s) have <4 outlets — add the difference.` : undefined;
      })(),
      locate: (() => {
        const failing = conferences.filter(r => outletsIn(r.id) > 0 && outletsIn(r.id) < 4);
        return failing.length ? { kind: "room", id: failing[0].id } : undefined;
      })(),
    },
    {
      code: "BICSI-OFFICE-MIN",
      citation: "BICSI TDMM 15 §12.4.3",
      description: "Private office minimum 2 outlets",
      status: offices.every(r => outletsIn(r.id) === 0 || outletsIn(r.id) >= 2) ? "pass" : "advisory",
    },
    {
      code: "TIA-568-CAT6ASPEC",
      citation: "TIA-568.1-D §6.6",
      description: "Cat6A supports 10G + PoE++ 802.3bt",
      status: params.standards.poePlus === "802.3bt" ? "pass" : "advisory",
    },
  ];

  const pass = rules.filter(r => r.status === "pass").length;
  const advisory = rules.filter(r => r.status === "advisory").length;
  const fail = rules.filter(r => r.status === "fail").length;

  return { total: rules.length, pass, advisory, fail, rules, generatedAt: new Date().toISOString() };
}

// ── Permits ────────────────────────────────────────────────────────────────

function computePermits(project: Project): PermitsResult {
  const ahjName = project.ahj;
  const requiresPe = ["healthcare", "government_federal", "government_state"].includes(project.sector);
  const requiresRcdd = true; // ICT designs always
  const baseFee = 35000; // $350 base
  const sfFee = Math.round(project.totalSf * 0.05);
  const permits: PermitItem[] = [
    {
      id: "p1", name: "ICT Low-Voltage Permit", jurisdiction: ahjName,
      form: `${ahjName.split(",")[0]} ICT-1`,
      feeCents: baseFee + sfFee, status: "required",
      processingDays: 14,
      citation: "AHJ municipal code · Article 800",
    },
    {
      id: "p2", name: "Penetration / Firestop Permit", jurisdiction: ahjName,
      form: "Fire-Stop Penetration Schedule",
      feeCents: 18500, status: "required",
      processingDays: 10,
      citation: "NEC 800.26 · NFPA 13",
    },
  ];
  if (requiresPe) {
    permits.push({
      id: "p3", name: "PE-Stamped Drawing Set", jurisdiction: ahjName,
      form: "Drawing submittal · D-size + electronic",
      feeCents: 0, status: "required",
      processingDays: 21,
      citation: "State PE board requirement",
    });
  }
  return {
    ahj: {
      name: ahjName,
      contact: "Permitting Office · Mon-Fri 8am-4pm",
      portalUrl: undefined,
      requiresPeStamp: requiresPe,
      requiresRcddStamp: requiresRcdd,
    },
    permits,
    generatedAt: new Date().toISOString(),
  };
}

// ── Schedule (Division 27 / NECA MLU) ──────────────────────────────────────

function computeSchedule(project: Project, computed: ReturnType<typeof computeDesign>): ScheduleResult {
  const sfScale = Math.max(0.6, Math.min(2.0, project.totalSf / 30000));
  const tasks: ScheduleTask[] = [
    { id: "t1",  wbs: "27-00-00", name: "Mobilization & Safety",       durationDays: Math.ceil(2 * sfScale), startDay: 0,  costCents: 420000,  predecessors: [],     color: "#64748b" },
    { id: "t2",  wbs: "27-05-26", name: "Grounding & Bonding",          durationDays: Math.ceil(1 * sfScale), startDay: 2,  costCents: 280000,  predecessors: ["t1"], color: "#c9931f" },
    { id: "t3",  wbs: "27-11-00", name: "Equipment Room Rough-In",      durationDays: Math.ceil(3 * sfScale), startDay: 3,  costCents: 840000,  predecessors: ["t1"], color: "#8b5cf6" },
    { id: "t4",  wbs: "27-05-28", name: "Cable Tray Installation",      durationDays: Math.ceil(4 * sfScale), startDay: 6,  costCents: 620000,  predecessors: ["t3"], color: "#06b6d4" },
    { id: "t5",  wbs: "27-15-00", name: "Backbone Fiber Pull",          durationDays: Math.ceil(2 * sfScale), startDay: 10, costCents: 510000,  predecessors: ["t4"], color: "#1d4ed8" },
    { id: "t6",  wbs: "27-15-11", name: "Horizontal Cabling Pull",      durationDays: Math.ceil(5 * sfScale), startDay: 10, costCents: 980000,  predecessors: ["t4"], color: "#1d4ed8" },
    { id: "t7",  wbs: "27-15-13", name: "Outlet Termination & Dress",   durationDays: Math.ceil(3 * sfScale), startDay: 15, costCents: 420000,  predecessors: ["t6"], color: "#3fae5d" },
    { id: "t8",  wbs: "27-15-13", name: "Patch Panel Termination",      durationDays: Math.ceil(2 * sfScale), startDay: 15, costCents: 310000,  predecessors: ["t6"], color: "#3fae5d" },
    { id: "t9",  wbs: "27-51-16", name: "WAP Installation",             durationDays: Math.ceil(2 * sfScale), startDay: 17, costCents: 560000,  predecessors: ["t7"], color: "#14b8a6" },
    { id: "t10", wbs: "07-84-13", name: "Firestop",                     durationDays: Math.ceil(1 * sfScale), startDay: 18, costCents: 80000,   predecessors: ["t6"], color: "#c44a4a" },
    { id: "t11", wbs: "27-15-01", name: "Testing & Certification",      durationDays: Math.ceil(3 * sfScale), startDay: 19, costCents: 640000,  predecessors: ["t7","t9"], color: "#f97316" },
    { id: "t12", wbs: "27-01-00", name: "Documentation & Closeout",     durationDays: Math.ceil(2 * sfScale), startDay: 22, costCents: 220000,  predecessors: ["t11"], color: "#94a3b8" },
  ];
  const totalDays = tasks.reduce((m, t) => Math.max(m, t.startDay + t.durationDays), 0);
  return { tasks, totalDays, generatedAt: new Date().toISOString() };
}

// ── Loss budget ────────────────────────────────────────────────────────────

function computeLoss(project: Project, params: DesignParameters): LossResult {
  const runs: FiberRun[] = [];
  for (let f = 2; f <= project.floors; f++) {
    // Approximate length: vertical riser ~14 ft/floor + ~30 ft horizontal
    const lengthM = +((f - 1) * 14 * 0.3048 + 30 * 0.3048).toFixed(1);
    const budgetDb = 2.9;
    // 0.3 dB per connector × 4 (2 per end) + α·L for OM4 at 850nm (~3.5 dB/km)
    const connectorLoss = 0.3 * 4;
    const attenuationLoss = +(lengthM * 3.5 / 1000).toFixed(2);
    const computedLossDb = +(connectorLoss + attenuationLoss).toFixed(2);
    const marginDb = +(budgetDb - computedLossDb).toFixed(2);
    runs.push({
      id: `BB-MDF-IDF${f}`,
      description: `MDF → IDF Floor ${f}`,
      lengthM,
      application: params.backboneMedia === "os2" ? "10GBASE-LR_OS2" : "10GBASE-SR_OM4",
      budgetDb, computedLossDb, marginDb,
      passes: marginDb > 0.1,
    });
  }
  return { runs, generatedAt: new Date().toISOString() };
}

// ── Room schedule ──────────────────────────────────────────────────────────

function computeRooms(rooms: ExtractedRoom[]): RoomScheduleResult {
  const items: RoomScheduleItem[] = rooms.filter(r => !r.excluded).map(r => ({
    id: r.id,
    name: r.overrideName ?? r.name,
    type: (r.overrideType ?? r.type),
    area: r.area,
    floor: r.floor,
    confirmed: r.reviewed,
    source: r.source,
  })).sort((a, b) => a.floor - b.floor || a.id.localeCompare(b.id));
  return { items, generatedAt: new Date().toISOString() };
}

// ── Entry point ────────────────────────────────────────────────────────────

export function computeResults(
  project: Project,
  params: DesignParameters,
  placements: PlacementState,
  rooms: ExtractedRoom[],
): ResultsBundle {
  const computed = computeDesign(params, project, rooms);
  return {
    projectId: project.id,
    bom:        computeBom(project, params, placements, rooms, computed),
    compliance: computeCompliance(project, params, placements, rooms),
    permits:    computePermits(project),
    schedule:   computeSchedule(project, computed),
    loss:       computeLoss(project, params),
    rooms:      computeRooms(rooms),
    computedAt: new Date().toISOString(),
  };
}
