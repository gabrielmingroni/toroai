// Placement domain — outlets, WAPs, TR/IDF symbols positioned on the floor plan.

export type ApprovalState = "approved" | "rejected" | "pending";

export interface OutletPlacement {
  id: string;
  x: number;
  y: number;
  floor: number;
  roomId: string | null;        // which extracted room it sits in
  ports: 1 | 2 | 3 | 4;
  approval: ApprovalState;
  source: "ai" | "rcdd";        // who placed it
  labelOverride: string | null;
  createdAt: string;
}

export interface WapPlacement {
  id: string;
  x: number;
  y: number;
  floor: number;
  roomId: string | null;
  coverageRadiusFt: number;
  approval: ApprovalState;
  source: "ai" | "rcdd";
  labelOverride: string | null;
  createdAt: string;
}

export interface TrPlacement {
  id: string;
  roomId: string;               // anchored to a confirmed room
  kind: "mdf" | "idf";
  floor: number;
  approval: ApprovalState;
  createdAt: string;
}

export interface PlacementState {
  projectId: string;
  outlets: OutletPlacement[];
  waps: WapPlacement[];
  trs: TrPlacement[];
  updatedAt: string;
}

export interface PlacementResponse {
  ok: boolean;
  state?: PlacementState;
  error?: { code: string; message: string };
}
