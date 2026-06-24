import { notFound } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/session";
import { projectStore } from "@/lib/projects/mock-store";
import { resolveRegulatoryReadiness } from "@/lib/regulatory/resolve";
import { TopBar } from "@/components/shell/TopBar";
import { RegulatoryView } from "@/components/regulatory/RegulatoryView";

export default function RegulatoryPage({ params }: { params: { id: string } }) {
  const user = getCurrentUser()!;
  const project = projectStore.get(params.id, user.id);
  if (!project) notFound();

  const report = resolveRegulatoryReadiness(project);

  return (
    <>
      <TopBar breadcrumb={[
        { label: "Workspace" },
        { label: "Projects" },
        { label: project.name },
        { label: "Regulatory Readiness" },
      ]} />
      <div className="flex-1 overflow-y-auto">
        <RegulatoryView report={report} />
      </div>
    </>
  );
}
