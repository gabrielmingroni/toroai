import { notFound } from "next/navigation";
import Link from "next/link";
import { getCurrentUser } from "@/lib/auth/session";
import { projectStore } from "@/lib/projects/mock-store";
import { call1OutputFor, runAllEnforcement } from "@/lib/enforcement";
import { TopBar } from "@/components/shell/TopBar";
import { EnforcementView } from "@/components/enforcement/EnforcementView";

export default function EnforcementPage({ params }: { params: { id: string } }) {
  const user = getCurrentUser()!;
  const project = projectStore.get(params.id, user.id);
  if (!project) notFound();

  const call1Input = call1OutputFor(project.id);
  const bundle = call1Input ? runAllEnforcement(call1Input, project) : null;

  return (
    <>
      <TopBar breadcrumb={[
        { label: "Workspace" },
        { label: "Projects" },
        { label: project.name },
        { label: "Enforcement" },
      ]} />
      <div className="flex-1 overflow-y-auto">
        {bundle && call1Input ? (
          <EnforcementView project={project} call1={call1Input} bundle={bundle} />
        ) : (
          <div className="p-6 max-w-[800px]">
            <h1 className="text-[20px] font-semibold mb-2">Post-processing enforcement</h1>
            <p className="text-[11.5px] text-text3 font-mono mb-4">
              No Call-1 output fixtured for this project yet. The design reasoning
              step must run before enforcement.
            </p>
            <Link href={`/projects/${project.id}`} className="btn btn-ghost text-[12px]">← Back to project</Link>
          </div>
        )}
      </div>
    </>
  );
}
