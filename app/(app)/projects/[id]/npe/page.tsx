import { notFound } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/session";
import { projectStore } from "@/lib/projects/mock-store";
import { runTwoCallArchitecture } from "@/lib/npe/orchestrator";
import { NpeWorkspace } from "@/components/npe/NpeWorkspace";

// Full-viewport CAD shell — same pattern as Pathway / Pipeline.

export default async function NpePage({ params }: { params: { id: string } }) {
  const user = getCurrentUser()!;
  const project = projectStore.get(params.id, user.id);
  if (!project) notFound();

  const bundle = await runTwoCallArchitecture(project);
  const identity = `${user.firstName} ${user.lastName}${user.rcddNumber ? ` · RCDD #${user.rcddNumber}` : ""}`;

  return (
    <div className="fixed inset-0 z-50 bg-chrome">
      <NpeWorkspace project={project} identity={identity} bundle={bundle} />
    </div>
  );
}
