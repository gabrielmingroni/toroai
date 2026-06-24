import { notFound } from "next/navigation";
import Link from "next/link";
import { getCurrentUser } from "@/lib/auth/session";
import { projectStore } from "@/lib/projects/mock-store";
import { intakeStore } from "@/lib/intake/mock-store";
import { designStore } from "@/lib/design/mock-store";
import { placementStore } from "@/lib/placement/mock-store";
import { computeResults } from "@/lib/results/compute";
import { TopBar } from "@/components/shell/TopBar";
import { ResultsWorkspace } from "@/components/results/ResultsWorkspace";

export default function ResultsPage({ params, searchParams }: { params: { id: string }; searchParams?: { tab?: string } }) {
  const user = getCurrentUser()!;
  const project = projectStore.get(params.id, user.id);
  if (!project) notFound();
  const intake = intakeStore.get(project.id);
  const placements = placementStore.get(project.id, user.id);
  const designParams = designStore.get(project.id, user.id);

  if (!intake || !placements || !designParams) {
    return (
      <>
        <TopBar breadcrumb={[
          { label: "Workspace" }, { label: "Projects" },
          { label: project.name }, { label: "Results" },
        ]} />
        <div className="flex-1 overflow-y-auto p-6">
          <div className="card max-w-[600px]">
            <div className="card-body p-6 text-[12px] text-text2 leading-relaxed">
              Results are computed from the project state. This project needs to finish intake and design parameters first.{" "}
              <Link href={`/projects/${project.id}/upload`} className="text-accent hover:underline">Open intake</Link>.
            </div>
          </div>
        </div>
      </>
    );
  }

  const results = computeResults(project, designParams, placements, intake.rooms);
  const tab = (searchParams?.tab ?? "bom") as string;

  return (
    <>
      <TopBar breadcrumb={[
        { label: "Workspace" }, { label: "Projects" },
        { label: project.name }, { label: "Results" },
      ]} />
      <div className="flex-1 overflow-hidden">
        <ResultsWorkspace project={project} results={results} initialTab={tab} />
      </div>
    </>
  );
}
