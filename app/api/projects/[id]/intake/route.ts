import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/session";
import { projectStore } from "@/lib/projects/mock-store";
import { intakeStore } from "@/lib/intake/mock-store";
import type { StartIntakeRequest } from "@/lib/intake/types";

export async function GET(_req: Request, { params }: { params: { id: string } }) {
  const user = getCurrentUser();
  if (!user) return NextResponse.json({ ok: false }, { status: 401 });
  if (!projectStore.get(params.id, user.id)) return NextResponse.json({ ok: false, error: { code: "not_found", message: "Project not found." } }, { status: 404 });
  const job = intakeStore.get(params.id);
  return NextResponse.json({ ok: true, job: job ?? null });
}

export async function POST(req: Request, { params }: { params: { id: string } }) {
  const user = getCurrentUser();
  if (!user) return NextResponse.json({ ok: false }, { status: 401 });
  const project = projectStore.get(params.id, user.id);
  if (!project) return NextResponse.json({ ok: false, error: { code: "not_found", message: "Project not found." } }, { status: 404 });
  const body = (await req.json()) as StartIntakeRequest;
  if (!body?.files?.length) {
    return NextResponse.json({ ok: false, error: { code: "no_files", message: "Upload at least one document before starting intake." } }, { status: 400 });
  }
  const job = intakeStore.start(params.id, body);
  // Flip project into "intake" status visually
  projectStore.update(params.id, user.id, { status: "intake" } as any);
  return NextResponse.json({ ok: true, job });
}

export async function DELETE(_req: Request, { params }: { params: { id: string } }) {
  const user = getCurrentUser();
  if (!user) return NextResponse.json({ ok: false }, { status: 401 });
  if (!projectStore.get(params.id, user.id)) return NextResponse.json({ ok: false, error: { code: "not_found", message: "Project not found." } }, { status: 404 });
  intakeStore.reset(params.id);
  projectStore.update(params.id, user.id, { status: "draft" } as any);
  return NextResponse.json({ ok: true });
}
