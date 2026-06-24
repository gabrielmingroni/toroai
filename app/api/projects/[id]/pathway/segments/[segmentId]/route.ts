import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/session";
import { projectStore } from "@/lib/projects/mock-store";
import { pathwayStore } from "@/lib/pathway/mock-store";
import type { PathwaySegment } from "@/lib/pathway/types";

interface PatchBody {
  nodes?: PathwaySegment["nodes"];
  heightFt?: number;
  trayWidthIn?: number;
  conduitSize?: string;
  label?: string;
  fromFloor?: number;
  toFloor?: number;
}

export async function PATCH(
  req: Request,
  { params }: { params: { id: string; segmentId: string } },
) {
  const user = getCurrentUser();
  if (!user) return NextResponse.json({ ok: false }, { status: 401 });
  if (!projectStore.get(params.id, user.id)) {
    return NextResponse.json({ ok: false, error: { code: "not_found", message: "Project not found." } }, { status: 404 });
  }
  const body = (await req.json()) as PatchBody;
  const seg = pathwayStore.updateSegment(params.id, params.segmentId, body);
  if (!seg) return NextResponse.json({ ok: false, error: { code: "not_found", message: "Segment not found." } }, { status: 404 });
  return NextResponse.json({ ok: true, segment: seg });
}

export async function DELETE(
  _req: Request,
  { params }: { params: { id: string; segmentId: string } },
) {
  const user = getCurrentUser();
  if (!user) return NextResponse.json({ ok: false }, { status: 401 });
  if (!projectStore.get(params.id, user.id)) {
    return NextResponse.json({ ok: false, error: { code: "not_found", message: "Project not found." } }, { status: 404 });
  }
  const ok = pathwayStore.removeSegment(params.id, params.segmentId);
  if (!ok) return NextResponse.json({ ok: false, error: { code: "not_found", message: "Segment not found." } }, { status: 404 });
  return NextResponse.json({ ok: true });
}
