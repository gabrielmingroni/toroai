import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/session";
import { projectStore } from "@/lib/projects/mock-store";
import { pathwayStore } from "@/lib/pathway/mock-store";
import { validateAllRuns, materialRollup } from "@/lib/pathway/compute";
import type { PathwaySegment } from "@/lib/pathway/types";

export async function GET(_req: Request, { params }: { params: { id: string } }) {
  const user = getCurrentUser();
  if (!user) return NextResponse.json({ ok: false }, { status: 401 });
  if (!projectStore.get(params.id, user.id)) {
    return NextResponse.json({ ok: false, error: { code: "not_found", message: "Project not found." } }, { status: 404 });
  }
  const state = pathwayStore.get(params.id);
  const validations = validateAllRuns(state.runs, state.segments);
  const materials   = materialRollup(state.segments, state.runs);
  return NextResponse.json({ ok: true, state, validations, materials });
}

interface CreateBody {
  type: PathwaySegment["type"];
  nodes: { x: number; y: number }[];
  floor: number;
  heightFt: number;
  trayWidthIn?: number;
  conduitSize?: string;
  fromFloor?: number;
  toFloor?: number;
  label?: string;
}

export async function POST(req: Request, { params }: { params: { id: string } }) {
  const user = getCurrentUser();
  if (!user) return NextResponse.json({ ok: false }, { status: 401 });
  if (!projectStore.get(params.id, user.id)) {
    return NextResponse.json({ ok: false, error: { code: "not_found", message: "Project not found." } }, { status: 404 });
  }
  const body = (await req.json()) as CreateBody;
  if (!body.type || !Array.isArray(body.nodes) || body.nodes.length < 2) {
    return NextResponse.json({ ok: false, error: { code: "bad_request", message: "type and at least 2 nodes are required." } }, { status: 400 });
  }
  const seg = pathwayStore.addSegment(params.id, {
    type:         body.type,
    nodes:        body.nodes,
    floor:        body.floor,
    heightFt:     body.heightFt,
    trayWidthIn:  body.trayWidthIn,
    conduitSize:  body.conduitSize,
    fromFloor:    body.fromFloor,
    toFloor:      body.toFloor,
    label:        body.label,
    source:       "rcdd",
  });
  return NextResponse.json({ ok: true, segment: seg });
}
