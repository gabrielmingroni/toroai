import type { PlacementResponse, OutletPlacement, WapPlacement, ApprovalState } from "./types";

const base = (projectId: string) => `/api/projects/${projectId}/placement`;

async function get(projectId: string): Promise<PlacementResponse> {
  const res = await fetch(base(projectId), { credentials: "include" });
  return res.json();
}

async function action<T = any>(projectId: string, name: string, payload?: T): Promise<PlacementResponse> {
  const res = await fetch(base(projectId), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify({ action: name, payload }),
  });
  return res.json();
}

export const placementClient = {
  get,
  addOutlet: (projectId: string, p: Partial<OutletPlacement> & { x: number; y: number; floor: number }) =>
    action(projectId, "add_outlet", p),
  addWap: (projectId: string, p: Partial<WapPlacement> & { x: number; y: number; floor: number }) =>
    action(projectId, "add_wap", p),
  removeOutlet: (projectId: string, id: string) => action(projectId, "remove_outlet", { id }),
  removeWap:    (projectId: string, id: string) => action(projectId, "remove_wap", { id }),
  setOutletApproval: (projectId: string, id: string, approval: ApprovalState) =>
    action(projectId, approval === "approved" ? "approve_outlet" : "reject_outlet", { id }),
  setWapApproval: (projectId: string, id: string, approval: ApprovalState) =>
    action(projectId, approval === "approved" ? "approve_wap" : "reject_wap", { id }),
  autoOutlets: (projectId: string) => action(projectId, "auto_outlets"),
  autoWaps:    (projectId: string) => action(projectId, "auto_waps"),
  approveAllPending: (projectId: string) => action(projectId, "approve_all_pending"),
  clearAi:           (projectId: string) => action(projectId, "clear_ai"),
};
