import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/session";
import { projectStore } from "@/lib/projects/mock-store";
import { call1OutputFor, runAllEnforcement } from "@/lib/enforcement";

export async function GET(_req: Request, { params }: { params: { id: string } }) {
  const user = getCurrentUser();
  if (!user) return NextResponse.json({ ok: false }, { status: 401 });
  const project = projectStore.get(params.id, user.id);
  if (!project) {
    return NextResponse.json({ ok: false, error: { code: "not_found", message: "Project not found." } }, { status: 404 });
  }
  const call1Input = call1OutputFor(project.id);
  if (!call1Input) {
    return NextResponse.json({
      ok: false,
      error: { code: "no_call1_output", message: "No Call-1 output is fixtured for this project yet. The two-call Claude architecture must run first." },
    }, { status: 404 });
  }
  const bundle = runAllEnforcement(call1Input, project);
  return NextResponse.json({
    ok: true,
    bundle,
    call1Input,
    projectContext: {
      federalAgency:     project.exhibit?.federalAgency,
      davisBaconApplies: !!project.exhibit?.davisBaconApplies,
      jurisdiction:      `${project.city}, ${project.state}`,
      exhibit:           project.exhibit,
    },
  });
}
