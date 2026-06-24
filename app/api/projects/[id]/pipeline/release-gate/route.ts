import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/session";
import { projectStore } from "@/lib/projects/mock-store";
import { pipelineStore } from "@/lib/pipeline/mock-store";

export async function POST(_req: Request, { params }: { params: { id: string } }) {
  const user = getCurrentUser();
  if (!user) return NextResponse.json({ ok: false }, { status: 401 });
  if (!projectStore.get(params.id, user.id)) return NextResponse.json({ ok: false, error: { code: "not_found", message: "Project not found." } }, { status: 404 });
  const run = pipelineStore.releaseGate(params.id);
  if (!run) return NextResponse.json({ ok: false, error: { code: "no_run", message: "No pipeline run for this project." } }, { status: 404 });
  // Don't flip the project status here — post-gate stages (construction drawing,
  // PDF export, S3 upload) still need to run. The next pipeline GET will promote
  // the project to "ready_to_stamp" once run.completedAt is set. Until then,
  // keep it in "in_progress" so the dashboard correctly reflects that drawings
  // are still being generated.
  if (run.completedAt) {
    projectStore.update(params.id, user.id, { status: "ready_to_stamp" } as any);
  } else {
    projectStore.update(params.id, user.id, { status: "in_progress" } as any);
  }
  return NextResponse.json({ ok: true, run });
}
