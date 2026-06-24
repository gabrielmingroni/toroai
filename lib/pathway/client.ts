import type { PathwaySegment, PathwayResponse, PathwayType } from "./types";

const base = (projectId: string) => `/api/projects/${projectId}/pathway`;

async function req<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(path, {
    ...init,
    headers: { "Content-Type": "application/json", ...(init?.headers ?? {}) },
    credentials: "include",
  });
  return res.json();
}

export interface CreateSegmentArgs {
  type: PathwayType;
  nodes: { x: number; y: number }[];
  floor: number;
  heightFt: number;
  trayWidthIn?: number;
  conduitSize?: string;
  fromFloor?: number;
  toFloor?: number;
  label?: string;
}

export interface UpdateSegmentArgs {
  nodes?: PathwaySegment["nodes"];
  heightFt?: number;
  trayWidthIn?: number;
  conduitSize?: string;
  label?: string;
  fromFloor?: number;
  toFloor?: number;
}

type SegmentResponse = { ok: boolean; segment?: PathwaySegment; error?: { code: string; message: string } };

export const pathwayClient = {
  status: (projectId: string) => req<PathwayResponse>(`${base(projectId)}/segments`),
  createSegment: (projectId: string, args: CreateSegmentArgs) =>
    req<SegmentResponse>(`${base(projectId)}/segments`, { method: "POST", body: JSON.stringify(args) }),
  updateSegment: (projectId: string, segmentId: string, patch: UpdateSegmentArgs) =>
    req<SegmentResponse>(`${base(projectId)}/segments/${segmentId}`, { method: "PATCH", body: JSON.stringify(patch) }),
  removeSegment: (projectId: string, segmentId: string) =>
    req<{ ok: boolean; error?: { code: string; message: string } }>(`${base(projectId)}/segments/${segmentId}`, { method: "DELETE" }),
};
