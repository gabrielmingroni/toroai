import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/session";
import { projectStore } from "@/lib/projects/mock-store";
import { intakeStore } from "@/lib/intake/mock-store";
import { placementStore } from "@/lib/placement/mock-store";
import { pathwayStore } from "@/lib/pathway/mock-store";
import { computeBom } from "@/lib/bom/compute";

export async function GET(_req: Request, { params }: { params: { id: string } }) {
  const user = getCurrentUser();
  if (!user) return NextResponse.json({ ok: false }, { status: 401 });
  const project = projectStore.get(params.id, user.id);
  if (!project) return NextResponse.json({ ok: false, error: { code: "not_found", message: "Project not found." } }, { status: 404 });

  const intake = intakeStore.get(project.id);
  const placement = placementStore.get(project.id, user.id) ?? null;
  const pathway = pathwayStore.get(project.id);

  const document = computeBom({
    project,
    rooms: intake?.rooms ?? [],
    placement,
    segments: pathway.segments,
    runs: pathway.runs,
  });
  return NextResponse.json({ ok: true, document });
}
