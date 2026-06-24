import { notFound } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/session";
import { projectStore } from "@/lib/projects/mock-store";
import { specStore } from "@/lib/spec/mock-store";
import { TopBar } from "@/components/shell/TopBar";
import { SpecView } from "@/components/spec/SpecView";

export default function SpecPage({ params }: { params: { id: string } }) {
  const user = getCurrentUser()!;
  const project = projectStore.get(params.id, user.id);
  if (!project) notFound();

  const doc = specStore.get(project.id);

  return (
    <>
      <TopBar breadcrumb={[
        { label: "Workspace" },
        { label: "Projects" },
        { label: project.name },
        { label: "Specification (CSI 27)" },
      ]} />
      <div className="flex-1 overflow-y-auto">
        <SpecView project={project} initialDoc={doc ?? null} />
      </div>
    </>
  );
}
