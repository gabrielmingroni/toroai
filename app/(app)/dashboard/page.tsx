import Link from "next/link";
import { TopBar } from "@/components/shell/TopBar";
import { getCurrentUser } from "@/lib/auth/session";
import { projectStore } from "@/lib/projects/mock-store";
import {
  STATUS_LABEL,
  TYPE_LABEL,
  SECTOR_LABEL,
  type Project,
  type ProjectStatus,
} from "@/lib/projects/types";

// Workspace home — the project browser an RCDD lands on after sign-in.
// Modeled on Revit's start page / Bluebeam Studio / iBwave project list.
// File-browser-first: recent projects, quick actions, review queue, libraries.

export default function DashboardPage() {
  const user = getCurrentUser()!;
  const projects = projectStore.list(user.id);

  // Group by what the RCDD actually cares about on open: things waiting on them,
  // things actively being worked, and everything else.
  const needsReview = projects.filter(p => p.status === "pending_review");
  const readyToStamp = projects.filter(p => p.status === "ready_to_stamp");
  const inFlight = projects.filter(p => p.status === "in_progress" || p.status === "intake");
  const drafts = projects.filter(p => p.status === "draft");

  const recent = [...projects]
    .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())
    .slice(0, 12);

  return (
    <>
      <TopBar breadcrumb={[{ label: "Workspace" }, { label: "Home" }]} />
      <div className="flex-1 overflow-y-auto">
        <div className="max-w-[1280px] mx-auto px-6 py-5">

          {/* ── Greeting + quick actions ──────────────────────────── */}
          <header className="flex items-end justify-between gap-6 mb-5 flex-wrap">
            <div>
              <div className="text-[11px] text-text3 font-mono uppercase tracking-[0.06em]">
                {user.firstName} {user.lastName}
                {user.rcddNumber && ` · RCDD #${user.rcddNumber}`}
              </div>
              <h1 className="text-[20px] font-semibold leading-tight text-text mt-0.5">
                {greeting()}{user.firstName ? `, ${user.firstName}` : ""}.
              </h1>
              <div className="text-[11.5px] text-text3 mt-0.5">
                {projects.length} project{projects.length === 1 ? "" : "s"} in your workspace
                {needsReview.length > 0 && (
                  <> · <span className="text-warn">{needsReview.length} awaiting review</span></>
                )}
                {readyToStamp.length > 0 && (
                  <> · <span className="text-accent">{readyToStamp.length} ready to stamp</span></>
                )}
              </div>
            </div>

            <div className="flex items-center gap-2 flex-wrap">
              <Link href="/projects/new"
                    className="btn btn-primary text-[12px] px-4 py-2 inline-flex items-center gap-2">
                <i className="ti ti-plus" style={{ fontSize: 13 }} aria-hidden="true" />
                New project
              </Link>
              <Link href="/projects"
                    className="btn btn-ghost text-[12px] px-3 py-2 inline-flex items-center gap-2">
                <i className="ti ti-folder" style={{ fontSize: 13 }} aria-hidden="true" />
                Open project
              </Link>
              {recent[0] && (
                <Link href={`/projects/${recent[0].id}`}
                      className="btn btn-ghost text-[12px] px-3 py-2 inline-flex items-center gap-2">
                  <i className="ti ti-history" style={{ fontSize: 13 }} aria-hidden="true" />
                  Resume <span className="text-text3 ml-1 truncate max-w-[160px]">{recent[0].number}</span>
                </Link>
              )}
            </div>
          </header>

          {/* ── Two-column workspace ──────────────────────────────── */}
          <div className="grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-5">

            {/* ─── Left: project browser ──────────────────────────── */}
            <section className="card">
              <div className="card-header">
                <div className="card-title">Recent projects</div>
                <Link href="/projects" className="text-[10.5px] text-accent hover:underline font-mono">
                  All projects →
                </Link>
              </div>
              {recent.length === 0 ? (
                <div className="px-4 py-10 text-center">
                  <i className="ti ti-folder-open block text-text4 mx-auto mb-2" style={{ fontSize: 28 }} aria-hidden="true" />
                  <div className="text-[12px] text-text3 mb-1">No projects yet.</div>
                  <div className="text-[11px] text-text4">
                    <Link href="/projects/new" className="text-accent hover:underline">Create your first project →</Link>
                  </div>
                </div>
              ) : (
                <table className="w-full text-[11.5px] table-fixed">
                  <thead>
                    <tr className="text-left text-[9.5px] uppercase tracking-[0.06em] text-text4 font-mono border-b border-chrome-dark">
                      <th className="px-3 py-2 font-medium w-[44%]">Project</th>
                      <th className="px-3 py-2 font-medium w-[16%]">Status</th>
                      <th className="px-3 py-2 font-medium w-[12%] text-right tabular-nums">Rooms</th>
                      <th className="px-3 py-2 font-medium w-[14%] text-right tabular-nums">BOM</th>
                      <th className="px-3 py-2 font-medium w-[14%] text-right tabular-nums">Updated</th>
                    </tr>
                  </thead>
                  <tbody>
                    {recent.map(p => <ProjectRow key={p.id} project={p} />)}
                  </tbody>
                </table>
              )}
            </section>

            {/* ─── Right: review queue + libraries ─────────────────── */}
            <aside className="flex flex-col gap-5">

              {/* Awaiting review */}
              <section className="card">
                <div className="card-header">
                  <div className="card-title flex items-center gap-2">
                    <span className={"w-1.5 h-1.5 rounded-full " + (needsReview.length > 0 ? "bg-warn" : "bg-text4")} />
                    Awaiting review
                  </div>
                  <span className="text-[10px] text-text4 font-mono">{needsReview.length}</span>
                </div>
                {needsReview.length === 0 ? (
                  <div className="px-4 py-4 text-[11px] text-text3">
                    Nothing waiting on you. Generated outputs land here once a project enters the RCDD gate.
                  </div>
                ) : (
                  <ul className="divide-y divide-chrome-dark">
                    {needsReview.slice(0, 5).map(p => <QueueRow key={p.id} project={p} />)}
                  </ul>
                )}
              </section>

              {/* In flight */}
              <section className="card">
                <div className="card-header">
                  <div className="card-title">In progress</div>
                  <span className="text-[10px] text-text4 font-mono">{inFlight.length}</span>
                </div>
                {inFlight.length === 0 ? (
                  <div className="px-4 py-4 text-[11px] text-text3">
                    No active design work. Start a project or open a draft.
                  </div>
                ) : (
                  <ul className="divide-y divide-chrome-dark">
                    {inFlight.slice(0, 5).map(p => <QueueRow key={p.id} project={p} />)}
                  </ul>
                )}
              </section>

              {/* Drafts */}
              {drafts.length > 0 && (
                <section className="card">
                  <div className="card-header">
                    <div className="card-title">Drafts</div>
                    <span className="text-[10px] text-text4 font-mono">{drafts.length}</span>
                  </div>
                  <ul className="divide-y divide-chrome-dark">
                    {drafts.slice(0, 4).map(p => <QueueRow key={p.id} project={p} />)}
                  </ul>
                </section>
              )}

              {/* Reference libraries */}
              <section className="card">
                <div className="card-header">
                  <div className="card-title">Libraries</div>
                </div>
                <ul className="divide-y divide-chrome-dark text-[11.5px]">
                  <LibraryRow
                    href="/standards"
                    icon="book-2"
                    label="Standards corpus"
                    sub="BICSI TDMM · TIA-568/569/758/607 · NEC 770/800 · UFC" />
                  <LibraryRow
                    href="/catalog"
                    icon="package"
                    label="Manufacturer catalog"
                    sub="Belden · Panduit · Leviton · CPI · Crouse-Hinds" />
                  <LibraryRow
                    href="/spec-templates"
                    icon="file-text"
                    label="CSI 27 spec templates"
                    sub="Section text · 3-part articles · firm boilerplate" />
                </ul>
              </section>

            </aside>
          </div>

        </div>
      </div>
    </>
  );
}

// ── Sub-components ────────────────────────────────────────────────────────

function ProjectRow({ project }: { project: Project }) {
  return (
    <tr className="border-b border-chrome-dark/60 hover:bg-chrome-dark/40 transition-colors">
      <td className="px-3 py-2 truncate">
        <Link href={`/projects/${project.id}`} className="text-text hover:text-accent transition-colors">
          <div className="truncate font-medium">{project.name}</div>
          <div className="text-[10px] text-text4 font-mono mt-0.5 truncate">
            {project.number} · {TYPE_LABEL[project.type]} · {project.city}, {project.state} · {SECTOR_LABEL[project.sector]}
          </div>
        </Link>
      </td>
      <td className="px-3 py-2">
        <StatusPill status={project.status} />
      </td>
      <td className="px-3 py-2 text-right tabular-nums text-text2">
        {project.roomsConfirmed}
        <span className="text-text4 font-mono text-[10px]"> / {project.outlets}o</span>
      </td>
      <td className="px-3 py-2 text-right tabular-nums text-text2">
        {project.bomTotalCents > 0 ? formatCents(project.bomTotalCents) : <span className="text-text4">—</span>}
      </td>
      <td className="px-3 py-2 text-right tabular-nums text-text3 font-mono text-[10.5px]">
        {formatRelative(project.updatedAt)}
      </td>
    </tr>
  );
}

function QueueRow({ project }: { project: Project }) {
  return (
    <li>
      <Link href={`/projects/${project.id}`}
            className="block px-4 py-2 hover:bg-chrome-dark transition-colors">
        <div className="text-[11.5px] text-text font-medium truncate">{project.name}</div>
        <div className="text-[10px] text-text4 font-mono mt-0.5 flex items-center gap-2">
          <span className="truncate">{project.number}</span>
          <span>·</span>
          <span>{formatRelative(project.updatedAt)}</span>
        </div>
      </Link>
    </li>
  );
}

function LibraryRow({ href, icon, label, sub }: { href: string; icon: string; label: string; sub: string }) {
  return (
    <li>
      <Link href={href} className="flex items-center gap-3 px-4 py-2 hover:bg-chrome-dark transition-colors">
        <i className={"ti ti-" + icon + " text-text3"} style={{ fontSize: 14 }} aria-hidden="true" />
        <div className="flex-1 min-w-0">
          <div className="text-[11.5px] text-text">{label}</div>
          <div className="text-[10px] text-text4 truncate">{sub}</div>
        </div>
        <i className="ti ti-chevron-right text-text4" style={{ fontSize: 12 }} aria-hidden="true" />
      </Link>
    </li>
  );
}

function StatusPill({ status }: { status: ProjectStatus }) {
  const tone =
    status === "complete"       ? "border-pass/40 bg-pass/10 text-pass"
    : status === "ready_to_stamp" ? "border-accent/40 bg-accent/10 text-accent"
    : status === "pending_review" ? "border-warn/40 bg-warn/10 text-warn"
    : status === "in_progress"  ? "border-info/40 bg-info/10 text-info"
    : status === "intake"       ? "border-info/40 bg-info/10 text-info"
    : status === "archived"     ? "border-chrome-dark bg-chrome-darkest text-text4"
    : "border-chrome-dark bg-chrome-darkest text-text3";
  return (
    <span className={"inline-block border rounded-[2px] px-1.5 py-[1px] text-[9.5px] uppercase tracking-[0.06em] font-mono " + tone}>
      {STATUS_LABEL[status]}
    </span>
  );
}

// ── Formatters ────────────────────────────────────────────────────────────

function greeting(): string {
  const h = new Date().getHours();
  if (h < 5)  return "Late night";
  if (h < 12) return "Good morning";
  if (h < 17) return "Good afternoon";
  if (h < 21) return "Good evening";
  return "Good evening";
}

function formatCents(cents: number): string {
  const dollars = cents / 100;
  if (dollars >= 1_000_000) return `$${(dollars / 1_000_000).toFixed(2)}M`;
  if (dollars >= 1_000)     return `$${(dollars / 1_000).toFixed(1)}k`;
  return `$${dollars.toFixed(0)}`;
}

function formatRelative(iso: string): string {
  const then = new Date(iso).getTime();
  const now = Date.now();
  const diffMs = now - then;
  const min = Math.floor(diffMs / 60_000);
  if (min < 1)      return "just now";
  if (min < 60)     return `${min}m ago`;
  const hr = Math.floor(min / 60);
  if (hr < 24)      return `${hr}h ago`;
  const days = Math.floor(hr / 24);
  if (days < 7)     return `${days}d ago`;
  const weeks = Math.floor(days / 7);
  if (weeks < 5)    return `${weeks}w ago`;
  // Older — drop the year for current-year items.
  const d = new Date(iso);
  const sameYear = d.getFullYear() === new Date().getFullYear();
  return d.toLocaleDateString(undefined, sameYear
    ? { month: "short", day: "numeric" }
    : { year: "numeric", month: "short", day: "numeric" });
}
