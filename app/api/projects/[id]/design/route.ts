import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/session";
import { projectStore } from "@/lib/projects/mock-store";
import { designStore } from "@/lib/design/mock-store";
import { intakeStore } from "@/lib/intake/mock-store";
import { computeDesign } from "@/lib/design/compute";
import type { DesignParameters } from "@/lib/design/types";

export async function GET(_req: Request, { params }: { params: { id: string } }) {
  const user = getCurrentUser();
  if (!user) return NextResponse.json({ ok: false }, { status: 401 });
  const project = projectStore.get(params.id, user.id);
  if (!project) return NextResponse.json({ ok: false, error: { code: "not_found", message: "Project not found." } }, { status: 404 });

  const parameters = designStore.get(params.id, user.id)!;
  const job = intakeStore.get(params.id);
  const confirmedRooms = job?.rooms ?? [];
  const results = computeDesign(parameters, project, confirmedRooms);
  return NextResponse.json({ ok: true, parameters, results });
}

export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  const user = getCurrentUser();
  if (!user) return NextResponse.json({ ok: false }, { status: 401 });
  const project = projectStore.get(params.id, user.id);
  if (!project) return NextResponse.json({ ok: false, error: { code: "not_found", message: "Project not found." } }, { status: 404 });

  const patch = (await req.json()) as Partial<DesignParameters>;
  const parameters = designStore.update(params.id, user.id, patch)!;
  const job = intakeStore.get(params.id);
  const results = computeDesign(parameters, project, job?.rooms ?? []);
  return NextResponse.json({ ok: true, parameters, results });
}

export async function DELETE(_req: Request, { params }: { params: { id: string } }) {
  const user = getCurrentUser();
  if (!user) return NextResponse.json({ ok: false }, { status: 401 });
  if (!projectStore.get(params.id, user.id)) {
    return NextResponse.json({ ok: false, error: { code: "not_found", message: "Project not found." } }, { status: 404 });
  }
  const parameters = designStore.reset(params.id, user.id)!;
  return NextResponse.json({ ok: true, parameters });
}
