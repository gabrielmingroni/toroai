// Results domain — what the RCDD ultimately stamps and ships.

export interface BomLineItem {
  category: string;     // grouping
  desc: string;
  qty: number;
  unit: string;
  unitPriceCents: number;
  extendedCents: number;
  citation?: string;
}

export interface BomResult {
  items: BomLineItem[];
  laborHours: number;
  laborRateCentsPerHr: number;
  materialSubtotalCents: number;
  laborSubtotalCents: number;
  grandTotalCents: number;
  generatedAt: string;
}

export type ComplianceStatus = "pass" | "advisory" | "fail";

export interface ComplianceRule {
  code: string;            // e.g. "BICSI-OUTLET-GRID"
  citation: string;        // e.g. "BICSI TDMM 15 §12.4.2"
  description: string;     // human readable
  status: ComplianceStatus;
  message?: string;
  locate?: { kind: "room" | "outlet" | "wap"; id: string };
}

export interface ComplianceResult {
  total: number;
  pass: number;
  advisory: number;
  fail: number;
  rules: ComplianceRule[];
  generatedAt: string;
}

export type PermitStatus = "required" | "filed" | "approved" | "n_a";

export interface PermitItem {
  id: string;
  name: string;
  jurisdiction: string;
  form: string;           // e.g. "City of Houston ICT-1"
  feeCents: number;
  status: PermitStatus;
  processingDays: number; // typical
  citation?: string;
}

export interface PermitsResult {
  ahj: {
    name: string;
    contact: string;
    portalUrl?: string;
    requiresPeStamp: boolean;
    requiresRcddStamp: boolean;
  };
  permits: PermitItem[];
  generatedAt: string;
}

export interface ScheduleTask {
  id: string;
  wbs: string;            // CSI MasterFormat / Division 27
  name: string;
  durationDays: number;
  startDay: number;       // offset from project start
  costCents: number;
  predecessors: string[]; // ids
  color: string;          // for the bar
}

export interface ScheduleResult {
  tasks: ScheduleTask[];
  totalDays: number;
  generatedAt: string;
}

export interface FiberRun {
  id: string;
  description: string;
  lengthM: number;
  application: string;       // e.g. "10GBASE-SR_OM4"
  budgetDb: number;
  computedLossDb: number;
  marginDb: number;
  passes: boolean;
}

export interface LossResult {
  runs: FiberRun[];
  generatedAt: string;
}

export interface RoomScheduleItem {
  id: string;
  name: string;
  type: string;
  area: number;
  floor: number;
  confirmed: boolean;
  source: string;
}

export interface RoomScheduleResult {
  items: RoomScheduleItem[];
  generatedAt: string;
}

export interface ResultsBundle {
  projectId: string;
  bom: BomResult;
  compliance: ComplianceResult;
  permits: PermitsResult;
  schedule: ScheduleResult;
  loss: LossResult;
  rooms: RoomScheduleResult;
  computedAt: string;
}
