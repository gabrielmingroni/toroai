"use client";

import Link from "next/link";
import clsx from "clsx";
import type { ComplianceResult, ComplianceRule } from "@/lib/results/types";
import type { Project } from "@/lib/projects/types";

const STATUS_CLASS = {
  pass:     { row: "border-l-pass",    icon: "bg-pass/15 text-pass",     text: "text-pass" },
  advisory: { row: "border-l-warn",    icon: "bg-warn/15 text-warn",     text: "text-warn" },
  fail:     { row: "border-l-fail",    icon: "bg-fail/15 text-fail",     text: "text-fail" },
} as const;

export function ComplianceTab({ compliance, project }: { compliance: ComplianceResult; project: Project }) {
  const { total, pass, advisory, fail, rules } = compliance;
  const scoreColor = fail > 0 ? "text-fail" : advisory > 0 ? "text-warn" : "text-pass";

  return (
    <div className="p-6 max-w-[1100px]">
      {/* Header */}
      <div className="flex items-center gap-6 mb-5">
        <div className={clsx("text-[44px] font-semibold tabular-nums", scoreColor)}>{pass}<span className="text-text4 text-[26px]"> / {total}</span></div>
        <div>
          <h2 className="text-[15px] font-semibold">Compliance Report</h2>
          <div className="text-[10.5px] text-text3 font-mono mt-0.5">
            <span className="text-pass">{pass} pass</span>{" · "}
            <span className={advisory ? "text-warn" : "text-text4"}>{advisory} advisory</span>{" · "}
            <span className={fail ? "text-fail" : "text-text4"}>{fail} fail</span>
          </div>
          <div className="text-[10px] text-text4 font-mono mt-0.5">
            Generated {new Date(compliance.generatedAt).toLocaleString()}
          </div>
        </div>
      </div>

      {/* Filter & summary */}
      <div className="mb-3 flex items-center gap-2 text-[10.5px] font-mono">
        <span className="text-text4 uppercase tracking-[0.06em]">Checks · BICSI TDMM 15 · TIA-568/569/607 · NEC 800</span>
      </div>

      <div className="space-y-1.5">
        {rules.map(r => <RuleRow key={r.code} rule={r} projectId={project.id} />)}
      </div>
    </div>
  );
}

function RuleRow({ rule, projectId }: { rule: ComplianceRule; projectId: string }) {
  const s = STATUS_CLASS[rule.status];
  return (
    <div className={clsx("card border-l-2 flex items-start gap-3 p-3", s.row)}>
      <div className={clsx("w-6 h-6 rounded-full flex items-center justify-center text-[12px] flex-shrink-0", s.icon)}>
        {rule.status === "pass" ? "✓" : rule.status === "advisory" ? "!" : "✕"}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-baseline gap-2">
          <span className="text-[12px] text-text font-medium">{rule.code}</span>
          <span className="text-[10.5px] text-text4 font-mono">{rule.citation}</span>
        </div>
        <div className="text-[11.5px] text-text3 mt-0.5">{rule.description}</div>
        {rule.message && (
          <div className={clsx("text-[11px] mt-1.5 font-mono", s.text)}>{rule.message}</div>
        )}
      </div>
      {rule.locate && (
        <Link
          href={`/projects/${projectId}/floor-plan`}
          className="flex-shrink-0 text-[10.5px] text-text3 hover:text-accent border border-chrome-lighter hover:border-accent rounded-[2px] px-2 py-1 font-mono"
        >
          Locate ↗
        </Link>
      )}
    </div>
  );
}
