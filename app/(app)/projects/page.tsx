import Link from "next/link";
import { getCurrentUser } from "@/lib/auth/session";
import { projectStore } from "@/lib/projects/mock-store";
import { TopBar } from "@/components/shell/TopBar";
import { ProjectsTable } from "@/components/projects/ProjectsTable";

export default function ProjectsPage() {
  const user = getCurrentUser()!;
  const projects = projectStore.list(user.id);

  return (
    <>
      <TopBar breadcrumb={[{ label: "Workspace" }, { label: "Projects" }]} />
      <div className="flex-1 overflow-y-auto">
        <div className="px-6 py-5">
          <header className="flex items-center justify-between mb-5">
            <div>
              <h1 className="text-[20px] font-semibold mb-0.5">Projects</h1>
              <p className="text-text3 text-[11.5px] font-mono">
                {projects.length} project{projects.length !== 1 ? "s" : ""} · {user.firmName ?? "Personal"}
              </p>
            </div>
            <Link href="/projects/new" className="btn btn-primary text-[12px] px-3 py-2">
              + New Project
            </Link>
          </header>

          {projects.length === 0 ? (
            <EmptyState />
          ) : (
            <ProjectsTable projects={projects} />
          )}
        </div>
      </div>
    </>
  );
}

function EmptyState() {
  return (
    <div className="card max-w-[640px]">
      <div className="px-8 py-12 text-center">
        <div className="text-[13px] text-text2 mb-2">No projects yet.</div>
        <p className="text-[11.5px] text-text3 leading-relaxed mb-6 max-w-[420px] mx-auto">
          Start a new ICT design by creating a project. You'll capture the building basics first,
          then upload the architectural backgrounds for ingestion.
        </p>
        <Link href="/projects/new" className="btn btn-primary text-[12px] px-4 py-2 inline-flex">
          Create your first project
        </Link>
      </div>
    </div>
  );
}
