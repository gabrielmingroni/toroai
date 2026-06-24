import { notFound } from "next/navigation";
import Link from "next/link";
import { getCurrentUser } from "@/lib/auth/session";
import { projectStore } from "@/lib/projects/mock-store";
import { TopBar } from "@/components/shell/TopBar";
import { PdfExtractPanel } from "@/components/intake/PdfExtractPanel";

export default function IntakeExtractPage({ params }: { params: { id: string } }) {
  const user = getCurrentUser()!;
  const project = projectStore.get(params.id, user.id);
  if (!project) notFound();

  return (
    <>
      <TopBar breadcrumb={[
        { label: "Workspace" },
        { label: "Projects" },
        { label: project.name },
        { label: "PDF Text Extraction" },
      ]} />
      <div className="flex-1 overflow-y-auto">
        <div className="p-6 max-w-[900px]">
          <header className="mb-5 flex items-start justify-between gap-4">
            <div>
              <h1 className="text-[20px] font-semibold mb-1">PDF text extraction</h1>
              <p className="text-[11.5px] text-text3 font-mono">
                pdfjs-dist · text extraction · 50 MB upload · OCR fallback for scanned PDFs
              </p>
            </div>
            <Link href={`/projects/${project.id}`} className="btn btn-ghost text-[11.5px]">← Project</Link>
          </header>
          <PdfExtractPanel projectId={project.id} />
        </div>
      </div>
    </>
  );
}
