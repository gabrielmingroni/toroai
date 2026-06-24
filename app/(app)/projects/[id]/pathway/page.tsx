import { notFound } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/session";
import { projectStore } from "@/lib/projects/mock-store";
import { intakeStore } from "@/lib/intake/mock-store";
import { pathwayStore } from "@/lib/pathway/mock-store";
import { validateAllRuns, materialRollup } from "@/lib/pathway/compute";
import { PathwayWorkspace } from "@/components/pathway/PathwayWorkspace";

// NOTE: this view intentionally takes over the full viewport (fixed inset-0)
// so the Revit-style AppFrame shell can dominate. The (app) layout's
// 220 px navigation Sidebar is still mounted underneath but visually covered.
// A future route-group restructure will lift this out of the (app) group.

export default function PathwayPage({ params }: { params: { id: string } }) {
  const user = getCurrentUser()!;
  const project = projectStore.get(params.id, user.id);
  if (!project) notFound();

  const state = pathwayStore.get(project.id);
  const intake = intakeStore.get(project.id);
  const rooms  = intake?.rooms ?? [];
  const validations = validateAllRuns(state.runs, state.segments);
  const materials   = materialRollup(state.segments, state.runs);
  const identity = `${user.firstName} ${user.lastName}${user.rcddNumber ? ` · RCDD #${user.rcddNumber}` : ""}`;

  return (
    <div className="fixed inset-0 z-50 bg-chrome">
      <PathwayWorkspace
        project={project}
        identity={identity}
        rooms={rooms}
        segments={state.segments}
        runs={state.runs}
        validations={validations}
        materials={materials}
      />
    </div>
  );
}
