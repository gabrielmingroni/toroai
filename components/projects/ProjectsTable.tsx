"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import clsx from "clsx";
import {
  Project, ProjectStatus, ProjectType, Sector,
  STATUS_LABEL, TYPE_LABEL, SECTOR_LABEL,
} from "@/lib/projects/types";

type StatusFilter = ProjectStatus | "all";
type TypeFilter = ProjectType | "all";

const STATUS_TONE: Record<ProjectStatus, "pass" | "warn" | "info" | "fail" | "neutral"> = {
  draft:           "neutral",
  intake:          "info",
  in_progress:     "info",
  pending_review:  "warn",
  ready_to_stamp:  "warn",
  complete:        "pass",
  archived:        "neutral",
};

const TONE_CLASS = {
  pass:    "text-pass bg-pass/10",
  warn:    "text-warn bg-warn/10",
  info:    "text-info bg-info/10",
  fail:    "text-fail bg-fail/10",
  neutral: "text-text3 bg-chrome-dark",
} as const;

function formatUpdated(iso: string): string {
  const d = new Date(iso);
  const now = new Date();
  const diffMs = now.getTime() - d.getTime();
  const diffH = diffMs / (1000 * 60 * 60);
  if (diffH < 1) return Math.max(1, Math.floor(diffMs / (1000 * 60))) + " min ago";
  if (diffH < 24) return Math.floor(diffH) + " h ago";
  const diffD = Math.floor(diffH / 24);
  if (diffD < 30) return diffD + " d ago";
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

function formatMoney(cents: number): string {
  if (cents === 0) return "—";
  return "$" + Math.round(cents / 100).toLocaleString();
}

export function ProjectsTable({ projects }: { projects: Project[] }) {
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [typeFilter, setTypeFilter] = useState<TypeFilter>("all");

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return projects.filter(p => {
      if (statusFilter !== "all" && p.status !== statusFilter) return false;
      if (typeFilter !== "all" && p.type !== typeFilter) return false;
      if (!q) return true;
      return (
        p.name.toLowerCase().includes(q) ||
        p.number.toLowerCase().includes(q) ||
        p.city.toLowerCase().includes(q) ||
        p.owner.toLowerCase().includes(q)
      );
    });
  }, [projects, query, statusFilter, typeFilter]);

  return (
    <>
      {/* Filters */}
      <div className="flex flex-wrap items-center gap-2 mb-3">
        <div className="relative flex-1 min-w-[240px] max-w-[360px]">
          <input
            className="input"
            placeholder="Search by name, number, city, owner…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </div>

        <select
          className="input w-auto text-[12px]"
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value as StatusFilter)}
        >
          <option value="all">All statuses</option>
          {(Object.keys(STATUS_LABEL) as ProjectStatus[]).map(s => (
            <option key={s} value={s}>{STATUS_LABEL[s]}</option>
          ))}
        </select>

        <select
          className="input w-auto text-[12px]"
          value={typeFilter}
          onChange={(e) => setTypeFilter(e.target.value as TypeFilter)}
        >
          <option value="all">All types</option>
          {(Object.keys(TYPE_LABEL) as ProjectType[]).map(t => (
            <option key={t} value={t}>{TYPE_LABEL[t]}</option>
          ))}
        </select>

        {(query || statusFilter !== "all" || typeFilter !== "all") && (
          <button
            className="btn btn-ghost text-[11.5px]"
            onClick={() => { setQuery(""); setStatusFilter("all"); setTypeFilter("all"); }}
          >
            Clear filters
          </button>
        )}

        <div className="ml-auto text-[11px] text-text3 font-mono">
          {filtered.length} of {projects.length}
        </div>
      </div>

      {/* Table */}
      <div className="card overflow-hidden">
        <table className="w-full">
          <thead>
            <tr className="border-b border-chrome-dark">
              <Th>Project</Th>
              <Th>Status</Th>
              <Th>Type</Th>
              <Th>Sector</Th>
              <Th className="text-right">SF</Th>
              <Th className="text-right">Floors</Th>
              <Th className="text-right">BOM</Th>
              <Th className="text-right">Updated</Th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr><td colSpan={8} className="px-4 py-10 text-center text-text3 text-[12px]">No projects match your filters.</td></tr>
            ) : filtered.map((p, i) => (
              <tr
                key={p.id}
                className={clsx(
                  "transition-colors hover:bg-chrome-light",
                  i < filtered.length - 1 && "border-b border-chrome-dark"
                )}
              >
                <td className="px-4 py-3">
                  <Link href={`/projects/${p.id}`} className="block">
                    <div className="text-[13px] text-text font-medium hover:text-accent transition-colors">{p.name}</div>
                    <div className="text-[10.5px] text-text3 font-mono mt-0.5">{p.number} · {p.city}, {p.state}</div>
                  </Link>
                </td>
                <td className="px-4 py-3 align-middle">
                  <span className={clsx(
                    "inline-flex items-center px-2 py-0.5 text-[10.5px] font-medium rounded-[2px] font-mono uppercase tracking-[0.04em]",
                    TONE_CLASS[STATUS_TONE[p.status]]
                  )}>
                    {STATUS_LABEL[p.status]}
                  </span>
                </td>
                <td className="px-4 py-3 align-middle text-[11.5px] text-text2 font-mono">{TYPE_LABEL[p.type]}</td>
                <td className="px-4 py-3 align-middle text-[11.5px] text-text2">{SECTOR_LABEL[p.sector]}</td>
                <td className="px-4 py-3 align-middle text-right text-[11.5px] text-text2 font-mono tabular-nums">{p.totalSf.toLocaleString()}</td>
                <td className="px-4 py-3 align-middle text-right text-[11.5px] text-text2 font-mono tabular-nums">{p.floors}</td>
                <td className="px-4 py-3 align-middle text-right text-[11.5px] text-text2 font-mono tabular-nums">{formatMoney(p.bomTotalCents)}</td>
                <td className="px-4 py-3 align-middle text-right text-[11px] text-text3 font-mono">{formatUpdated(p.updatedAt)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}

function Th({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <th className={clsx("px-4 py-2.5 text-left font-mono text-[10px] uppercase tracking-[0.06em] text-text3 font-medium", className)}>
      {children}
    </th>
  );
}
