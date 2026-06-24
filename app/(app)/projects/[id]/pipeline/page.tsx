import { notFound } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/session";
import { projectStore } from "@/lib/projects/mock-store";
import { pipelineStore } from "@/lib/pipeline/mock-store";
import { PipelineWorkspace } from "@/components/pipeline/PipelineWorkspace";

// Renders inside a full-viewport fixed overlay so the Revit-style AppFrame
// takes over and hides the (app) layout's 220 px nav sidebar.

export default function PipelinePage({ params }: { params: { id: string } }) {
  const user = getCurrentUser()!;
  const project = projectStore.get(params.id, user.id);
  if (!project) notFound();

  const initialRun = pipelineStore.get(project.id) ?? null;
  const identity = `${user.firstName} ${user.lastName}${user.rcddNumber ? ` · RCDD #${user.rcddNumber}` : ""}`;

  return (
    <div className="fixed inset-0 z-50 bg-chrome">
      <PipelineWorkspace
        project={project}
        identity={identity}
        initialRun={initialRun}
      />
    </div>
  );
}
