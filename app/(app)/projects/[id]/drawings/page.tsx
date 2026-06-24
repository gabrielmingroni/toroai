import { notFound } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/session";
import { projectStore } from "@/lib/projects/mock-store";
import { intakeStore } from "@/lib/intake/mock-store";
import { placementStore } from "@/lib/placement/mock-store";
import { drawingSetStore } from "@/lib/drawings/mock-store";
import { suggestTrLocations } from "@/lib/design/tr-suggester";
import { buildCableSchedule } from "@/lib/design/cable-schedule";
import { TopBar } from "@/components/shell/TopBar";
import { DrawingSetView } from "@/components/drawings/DrawingSetView";

// /projects/[id]/drawings — sheet set browser. Loads intake rooms + the
// cable schedule (if available) and renders the active sheet at D-size.

export default function DrawingsPage({ params }: { params: { id: string } }) {
  const user = getCurrentUser()!;
  const project = projectStore.get(params.id, user.id);
  if (!project) notFound();

  const set = drawingSetStore.get(project);

  const intake = intakeStore.get(project.id);
  const placement = placementStore.get(project.id, user.id);
  const rooms = intake?.rooms ?? [];
  const outlets = placement?.outlets ?? [];

  // Cable schedule needs TR suggestions + outlets — produce them inline so the
  // sheet always has up-to-date data without an extra round-trip.
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
        { label: "Drawings" },
      ]} />
      <div className="flex-1 min-h-0 flex">
        <DrawingSetView
          project={project}
          rcdd={user}
          set={set}
          rooms={rooms}
          scheduleRows={schedule.rows}
          scheduleTotalLf={schedule.totalCableLf}
          outletCount={outlets.length || project.outlets || 0}
        />
      </div>
    </>
  );
}
