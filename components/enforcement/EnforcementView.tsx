// Enforcement view — renders the four post-processing modules (TDD §5.5)
// as a single audit-ready surface. Patent-defending artifact: each section
// cites the relevant TDD §, names the deterministic rule being applied,
// shows the violations found in the Call-1 input, and renders the before/
// after diff so counsel can point at concrete corrections.

import Link from "next/link";
import clsx from "clsx";
import type { Project } from "@/lib/projects/types";
import {
  CONNECTOR_SPEC_LABEL, FEDERAL_AGENCY_LABEL,
} from "@/lib/projects/types";
import type {
  EnforcementBundle, NpeCall1Output,
  DavisBaconResult, LcUpcResult, ProductionRateResult, PermitTriggerResult,
} from "@/lib/enforcement/types";
import { PERMIT_TYPE_LABEL } from "@/lib/enforcement/types";

export function EnforcementView({
  project, call1, bundle,
}: { project: Project; call1: NpeCall1Output; bundle: EnforcementBundle }) {
  const exhibit = project.exhibit;
  const counts = {
    davisBacon:     bundle.davisBacon.violations.length,
    lcUpc:          bundle.lcUpc.violations.length,
    productionRate: bundle.productionRate.violations.length,
    permitTriggers: bundle.permitTriggers.triggers.length,
  };

  return (
    <div className="p-6 max-w-[1100px] mx-auto">
      {/* Header */}
      <header className="mb-5 flex items-start justify-between gap-4">
        <div>
          <h1 className="text-[20px] font-semibold mb-1">Post-processing enforcement</h1>
          <p className="text-[11.5px] text-text3 font-mono">
            Four deterministic modules run after the AI design reasoning step —
            Davis-Bacon · LC/UPC · production rate · permit triggers.
          </p>
        </div>
        <Link href={`/projects/${project.id}/pipeline`} className="btn btn-ghost text-[11.5px]">← Pipeline</Link>
      </header>

      {/* Project context band */}
      <div className="card mb-5 border-l-2 border-l-info">
        <div className="card-body py-3">
          <div className="text-[10px] uppercase tracking-[0.06em] text-info font-mono mb-1">Project context</div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-[11.5px]">
            <Ctx label="Project" value={`${project.number} — ${project.name}`} />
            <Ctx label="Jurisdiction" value={`${project.city}, ${project.state}`} />
            <Ctx label="Federal agency"
                 value={exhibit?.federalAgency ? FEDERAL_AGENCY_LABEL[exhibit.federalAgency] : "—"} />
            <Ctx label="Davis-Bacon"
                 value={exhibit?.davisBaconApplies ? "Applies" : "Does not apply"}
                 tone={exhibit?.davisBaconApplies ? "warn" : "text4"} />
          </div>
        </div>
      </div>

      {/* Summary tiles */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-2.5 mb-5">
        <SummaryTile module="Davis-Bacon" count={counts.davisBacon} unit="corrections" tone={counts.davisBacon ? "warn" : "pass"} />
        <SummaryTile module="LC/UPC"       count={counts.lcUpc}     unit="overrides"   tone={counts.lcUpc ? "warn" : "pass"} />
        <SummaryTile module="Prod. rate"   count={counts.productionRate} unit="clamps"  tone={counts.productionRate ? "warn" : "pass"} />
        <SummaryTile module="Permit triggers" count={counts.permitTriggers} unit="extracted" tone={counts.permitTriggers ? "info" : "text4"} />
      </div>

      {/* Module sections */}
      <DavisBaconSection result={bundle.davisBacon} call1={call1} />
      <LcUpcSection result={bundle.lcUpc} call1={call1} />
      <ProductionRateSection result={bundle.productionRate} call1={call1} />
      <PermitTriggersSection result={bundle.permitTriggers} call1={call1} />

      <footer className="mt-6 text-[10px] text-text4 font-mono leading-snug">
        Enforcement bundle generated {new Date(bundle.ranAt).toLocaleString()} ·
        Deterministic, reproducible from project state.
      </footer>
    </div>
  );
}

// ── Small atoms ─────────────────────────────────────────────────────────

function Ctx({ label, value, tone = "text2" }: { label: string; value: string; tone?: "text2" | "warn" | "text4" }) {
  const cls = tone === "warn" ? "text-warn" : tone === "text4" ? "text-text4" : "text-text2";
  return (
    <div className="flex flex-col">
      <span className="text-[9.5px] text-text4 font-mono uppercase tracking-[0.06em]">{label}</span>
      <span className={clsx("font-mono", cls)}>{value}</span>
    </div>
  );
}

function SummaryTile({ module, count, unit, tone }: {
  module: string; count: number; unit: string;
  tone: "pass" | "warn" | "info" | "text4";
}) {
  const cls = tone === "pass" ? "text-pass" : tone === "warn" ? "text-warn"
            : tone === "info" ? "text-info" : "text-text4";
  return (
    <div className="border border-chrome-dark rounded-[2px] p-3 bg-chrome-darkest">
      <div className="text-[9.5px] text-text4 font-mono uppercase tracking-[0.06em]">{module}</div>
      <div className={clsx("text-[20px] font-semibold tabular-nums leading-tight mt-1", cls)}>{count}</div>
      <div className="text-[10px] text-text3 font-mono">{unit}</div>
    </div>
  );
}

function SectionShell({
  title, ruleText, citation, footer, children,
}: {
  title: string; ruleText: string; citation: string;
  footer?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section className="card mb-5">
      <div className="card-header">
        <div className="card-title">{title}</div>
        <span className="text-[9.5px] text-text4 font-mono uppercase tracking-[0.06em]">{citation}</span>
      </div>
      <div className="px-4 py-2 border-b border-chrome-dark bg-chrome-darkest/40">
        <span className="text-[9.5px] text-text4 font-mono uppercase tracking-[0.06em]">Rule</span>
        <div className="text-[11px] text-text2 mt-0.5 leading-snug">{ruleText}</div>
      </div>
      <div className="card-body">{children}</div>
      {footer}
    </section>
  );
}

// ── Davis-Bacon section ─────────────────────────────────────────────────

function DavisBaconSection({ result, call1 }: { result: DavisBaconResult; call1: NpeCall1Output }) {
  return (
    <SectionShell
      title="① Davis-Bacon prevailing wage override"
      ruleText="When the project is owned/occupied by a federal agency or is explicitly flagged, every proposed labor rate is compared against the SCA prevailing wage table (base + fringe) for its classification and jurisdiction. Rates below prevailing are corrected upward; total dollar correction is rolled up across the labor SOV."
      citation="Federal / Davis-Bacon override · deterministic"
    >
      {!result.applies ? (
        <div className="text-[11.5px] text-text3">
          Module skipped — {result.reason}
        </div>
      ) : (
        <>
          <div className="text-[11.5px] text-text2 mb-3">{result.reason}</div>
          <div className="grid grid-cols-3 gap-3 mb-3 text-[11px]">
            <Stat label="Jurisdiction" value={result.jurisdiction} />
            <Stat label="Original labor cost" value={dollars(result.originalLaborCostCents)} mono />
            <Stat label="Corrected labor cost" value={dollars(result.correctedLaborCostCents)} mono tone="warn" />
          </div>

          {result.violations.length === 0 ? (
            <div className="text-[11.5px] text-pass">
              ✓ No violations — all proposed labor rates meet or exceed prevailing wage.
            </div>
          ) : (
            <>
              <div className="text-[10px] uppercase tracking-[0.06em] text-text4 font-mono mb-2">
                Corrections ({result.violations.length})
              </div>
              <div className="border border-chrome-dark rounded-[2px] overflow-hidden">
                <Row header>
                  <Cell w="flex-1">Task</Cell>
                  <Cell w="w-[160px]">Classification</Cell>
                  <Cell w="w-[100px]" right>Proposed</Cell>
                  <Cell w="w-[100px]" right>Prevailing</Cell>
                  <Cell w="w-[120px]" right>Correction</Cell>
                </Row>
                {result.violations.map(v => {
                  const task = call1.laborTasks.find(t => t.id === v.taskId);
                  return (
                    <Row key={v.taskId}>
                      <Cell w="flex-1">{v.taskDescription}<div className="text-[9.5px] text-text4">{task?.hours} hr</div></Cell>
                      <Cell w="w-[160px]">{v.classification}</Cell>
                      <Cell w="w-[100px]" right mono>${v.proposedRateUsdHr.toFixed(2)}</Cell>
                      <Cell w="w-[100px]" right mono tone="warn">${v.prevailingRateUsdHr.toFixed(2)}</Cell>
                      <Cell w="w-[120px]" right mono tone="warn">+ {dollars(v.correctionCents)}</Cell>
                    </Row>
                  );
                })}
                <Row total>
                  <Cell w="flex-1"><span className="text-text2">Total correction</span></Cell>
                  <Cell w="w-[160px]"> </Cell>
                  <Cell w="w-[100px]"> </Cell>
                  <Cell w="w-[100px]"> </Cell>
                  <Cell w="w-[120px]" right mono tone="warn">+ {dollars(result.totalCorrectionCents)}</Cell>
                </Row>
              </div>
            </>
          )}

          <div className="mt-4">
            <div className="text-[10px] uppercase tracking-[0.06em] text-text4 font-mono mb-2">
              Wage table — Harris County, TX (WD-2026-2741)
            </div>
            <div className="border border-chrome-dark rounded-[2px] overflow-hidden">
              <Row header>
                <Cell w="flex-1">Classification</Cell>
                <Cell w="w-[100px]" right>Base</Cell>
                <Cell w="w-[100px]" right>Fringe</Cell>
                <Cell w="w-[100px]" right>Total</Cell>
              </Row>
              {result.wageTable.map(w => (
                <Row key={w.classification}>
                  <Cell w="flex-1">{w.classification}</Cell>
                  <Cell w="w-[100px]" right mono>${w.baseRateUsdHr.toFixed(2)}</Cell>
                  <Cell w="w-[100px]" right mono>${w.fringeUsdHr.toFixed(2)}</Cell>
                  <Cell w="w-[100px]" right mono tone="text2">${(w.baseRateUsdHr + w.fringeUsdHr).toFixed(2)}</Cell>
                </Row>
              ))}
            </div>
          </div>
        </>
      )}
    </SectionShell>
  );
}

// ── LC/UPC section ──────────────────────────────────────────────────────

function LcUpcSection({ result, call1 }: { result: LcUpcResult; call1: NpeCall1Output }) {
  return (
    <SectionShell
      title="② LC/UPC connector enforcement"
      ruleText="LC/UPC is the mandatory default fiber connector specification. Any LC/APC specification produced by the AI reasoning layer is overridden to LC/UPC in post-processing. The override is unconditional — there is no project-context flag that disables it."
      citation="LC/UPC mandated · LC/APC overridden unconditionally"
    >
      <div className="grid grid-cols-3 gap-3 mb-3 text-[11px]">
        <Stat label="Items scanned" value={String(result.totalLineItemsScanned)} mono />
        <Stat label="LC/APC found" value={String(result.totalCorrected)} mono tone={result.totalCorrected ? "warn" : "pass"} />
        <Stat label="Overrides applied" value={String(result.totalCorrected)} mono tone={result.totalCorrected ? "warn" : "pass"} />
      </div>

      {result.violations.length === 0 ? (
        <div className="text-[11.5px] text-pass">
          ✓ No violations — all connector specs are compliant.
        </div>
      ) : (
        <div className="border border-chrome-dark rounded-[2px] overflow-hidden">
          <Row header>
            <Cell w="w-[60px]">Item</Cell>
            <Cell w="flex-1">Description</Cell>
            <Cell w="w-[110px]" right>Proposed</Cell>
            <Cell w="w-[110px]" right>Corrected</Cell>
          </Row>
          {result.violations.map(v => {
            const item = call1.bomLineItems.find(b => b.id === v.lineItemId);
            return (
              <Row key={v.lineItemId}>
                <Cell w="w-[60px]" mono>{v.lineItemId}</Cell>
                <Cell w="flex-1">{v.description}<div className="text-[9.5px] text-text4">{item?.quantity} {item?.unit}</div></Cell>
                <Cell w="w-[110px]" right mono tone="fail">{CONNECTOR_SPEC_LABEL[v.proposedSpec]}</Cell>
                <Cell w="w-[110px]" right mono tone="pass">{CONNECTOR_SPEC_LABEL[v.correctedSpec]}</Cell>
              </Row>
            );
          })}
        </div>
      )}

      <div className="text-[10px] text-text4 font-mono mt-3 leading-snug">
        Note: SC/UPC and ST/UPC connectors are left untouched. Only LC/APC is overridden.
      </div>
    </SectionShell>
  );
}

// ── Production rate section ─────────────────────────────────────────────

function ProductionRateSection({ result, call1 }: { result: ProductionRateResult; call1: NpeCall1Output }) {
  return (
    <SectionShell
      title="③ Production rate validation"
      ruleText="OSP fiber pull tasks are validated against a hard-coded envelope of 3,500–5,280 LF/day for a 5-man crew (1 Supervisor + 2 Journeymen + 2 Fiber Techs). Rates above the maximum are clamped down to 5,280 LF/day; rates below the minimum are clamped up to 3,500 LF/day. The envelope is fixed; only the violation set varies by project."
      citation="OSP pull crew · 3,500–5,280 LF/day envelope"
    >
      <div className="grid grid-cols-3 gap-3 mb-3 text-[11px]">
        <Stat label="Envelope" value={`${result.envelope.minLfPerDay.toLocaleString()}–${result.envelope.maxLfPerDay.toLocaleString()} LF/day`} mono />
        <Stat label="Crew" value="5-man OSP pull crew" />
        <Stat label="Violations" value={String(result.violations.length)} mono tone={result.violations.length ? "warn" : "pass"} />
      </div>

      {result.violations.length === 0 ? (
        <div className="text-[11.5px] text-pass">
          ✓ No violations — all pull tasks within envelope.
        </div>
      ) : (
        <div className="border border-chrome-dark rounded-[2px] overflow-hidden">
          <Row header>
            <Cell w="flex-1">Task</Cell>
            <Cell w="w-[100px]" right>Crew</Cell>
            <Cell w="w-[140px]" right>Proposed LF/day</Cell>
            <Cell w="w-[140px]" right>Clamped LF/day</Cell>
            <Cell w="w-[120px]">Direction</Cell>
          </Row>
          {result.violations.map(v => (
            <Row key={v.taskId}>
              <Cell w="flex-1">{v.taskDescription}</Cell>
              <Cell w="w-[100px]" right mono>{v.crewSize}-man</Cell>
              <Cell w="w-[140px]" right mono tone="fail">{v.proposedLfPerDay.toLocaleString()}</Cell>
              <Cell w="w-[140px]" right mono tone="pass">{v.clampedLfPerDay.toLocaleString()}</Cell>
              <Cell w="w-[120px]"><span className="text-[10px] uppercase tracking-[0.06em] font-mono text-warn">
                {v.direction === "above_envelope" ? "↓ clamped down" : "↑ clamped up"}
              </span></Cell>
            </Row>
          ))}
        </div>
      )}

      <div className="text-[10px] text-text4 font-mono mt-3 leading-snug">
        Envelope applies to a 5-man OSP pull crew (1 Supervisor + 2 Journeymen + 2 Fiber Techs).
      </div>
    </SectionShell>
  );
}

// ── Permit triggers section ─────────────────────────────────────────────

function PermitTriggersSection({ result, call1 }: { result: PermitTriggerResult; call1: NpeCall1Output }) {
  return (
    <SectionShell
      title="④ Permit trigger extraction"
      ruleText="The raw permit-candidate list emitted by the AI reasoning layer is taxonomized into a deterministic permit-type set via a predicate library. Each resolved trigger gets a responsible AHJ + lead-time estimate from the regulatory taxonomy. Unresolved candidates are surfaced for human review."
      citation="Predicate library · AHJ taxonomy · lead-time estimates"
    >
      <div className="grid grid-cols-3 gap-3 mb-3 text-[11px]">
        <Stat label="Raw candidates" value={String(result.totalCandidates)} mono />
        <Stat label="Resolved triggers" value={String(result.triggers.length)} mono tone="info" />
        <Stat label="Unresolved" value={String(result.unresolved.length)} mono tone={result.unresolved.length ? "warn" : "pass"} />
      </div>

      {result.triggers.length === 0 ? (
        <div className="text-[11.5px] text-text3">No triggers resolved.</div>
      ) : (
        <div className="border border-chrome-dark rounded-[2px] overflow-hidden">
          <Row header>
            <Cell w="w-[200px]">Permit type</Cell>
            <Cell w="flex-1">Authority</Cell>
            <Cell w="w-[100px]" right>Lead time</Cell>
            <Cell w="w-[260px]">Trigger source</Cell>
          </Row>
          {result.triggers.map(t => (
            <Row key={t.type + "::" + t.triggerSource}>
              <Cell w="w-[200px]" tone="text2">{PERMIT_TYPE_LABEL[t.type]}</Cell>
              <Cell w="flex-1">{t.authority}</Cell>
              <Cell w="w-[100px]" right mono>{t.estimatedLeadTimeDays} days</Cell>
              <Cell w="w-[260px]"><span className="text-[10px] font-mono text-text4">{t.triggerSource}</span></Cell>
            </Row>
          ))}
        </div>
      )}

      {result.unresolved.length > 0 && (
        <div className="mt-4">
          <div className="text-[10px] uppercase tracking-[0.06em] text-text4 font-mono mb-2">Unresolved candidates ({result.unresolved.length})</div>
          <ul className="space-y-1">
            {result.unresolved.map(u => (
              <li key={u} className="text-[11px] text-text3 font-mono">▸ {u}</li>
            ))}
          </ul>
          <div className="text-[10px] text-text4 font-mono mt-2 leading-snug">
            Unresolved candidates are surfaced to the RCDD reviewer; the predicate library
            should be extended to cover them deterministically before production cutover.
          </div>
        </div>
      )}
    </SectionShell>
  );
}

// ── Tiny table primitives ───────────────────────────────────────────────

function Row({ header, total, children }: { header?: boolean; total?: boolean; children: React.ReactNode }) {
  return (
    <div className={clsx(
      "flex items-stretch border-b border-chrome-dark last:border-b-0",
      header && "bg-chrome-darkest text-[9.5px] uppercase tracking-[0.06em] text-text4 font-mono",
      total  && "bg-warn/5 text-[11px] font-medium",
      !header && !total && "text-[11px]",
    )}>{children}</div>
  );
}

function Cell({ w, right, mono, tone = "text3", children }: {
  w: string; right?: boolean; mono?: boolean;
  tone?: "text2" | "text3" | "warn" | "pass" | "fail";
  children: React.ReactNode;
}) {
  const cls =
    tone === "text2" ? "text-text2"
    : tone === "warn" ? "text-warn"
    : tone === "pass" ? "text-pass"
    : tone === "fail" ? "text-fail"
    : "text-text3";
  return (
    <div className={clsx(
      "px-3 py-1.5 border-r border-chrome-dark/40 last:border-r-0",
      w, right && "text-right", mono && "font-mono tabular-nums", cls,
    )}>{children}</div>
  );
}

function Stat({ label, value, mono, tone = "text2" }: {
  label: string; value: string; mono?: boolean;
  tone?: "text2" | "warn" | "pass" | "info" | "text4";
}) {
  const cls = tone === "warn" ? "text-warn"
            : tone === "pass" ? "text-pass"
            : tone === "info" ? "text-info"
            : tone === "text4" ? "text-text4"
            : "text-text2";
  return (
    <div className="flex flex-col">
      <span className="text-[9.5px] text-text4 font-mono uppercase tracking-[0.06em]">{label}</span>
      <span className={clsx(mono && "font-mono tabular-nums", cls)}>{value}</span>
    </div>
  );
}

function dollars(cents: number): string {
  return "$" + (cents / 100).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}
