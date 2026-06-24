import { TopBar } from "@/components/shell/TopBar";
import { NewProjectForm } from "@/components/projects/NewProjectForm";

export default function NewProjectPage() {
  return (
    <>
      <TopBar breadcrumb={[{ label: "Workspace" }, { label: "Projects" }, { label: "New Project" }]} />
      <div className="flex-1 overflow-y-auto">
        <div className="px-6 py-5 max-w-[860px]">
          <header className="mb-5">
            <h1 className="text-[20px] font-semibold mb-0.5">New Project</h1>
            <p className="text-text3 text-[11.5px] font-mono">
              Capture the building basics. Upload the architectural backgrounds in the next step.
            </p>
          </header>
          <NewProjectForm />
        </div>
      </div>
    </>
  );
}
