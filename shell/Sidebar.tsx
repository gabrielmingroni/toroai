"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import clsx from "clsx";

type NavItem = { href: string; label: string };

const WORKSPACE: NavItem[] = [
  { href: "/dashboard", label: "Dashboard" },
  { href: "/projects",  label: "Projects" },
];
const ACCOUNT: NavItem[] = [
  { href: "/billing",  label: "Billing" },
  { href: "/settings", label: "Settings" },
];

function activeProjectId(pathname: string): string | null {
  // Match /projects/<id>/... where <id> is anything other than "new"
  const m = pathname.match(/^\/projects\/([^/]+)(?:\/|$)/);
  if (!m) return null;
  if (m[1] === "new") return null;
  return m[1];
}

function activeProjectItems(id: string): NavItem[] {
  return [
    { href: `/projects/${id}`,             label: "Overview" },
    { href: `/projects/${id}/upload`,      label: "Upload" },
    { href: `/projects/${id}/floor-plan`,  label: "Floor Plan Editor" },
    { href: `/projects/${id}/pre-design`,  label: "RCDD Pre-Design" },
    { href: `/projects/${id}/pipeline`,    label: "Pipeline" },
    { href: `/projects/${id}/review`,      label: "RCDD Review" },
    { href: `/projects/${id}/results`,     label: "Results" },
  ];
}

export function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const projectId = activeProjectId(pathname);

  async function signOut() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/auth/login");
    router.refresh();
  }

  return (
    <aside className="w-[220px] bg-chrome border-r border-chrome-dark flex flex-col flex-shrink-0">
      <div className="px-4 py-3 border-b border-chrome-dark">
        <Link href="/projects" className="flex items-baseline gap-0.5">
          <span className="text-[18px] font-semibold tracking-tight">Toro</span>
          <span className="text-[18px] font-semibold tracking-tight text-accent">AI</span>
        </Link>
        <div className="font-mono text-[8.5px] uppercase tracking-[0.15em] text-text4 mt-0.5">
          Phoenix Infrastructure Services
        </div>
      </div>

      <nav className="flex-1 overflow-y-auto py-2">
        <Section title="Workspace">
          {WORKSPACE.map((item) => (
            <SidebarLink key={item.href} item={item} pathname={pathname} />
          ))}
        </Section>

        {projectId ? (
          <Section title={`Active Project · ${projectId}`}>
            {activeProjectItems(projectId).map((item) => (
              <SidebarLink key={item.href} item={item} pathname={pathname} exact={item.href.endsWith(`/${projectId}`)} />
            ))}
          </Section>
        ) : (
          <div className="px-3.5 pt-4 pb-1">
            <div className="font-mono text-[9.5px] text-text4 uppercase tracking-[0.06em] mb-1">Active Project</div>
            <div className="text-[10.5px] text-text4 leading-relaxed">
              Open a project to see its design steps here.
            </div>
          </div>
        )}

        <Section title="Account">
          {ACCOUNT.map((item) => (
            <SidebarLink key={item.href} item={item} pathname={pathname} />
          ))}
        </Section>
      </nav>

      <div className="px-3.5 py-3 border-t border-chrome-dark">
        <button
          onClick={signOut}
          className="w-full text-left text-[11px] text-text3 hover:text-text transition-colors font-mono"
        >
          Sign out →
        </button>
      </div>
    </aside>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="mb-1">
      <div className="px-3.5 pt-3 pb-1 font-mono text-[9.5px] text-text4 uppercase tracking-[0.06em]">{title}</div>
      {children}
    </div>
  );
}

function SidebarLink({ item, pathname, exact = false }: { item: NavItem; pathname: string; exact?: boolean }) {
  const active = exact ? pathname === item.href : pathname === item.href || pathname.startsWith(item.href + "/");
  return (
    <Link
      href={item.href}
      className={clsx(
        "flex items-center gap-2 px-3.5 py-1.5 cursor-pointer transition-colors text-[12px] font-medium",
        active
          ? "bg-accent/10 text-accent border-r-2 border-accent"
          : "text-text2 hover:bg-chrome-light hover:text-text"
      )}
    >
      {item.label}
    </Link>
  );
}
