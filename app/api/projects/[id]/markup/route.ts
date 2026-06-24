import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/session";
import { projectStore } from "@/lib/projects/mock-store";
import { markupStore, CURRENT_AUTHOR } from "@/lib/markup/mock-store";
import type { MarkupGeometry, MarkupType } from "@/lib/markup/types";

export async function GET(req: Request, { params }: { params: { id: string } }) {
  const user = getCurrentUser();
  if (!user) return NextResponse.json({ ok: false }, { status: 401 });
  if (!projectStore.get(params.id, user.id)) {
    return NextResponse.json({ ok: false, error: { code: "not_found", message: "Project not found." } }, { status: 404 });
  }
  const sheetId = new URL(req.url).searchParams.get("sheetId") ?? undefined;
  const markups = markupStore.listMarkups(params.id, sheetId ?? undefined);
  return NextResponse.json({ ok: true, markups });
}

interface CreateBody {
  sheetId: string;
  type: MarkupType;
  geometry: MarkupGeometry;
  title?: string;
  body?: string;
  color?: string;
}

export async function POST(req: Request, { params }: { params: { id: string } }) {
  const user = getCurrentUser();
  if (!user) return NextResponse.json({ ok: false }, { status: 401 });
  if (!projectStore.get(params.id, user.id)) {
    return NextResponse.json({ ok: false, error: { code: "not_found", message: "Project not found." } }, { status: 404 });
  }
  const body = (await req.json()) as CreateBody;
  if (!body.sheetId || !body.type || !body.geometry) {
    return NextResponse.json({ ok: false, error: { code: "bad_request", message: "sheetId, type, and geometry are required." } }, { status: 400 });
  }
  const m = markupStore.createMarkup(params.id, {
    sheetId: body.sheetId,
    type: body.type,
    geometry: body.geometry,
    title: body.title,
    body: body.body,
    color: body.color,
    author: CURRENT_AUTHOR,
  });
  if (!m) {
    return NextResponse.json({ ok: false, error: { code: "bad_sheet", message: "Sheet not found in this project." } }, { status: 404 });
  }
  return NextResponse.json({ ok: true, markup: m });
}
