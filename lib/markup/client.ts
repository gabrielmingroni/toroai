import type {
  Markup, MarkupGeometry, MarkupResponse, MarkupStatus, MarkupType, MarkupAuthor,
} from "./types";

const base = (projectId: string) => `/api/projects/${projectId}/markup`;

async function req<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(path, {
    ...init,
    headers: { "Content-Type": "application/json", ...(init?.headers ?? {}) },
    credentials: "include",
  });
  return res.json();
}

export interface CreateMarkupArgs {
  sheetId: string;
  type: MarkupType;
  geometry: MarkupGeometry;
  title?: string;
  body?: string;
  color?: string;
}

export interface UpdateMarkupArgs {
  title?: string;
  body?: string;
  color?: string;
  status?: MarkupStatus;
  assignedTo?: MarkupAuthor;
  geometry?: MarkupGeometry;
}

export const markupClient = {
  list: (projectId: string, sheetId?: string) =>
    req<MarkupResponse>(`${base(projectId)}${sheetId ? `?sheetId=${encodeURIComponent(sheetId)}` : ""}`),
  create: (projectId: string, args: CreateMarkupArgs) =>
    req<MarkupResponse>(base(projectId), { method: "POST", body: JSON.stringify(args) }),
  update: (projectId: string, markupId: string, patch: UpdateMarkupArgs) =>
    req<MarkupResponse>(`${base(projectId)}/${markupId}`, { method: "PATCH", body: JSON.stringify(patch) }),
  remove: (projectId: string, markupId: string) =>
    req<{ ok: boolean; error?: { code: string; message: string } }>(`${base(projectId)}/${markupId}`, { method: "DELETE" }),
  addComment: (projectId: string, markupId: string, body: string) =>
    req<MarkupResponse>(`${base(projectId)}/${markupId}/comments`, { method: "POST", body: JSON.stringify({ body }) }),
};

/** Type guard — narrows a generic Markup to one we can be sure was returned. */
export function isMarkup(x: unknown): x is Markup {
  return typeof x === "object" && x !== null && "id" in x && "sheetId" in x;
}
