// Regulatory Readiness Report view — the patent-defending artifact for
// Claim 3 (TDD §8.3 — "the strongest individual patent claim").
//
// Renders the full Readiness Report as a printable surface: jurisdictional
// stack, per-permit requirements with authorities and lead times,
// environmental flags, totals, and a Markdown export.

import Link from "next/link";
import clsx from "clsx";
import type {
  RegulatoryReadinessReport, JurisdictionStack, PermitRequirement,
  EnvironmentalFlag, JurisdictionLevel,
} from "@/lib/regulatory/types";
import { ENV_FLAG_LABEL } from "@/lib/regulatory/types";

export function RegulatoryView({ report }: { report: RegulatoryReadinessReport }) {
  const markdownExport = generateMarkdownReport(report);
  return (
    <div className="p-6 max-w-[1100px] mx-auto">
      {/* Header */}
      <header className="mb-5 flex items-start justify-between gap-4">
        <div>
          <h1 className="text-[20px] font-semibold mb-1">Regulatory Readiness Report</h1>
          <p className="text-[11.5px] text-text3 font-mono">
            Generated {new Date(report.generatedAt).toLocaleString()} ·
            Jurisdictional stack · permit taxonomy · AHJ taxonomy · environmental flags
          </p>
        </div>
        <div className="flex items-center gap-2">
          <a
            href={`data:text/markdown;charset=utf-8,${encodeURIComponent(markdownExport)}`}
            download={`${report.project.number}-regulatory-readiness.md`}
            className="btn btn-ghost text-[11.5px]"
          >Download .md</a>
          <Link href={`/projects/${report.project.id}/npe`} className="btn btn-ghost text-[11.5px]">→ NPE Reasoning</Link>
        </div>
      </header>

      {/* Executive summary */}
      <div className="card mb-5 border-l-2 border-l-accent">
        <div className="card-body py-3">
          <div className="text-[10px] uppercase tracking-[0.06em] text-accent font-mono mb-2">Executive summary</div>
          <p className="text-[11.5px] text-text2 leading-relaxed">{report.executiveSummary}</p>
        </div>
      </div>

      {/* Summary tiles */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-2.5 mb-5">
        <Tile label="Permits required"       value={String(report.permitRequirements.length)} />
        <Tile label="Environmental flags"    value={String(report.environmentalFlags.length)} tone="warn" />
        <Tile label="Longest lead time"      value={`${report.longestPermitLeadDays} days`} />
        <Tile label="Total estimated fees"   value={dollars(report.totalEstimatedFeesCents)} mono />
      </div>

      {/* Jurisdictional stack */}
      <section className="card mb-5">
        <div className="card-header">
          <div className="card-title">① Jurisdictional stack</div>
          <span className="text-[9.5px] text-text4 font-mono uppercase tracking-[0.06em]">City · county · state · federal</span>
        </div>
        <div className="card-body p-0">
          <StackRow level="city"    j={report.jurisdictionStack.city} />
          <StackRow level="county"  j={report.jurisdictionStack.county} />
          <StackRow level="state"   j={report.jurisdictionStack.state} />
          <StackRow level="federal" j={report.jurisdictionStack.federal} />
        </div>
        <div className="px-4 py-2 border-t border-chrome-dark bg-chrome-darkest/40">
          <span className="text-[9.5px] text-text4 font-mono uppercase tracking-[0.06em]">State DOT variant</span>
          <div className="text-[11.5px] text-text2 mt-0.5">
            <span className="font-mono">{report.jurisdictionStack.dot.acronym}</span> · {report.jurisdictionStack.dot.name}
            {report.jurisdictionStack.dot.contactPortal && <>
              <span className="ml-2 text-text4">·</span>{" "}
              <a className="text-info hover:underline" href={report.jurisdictionStack.dot.contactPortal} target="_blank" rel="noreferrer">portal ↗</a>
            </>}
          </div>
        </div>
      </section>

      {/* Permit requirements */}
      <section className="card mb-5">
        <div className="card-header">
          <div className="card-title">② Permit requirements · {report.permitRequirements.length}</div>
          <span className="text-[9.5px] text-text4 font-mono uppercase tracking-[0.06em]">Permit type → AHJ · lead time · fees</span>
        </div>
        {report.permitRequirements.length === 0 ? (
          <div className="card-body text-[11.5px] text-text3">No permits resolved for this project.</div>
        ) : (
          <div className="divide-y divide-chrome-dark">
            {report.permitRequirements.map(p => <PermitRow key={p.type} req={p} />)}
          </div>
        )}
      </section>

      {/* Environmental flags */}
      <section className="card mb-5">
        <div className="card-header">
          <div className="card-title">③ Environmental flags · {report.environmentalFlags.length}</div>
          <span className="text-[9.5px] text-text4 font-mono uppercase tracking-[0.06em]">Site / activity / sector predicates</span>
        </div>
        {report.environmentalFlags.length === 0 ? (
          <div className="card-body text-[11.5px] text-text3">No environmental flags raised for this project.</div>
        ) : (
          <div className="divide-y divide-chrome-dark">
            {report.environmentalFlags.map(f => <EnvFlagRow key={f.kind} flag={f} />)}
          </div>
        )}
      </section>

      {/* CPM integration note */}
      <section className="card mb-5 border-l-2 border-l-info">
        <div className="card-body py-3">
          <div className="text-[10px] uppercase tracking-[0.06em] text-info font-mono mb-1">CPM integration</div>
          <p className="text-[11.5px] text-text2 leading-relaxed">
            Each permit requirement above is fed into Call 2 (Critical Path Schedule) as a
            predecessor constraint activity (A0901, A0902, ...). The longest permit lead time
            ({report.longestPermitLeadDays} days) sits on the critical path before
            Mobilization. See the{" "}
            <Link href={`/projects/${report.project.id}/npe`} className="text-info hover:underline">
              Design Reasoning view
            </Link>{" "}for the resulting schedule.
          </p>
        </div>
      </section>

      <footer className="mt-6 text-[10px] text-text4 font-mono leading-snug">
        Generated by the Regulatory Output Engine. Components: jurisdiction stack
        resolver · permit-type taxonomy + applicability predicates · AHJ contact
        mapping · environmental-flag generator · Readiness Report assembly.
        Markdown export downloadable above (PDF in production cutover).
      </footer>
    </div>
  );
}

// ── Sub-atoms ───────────────────────────────────────────────────────────

const LEVEL_LABEL: Record<JurisdictionLevel, string> = {
  city: "City", county: "County", state: "State", federal: "Federal",
};

const LEVEL_TONE: Record<JurisdictionLevel, string> = {
  city: "text-accent", county: "text-info", state: "text-warn", federal: "text-pass",
};

function StackRow({ level, j }: { level: JurisdictionLevel; j: { name: string; stateCode: string; zips?: string[] } }) {
  return (
    <div className="px-4 py-2 flex items-baseline gap-3 border-b border-chrome-dark/50 last:border-b-0">
      <span className={clsx("text-[9.5px] uppercase tracking-[0.06em] font-mono w-[60px]", LEVEL_TONE[level])}>
        {LEVEL_LABEL[level]}
      </span>
      <span className="text-[11.5px] text-text font-medium">{j.name}</span>
      <span className="text-[10px] text-text4 font-mono">{j.stateCode}</span>
      {j.zips && j.zips.length > 0 && (
        <span className="text-[9.5px] text-text4 font-mono ml-auto">ZIPs: {j.zips.join(", ")}</span>
      )}
    </div>
  );
}

function PermitRow({ req }: { req: PermitRequirement }) {
  return (
    <div className="px-4 py-3">
      <div className="flex items-baseline justify-between gap-3 mb-1">
        <div className="flex-1 min-w-0">
          <div className="text-[12px] text-text font-medium">{req.definition.label}</div>
          <div className="text-[10px] text-text4 font-mono mt-0.5">{req.type}</div>
        </div>
        <div className="text-right flex-shrink-0">
          <div className="text-[11px] text-warn font-mono tabular-nums">{req.leadTimeDays} days</div>
          <div className="text-[10px] text-text4 font-mono tabular-nums">{dollars(req.estimatedFeeCents)} fee</div>
        </div>
      </div>
      <div className="text-[10.5px] text-text3 leading-snug mb-2">{req.definition.description}</div>
      <div className="text-[10px] text-text4 font-mono leading-snug mb-2">
        <span className="text-text3">Why:</span> {req.definition.applicabilityRationale}
      </div>
      <div className="flex items-baseline gap-3 text-[10.5px] flex-wrap">
        <span className={clsx("text-[9.5px] uppercase tracking-[0.06em] font-mono", LEVEL_TONE[req.authority.level])}>
          {LEVEL_LABEL[req.authority.level]}
        </span>
        <span className="text-text2">{req.authority.name}</span>
        {req.authority.unit && <span className="text-text4">· {req.authority.unit}</span>}
        {req.authority.contactPortal && (
          <a href={req.authority.contactPortal} target="_blank" rel="noreferrer"
             className="text-info hover:underline ml-auto text-[10px]">portal ↗</a>
        )}
        {req.authority.contactPhone && (
          <span className="text-text4 text-[10px] font-mono">{req.authority.contactPhone}</span>
        )}
      </div>
    </div>
  );
}

function EnvFlagRow({ flag }: { flag: EnvironmentalFlag }) {
  return (
    <div className="px-4 py-3 flex items-start gap-3">
      <span className={clsx(
        "w-6 h-6 rounded-full flex items-center justify-center text-[11px] flex-shrink-0",
        flag.blocksConstruction ? "bg-fail/15 text-fail" : "bg-warn/15 text-warn",
      )}>{flag.blocksConstruction ? "✕" : "!"}</span>
      <div className="flex-1 min-w-0">
        <div className="flex items-baseline gap-2">
          <span className="text-[12px] text-text font-medium">{ENV_FLAG_LABEL[flag.kind]}</span>
          {flag.blocksConstruction && (
            <span className="text-[9.5px] uppercase tracking-[0.06em] font-mono text-fail">blocks start</span>
          )}
        </div>
        <div className="text-[10.5px] text-text3 leading-snug mt-0.5">{flag.rationale}</div>
        {flag.authority && (
          <div className="flex items-baseline gap-2 mt-1 text-[10.5px]">
            <span className={clsx("text-[9.5px] uppercase tracking-[0.06em] font-mono", LEVEL_TONE[flag.authority.level])}>
              {LEVEL_LABEL[flag.authority.level]}
            </span>
            <span className="text-text3">{flag.authority.name}</span>
            {flag.authority.contactPortal && (
              <a href={flag.authority.contactPortal} target="_blank" rel="noreferrer"
                 className="text-info hover:underline text-[10px] ml-auto">portal ↗</a>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function Tile({ label, value, mono, tone = "text2" }: {
  label: string; value: string; mono?: boolean;
  tone?: "text2" | "warn" | "pass";
}) {
  const cls = tone === "warn" ? "text-warn" : tone === "pass" ? "text-pass" : "text-text2";
  return (
    <div className="border border-chrome-dark rounded-[2px] p-3 bg-chrome-darkest">
      <div className="text-[9.5px] uppercase tracking-[0.06em] text-text4 font-mono">{label}</div>
      <div className={clsx("text-[18px] font-semibold leading-tight tabular-nums mt-1", cls, mono && "font-mono")}>
        {value}
      </div>
    </div>
  );
}

function dollars(cents: number): string {
  return "$" + (cents / 100).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

// ── Markdown export ─────────────────────────────────────────────────────

function generateMarkdownReport(r: RegulatoryReadinessReport): string {
  const lines: string[] = [];
  lines.push(`# Regulatory Readiness Report — ${r.project.name}`);
  lines.push("");
  lines.push(`**Project:** ${r.project.number} · ${r.project.name}`);
  lines.push(`**Site:** ${r.project.addressLine1}, ${r.project.city}, ${r.project.state} ${r.project.zip}`);
  lines.push(`**Generated:** ${new Date(r.generatedAt).toLocaleString()}`);
  lines.push("");
  lines.push("## Executive Summary");
  lines.push("");
  lines.push(r.executiveSummary);
  lines.push("");
  lines.push("## Jurisdictional Stack");
  lines.push("");
  lines.push(`- **City:** ${r.jurisdictionStack.city.name}`);
  lines.push(`- **County:** ${r.jurisdictionStack.county.name}`);
  lines.push(`- **State:** ${r.jurisdictionStack.state.name}`);
  lines.push(`- **Federal:** ${r.jurisdictionStack.federal.name}`);
  lines.push(`- **State DOT:** ${r.jurisdictionStack.dot.acronym} — ${r.jurisdictionStack.dot.name}`);
  lines.push("");
  lines.push(`## Permit Requirements (${r.permitRequirements.length})`);
  lines.push("");
  for (const p of r.permitRequirements) {
    lines.push(`### ${p.definition.label}`);
    lines.push("");
    lines.push(`- **Type:** ${p.type}`);
    lines.push(`- **Lead time:** ${p.leadTimeDays} calendar days`);
    lines.push(`- **Estimated fee:** ${dollars(p.estimatedFeeCents)}`);
    lines.push(`- **Authority:** ${p.authority.name}${p.authority.unit ? " — " + p.authority.unit : ""} (${p.authority.level})`);
    if (p.authority.contactPortal) lines.push(`- **Portal:** ${p.authority.contactPortal}`);
    if (p.authority.contactPhone) lines.push(`- **Phone:** ${p.authority.contactPhone}`);
    lines.push("");
    lines.push(p.definition.description);
    lines.push("");
    lines.push(`**Applicability:** ${p.definition.applicabilityRationale}`);
    lines.push("");
  }
  lines.push(`## Environmental Flags (${r.environmentalFlags.length})`);
  lines.push("");
  for (const f of r.environmentalFlags) {
    lines.push(`### ${ENV_FLAG_LABEL[f.kind]}${f.blocksConstruction ? " — BLOCKS CONSTRUCTION START" : ""}`);
    lines.push("");
    lines.push(f.rationale);
    if (f.authority) lines.push(`\n_Authority: ${f.authority.name}_`);
    lines.push("");
  }
  lines.push("## Totals");
  lines.push("");
  lines.push(`- **Longest permit lead time:** ${r.longestPermitLeadDays} calendar days`);
  lines.push(`- **Total estimated fees:** ${dollars(r.totalEstimatedFeesCents)}`);
  lines.push("");
  lines.push("---");
  lines.push("");
  lines.push("Generated by the ToroAI Regulatory Output Engine.");
  return lines.join("\n");
}
