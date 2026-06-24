import { notFound } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/session";
import { projectStore } from "@/lib/projects/mock-store";
import { intakeStore } from "@/lib/intake/mock-store";
import { TopBar } from "@/components/shell/TopBar";
import { IntakeWizard } from "@/components/intake/IntakeWizard";

export default function IntakeUploadPage({ params }: { params: { id: string } }) {
  const user = getCurrentUser()!;
  const project = projectStore.get(params.id, user.id);
  if (!project) notFound();
  const job = intakeStore.get(project.id) ?? null;

  return (
    <>
      <TopBar breadcrumb={[
        { label: "Workspace" },
        { label: "Projects" },
        { label: project.name },
        { label: "Document Intake" },
      ]} />
      <div className="flex-1 overflow-hidden">
        <IntakeWizard project={project} initialJob={job} />
      </div>
    </>
  );
}
