"use client";

// /standards — browseable BICSI / TIA / NEC / UFC compliance corpus. The
// 20-rule library an RCDD references daily, with filter + search.

import { useMemo, useState } from "react";
import Link from "next/link";
import { TopBar } from "@/components/shell/TopBar";
import { RULES } from "@/lib/standards/rules";
import { STANDARD_LABEL, type StandardFamily, type RuleCategory } from "@/lib/standards/types";

const CATEGORY_LABEL: Record<RuleCategory, string> = {
  horizontal_cabling:     "Horizontal cabling",
  backbone_cabling:       "Backbone cabling",
  pathways_spaces:        "Pathways & spaces",
  osp:                    "Outside plant",
  grounding_bonding:      "Grounding & bonding",
  fire_safety_jacketing:  "Fire safety / jacketing",
  tr_design:              "TR design",
  outlet_density:         "Outlet density",
  dod_specific:           "DoD-specific",
};

const STANDARDS_IN_CORPUS = Array.from(new Set(RULES.map(r => r.standard))) as StandardFamily[];

export default function StandardsPage() {
  const [stdFilter, setStdFilter] = useState<StandardFamily | "all">("all");
  const [query, setQuery] = useState("");

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return RULES.filter(r => {
      if (stdFilter !== "all" && r.standard !== stdFilter) return false;
      if (!q) return true;
      return (
        r.title.toLowerCase().includes(q) ||
        r.code.toLowerCase().includes(q) ||
        r.description.toLowerCase().includes(q) ||
        r.citation.toLowerCase().includes(q)
      );
    });
  }, [stdFilter, query]);

  const countsByStd = useMemo(() => {
    const m: Partial<Record<StandardFamily, number>> = {};
    for (const r of RULES) m[r.standard] = (m[r.standard] ?? 0) + 1;
    return m;
  }, []);

  return (
    <>
      <TopBar breadcrumb={[{ label: "Workspace" }, { label: "Libraries" }, { label: "Standards Corpus" }]} />
      <div className="flex-1 overflow-y-auto">
        <div className="max-w-[1280px] mx-auto px-6 py-5">

          {/* Header */}
          <header className="flex items-end justify-between gap-4 mb-4 flex-wrap">
            <div>
              <div className="text-[11px] text-text3 font-mono uppercase tracking-[0.06em]">Library · Reference</div>
              <h1 className="text-[20px] font-semibold leading-tight text-text mt-0.5">Standards Corpus</h1>
              <div className="text-[11.5px] text-text3 mt-0.5">
                {RULES.length} compliance rules across BICSI, TIA, NEC, and UFC.
              </div>
            </div>
            <Link href="/dashboard" className="text-[11px] text-text3 hover:text-accent font-mono">
              ← Workspace
            </Link>
          </header>

          {/* Filters */}
          <div className="card mb-4">
            <div className="card-body flex items-center gap-3 flex-wrap py-3">
              <div className="flex items-center gap-1 flex-wrap">
                <FilterPill active={stdFilter === "all"} onClick={() => setStdFilter("all")}
                            label={`All (${RULES.length})`} />
                {STANDARDS_IN_CORPUS.map(s => (
                  <FilterPill key={s} active={stdFilter === s} onClick={() => setStdFilter(s)}
                              label={`${STANDARD_LABEL[s]} · ${countsByStd[s] ?? 0}`} />
                ))}
              </div>
              <div className="ml-auto">
                <input
                  type="search" value={query} onChange={e => setQuery(e.target.value)}
                  placeholder="Search rule, code, or citation"
                  className="input text-[11.5px] py-1.5 px-2 w-[280px]"
                />
              </div>
            </div>
          </div>

          {/* Rule list */}
          <section className="card">
            <div className="card-header">
              <div className="card-title">{filtered.length} rule{filtered.length === 1 ? "" : "s"}</div>
              <span className="text-[10px] text-text4 font-mono">
                Each predicate is deterministic over project state · see <code>lib/standards/rules.ts</code>
              </span>
            </div>
            {filtered.length === 0 ? (
              <div className="px-4 py-8 text-center text-[12px] text-text3">
                No rules match the current filter.
              </div>
            ) : (
              <ul className="divide-y divide-chrome-dark">
                {filtered.map(rule => (
                  <li key={rule.code} className="px-4 py-3 hover:bg-chrome-dark/30">
                    <div className="flex items-baseline justify-between gap-3 flex-wrap">
                      <div className="flex items-baseline gap-3 min-w-0 flex-1">
                        <code className="text-[10.5px] text-text4 font-mono whitespace-nowrap">{rule.code}</code>
                        <div className="text-[12.5px] text-text font-medium">{rule.title}</div>
                      </div>
                      <SeverityChip severity={rule.failSeverity} />
                    </div>
                    <div className="text-[11px] text-text3 mt-1 ml-[140px]">
                      {rule.description}
                    </div>
                    <div className="text-[10px] text-text4 font-mono mt-1.5 ml-[140px] flex items-center gap-3 flex-wrap">
                      <span className="text-text3">{rule.citation}</span>
                      <span>·</span>
                      <span>{CATEGORY_LABEL[rule.category]}</span>
                      <span>·</span>
                      <span>{STANDARD_LABEL[rule.standard]}</span>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </section>

        </div>
      </div>
    </>
  );
}

function FilterPill({ active, onClick, label }: { active: boolean; onClick: () => void; label: string }) {
  return (
    <button type="button" onClick={onClick}
            className={
              "text-[10.5px] font-mono px-2.5 py-1 rounded-[2px] border transition-colors " +
              (active
                ? "bg-accent text-chrome-darkest border-accent"
                : "border-chrome-dark text-text3 hover:bg-chrome-dark hover:text-text")
            }>
      {label}
    </button>
  );
}

function SeverityChip({ severity }: { severity: "advisory" | "fail" }) {
  const cls = severity === "fail"
    ? "border-fail/40 bg-fail/10 text-fail"
    : "border-warn/40 bg-warn/10 text-warn";
  return (
    <span className={"text-[9.5px] uppercase tracking-[0.06em] font-mono px-1.5 py-0.5 rounded-[2px] border " + cls}>
      {severity === "fail" ? "Hard fail" : "Advisory"}
    </span>
  );
}
