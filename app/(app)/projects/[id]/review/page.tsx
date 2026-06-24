import { notFound } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/session";
import { projectStore } from "@/lib/projects/mock-store";
import { intakeStore } from "@/lib/intake/mock-store";
import { designStore } from "@/lib/design/mock-store";
import { placementStore } from "@/lib/placement/mock-store";
import { pipelineStore } from "@/lib/pipeline/mock-store";
import { markupStore } from "@/lib/markup/mock-store";
import { computeResults } from "@/lib/results/compute";
import { TopBar } from "@/components/shell/TopBar";
import { ReviewQueue } from "@/components/review/ReviewQueue";

export default function ReviewPage({ params }: { params: { id: string } }) {
  const user = getCurrentUser()!;
  const project = projectStore.get(params.id, user.id);
  if (!project) notFound();

  const intake = intakeStore.get(project.id);
  const placements = placementStore.get(project.id, user.id);
  const designParams = designStore.get(project.id, user.id);
  const pipelineRun = pipelineStore.get(project.id) ?? null;

  const hasPrereqs = !!(intake && placements && designParams);
  const compliance = hasPrereqs
    ? computeResults(project, designParams!, placements!, intake!.rooms).compliance
    : null;

  const sheets       = markupStore.listSheets(project.id);
  const sheetCounts  = markupStore.countsBySheet(project.id);

  return (
    <>
      <TopBar breadcrumb={[
        { label: "Workspace" },
        { label: "Projects" },
        { label: project.name },
        { label: "RCDD Review" },
      ]} />
      <div className="flex-1 overflow-hidden">
        <ReviewQueue
          project={project}
          placements={placements ?? null}
          rooms={intake?.rooms ?? []}
          compliance={compliance}
          initialRun={pipelineRun}
          sheets={sheets}
          sheetCounts={sheetCounts}
        />
      </div>
    </>
  );
}
