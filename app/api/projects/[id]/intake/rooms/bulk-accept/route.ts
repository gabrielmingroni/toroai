import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/session";
import { projectStore } from "@/lib/projects/mock-store";
import { intakeStore } from "@/lib/intake/mock-store";

export async function POST(req: Request, { params }: { params: { id: string } }) {
  const user = getCurrentUser();
  if (!user) return NextResponse.json({ ok: false }, { status: 401 });
  if (!projectStore.get(params.id, user.id)) return NextResponse.json({ ok: false, error: { code: "not_found", message: "Project not found." } }, { status: 404 });
  const body = await req.json().catch(() => ({}));
  const threshold = typeof body.threshold === "number" ? body.threshold : 0.85;
  const job = intakeStore.bulkAcceptHighConfidence(params.id, threshold);
  if (!job) return NextResponse.json({ ok: false, error: { code: "no_job", message: "No intake job for this project." } }, { status: 404 });
  return NextResponse.json({ ok: true, job });
}
