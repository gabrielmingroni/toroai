import type { DesignParameters, DesignResults } from "./types";

const base = (projectId: string) => `/api/projects/${projectId}/design`;

async function req<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(path, {
    ...init,
    headers: { "Content-Type": "application/json", ...(init?.headers || {}) },
    credentials: "include",
  });
  return res.json();
}

export interface DesignResponse {
  ok: boolean;
  parameters?: DesignParameters;
  results?: DesignResults;
  error?: { code: string; message: string };
}

export const designClient = {
  get:    (projectId: string) =>
    req<DesignResponse>(base(projectId)),
  update: (projectId: string, patch: Partial<DesignParameters>) =>
    req<DesignResponse>(base(projectId), { method: "PATCH", body: JSON.stringify(patch) }),
  reset:  (projectId: string) =>
    req<DesignResponse>(base(projectId), { method: "DELETE" }),
};
