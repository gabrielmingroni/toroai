import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/session";
import { projectStore } from "@/lib/projects/mock-store";
import { pipelineStore } from "@/lib/pipeline/mock-store";

export async function GET(_req: Request, { params }: { params: { id: string } }) {
  const user = getCurrentUser();
  if (!user) return NextResponse.json({ ok: false }, { status: 401 });
  if (!projectStore.get(params.id, user.id)) return NextResponse.json({ ok: false, error: { code: "not_found", message: "Project not found." } }, { status: 404 });
  const run = pipelineStore.get(params.id);
  // Sync project status from run state.
  //  ▸ paused at gate                 → pending_review
  //  ▸ completed (all stages done)    → ready_to_stamp
  //  ▸ gate released, stages 8–10 run → in_progress  (so dashboard doesn't
  //    falsely advertise "Pending Review" or "Ready to Stamp" while drawings
  //    are still being generated)
  if (run) {
    if (run.currentStage === "rcdd_review_gate" && !run.gateReleasedAt) {
      projectStore.update(params.id, user.id, { status: "pending_review" } as any);
    } else if (run.completedAt) {
      projectStore.update(params.id, user.id, { status: "ready_to_stamp" } as any);
    } else if (run.gateReleasedAt) {
      projectStore.update(params.id, user.id, { status: "in_progress" } as any);
    }
  }
  return NextResponse.json({ ok: true, run: run ?? null });
}

export async function POST(_req: Request, { params }: { params: { id: string } }) {
  const user = getCurrentUser();
  if (!user) return NextResponse.json({ ok: false }, { status: 401 });
  if (!projectStore.get(params.id, user.id)) return NextResponse.json({ ok: false, error: { code: "not_found", message: "Project not found." } }, { status: 404 });
  const run = pipelineStore.start(params.id);
  // Keep project in_progress while pipeline runs (pre-gate)
  projectStore.update(params.id, user.id, { status: "in_progress" } as any);
  return NextResponse.json({ ok: true, run });
}

export async function DELETE(_req: Request, { params }: { params: { id: string } }) {
  const user = getCurrentUser();
  if (!user) return NextResponse.json({ ok: false }, { status: 401 });
  if (!projectStore.get(params.id, user.id)) return NextResponse.json({ ok: false, error: { code: "not_found", message: "Project not found." } }, { status: 404 });
  pipelineStore.reset(params.id);
  return NextResponse.json({ ok: true });
}
