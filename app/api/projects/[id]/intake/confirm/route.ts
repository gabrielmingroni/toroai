import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/session";
import { projectStore } from "@/lib/projects/mock-store";
import { intakeStore } from "@/lib/intake/mock-store";

export async function POST(_req: Request, { params }: { params: { id: string } }) {
  const user = getCurrentUser();
  if (!user) return NextResponse.json({ ok: false }, { status: 401 });
  if (!projectStore.get(params.id, user.id)) return NextResponse.json({ ok: false, error: { code: "not_found", message: "Project not found." } }, { status: 404 });
  const job = intakeStore.confirm(params.id);
  if (!job) return NextResponse.json({ ok: false, error: { code: "not_ready", message: "Intake is not ready for review yet." } }, { status: 400 });
  return NextResponse.json({ ok: true, job });
}
