import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/session";
import { projectStore } from "@/lib/projects/mock-store";
import { markupStore, CURRENT_AUTHOR } from "@/lib/markup/mock-store";

interface PostBody { body: string }

export async function POST(
  req: Request,
  { params }: { params: { id: string; markupId: string } },
) {
  const user = getCurrentUser();
  if (!user) return NextResponse.json({ ok: false }, { status: 401 });
  if (!projectStore.get(params.id, user.id)) {
    return NextResponse.json({ ok: false, error: { code: "not_found", message: "Project not found." } }, { status: 404 });
  }
  const body = (await req.json()) as PostBody;
  if (!body.body?.trim()) {
    return NextResponse.json({ ok: false, error: { code: "bad_request", message: "Comment body is required." } }, { status: 400 });
  }
  const m = markupStore.addComment(params.id, params.markupId, CURRENT_AUTHOR, body.body.trim());
  if (!m) return NextResponse.json({ ok: false, error: { code: "not_found", message: "Markup not found." } }, { status: 404 });
  return NextResponse.json({ ok: true, markup: m });
}
