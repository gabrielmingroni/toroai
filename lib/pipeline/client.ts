import type { PipelineResponse } from "./types";

const base = (projectId: string) => `/api/projects/${projectId}/pipeline`;

async function req<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(path, {
    ...init,
    headers: { "Content-Type": "application/json", ...(init?.headers || {}) },
    credentials: "include",
  });
  return res.json();
}

export const pipelineClient = {
  status: (projectId: string) => req<PipelineResponse>(base(projectId)),
  start:  (projectId: string) => req<PipelineResponse>(base(projectId), { method: "POST" }),
  reset:  (projectId: string) => req<{ ok: boolean }>(base(projectId), { method: "DELETE" }),
  releaseGate: (projectId: string) =>
    req<PipelineResponse>(`${base(projectId)}/release-gate`, { method: "POST" }),
};
