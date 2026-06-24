// Domain types lifted from the demo prototype.
// In Phase B these will be replaced by `openapi-typescript` output against FastAPI's /openapi.json.

export type RoomType =
  | "mdf"
  | "idf"
  | "open_office"
  | "conference"
  | "reception"
  | "corridor"
  | "storage"
  | "private_office";

export type ProjectStatus = "draft" | "in_progress" | "pending_review" | "done";

export type ProjectType = "isp" | "osp" | "isp_osp";

export interface Project {
  id: string;
  name: string;
  city: string;
  type: ProjectType;
  sector: string;
  floors: number;
  sf: number;
  has_floor_plan: boolean;
  floor_plan_rooms: number;
  status: ProjectStatus;
  jobs: number;
  number: string;
}

export interface Room {
  id: string;
  name: string;
  type: RoomType;
  x: number;
  y: number;
  w: number;
  h: number;
  sf: number;
  floor: number;
  confirmed: boolean;
  source: "CAD" | "PDF" | "EST";
}

export interface Outlet {
  id: string;
  x: number;
  y: number;
  rid: string;
  label: string;
  approved: boolean | null;
}

export interface Wap {
  id: string;
  x: number;
  y: number;
  rid: string;
  label: string;
}

export interface BomItem {
  cat: string;
  desc: string;
  qty: number;
  unit: string;
  up: number;
  total: number;
}

export type ComplianceStatus = "pass" | "fail" | "advisory";

export interface ComplianceCheck {
  rule: string;
  std: string;
  desc: string;
  status: ComplianceStatus;
  msg?: string;
}

export interface ScheduleTask {
  name: string;
  wbs: string;
  dur: number;
  cost: number;
  start: number;
  color: string;
}

export interface FiberRun {
  id: string;
  desc: string;
  len: number;
  app: string;
  budget: number;
  loss: number;
  margin: number;
  passes: boolean;
}

export interface RecentActivityItem {
  project: string;
  activity: string;
  time: string;
  color: "green" | "amber" | "blue" | "red";
}

export interface StandardCoverage {
  standard: string;
  detail: string;
}
