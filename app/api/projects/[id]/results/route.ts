import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/session";
import { projectStore } from "@/lib/projects/mock-store";
import { intakeStore } from "@/lib/intake/mock-store";
import { designStore } from "@/lib/design/mock-store";
import { placementStore } from "@/lib/placement/mock-store";
import { computeResults } from "@/lib/results/compute";

export async function GET(_req: Request, { params }: { params: { id: string } }) {
  const user = getCurrentUser();
  if (!user) return NextResponse.json({ ok: false }, { status: 401 });
  const project = projectStore.get(params.id, user.id);
  if (!project) return NextResponse.json({ ok: false, error: { code: "not_found", message: "Project not found." } }, { status: 404 });

  const intake = intakeStore.get(project.id);
  const placements = placementStore.get(project.id, user.id);
  const params_ = designStore.get(project.id, user.id);
  if (!intake || !placements || !params_) {
    return NextResponse.json({ ok: false, error: { code: "incomplete", message: "Run intake + Pre-Design before opening Results." } }, { status: 400 });
  }
  const results = computeResults(project, params_, placements, intake.rooms);
  return NextResponse.json({ ok: true, results });
}
