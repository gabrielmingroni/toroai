import { notFound } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/session";
import { projectStore } from "@/lib/projects/mock-store";
import { buildContext, runComplianceChecks } from "@/lib/standards/check";
import { TopBar } from "@/components/shell/TopBar";
import { ComplianceView } from "@/components/standards/ComplianceView";

export default function CompliancePage({ params }: { params: { id: string } }) {
  const user = getCurrentUser()!;
  const project = projectStore.get(params.id, user.id);
  if (!project) notFound();

  const ctx = buildContext(project, user.id);
  const result = runComplianceChecks(ctx);

  return (
    <>
      <TopBar breadcrumb={[
        { label: "Workspace" },
        { label: "Projects" },
        { label: project.name },
        { label: "Compliance" },
      ]} />
      <div className="flex-1 overflow-y-auto">
        <ComplianceView project={project} result={result} />
      </div>
    </>
  );
}
