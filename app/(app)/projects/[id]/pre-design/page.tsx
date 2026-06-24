import { notFound } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/session";
import { projectStore } from "@/lib/projects/mock-store";
import { intakeStore } from "@/lib/intake/mock-store";
import { designStore } from "@/lib/design/mock-store";
import { computeDesign } from "@/lib/design/compute";
import { SECTOR_LABEL } from "@/lib/projects/types";
import { SECTOR_DEFAULTS } from "@/lib/design/types";
import { TopBar } from "@/components/shell/TopBar";
import { PreDesignEditor } from "@/components/design/PreDesignEditor";

export default function PreDesignPage({ params }: { params: { id: string } }) {
  const user = getCurrentUser()!;
  const project = projectStore.get(params.id, user.id);
  if (!project) notFound();

  const parameters = designStore.get(project.id, user.id)!;
  const job = intakeStore.get(project.id);
  const confirmedRooms = job?.rooms ?? [];
  const initialResults = computeDesign(parameters, project, confirmedRooms);
  const sectorRationale = SECTOR_DEFAULTS[project.sector]?.rationale;

  return (
    <>
      <TopBar breadcrumb={[
        { label: "Workspace" },
        { label: "Projects" },
        { label: project.name },
        { label: "RCDD Pre-Design" },
      ]} />
      <div className="flex-1 overflow-y-auto">
        <PreDesignEditor
          project={project}
          sectorLabel={SECTOR_LABEL[project.sector]}
          sectorRationale={sectorRationale ?? ""}
          initialParameters={parameters}
          initialResults={initialResults}
          hasIntake={Boolean(job?.rooms?.length)}
        />
      </div>
    </>
  );
}
