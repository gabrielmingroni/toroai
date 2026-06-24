import type { Room, Outlet, Wap, BomItem, ComplianceCheck, ScheduleTask, FiberRun } from "@/lib/types";

export const ROOMS: Room[] = [
  { id: "MDF1", name: "MDF Telecom Room", type: "mdf", x: 4, y: 5, w: 14, h: 13, sf: 110, floor: 1, confirmed: true, source: "CAD" },
  { id: "R101", name: "Open Office A", type: "open_office", x: 20, y: 5, w: 64, h: 44, sf: 3200, floor: 1, confirmed: true, source: "CAD" },
  { id: "R102", name: "Conference Rm 1", type: "conference", x: 20, y: 51, w: 32, h: 22, sf: 480, floor: 1, confirmed: true, source: "PDF" },
  { id: "R103", name: "Reception", type: "reception", x: 54, y: 51, w: 30, h: 22, sf: 420, floor: 1, confirmed: true, source: "PDF" },
  { id: "COR1", name: "Corridor", type: "corridor", x: 4, y: 20, w: 134, h: 8, sf: 1072, floor: 1, confirmed: true, source: "CAD" },
  { id: "R104", name: "Storage", type: "storage", x: 4, y: 51, w: 14, h: 22, sf: 154, floor: 1, confirmed: false, source: "EST" },
];

export const OUTLETS: Outlet[] = [
  { id: "D-1OO-001", x: 28, y: 12, rid: "R101", label: "D-1OO-001", approved: true },
  { id: "D-1OO-002", x: 40, y: 12, rid: "R101", label: "D-1OO-002", approved: true },
  { id: "D-1OO-003", x: 52, y: 12, rid: "R101", label: "D-1OO-003", approved: true },
  { id: "D-1OO-004", x: 64, y: 12, rid: "R101", label: "D-1OO-004", approved: null },
  { id: "D-1OO-005", x: 76, y: 12, rid: "R101", label: "D-1OO-005", approved: null },
  { id: "D-1OO-006", x: 28, y: 40, rid: "R101", label: "D-1OO-006", approved: true },
  { id: "D-1OO-007", x: 40, y: 40, rid: "R101", label: "D-1OO-007", approved: false },
  { id: "D-1CR-001", x: 26, y: 58, rid: "R102", label: "D-1CR-001", approved: null },
  { id: "D-1CR-002", x: 34, y: 58, rid: "R102", label: "D-1CR-002", approved: null },
  { id: "D-1CR-003", x: 42, y: 58, rid: "R102", label: "D-1CR-003", approved: null },
  { id: "D-1CR-004", x: 50, y: 58, rid: "R102", label: "D-1CR-004", approved: null },
  { id: "D-1RX-001", x: 60, y: 58, rid: "R103", label: "D-1RX-001", approved: null },
  { id: "D-1RX-002", x: 70, y: 58, rid: "R103", label: "D-1RX-002", approved: null },
];

export const WAPS: Wap[] = [
  { id: "AP-1-01", x: 52, y: 27, rid: "R101", label: "AP-1-01" },
  { id: "AP-1-02", x: 84, y: 27, rid: "R101", label: "AP-1-02" },
];

export const BOM_ITEMS: BomItem[] = [
  { cat: "Horizontal Cabling", desc: "Cat6A UTP Cable, 23 AWG, 4-pair, CMR", qty: 14820, unit: "LF", up: 0.38, total: 5631.6 },
  { cat: "Horizontal Cabling", desc: "Cat6A Patch Cord, 6 ft, Blue", qty: 52, unit: "EA", up: 8.5, total: 442.0 },
  { cat: "Backbone Cabling", desc: "OM4 50/125 MM Fiber, 12-strand, OFNR", qty: 380, unit: "LF", up: 2.1, total: 798.0 },
  { cat: "Backbone Cabling", desc: "LC/UPC Duplex Connector, OM4", qty: 24, unit: "EA", up: 4.2, total: 100.8 },
  { cat: "Outlets & Faceplates", desc: "Data Outlet, 2-Port, Cat6A, White", qty: 52, unit: "EA", up: 18.5, total: 962.0 },
  { cat: "Outlets & Faceplates", desc: "Keystone Wallplate, 2-Port, White", qty: 52, unit: "EA", up: 4.25, total: 221.0 },
  { cat: "Pathways", desc: "Ladder Cable Tray, 12\" Wide, 10 ft", qty: 24, unit: "EA", up: 42.0, total: 1008.0 },
  { cat: "Equipment Room", desc: "48-Port Cat6A Patch Panel, 2U", qty: 3, unit: "EA", up: 285.0, total: 855.0 },
  { cat: "Equipment Room", desc: "42U Open Frame Rack", qty: 1, unit: "EA", up: 420.0, total: 420.0 },
  { cat: "Wireless", desc: "802.11ax WAP, PoE++ 802.3bt", qty: 8, unit: "EA", up: 385.0, total: 3080.0 },
  { cat: "Grounding", desc: "TMGB, Copper Busbar 4×12 in", qty: 1, unit: "EA", up: 145.0, total: 145.0 },
  { cat: "Firestop", desc: "UL-Listed Firestop Sleeve Kit", qty: 6, unit: "EA", up: 32.0, total: 192.0 },
];

export const COMPLIANCE_CHECKS: ComplianceCheck[] = [
  { rule: "BICSI-OUTLET-GRID", std: "BICSI TDMM 15 §12.4.2", desc: "Outlet spacing ≤ 30 ft in open office", status: "pass" },
  { rule: "BICSI-WAP-CENTER", std: "BICSI TDMM 15 §12.3", desc: "WAP at ceiling center of coverage zone", status: "pass" },
  { rule: "TIA-568-90M", std: "TIA-568.1-D §6.4", desc: "Channel length ≤ 90m permanent link", status: "pass" },
  { rule: "TIA-568-CAT6A", std: "TIA-568.1-D §6.6", desc: "Cat6A horizontal cabling", status: "pass" },
  { rule: "BICSI-TR-EXISTS", std: "BICSI TDMM 15 §11", desc: "Telecom room present on each floor", status: "pass" },
  { rule: "BICSI-TR-SIZE", std: "BICSI TDMM 15 Table 4.1", desc: "TR minimum 80 SF for ≤5000 SF served", status: "pass" },
  { rule: "BICSI-MDF-FLOOR1", std: "BICSI TDMM 15 §11.2", desc: "MDF on ground/entry floor", status: "pass" },
  { rule: "TIA-607-TGB", std: "TIA-607-C", desc: "TGB present at each TR", status: "pass" },
  { rule: "TIA-607-TMGB", std: "TIA-607-C", desc: "TMGB at MDF (main grounding busbar)", status: "pass" },
  { rule: "NEC-800-26-FS", std: "NEC 800.26", desc: "Firestop at all rated-wall penetrations", status: "pass" },
  { rule: "TIA-569-TRAY-FILL", std: "TIA-569-D §8", desc: "Cable tray fill ≤ 40%", status: "advisory", msg: "Tray T3 estimated fill ~38% — approaching 40% limit. Monitor during rough-in." },
  { rule: "BICSI-BB-MEDIA", std: "BICSI TDMM 15 §13", desc: "OM4/OS2 backbone fiber", status: "pass" },
  { rule: "TIA-568-HZMEDIA", std: "TIA-568.1-D §6.6", desc: "10G-capable horizontal media", status: "pass" },
  { rule: "BICSI-WAP-COV", std: "BICSI TDMM 15 §12.3", desc: "WAP coverage gaps in work areas", status: "pass" },
  { rule: "BICSI-OUTLET-DENS", std: "BICSI TDMM 15 §12.4.2", desc: "Outlet density per work area SF", status: "pass" },
  { rule: "TIA-568-90M-PROX", std: "TIA-568.1-D §6.4", desc: "TR 90m proximity check per room", status: "pass" },
  { rule: "BICSI-TR-AREA", std: "BICSI TDMM 15 §11.3", desc: "TR per 10,000 SF served", status: "pass" },
  { rule: "BICSI-CONF-MIN", std: "BICSI TDMM 15 §12.4.3", desc: "Conference room minimum 4 outlets", status: "advisory", msg: "Conference Rm 2 (Floor 3) has 3 outlets. BICSI minimum is 4. Add 1 outlet." },
  { rule: "BICSI-OFFICE-MIN", std: "BICSI TDMM 15 §12.4.3", desc: "Private office minimum 2 outlets", status: "pass" },
  { rule: "TIA-568-CAT6ASPEC", std: "TIA-568.1-D §6.6", desc: "Cat6A supports 10G + PoE++ 802.3bt", status: "pass" },
];

export const SCHEDULE_TASKS: ScheduleTask[] = [
  { name: "Mobilization & Safety", wbs: "27-00-00", dur: 2, cost: 4200, start: 0, color: "#64748b" },
  { name: "Grounding & Bonding", wbs: "27-05-26", dur: 1, cost: 2800, start: 2, color: "#f59e0b" },
  { name: "Equipment Room Rough-In", wbs: "27-11-00", dur: 3, cost: 8400, start: 3, color: "#8b5cf6" },
  { name: "Cable Tray Installation", wbs: "27-05-28", dur: 4, cost: 6200, start: 6, color: "#06b6d4" },
  { name: "Backbone Fiber Pull", wbs: "27-15-00", dur: 2, cost: 5100, start: 10, color: "#3b82f6" },
  { name: "Horizontal Cabling Pull", wbs: "27-15-11", dur: 5, cost: 9800, start: 10, color: "#3b82f6" },
  { name: "Outlet Termination & Dress", wbs: "27-15-13", dur: 3, cost: 4200, start: 15, color: "#22c55e" },
  { name: "Patch Panel Termination", wbs: "27-15-13", dur: 2, cost: 3100, start: 15, color: "#22c55e" },
  { name: "WAP Installation", wbs: "27-51-16", dur: 2, cost: 5600, start: 17, color: "#14b8a6" },
  { name: "Firestop", wbs: "07-84-13", dur: 1, cost: 800, start: 18, color: "#ef4444" },
  { name: "Testing & Certification", wbs: "27-15-01", dur: 3, cost: 6400, start: 19, color: "#f97316" },
  { name: "Documentation & Closeout", wbs: "27-01-00", dur: 2, cost: 2200, start: 22, color: "#94a3b8" },
];

export const SCHED_TOTAL_DAYS = 24;

export const FIBER_RUNS: FiberRun[] = [
  { id: "BB-MDF-IDF2", desc: "MDF → IDF Floor 2", len: 45.2, app: "10GBASE-SR_OM4", budget: 2.9, loss: 0.81, margin: 2.09, passes: true },
  { id: "BB-MDF-IDF3", desc: "MDF → IDF Floor 3", len: 72.8, app: "10GBASE-SR_OM4", budget: 2.9, loss: 1.1, margin: 1.8, passes: true },
  { id: "BB-MDF-IDF4", desc: "MDF → IDF Floor 4", len: 98.4, app: "10GBASE-SR_OM4", budget: 2.9, loss: 1.42, margin: 1.48, passes: true },
];
