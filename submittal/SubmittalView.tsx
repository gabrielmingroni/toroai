// Submittal Package preview + download.
//
// The "Download Submittal Package" link hits the /api route which generates
// a real multi-page PDF (cover + BOM + compliance + regulatory + cable
// schedule) and streams it back. This is the actual production-grade
// deliverable an RCDD attaches to a bid.

import Link from "next/link";
import type { Project } from "@/lib/projects/types";
import type { AuthUser } from "@/lib/auth/types";

interface BomSummary {
  lineItems: number; sections: number;
  materialCents: number; laborCents: number; grandTotalCents: number;
}
interface ComplianceSummary { total: number; pass: number; advisory: number; fail: number; na: number; }
interface RegulatorySummary {
  permitCount: number; envFlags: number;
  longestLeadDays: number; totalFeesCents: number;
}

export function SubmittalView({
  project, user, bomSummary, complianceSummary, regulatorySummary,
}: {
  project: Project;
  user: AuthUser;
  bomSummary: BomSummary;
  complianceSummary: ComplianceSummary;
  regulatorySummary: RegulatorySummary;
}) {
  const downloadUrl = `/api/projects/${project.id}/submittal`;

  return (
    <div className="p-6 max-w-[1000px] mx-auto">

      <header className="mb-5 flex items-start justify-between gap-4">
        <div>
          <h1 className="text-[20px] font-semibold mb-1">Submittal Package</h1>
          <p className="text-[11.5px] text-text3 font-mono">
            Production-grade multi-page PDF · cover + BOM + compliance + regulatory + cable schedule
          </p>
        </div>
        <a href={downloadUrl} download
           className="btn btn-primary text-[13px] px-5 py-2.5 font-medium inline-flex items-center gap-2">
          <i className="ti ti-download" style={{ fontSize: 14 }} aria-hidden="true" />
          Download Submittal Package (.pdf)
        </a>
      </header>

      {/* Project context */}
      <div className="card mb-5">
        <div className="card-header">
          <div className="card-title">Cover page · Project context</div>
          <span className="text-[9.5px] text-text4 font-mono uppercase tracking-[0.06em]">Section 1</span>
        </div>
        <div className="card-body">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-[11.5px]">
            <Field label="Project number"   value={project.number} mono />
            <Field label="Project name"     value={project.name} />
            <Field label="Owner"            value={project.owner} />
            <Field label="Site"             value={`${project.city}, ${project.state}`} />
            <Field label="AHJ"              value={project.ahj} />
            <Field label="Total SF"         value={project.totalSf.toLocaleString()} mono />
            <Field label="Floors"           value={String(project.floors)} mono />
            <Field label="Target occupancy" value={project.occupancyDate ?? "—"} />
          </div>
          <div className="text-[10px] text-text4 font-mono mt-3 leading-snug">
            Cover sheet includes a full-size RCDD stamp box pre-filled with{" "}
            <span className="text-text2">{user.firstName} {user.lastName}</span>
            {user.rcddNumber && <> · RCDD #{user.rcddNumber}{user.rcddState && ` (${user.rcddState})`}</>}
            {user.firmName && <> · {user.firmName}</>}
            . Signature line ready for wet/digital sign-off.
            {project.exhibit && (
              <> Includes a federal-project scope summary on the cover sheet.</>
            )}
          </div>
        </div>
      </div>

      {/* BOM section */}
      <div className="card mb-5">
        <div className="card-header">
          <div className="card-title">Bill of Materials</div>
          <span className="text-[9.5px] text-text4 font-mono uppercase tracking-[0.06em]">Section 2</span>
        </div>
        <div className="card-body grid grid-cols-2 md:grid-cols-4 gap-2.5">
          <Tile label="Line items"  value={String(bomSummary.lineItems)} />
          <Tile label="CSI sections" value={String(bomSummary.sections)} />
          <Tile label="Material"    value={dollars(bomSummary.materialCents)} />
          <Tile label="Grand total" value={dollars(bomSummary.grandTotalCents)} tone="accent" />
        </div>
      </div>

      {/* Compliance section */}
      <div className="card mb-5">
        <div className="card-header">
          <div className="card-title">Compliance — 20-rule standards corpus</div>
          <span className="text-[9.5px] text-text4 font-mono uppercase tracking-[0.06em]">Section 3</span>
        </div>
        <div className="card-body grid grid-cols-2 md:grid-cols-5 gap-2.5">
          <Tile label="Total"    value={String(complianceSummary.total)} />
          <Tile label="Pass"     value={String(complianceSummary.pass)}     tone="pass" />
          <Tile label="Advisory" value={String(complianceSummary.advisory)} tone="warn" />
          <Tile label="Fail"     value={String(complianceSummary.fail)}     tone="fail" />
          <Tile label="N/A"      value={String(complianceSummary.na)}       tone="dim" />
        </div>
      </div>

      {/* Regulatory section */}
      <div className="card mb-5">
        <div className="card-header">
          <div className="card-title">Regulatory readiness</div>
          <span className="text-[9.5px] text-text4 font-mono uppercase tracking-[0.06em]">Section 4</span>
        </div>
        <div className="card-body grid grid-cols-2 md:grid-cols-4 gap-2.5">
          <Tile label="Required permits" value={String(regulatorySummary.permitCount)} />
          <Tile label="Environmental flags" value={String(regulatorySummary.envFlags)} tone="warn" />
          <Tile label="Longest lead"     value={`${regulatorySummary.longestLeadDays} days`} />
          <Tile label="Estimated fees"   value={dollars(regulatorySummary.totalFeesCents)} mono />
        </div>
      </div>

      {/* Cable schedule appendix */}
      <div className="card mb-5">
        <div className="card-header">
          <div className="card-title">Cable schedule appendix</div>
          <span className="text-[9.5px] text-text4 font-mono uppercase tracking-[0.06em]">Section 5 (when applicable)</span>
        </div>
        <div className="card-body text-[11.5px] text-text3">
          From-to rows for every cable run, TIA-606-C labels, source rack/U/port,
          destination outlet, computed channel length, TIA-568 status. Included
          when the project has placed outlets + suggested TR locations.
        </div>
      </div>

      {/* CTA + footer */}
      <div className="card mb-5 border-l-2 border-l-accent">
        <div className="card-body flex items-start gap-4">
          <div className="flex-1">
            <div className="text-[10px] uppercase tracking-[0.06em] text-accent font-mono mb-1">Ready to ship</div>
            <div className="text-[13px] text-text font-medium mb-1">
              The submittal package bundles everything above into a single PDF.
            </div>
            <div className="text-[11.5px] text-text3">
              Letter-sized · paginates automatically · embeds project header + page numbers.
              Production roadmap: D-size 24″×36″ sheet sets with revision clouds + Bluebeam-compatible markups.
            </div>
          </div>
          <a href={downloadUrl} download
             className="btn btn-primary text-[12px] px-4 py-2 inline-flex items-center gap-2">
            <i className="ti ti-download" style={{ fontSize: 12 }} aria-hidden="true" />
            Download .pdf
          </a>
        </div>
      </div>

      <footer className="mt-6 text-[10px] text-text4 font-mono leading-snug">
        Generated server-side via pdf-lib. PDF re-generates fresh on every download —
        any change to BOM / compliance / regulatory / schedule shows up immediately.
        For D-size sheet output + revision clouds, see the production roadmap.
      </footer>
    </div>
  );
}

// ── Atoms ───────────────────────────────────────────────────────────────

function Field({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="flex flex-col">
      <span className="text-[9.5px] text-text4 font-mono uppercase tracking-[0.06em]">{label}</span>
      <span className={mono ? "text-text2 font-mono tabular-nums" : "text-text2"}>{value}</span>
    </div>
  );
}

function Tile({ label, value, tone = "text", mono }: {
  label: string; value: string;
  tone?: "text" | "pass" | "warn" | "fail" | "accent" | "dim"; mono?: boolean;
}) {
  const cls =
    tone === "pass"   ? "text-pass"
    : tone === "warn" ? "text-warn"
    : tone === "fail" ? "text-fail"
    : tone === "accent" ? "text-accent"
    : tone === "dim"  ? "text-text4"
    : "text-text2";
  return (
    <div className="border border-chrome-dark rounded-[2px] p-3 bg-chrome-darkest">
      <div className="text-[9.5px] uppercase tracking-[0.06em] text-text4 font-mono">{label}</div>
      <div className={"text-[18px] font-semibold tabular-nums leading-tight mt-1 " + cls + (mono ? " font-mono" : "")}>
        {value}
      </div>
    </div>
  );
}

function dollars(cents: number): string {
  return "$" + (cents / 100).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}
