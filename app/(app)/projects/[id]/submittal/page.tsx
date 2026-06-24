import { notFound } from "next/navigation";
import Link from "next/link";
import { getCurrentUser } from "@/lib/auth/session";
import { projectStore } from "@/lib/projects/mock-store";
import { intakeStore } from "@/lib/intake/mock-store";
import { placementStore } from "@/lib/placement/mock-store";
import { pathwayStore } from "@/lib/pathway/mock-store";
import { computeBom } from "@/lib/bom/compute";
import { buildContext as buildComplianceContext, runComplianceChecks } from "@/lib/standards/check";
import { resolveRegulatoryReadiness } from "@/lib/regulatory/resolve";
import { TopBar } from "@/components/shell/TopBar";
import { SubmittalView } from "@/components/submittal/SubmittalView";

export default function SubmittalPage({ params }: { params: { id: string } }) {
  const user = getCurrentUser()!;
  const project = projectStore.get(params.id, user.id);
  if (!project) notFound();

  // Precompute summary numbers for the page (the PDF generates on download).
  const intake    = intakeStore.get(project.id);
  const placement = placementStore.get(project.id, user.id);
  const pathway   = pathwayStore.get(project.id);
  const rooms     = intake?.rooms ?? [];

  const bom = computeBom({ project, rooms, placement: placement ?? null,
    segments: pathway.segments, runs: pathway.runs });
  const compliance = runComplianceChecks(buildComplianceContext(project, user.id));
  const regulatory = resolveRegulatoryReadiness(project);

  return (
    <>
      <TopBar breadcrumb={[
        { label: "Workspace" },
        { label: "Projects" },
        { label: project.name },
        { label: "Submittal Package" },
      ]} />
      <div className="flex-1 overflow-y-auto">
        <SubmittalView
          project={project}
          user={user}
          bomSummary={{
            lineItems: bom.lineItems.length,
            sections:  bom.sections.length,
            materialCents: bom.materialSubtotalCents,
            laborCents: bom.labor.subtotalCents,
            grandTotalCents: bom.grandTotalCents,
          }}
          complianceSummary={{
            total: compliance.counts.total,
            pass: compliance.counts.pass,
            advisory: compliance.counts.advisory,
            fail: compliance.counts.fail,
            na: compliance.counts.not_applicable,
          }}
          regulatorySummary={{
            permitCount: regulatory.permitRequirements.length,
            envFlags: regulatory.environmentalFlags.length,
            longestLeadDays: regulatory.longestPermitLeadDays,
            totalFeesCents: regulatory.totalEstimatedFeesCents,
          }}
        />
      </div>
    </>
  );
}
