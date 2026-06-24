import { notFound } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/session";
import { projectStore } from "@/lib/projects/mock-store";
import { intakeStore } from "@/lib/intake/mock-store";
import { placementStore } from "@/lib/placement/mock-store";
import { pathwayStore } from "@/lib/pathway/mock-store";
import { computeBom } from "@/lib/bom/compute";
import { TopBar } from "@/components/shell/TopBar";
import { BomView } from "@/components/bom/BomView";

export default function BomPage({ params }: { params: { id: string } }) {
  const user = getCurrentUser()!;
  const project = projectStore.get(params.id, user.id);
  if (!project) notFound();

  const intake = intakeStore.get(project.id);
  const placement = placementStore.get(project.id, user.id) ?? null;
  const pathway = pathwayStore.get(project.id);

  const document = computeBom({
    project,
    rooms: intake?.rooms ?? [],
    placement,
    segments: pathway.segments,
    runs: pathway.runs,
  });

  return (
    <>
      <TopBar breadcrumb={[
        { label: "Workspace" },
        { label: "Projects" },
        { label: project.name },
        { label: "Bill of Materials" },
      ]} />
      <div className="flex-1 overflow-y-auto">
        <BomView document={document} />
      </div>
    </>
  );
}
