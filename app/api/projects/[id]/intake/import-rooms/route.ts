import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/session";
import { projectStore } from "@/lib/projects/mock-store";
import { intakeStore } from "@/lib/intake/mock-store";
import type { ExtractedRoom, RoomType } from "@/lib/intake/types";
import { CANVAS_W, CANVAS_H } from "@/lib/intake/types";

const VALID_TYPES = new Set<RoomType>([
  "mdf", "idf", "open_office", "private_office", "conference", "reception",
  "corridor", "storage", "electrical", "mechanical", "restroom", "kitchen",
  "stairwell", "elevator", "lab", "patient_room", "exam_room", "classroom", "unknown",
]);

export async function POST(req: Request, { params }: { params: { id: string } }) {
  const user = getCurrentUser();
  if (!user) return NextResponse.json({ ok: false }, { status: 401 });
  const project = projectStore.get(params.id, user.id);
  if (!project) {
    return NextResponse.json({ ok: false, error: { code: "not_found", message: "Project not found." } }, { status: 404 });
  }

  let body: { rooms?: unknown };
  try { body = await req.json(); }
  catch {
    return NextResponse.json({ ok: false, error: { code: "bad_json", message: "Request body must be JSON with rooms[]." } }, { status: 400 });
  }
  if (!Array.isArray(body.rooms) || body.rooms.length === 0) {
    return NextResponse.json({ ok: false, error: { code: "no_rooms", message: "rooms must be a non-empty array." } }, { status: 400 });
  }

  // ── Validate + coerce each room ──────────────────────────────────────
  const rooms: ExtractedRoom[] = [];
  for (const raw of body.rooms as unknown[]) {
    if (!raw || typeof raw !== "object") continue;
    const r = raw as Record<string, unknown>;
    const id     = typeof r.id === "string" ? r.id : "vroom_" + rooms.length.toString().padStart(3, "0");
    const name   = typeof r.name === "string" && r.name.trim() ? r.name.trim() : null;
    if (!name) continue;
    const type   = typeof r.type === "string" && VALID_TYPES.has(r.type as RoomType) ? r.type as RoomType : "unknown";
    const x = clamp(Number(r.x ?? 0), 0, CANVAS_W);
    const y = clamp(Number(r.y ?? 0), 0, CANVAS_H);
    const w = clamp(Number(r.w ?? 1), 0.5, CANVAS_W - x);
    const h = clamp(Number(r.h ?? 1), 0.5, CANVAS_H - y);
    rooms.push({
      id, name, type,
      confidence: clamp(Number(r.confidence ?? 0.8), 0, 1),
      area: Math.round(w * h),
      floor: Number(r.floor ?? 1),
      x, y, w, h,
      source: "CAD",
      overrideType: null, overrideName: null,
      excluded: false, reviewed: false,
    });
  }
  if (rooms.length === 0) {
    return NextResponse.json({ ok: false, error: { code: "no_valid_rooms", message: "After validation, no rooms remained." } }, { status: 400 });
  }

  const job = intakeStore.confirmRoomsFromVision(project.id, rooms, user.id);
  if (!job) {
    return NextResponse.json({ ok: false, error: { code: "import_failed", message: "Could not import rooms." } }, { status: 500 });
  }

  return NextResponse.json({
    ok: true,
    imported: rooms.length,
    project: {
      id: project.id,
      roomsConfirmed: project.roomsConfirmed,
      outlets: project.outlets,
      waps: project.waps,
      hasUpload: project.hasUpload,
    },
  });
}

function clamp(n: number, min: number, max: number): number {
  if (Number.isNaN(n)) return min;
  return Math.max(min, Math.min(max, n));
}
