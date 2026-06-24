import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/session";
import { projectStore } from "@/lib/projects/mock-store";
import { intakeStore } from "@/lib/intake/mock-store";
import { placementStore } from "@/lib/placement/mock-store";
import { pathwayStore } from "@/lib/pathway/mock-store";
import { computeBom } from "@/lib/bom/compute";
import { buildContext as buildComplianceContext, runComplianceChecks } from "@/lib/standards/check";
import { resolveRegulatoryReadiness } from "@/lib/regulatory/resolve";
import { suggestTrLocations } from "@/lib/design/tr-suggester";
import { buildCableSchedule } from "@/lib/design/cable-schedule";
import { generateSubmittalPdf } from "@/lib/submittal/generate";

export async function GET(_req: Request, { params }: { params: { id: string } }) {
  const user = getCurrentUser();
  if (!user) return NextResponse.json({ ok: false }, { status: 401 });
  const project = projectStore.get(params.id, user.id);
  if (!project) {
    return NextResponse.json({ ok: false, error: { code: "not_found", message: "Project not found." } }, { status: 404 });
  }

  // Run all the computes the submittal needs.
  const intake    = intakeStore.get(project.id);
  const placement = placementStore.get(project.id, user.id);
  const pathway   = pathwayStore.get(project.id);
  const rooms     = intake?.rooms ?? [];
  const outlets   = placement?.outlets ?? [];

  const bom        = computeBom({ project, rooms, placement: placement ?? null, segments: pathway.segments, runs: pathway.runs });
  const compliance = runComplianceChecks(buildComplianceContext(project, user.id));
  const regulatory = resolveRegulatoryReadiness(project);
  const trResult   = suggestTrLocations({
    rooms,
    outletPositions: outlets.map(o => ({ id: o.id, x: o.x, y: o.y, floor: o.floor })),
  });
  const cableSchedule = buildCableSchedule({ rooms, outlets, trSuggestions: trResult.suggestions });

  let pdfBytes: Uint8Array;
  try {
    pdfBytes = await generateSubmittalPdf({
      project, user, bom, compliance, regulatory, cableSchedule,
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({
      ok: false,
      error: { code: "generation_failed", message: msg },
    }, { status: 500 });
  }

  // Stream the PDF back. Browsers + curl handle Uint8Array directly when we
  // set the right content-type + disposition headers.
  const filename = `${project.number}-submittal.pdf`;
  return new Response(pdfBytes, {
    status: 200,
    headers: {
      "content-type":        "application/pdf",
      "content-disposition": `attachment; filename="${filename}"`,
      "content-length":      String(pdfBytes.length),
    },
  });
}
