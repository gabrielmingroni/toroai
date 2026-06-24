// Compliance view — renders the 20-rule standards corpus check (TDD §6.4).
// Patent-defending artifact: each rule cites the standard + the section
// number; every check ran a real predicate against project state.

import clsx from "clsx";
import type { Project } from "@/lib/projects/types";
import type {
  StandardsComplianceResult, StandardFamily, RuleStatus,
} from "@/lib/standards/types";
import { STANDARD_LABEL } from "@/lib/standards/types";

export function ComplianceView({
  project, result,
}: { project: Project; result: StandardsComplianceResult }) {
  const markdown = generateMarkdownReport(project, result);

  // Group rules by standard for the per-standard sections.
  const standardOrder: StandardFamily[] = [
    "TIA-568.2-D", "TIA-568.1-D", "TIA-569", "TIA-758-B", "TIA-607",
    "NEC-770", "NEC-800", "NEC-830", "BICSI-TDMM-15", "UFC-3-580-01",
  ];

  return (
    <div className="p-6 max-w-[1100px] mx-auto">
      {/* Header */}
      <header className="mb-5 flex items-start justify-between gap-4">
        <div>
          <h1 className="text-[20px] font-semibold mb-1">Standards compliance — 20-rule corpus</h1>
          <p className="text-[11.5px] text-text3 font-mono">
            BICSI TDMM 15 · TIA-568/569/758/607 · NEC 770/800 · UFC 3-580-01
          </p>
        </div>
        <a
          href={`data:text/markdown;charset=utf-8,${encodeURIComponent(markdown)}`}
          download={`${project.number}-compliance.md`}
          className="btn btn-ghost text-[11.5px]"
        >Download .md</a>
      </header>

      {/* Top summary */}
      <div className="grid grid-cols-4 gap-2.5 mb-5">
        <Tile label="Pass"           value={result.counts.pass}           tone="pass" />
        <Tile label="Advisory"       value={result.counts.advisory}       tone="warn" />
        <Tile label="Fail"           value={result.counts.fail}           tone="fail" />
        <Tile label="Not applicable" value={result.counts.not_applicable} tone="text4" />
      </div>

      {/* Per-standard rollup */}
      <section className="card mb-5">
        <div className="card-header">
          <div className="card-title">Per-standard rollup</div>
          <span className="text-[9.5px] text-text4 font-mono uppercase tracking-[0.06em]">{result.counts.total} rules</span>
        </div>
        <div className="card-body p-0">
          {standardOrder.filter(std => result.byStandard[std].total > 0).map(std => (
            <StandardRollupRow key={std} std={std} counts={result.byStandard[std]} />
          ))}
        </div>
      </section>

      {/* Per-standard sections */}
      {standardOrder.filter(std => result.byStandard[std].total > 0).map(std => (
        <StandardSection
          key={std}
          std={std}
          rules={result.rules.filter(r => r.def.standard === std)}
        />
      ))}

      <footer className="mt-6 text-[10px] text-text4 font-mono leading-snug">
        Each rule's predicate is deterministic over the project state
        (intake rooms, placement, design parameters, pathway). Every rule cites
        its standard section, and the predicate logic is visible in
        <code className="text-text3"> lib/standards/rules.ts</code>.
      </footer>
    </div>
  );
}

// ── Atoms ───────────────────────────────────────────────────────────────

const STATUS_TONE: Record<RuleStatus, string> = {
  pass: "text-pass", advisory: "text-warn", fail: "text-fail", not_applicable: "text-text4",
};
const STATUS_BG: Record<RuleStatus, string> = {
  pass: "bg-pass/15", advisory: "bg-warn/15", fail: "bg-fail/15", not_applicable: "bg-chrome-darkest",
};
const STATUS_GLYPH: Record<RuleStatus, string> = {
  pass: "✓", advisory: "!", fail: "✕", not_applicable: "–",
};
const STATUS_LABEL: Record<RuleStatus, string> = {
  pass: "Pass", advisory: "Advisory", fail: "Fail", not_applicable: "N/A",
};

function Tile({ label, value, tone }: {
  label: string; value: number; tone: "pass" | "warn" | "fail" | "text4";
}) {
  const cls = tone === "pass" ? "text-pass" : tone === "warn" ? "text-warn"
            : tone === "fail" ? "text-fail" : "text-text4";
  return (
    <div className="border border-chrome-dark rounded-[2px] p-3 bg-chrome-darkest">
      <div className="text-[9.5px] uppercase tracking-[0.06em] text-text4 font-mono">{label}</div>
      <div className={clsx("text-[24px] font-semibold leading-tight tabular-nums mt-1", cls)}>{value}</div>
    </div>
  );
}

function StandardRollupRow({
  std, counts,
}: { std: StandardFamily; counts: { pass: number; advisory: number; fail: number; not_applicable: number; total: number } }) {
  const tone = counts.fail > 0 ? "text-fail"
             : counts.advisory > 0 ? "text-warn"
             : counts.pass > 0 ? "text-pass" : "text-text4";
  return (
    <div className="px-4 py-2 flex items-baseline gap-3 border-b border-chrome-dark/50 last:border-b-0">
      <span className="text-[11px] text-text2 font-mono w-[120px] flex-shrink-0">{STANDARD_LABEL[std]}</span>
      <span className="flex-1 flex items-center gap-1.5 text-[10.5px] font-mono">
        {counts.pass > 0 && <span className="text-pass">{counts.pass} pass</span>}
        {counts.advisory > 0 && <span className="text-warn">· {counts.advisory} advisory</span>}
        {counts.fail > 0 && <span className="text-fail">· {counts.fail} fail</span>}
        {counts.not_applicable > 0 && <span className="text-text4">· {counts.not_applicable} N/A</span>}
      </span>
      <span className={clsx("text-[10.5px] font-mono tabular-nums", tone)}>
        {counts.pass + counts.advisory + counts.fail}/{counts.total - counts.not_applicable} applicable pass
      </span>
    </div>
  );
}

function StandardSection({
  std, rules,
}: {
  std: StandardFamily;
  rules: StandardsComplianceResult["rules"];
}) {
  return (
    <section className="card mb-5">
      <div className="card-header">
        <div className="card-title">{STANDARD_LABEL[std]}</div>
        <span className="text-[9.5px] text-text4 font-mono uppercase tracking-[0.06em]">{rules.length} rule{rules.length === 1 ? "" : "s"}</span>
      </div>
      <div className="divide-y divide-chrome-dark">
        {rules.map(r => <RuleRow key={r.def.code} rule={r} />)}
      </div>
    </section>
  );
}

function RuleRow({ rule }: { rule: StandardsComplianceResult["rules"][number] }) {
  const status = rule.outcome.status;
  return (
    <div className="px-4 py-3">
      <div className="flex items-baseline gap-3">
        <span className={clsx(
          "w-6 h-6 rounded-full flex items-center justify-center text-[12px] flex-shrink-0",
          STATUS_BG[status], STATUS_TONE[status],
        )}>{STATUS_GLYPH[status]}</span>
        <div className="flex-1 min-w-0">
          <div className="flex items-baseline gap-2">
            <span className="text-[12px] text-text font-medium">{rule.def.title}</span>
            <span className="text-[9.5px] text-text4 font-mono">{rule.def.code}</span>
          </div>
          <div className="text-[10.5px] text-text3 mt-0.5">{rule.def.citation}</div>
          <div className="text-[10.5px] text-text3 mt-1 leading-snug">{rule.def.description}</div>
          {rule.outcome.message && (
            <div className={clsx("text-[11px] mt-1.5 font-mono leading-snug", STATUS_TONE[status])}>
              {rule.outcome.message}
            </div>
          )}
        </div>
        <span className={clsx("text-[9.5px] uppercase tracking-[0.06em] font-mono flex-shrink-0", STATUS_TONE[status])}>
          {STATUS_LABEL[status]}
        </span>
      </div>
    </div>
  );
}

// ── Markdown export ─────────────────────────────────────────────────────

function generateMarkdownReport(project: Project, result: StandardsComplianceResult): string {
  const lines: string[] = [];
  lines.push(`# Compliance Report — ${project.name}`);
  lines.push("");
  lines.push(`**Project:** ${project.number} · ${project.name}`);
  lines.push(`**Generated:** ${new Date(result.generatedAt).toLocaleString()}`);
  lines.push("");
  lines.push(`## Summary`);
  lines.push("");
  lines.push(`- Pass: ${result.counts.pass}`);
  lines.push(`- Advisory: ${result.counts.advisory}`);
  lines.push(`- Fail: ${result.counts.fail}`);
  lines.push(`- Not applicable: ${result.counts.not_applicable}`);
  lines.push(`- Total rules: ${result.counts.total}`);
  lines.push("");
  for (const r of result.rules) {
    lines.push(`### ${r.def.code} — ${r.def.title}`);
    lines.push("");
    lines.push(`**Status:** ${STATUS_LABEL[r.outcome.status]}`);
    lines.push(`**Citation:** ${r.def.citation}`);
    lines.push("");
    lines.push(r.def.description);
    if (r.outcome.message) {
      lines.push("");
      lines.push(`> ${r.outcome.message}`);
    }
    lines.push("");
  }
  return lines.join("\n");
}
