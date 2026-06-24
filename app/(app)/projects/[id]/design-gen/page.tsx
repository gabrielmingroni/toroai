import { notFound } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/session";
import { projectStore } from "@/lib/projects/mock-store";
import { intakeStore } from "@/lib/intake/mock-store";
import { placementStore } from "@/lib/placement/mock-store";
import { suggestTrLocations } from "@/lib/design/tr-suggester";
import { buildCableSchedule } from "@/lib/design/cable-schedule";
import { TopBar } from "@/components/shell/TopBar";
import { DesignGenView } from "@/components/design/DesignGenView";

export default function DesignGenPage({ params }: { params: { id: string } }) {
  const user = getCurrentUser()!;
  const project = projectStore.get(params.id, user.id);
  if (!project) notFound();

  const intake = intakeStore.get(project.id);
  const placement = placementStore.get(project.id, user.id);
  const rooms = intake?.rooms ?? [];
  const outlets = placement?.outlets ?? [];

  const trResult = suggestTrLocations({
    rooms,
    outletPositions: outlets.map(o => ({ id: o.id, x: o.x, y: o.y, floor: o.floor })),
  });
  const schedule = buildCableSchedule({
    rooms, outlets, trSuggestions: trResult.suggestions,
  });

  return (
    <>
      <TopBar breadcrumb={[
        { label: "Workspace" },
        { label: "Projects" },
        { label: project.name },
        { label: "Design Generation" },
      ]} />
      <div className="flex-1 overflow-y-auto">
        <DesignGenView
          project={project}
          rooms={rooms}
          outlets={outlets}
          trResult={trResult}
          schedule={schedule}
        />
      </div>
    </>
  );
}
