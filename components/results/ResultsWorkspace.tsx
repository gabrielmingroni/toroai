"use client";

import { useState } from "react";
import clsx from "clsx";
import Link from "next/link";
import type { Project } from "@/lib/projects/types";
import type { ResultsBundle } from "@/lib/results/types";
import { BomTab }        from "./BomTab";
import { ComplianceTab } from "./ComplianceTab";
import { PermitsTab }    from "./PermitsTab";
import { ScheduleTab }   from "./ScheduleTab";
import { LossTab }       from "./LossTab";
import { RoomsTab }      from "./RoomsTab";

type TabId = "bom" | "compliance" | "permits" | "schedule" | "loss" | "rooms" | "drawing";

const TABS: { id: TabId; label: string; hint: string }[] = [
  { id: "bom",        label: "BOM",         hint: "Bill of Materials" },
  { id: "compliance", label: "Compliance",  hint: "20-rule check" },
  { id: "permits",    label: "Permits",     hint: "AHJ + forms" },
  { id: "schedule",   label: "Schedule",    hint: "Div 27 / NECA MLU" },
  { id: "loss",       label: "Loss Budget", hint: "Fiber backbone" },
  { id: "rooms",      label: "Rooms",       hint: "Room schedule" },
  { id: "drawing",    label: "Drawing",     hint: "Floor plan" },
];

export function ResultsWorkspace({ project, results, initialTab }: { project: Project; results: ResultsBundle; initialTab: string }) {
  const [active, setActive] = useState<TabId>((TABS.find(t => t.id === initialTab)?.id) ?? "bom");

  const pass = results.compliance.pass;
  const advisory = results.compliance.advisory;
  const fail = results.compliance.fail;
  const total = results.compliance.total;
  const grand = results.bom.grandTotalCents / 100;

  return (
    <div className="h-full flex flex-col">
      {/* Header summary */}
      <header className="bg-chrome-dark border-b border-divider px-6 py-3">
        <div className="flex items-start justify-between gap-6">
          <div>
            <h1 className="text-[16px] font-semibold">{project.name}</h1>
            <div className="text-[10.5px] text-text3 font-mono mt-0.5">
              {project.number} · Rev A · Computed {new Date(results.computedAt).toLocaleString()}
            </div>
          </div>
          <div className="flex items-center gap-5 text-right">
            <Stat label="Compliance" value={`${pass} / ${total}`} sub={`${advisory} advisory · ${fail} fail`} tone={fail > 0 ? "fail" : advisory > 0 ? "warn" : "pass"} />
            <Stat label="BOM"     value={"$" + Math.round(grand).toLocaleString()} sub="incl. NECA MLU labor" tone="accent" />
            <Stat label="Drawing" value={`${results.rooms.items.length}`} sub="rooms confirmed" tone="neutral" />
          </div>
        </div>
      </header>

      {/* Tabs */}
      <div className="bg-chrome border-b border-chrome-dark px-4 flex items-center overflow-x-auto">
        {TABS.map(t => (
          <button
            key={t.id}
            onClick={() => setActive(t.id)}
            className={clsx(
              "px-3.5 py-2.5 text-[11.5px] font-medium border-b-2 transition-colors -mb-px flex-shrink-0 flex items-baseline gap-1.5",
              active === t.id
                ? "border-accent text-accent"
                : "border-transparent text-text3 hover:text-text",
            )}
          >
            <span>{t.label}</span>
            <span className={clsx("text-[9.5px] font-mono", active === t.id ? "text-accent/70" : "text-text4")}>{t.hint}</span>
          </button>
        ))}
      </div>

      {/* Tab content */}
      <div className="flex-1 min-h-0 overflow-y-auto bg-chrome">
        {active === "bom"        && <BomTab        bom={results.bom}        />}
        {active === "compliance" && <ComplianceTab compliance={results.compliance} project={project} />}
        {active === "permits"    && <PermitsTab    permits={results.permits} />}
        {active === "schedule"   && <ScheduleTab   schedule={results.schedule} />}
        {active === "loss"       && <LossTab       loss={results.loss}     />}
        {active === "rooms"      && <RoomsTab      rooms={results.rooms}   />}
        {active === "drawing"    && <DrawingPreview project={project} />}
      </div>
    </div>
  );
}

function Stat({ label, value, sub, tone }: { label: string; value: string; sub?: string; tone: "pass" | "warn" | "fail" | "accent" | "neutral" }) {
  const cls = tone === "pass"   ? "text-pass"
            : tone === "warn"   ? "text-warn"
            : tone === "fail"   ? "text-fail"
            : tone === "accent" ? "text-accent"
            : "text-text";
  return (
    <div>
      <div className="text-[9.5px] uppercase tracking-[0.06em] text-text4 font-mono">{label}</div>
      <div className={clsx("text-[18px] font-semibold tabular-nums leading-tight", cls)}>{value}</div>
      {sub && <div className="text-[10px] text-text4 font-mono mt-0.5">{sub}</div>}
    </div>
  );
}

function DrawingPreview({ project }: { project: Project }) {
  return (
    <div className="p-8 text-center">
      <div className="max-w-[420px] mx-auto">
        <div className="text-[13px] text-text2 mb-2">The Drawing tab opens the live Floor Plan canvas.</div>
        <p className="text-[11.5px] text-text3 leading-relaxed mb-5">
          Use the Floor Plan view for placement and editing. The Results Drawing tab will eventually
          host a read-only stamped sheet preview with title block, north arrow, and revision cloud.
        </p>
        <Link href={`/projects/${project.id}/floor-plan`} className="btn btn-primary inline-flex">
          Open Floor Plan →
        </Link>
      </div>
    </div>
  );
}
