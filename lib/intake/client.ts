import type { IntakeResponse, IntakeJob, StartIntakeRequest, RoomType } from "./types";

const base = (projectId: string) => `/api/projects/${projectId}/intake`;

async function req<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(path, {
    ...init,
    headers: { "Content-Type": "application/json", ...(init?.headers || {}) },
    credentials: "include",
  });
  return res.json();
}

export const intakeClient = {
  status: (projectId: string) =>
    req<{ ok: boolean; job: IntakeJob | null }>(base(projectId)),
  start: (projectId: string, body: StartIntakeRequest) =>
    req<IntakeResponse>(base(projectId), { method: "POST", body: JSON.stringify(body) }),
  reset: (projectId: string) =>
    req<{ ok: boolean }>(base(projectId), { method: "DELETE" }),
  overrideRoom: (projectId: string, roomId: string, patch: { overrideType?: RoomType | null; overrideName?: string | null; excluded?: boolean; reviewed?: boolean }) =>
    req<IntakeResponse>(`${base(projectId)}/rooms/${roomId}`, { method: "POST", body: JSON.stringify(patch) }),
  bulkAccept: (projectId: string, threshold = 0.85) =>
    req<IntakeResponse>(`${base(projectId)}/rooms/bulk-accept`, { method: "POST", body: JSON.stringify({ threshold }) }),
  setTr: (projectId: string, roomId: string, approved: boolean | null) =>
    req<IntakeResponse>(`${base(projectId)}/trs/${roomId}`, { method: "POST", body: JSON.stringify({ approved }) }),
  confirm: (projectId: string) =>
    req<IntakeResponse>(`${base(projectId)}/confirm`, { method: "POST" }),
};
