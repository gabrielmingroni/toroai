import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/session";
import { projectStore } from "@/lib/projects/mock-store";
import { intakeStore } from "@/lib/intake/mock-store";
import { placementStore } from "@/lib/placement/mock-store";
import { pathwayStore } from "@/lib/pathway/mock-store";
import { computeBom } from "@/lib/bom/compute";
import { buildContext as buildComplianceContext, runComplianceChecks } from "@/lib/standards/check";
import { resolveRegulatoryReadiness } from "@/lib/regulatory/resolve";
import { generateSpec } from "@/lib/spec/generate";
import { specStore } from "@/lib/spec/mock-store";

export async function GET(_req: Request, { params }: { params: { id: string } }) {
  const user = getCurrentUser();
  if (!user) return NextResponse.json({ ok: false }, { status: 401 });
  if (!projectStore.get(params.id, user.id)) {
    return NextResponse.json({ ok: false, error: { code: "not_found", message: "Project not found." } }, { status: 404 });
  }
  const document = specStore.get(params.id);
  return NextResponse.json({ ok: true, document: document ?? null });
}

export async function POST(_req: Request, { params }: { params: { id: string } }) {
  const user = getCurrentUser();
  if (!user) return NextResponse.json({ ok: false }, { status: 401 });
  const project = projectStore.get(params.id, user.id);
  if (!project) {
    return NextResponse.json({ ok: false, error: { code: "not_found", message: "Project not found." } }, { status: 404 });
  }

  const intake    = intakeStore.get(project.id);
  const placement = placementStore.get(project.id, user.id);
  const pathway   = pathwayStore.get(project.id);
  const rooms     = intake?.rooms ?? [];
  const bom        = computeBom({ project, rooms, placement: placement ?? null,
    segments: pathway.segments, runs: pathway.runs });
  const compliance = runComplianceChecks(buildComplianceContext(project, user.id));
  const regulatory = resolveRegulatoryReadiness(project);

  try {
    const doc = await generateSpec({ project, bom, compliance, regulatory });
    specStore.set(project.id, doc);
    return NextResponse.json({ ok: true, document: doc });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({
      ok: false,
      error: { code: "generation_failed", message: msg },
    }, { status: 500 });
  }
}

export async function DELETE(_req: Request, { params }: { params: { id: string } }) {
  const user = getCurrentUser();
  if (!user) return NextResponse.json({ ok: false }, { status: 401 });
  if (!projectStore.get(params.id, user.id)) {
    return NextResponse.json({ ok: false, error: { code: "not_found", message: "Project not found." } }, { status: 404 });
  }
  specStore.clear(params.id);
  return NextResponse.json({ ok: true });
}
