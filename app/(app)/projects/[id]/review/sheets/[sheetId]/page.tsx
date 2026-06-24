import { notFound } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/session";
import { projectStore } from "@/lib/projects/mock-store";
import { markupStore, CURRENT_AUTHOR } from "@/lib/markup/mock-store";
import { TopBar } from "@/components/shell/TopBar";
import { MarkupViewer } from "@/components/markup/MarkupViewer";

export default function SheetMarkupPage({
  params,
}: { params: { id: string; sheetId: string } }) {
  const user = getCurrentUser()!;
  const project = projectStore.get(params.id, user.id);
  if (!project) notFound();

  const sheet = markupStore.getSheet(project.id, params.sheetId);
  if (!sheet) notFound();

  const allSheets = markupStore.listSheets(project.id);
  const allCounts = markupStore.countsBySheet(project.id);
  const markups   = markupStore.listMarkups(project.id, sheet.id);

  return (
    <>
      <TopBar breadcrumb={[
        { label: "Workspace" },
        { label: "Projects" },
        { label: project.name },
        { label: "RCDD Review" },
        { label: `Sheet ${sheet.number}` },
      ]} />
      <div className="flex-1 overflow-hidden">
        <MarkupViewer
          project={project}
          sheet={sheet}
          allSheets={allSheets}
          allCounts={allCounts}
          initialMarkups={markups}
          currentAuthor={CURRENT_AUTHOR}
        />
      </div>
    </>
  );
}
