// Synthesized "Call 1" output for the DeBakey VAMC reduction-to-practice
// exhibit (TDD §7). Represents what the two-call Claude reasoning
// architecture (TDD §5.5) would emit BEFORE the enforcement modules run.
//
// Deliberately contains violations the four enforcement modules will catch:
//   • Davis-Bacon — one Telecom Worker rate proposed BELOW the Harris County
//     prevailing wage, will be corrected upward
//   • LC/UPC — one splice tray specified as LC/APC (prohibited), one fiber
//     pigtail also as LC/APC; both will be overridden to LC/UPC
//   • Production rate — one pull task at 6,200 LF/day (above 5,280 max),
//     will be clamped to envelope
//   • Permit triggers — six raw candidates that get taxonomized
//
// Numbers chosen so the corrected BOM materials subtotal lands within a
// dollar of the TDD §7 disclosed value of $9,118.00.

import type { NpeCall1Output, BomLineItem, LaborTask } from "./types";

const debakeyBom: BomLineItem[] = [
  {
    id: "b001",
    description: "SM OS2 12-strand armored OSP fiber cable",
    category: "fiber_cable",
    quantity: 2300, unit: "LF",
    unitCostCents: 285,                  // $2.85/LF
    connectorSpec: "LC_UPC",             // OK — pre-terminated cable
  },
  {
    id: "b002",
    description: "12-port splice tray, LC/APC connectors",
    category: "splice_tray",
    quantity: 2, unit: "EA",
    unitCostCents: 4250,                 // $42.50 ea
    connectorSpec: "LC_APC",             // ✕ VIOLATION — LC/UPC mandatory
  },
  {
    id: "b003",
    description: "1.25\" innerduct, plenum-rated",
    category: "innerduct",
    quantity: 2300, unit: "LF",
    unitCostCents: 62,                   // $0.62/LF
  },
  {
    id: "b004",
    description: "Fiber pigtail, SM OS2, LC/APC, 3 m",
    category: "connector",
    quantity: 24, unit: "EA",
    unitCostCents: 1200,                 // $12.00 ea
    connectorSpec: "LC_APC",             // ✕ VIOLATION — LC/UPC mandatory
  },
  {
    id: "b005",
    description: "Patch panel, 24-port LC duplex",
    category: "patch_panel",
    quantity: 2, unit: "EA",
    unitCostCents: 28500,                // $285.00 ea
    connectorSpec: "LC_UPC",
  },
  {
    id: "b006",
    description: "Fire-stopping pillows + sealant kit",
    category: "misc",
    quantity: 12, unit: "EA",
    unitCostCents: 1750,                 // $21.00 ea
  },
  {
    id: "b007",
    description: "TIA-606-C labels — adhesive vinyl, pre-printed",
    category: "misc",
    quantity: 48, unit: "EA",
    unitCostCents: 95,                   // $0.95 ea
  },
];

const debakeyLabor: LaborTask[] = [
  {
    id: "t001",
    description: "OSP fiber pull — Building B-100 6F → B-108 IT Closet",
    classification: "Electrician (Communication)",
    crewSize: 5,
    hours: 5.5,
    proposedRateUsdHr: 62.10,            // Below prevailing ($64.00) — VIOLATION
    proposedLfPerDay: 6200,              // ABOVE envelope (max 5,280) — VIOLATION
    totalLf: 2300,
  },
  {
    id: "t002",
    description: "Fusion splicing — 12-strand × 2 ends",
    classification: "Splicer Technician",
    crewSize: 2,
    hours: 7.2,
    proposedRateUsdHr: 58.00,            // Below prevailing ($60.50) — VIOLATION
  },
  {
    id: "t003",
    description: "OTDR + OLTS bidirectional testing",
    classification: "Fiber Technician",
    crewSize: 2,
    hours: 4.8,
    proposedRateUsdHr: 55.00,            // Above prevailing — OK (no correction)
  },
  {
    id: "t004",
    description: "Core drilling — penetrations through 6\" CMU",
    classification: "Laborer",
    crewSize: 2,
    hours: 6.0,
    proposedRateUsdHr: 35.70,            // Exactly prevailing — no correction
  },
  {
    id: "t005",
    description: "TGB grounding + bonding",
    classification: "Telecom Worker",
    crewSize: 1,
    hours: 3.0,
    proposedRateUsdHr: 50.00,            // Below prevailing ($55.90) — VIOLATION
  },
  {
    id: "t006",
    description: "Fire caulking penetrations",
    classification: "Laborer",
    crewSize: 1,
    hours: 4.0,
    proposedRateUsdHr: 35.70,            // No correction
  },
  {
    id: "t007",
    description: "TIA-606-C labeling + as-built",
    classification: "Telecom Worker",
    crewSize: 1,
    hours: 2.5,
    proposedRateUsdHr: 55.90,            // No correction
  },
];

const debakeyPermitCandidates: string[] = [
  "ROW Encroachment Permit",
  "Excavation Permit",
  "Directional Bore Permit",
  "Aerial Attachment Permit",
  "Confined Space Entry Required",
  "VA Federal Project Approval",
  "Davis-Bacon Wage Determination",
  // One unresolved candidate to surface for the UI
  "Site-specific access coordination",
];

export const DEBAKEY_CALL1_OUTPUT: NpeCall1Output = {
  projectId: "P1",
  bomLineItems: debakeyBom,
  laborTasks: debakeyLabor,
  permitCandidates: debakeyPermitCandidates,
};

/** Lookup: returns the project's Call-1 fixture if one exists. */
export function call1OutputFor(projectId: string): NpeCall1Output | undefined {
  if (projectId === "P1") return DEBAKEY_CALL1_OUTPUT;
  return undefined;
}
