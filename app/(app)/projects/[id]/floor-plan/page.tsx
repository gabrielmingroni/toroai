import { notFound, redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/session";
import { projectStore } from "@/lib/projects/mock-store";
import { intakeStore } from "@/lib/intake/mock-store";
import { designStore } from "@/lib/design/mock-store";
import { placementStore } from "@/lib/placement/mock-store";
import { TopBar } from "@/components/shell/TopBar";
import { FloorPlanWorkspace } from "@/components/floorplan/FloorPlanWorkspace";

export default function FloorPlanPage({ params }: { params: { id: string } }) {
  const user = getCurrentUser()!;
  const project = projectStore.get(params.id, user.id);
  if (!project) notFound();
  const intake = intakeStore.get(project.id);
  if (!intake || !intake.rooms.length) {
    redirect(`/projects/${project.id}/upload`);
  }
  const placements = placementStore.get(project.id, user.id)!;
  const params_ = designStore.get(project.id, user.id)!;

  return (
    <>
      <TopBar breadcrumb={[
        { label: "Workspace" },
        { label: "Projects" },
        { label: project.name },
        { label: "Floor Plan" },
      ]} />
      <div className="flex-1 overflow-hidden">
        <FloorPlanWorkspace
          project={project}
          rooms={intake.rooms}
          initialPlacements={placements}
          designParameters={params_}
        />
      </div>
    </>
  );
}
