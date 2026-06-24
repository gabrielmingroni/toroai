import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/session";
import { projectStore } from "@/lib/projects/mock-store";
import { intakeStore } from "@/lib/intake/mock-store";
import { placementStore } from "@/lib/placement/mock-store";
import { suggestTrLocations } from "@/lib/design/tr-suggester";
import { buildCableSchedule } from "@/lib/design/cable-schedule";

export async function GET(_req: Request, { params }: { params: { id: string } }) {
  const user = getCurrentUser();
  if (!user) return NextResponse.json({ ok: false }, { status: 401 });
  const project = projectStore.get(params.id, user.id);
  if (!project) return NextResponse.json({ ok: false, error: { code: "not_found", message: "Project not found." } }, { status: 404 });

  const intake = intakeStore.get(project.id);
  const placement = placementStore.get(project.id, user.id);
  const rooms = intake?.rooms ?? [];
  const outlets = placement?.outlets ?? [];

  const tr = suggestTrLocations({
    rooms,
    outletPositions: outlets.map(o => ({ id: o.id, x: o.x, y: o.y, floor: o.floor })),
  });
  const schedule = buildCableSchedule({
    rooms, outlets, trSuggestions: tr.suggestions,
  });

  return NextResponse.json({ ok: true, trSuggestions: tr, cableSchedule: schedule });
}
