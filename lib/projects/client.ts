/**
 * Projects client. Same swap-in-place pattern as auth/client.ts —
 * when FastAPI lands, change the BASE constant.
 */
import type {
  Project,
  CreateProjectRequest,
  UpdateProjectRequest,
  ProjectListResponse,
  ProjectResponse,
} from "./types";

const BASE = "/api/projects";

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    ...init,
    headers: { "Content-Type": "application/json", ...(init?.headers || {}) },
    credentials: "include",
  });
  return res.json();
}

export const projectsClient = {
  list: () =>
    request<ProjectListResponse>(""),
  get: (id: string) =>
    request<ProjectResponse>(`/${id}`),
  create: (req: CreateProjectRequest) =>
    request<ProjectResponse>("", { method: "POST", body: JSON.stringify(req) }),
  update: (id: string, patch: UpdateProjectRequest) =>
    request<ProjectResponse>(`/${id}`, { method: "PATCH", body: JSON.stringify(patch) }),
  remove: (id: string) =>
    request<{ ok: boolean }>(`/${id}`, { method: "DELETE" }),
};

export type { Project };
