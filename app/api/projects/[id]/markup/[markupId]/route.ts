import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/session";
import { projectStore } from "@/lib/projects/mock-store";
import { markupStore } from "@/lib/markup/mock-store";
import type { MarkupGeometry, MarkupStatus, MarkupAuthor } from "@/lib/markup/types";

interface PatchBody {
  title?: string;
  body?: string;
  color?: string;
  status?: MarkupStatus;
  assignedTo?: MarkupAuthor;
  geometry?: MarkupGeometry;
}

export async function PATCH(
  req: Request,
  { params }: { params: { id: string; markupId: string } },
) {
  const user = getCurrentUser();
  if (!user) return NextResponse.json({ ok: false }, { status: 401 });
  if (!projectStore.get(params.id, user.id)) {
    return NextResponse.json({ ok: false, error: { code: "not_found", message: "Project not found." } }, { status: 404 });
  }
  const body = (await req.json()) as PatchBody;
  const m = markupStore.updateMarkup(params.id, params.markupId, body);
  if (!m) return NextResponse.json({ ok: false, error: { code: "not_found", message: "Markup not found." } }, { status: 404 });
  return NextResponse.json({ ok: true, markup: m });
}

export async function DELETE(
  _req: Request,
  { params }: { params: { id: string; markupId: string } },
) {
  const user = getCurrentUser();
  if (!user) return NextResponse.json({ ok: false }, { status: 401 });
  if (!projectStore.get(params.id, user.id)) {
    return NextResponse.json({ ok: false, error: { code: "not_found", message: "Project not found." } }, { status: 404 });
  }
  const ok = markupStore.deleteMarkup(params.id, params.markupId);
  if (!ok) return NextResponse.json({ ok: false, error: { code: "not_found", message: "Markup not found." } }, { status: 404 });
  return NextResponse.json({ ok: true });
}
