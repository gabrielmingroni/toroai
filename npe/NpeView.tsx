// NPE Reasoning view — renders the two-call Claude architecture (TDD §5.5)
// as a single patent-defending artifact. Shows the two system prompts
// verbatim, the Layer-3 entity dictionary, both call inputs/outputs, the
// per-rule trace, the CPM schedule, and a downloadable Primavera P6 XML.

import Link from "next/link";
import clsx from "clsx";
import type { Project } from "@/lib/projects/types";
import type {
  TwoCallBundle, TelecomEntityCategory, CpmActivity,
} from "@/lib/npe/types";
import { TELECOM_ENTITY_LABEL } from "@/lib/npe/types";
import { CALL_1_SYSTEM_PROMPT, CALL_2_SYSTEM_PROMPT, ENGINEERING_RULES } from "@/lib/npe/prompts";

export function NpeView({ project, bundle }: { project: Project; bundle: TwoCallBundle }) {
  return (
    <div className="p-6 max-w-[1200px] mx-auto">
      {/* Header */}
      <header className="mb-5 flex items-start justify-between gap-4">
        <div>
          <h1 className="text-[20px] font-semibold mb-1">Design Reasoning</h1>
          <p className="text-[11.5px] text-text3 font-mono">
            Two-call AI · Strategy: <span className="text-accent">{bundle.strategy}</span> · elapsed {bundle.elapsedMs} ms
          </p>
        </div>
        <Link href={`/projects/${project.id}/enforcement`} className="btn btn-ghost text-[11.5px]">→ Enforcement</Link>
      </header>

      {/* Architecture diagram */}
      <ArchitectureDiagram />

      {/* Layer 3 — Entity dictionary */}
      <section className="card mb-5">
        <div className="card-header">
          <div className="card-title">Telecom-domain entity classification</div>
          <span className="text-[9.5px] text-text4 font-mono uppercase tracking-[0.06em]">10 categories · regex + spaCy NER</span>
        </div>
        <div className="card-body">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-3">
            {(Object.keys(bundle.call1Input.entityDict) as TelecomEntityCategory[]).map(cat => (
              <EntityColumn key={cat} category={cat} entities={bundle.call1Input.entityDict[cat]} />
            ))}
          </div>
          <div className="text-[10px] text-text4 font-mono mt-3 leading-snug">
            Total entities extracted: {Object.values(bundle.call1Input.entityDict).flat().length}.
            Source: regex predicate library (10 telecom-domain categories) + spaCy NER for GPE / ORG / DATE.
          </div>
        </div>
      </section>

      {/* Call 1 — System prompt + I/O */}
      <CallSection
        title="Call 1 — BOM + Labor SOV generation"
        citation="13 engineering rules embedded in system prompt"
        prompt={CALL_1_SYSTEM_PROMPT}
        tokensIn={bundle.call1Output.estimatedTokens.input}
        tokensOut={bundle.call1Output.estimatedTokens.output}
        rightHeader="Output"
      >
        <Call1IO bundle={bundle} />
      </CallSection>

      {/* Rule trace */}
      <section className="card mb-5">
        <div className="card-header">
          <div className="card-title">Engineering rule trace</div>
          <span className="text-[9.5px] text-text4 font-mono uppercase tracking-[0.06em]">13 rules · per-item application</span>
        </div>
        <div className="card-body p-0">
          <div className="divide-y divide-chrome-dark">
            {ENGINEERING_RULES.map(r => {
              const app = bundle.call1Output.ruleApplications.find(a => a.ruleNumber === r.n);
              return (
                <div key={r.n} className="px-4 py-2 flex items-start gap-3">
                  <span className="w-7 h-6 flex items-center justify-center text-[10px] font-mono bg-accent/10 text-accent rounded-[2px]">{r.n}</span>
                  <div className="flex-1 min-w-0">
                    <div className="text-[11.5px] text-text2">{r.name}</div>
                    {app ? (
                      <div className="text-[10.5px] text-text4 mt-0.5">
                        Applied to <span className="text-text3">{app.appliedTo.length}</span> item{app.appliedTo.length === 1 ? "" : "s"}
                        {app.note && <span className="ml-2">· {app.note}</span>}
                      </div>
                    ) : (
                      <div className="text-[10.5px] text-text4 mt-0.5">No specific application traced for this rule on this project.</div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* Call 2 — System prompt + I/O */}
      <CallSection
        title="Call 2 — Critical Path Schedule generation"
        citation="Production-rate constrained · uses corrected wages from enforcement"
        prompt={CALL_2_SYSTEM_PROMPT}
        tokensIn={bundle.call2Output.estimatedTokens.input}
        tokensOut={bundle.call2Output.estimatedTokens.output}
        rightHeader="Output (CPM + P6)"
      >
        <Call2IO bundle={bundle} />
      </CallSection>

      <footer className="mt-6 text-[10px] text-text4 font-mono leading-snug">
        Two-call sequence completed in {bundle.elapsedMs} ms at strategy
        <span className="text-text3"> {bundle.strategy}</span>. Live
        <code className="px-1 text-text3">live_anthropic_api</code> strategy
        can be swapped in behind the same orchestrator interface.
      </footer>
    </div>
  );
}

// ── Architecture diagram ─────────────────────────────────────────────────

function ArchitectureDiagram() {
  return (
    <section className="card mb-5 border-l-2 border-l-accent">
      <div className="card-body py-3">
        <div className="text-[10px] uppercase tracking-[0.06em] text-accent font-mono mb-2">Two-call architecture</div>
        <div className="flex items-center gap-2 text-[10.5px] font-mono text-text2 flex-wrap">
          <span className="px-2 py-1 bg-chrome-darkest rounded-[2px]">L2 OCR + CAD</span>
          <span className="text-text4">→</span>
          <span className="px-2 py-1 bg-chrome-darkest rounded-[2px]">L3 NLP entities</span>
          <span className="text-text4">→</span>
          <span className="px-2 py-1 bg-accent/15 text-accent rounded-[2px]">Call 1 (BOM + Labor)</span>
          <span className="text-text4">→</span>
          <span className="px-2 py-1 bg-warn/15 text-warn rounded-[2px]">Enforcement</span>
          <span className="text-text4">→</span>
          <span className="px-2 py-1 bg-accent/15 text-accent rounded-[2px]">Call 2 (CPM + P6)</span>
          <span className="text-text4">→</span>
          <span className="px-2 py-1 bg-chrome-darkest rounded-[2px]">Gate / Delivery</span>
        </div>
        <div className="text-[10px] text-text4 font-mono mt-2 leading-snug">
          Call 2 is strictly sequenced after Call 1; enforcement sits between them so the CPM
          uses corrected labor rates and clamped production rates.
        </div>
      </div>
    </section>
  );
}

// ── Entity column ───────────────────────────────────────────────────────

function EntityColumn({
  category, entities,
}: { category: TelecomEntityCategory; entities: TwoCallBundle["call1Input"]["entityDict"][TelecomEntityCategory] }) {
  return (
    <div className="border border-chrome-dark rounded-[2px] bg-chrome-darkest p-2">
      <div className="text-[9.5px] uppercase tracking-[0.06em] text-text4 font-mono mb-1.5">
        {TELECOM_ENTITY_LABEL[category]}
        <span className="ml-1 text-text4">· {entities.length}</span>
      </div>
      <ul className="space-y-0.5">
        {entities.length === 0 && <li className="text-[10.5px] text-text4 font-mono">—</li>}
        {entities.map((e, i) => (
          <li key={i} className="text-[10.5px] text-text2 leading-snug">
            <span className="font-mono text-text3 text-[9.5px]">{(e.confidence * 100).toFixed(0)}%</span>{" "}
            {e.text}
          </li>
        ))}
      </ul>
    </div>
  );
}

// ── Call section shell ──────────────────────────────────────────────────

function CallSection({
  title, citation, prompt, tokensIn, tokensOut, rightHeader, children,
}: {
  title: string; citation: string; prompt: string;
  tokensIn: number; tokensOut: number; rightHeader: string;
  children: React.ReactNode;
}) {
  return (
    <section className="card mb-5">
      <div className="card-header">
        <div className="card-title">{title}</div>
        <span className="text-[9.5px] text-text4 font-mono uppercase tracking-[0.06em]">{citation}</span>
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-2 divide-y lg:divide-y-0 lg:divide-x divide-chrome-dark">
        {/* Left — system prompt */}
        <div className="p-4">
          <div className="text-[9.5px] uppercase tracking-[0.06em] text-text4 font-mono mb-2">System prompt</div>
          <pre className="text-[10px] text-text2 font-mono leading-snug bg-chrome-darkest border border-chrome-dark rounded-[2px] p-3 overflow-x-auto whitespace-pre-wrap max-h-[440px] overflow-y-auto">
{prompt}
          </pre>
          <div className="text-[9.5px] text-text4 font-mono mt-2">
            Token estimate · input {tokensIn.toLocaleString()} · output {tokensOut.toLocaleString()}
          </div>
        </div>
        {/* Right — I/O */}
        <div className="p-4">
          <div className="text-[9.5px] uppercase tracking-[0.06em] text-text4 font-mono mb-2">{rightHeader}</div>
          {children}
        </div>
      </div>
    </section>
  );
}

// ── Call 1 input / output ───────────────────────────────────────────────

function Call1IO({ bundle }: { bundle: TwoCallBundle }) {
  const c1 = bundle.call1Output;
  return (
    <div className="space-y-3">
      <Counters items={[
        { label: "BOM line items", value: c1.bomLineItems.length },
        { label: "Labor tasks",     value: c1.laborTasks.length },
        { label: "Permit candidates", value: c1.permitCandidates.length },
      ]} />

      <div>
        <div className="text-[9.5px] uppercase tracking-[0.06em] text-text4 font-mono mb-1">BOM (top 5 line items)</div>
        <div className="border border-chrome-dark rounded-[2px] overflow-hidden">
          {c1.bomLineItems.slice(0, 5).map(b => (
            <div key={b.id} className="px-3 py-1.5 flex items-baseline justify-between text-[11px] border-b border-chrome-dark/40 last:border-b-0">
              <div className="flex-1 min-w-0 truncate">
                <span className="text-text4 font-mono">{b.id}</span> <span className="text-text2">{b.description}</span>
                {b.connectorSpec && <span className={clsx("ml-2 font-mono text-[9.5px]", b.connectorSpec === "LC_APC" ? "text-fail" : "text-text4")}>
                  · {b.connectorSpec.replace("_", "/")}
                </span>}
              </div>
              <span className="text-text3 font-mono tabular-nums text-[10.5px]">{b.quantity} {b.unit}</span>
            </div>
          ))}
        </div>
      </div>

      <div>
        <div className="text-[9.5px] uppercase tracking-[0.06em] text-text4 font-mono mb-1">Labor SOV (all tasks)</div>
        <div className="border border-chrome-dark rounded-[2px] overflow-hidden">
          {c1.laborTasks.map(t => (
            <div key={t.id} className="px-3 py-1.5 flex items-baseline justify-between text-[11px] border-b border-chrome-dark/40 last:border-b-0">
              <div className="flex-1 min-w-0 truncate">
                <span className="text-text4 font-mono">{t.id}</span> <span className="text-text2">{t.description}</span>
                <div className="text-[9.5px] text-text4 font-mono mt-0.5">{t.classification} · {t.crewSize}-man · {t.hours}h</div>
              </div>
              <span className="text-text3 font-mono tabular-nums text-[10.5px]">${t.proposedRateUsdHr.toFixed(2)}/hr</span>
            </div>
          ))}
        </div>
      </div>

      <div>
        <div className="text-[9.5px] uppercase tracking-[0.06em] text-text4 font-mono mb-1">Permit candidates ({c1.permitCandidates.length})</div>
        <div className="text-[10.5px] text-text3 font-mono leading-snug">
          {c1.permitCandidates.join(" · ")}
        </div>
      </div>
    </div>
  );
}

// ── Call 2 input / output ───────────────────────────────────────────────

function Call2IO({ bundle }: { bundle: TwoCallBundle }) {
  const c2 = bundle.call2Output;
  const critical = new Set(c2.criticalPath);
  return (
    <div className="space-y-3">
      <Counters items={[
        { label: "Activities",   value: c2.cpmActivities.length },
        { label: "Critical path", value: c2.criticalPath.length },
        { label: "Total duration", value: c2.totalDurationDays + " days" },
      ]} />

      <div>
        <div className="text-[9.5px] uppercase tracking-[0.06em] text-text4 font-mono mb-1">CPM activities</div>
        <div className="border border-chrome-dark rounded-[2px] overflow-hidden max-h-[260px] overflow-y-auto">
          {c2.cpmActivities.map(a => <ActivityRow key={a.id} activity={a} critical={critical.has(a.id)} />)}
        </div>
      </div>

      <div>
        <div className="text-[9.5px] uppercase tracking-[0.06em] text-text4 font-mono mb-1">Milestones</div>
        <div className="border border-chrome-dark rounded-[2px] overflow-hidden">
          {c2.milestones.map(m => (
            <div key={m.id} className="px-3 py-1.5 flex items-baseline justify-between text-[11px] border-b border-chrome-dark/40 last:border-b-0">
              <div><span className="text-text4 font-mono">{m.id}</span> <span className="text-text2">{m.name}</span></div>
              <span className="text-text3 font-mono tabular-nums text-[10.5px]">Day {m.dayIndex}</span>
            </div>
          ))}
        </div>
      </div>

      <div>
        <div className="flex items-center justify-between mb-1">
          <div className="text-[9.5px] uppercase tracking-[0.06em] text-text4 font-mono">Primavera P6 XML</div>
          <a
            href={`data:application/xml;charset=utf-8,${encodeURIComponent(c2.primaveraP6Xml)}`}
            download={`${bundle.projectId}-cpm.xml`}
            className="text-[10px] text-accent hover:underline font-mono"
          >Download .xml</a>
        </div>
        <pre className="text-[9.5px] text-text3 font-mono leading-snug bg-chrome-darkest border border-chrome-dark rounded-[2px] p-2 overflow-x-auto max-h-[200px] overflow-y-auto whitespace-pre-wrap">
{c2.primaveraP6Xml}
        </pre>
      </div>
    </div>
  );
}

function ActivityRow({ activity, critical }: { activity: CpmActivity; critical: boolean }) {
  return (
    <div className={clsx(
      "px-3 py-1.5 grid grid-cols-12 gap-2 items-baseline text-[11px] border-b border-chrome-dark/40 last:border-b-0",
      critical && "bg-fail/[0.04]",
    )}>
      <span className="col-span-1 text-text4 font-mono">{activity.id}</span>
      <span className="col-span-5 text-text2 truncate">{activity.name}</span>
      <span className="col-span-1 text-text4 font-mono tabular-nums text-right">{activity.durationDays}d</span>
      <span className="col-span-1 text-text4 font-mono tabular-nums text-right">ES {activity.earlyStart}</span>
      <span className="col-span-1 text-text4 font-mono tabular-nums text-right">EF {activity.earlyFinish}</span>
      <span className="col-span-1 text-text4 font-mono tabular-nums text-right">TF {activity.totalFloat}</span>
      <span className="col-span-2 text-right">
        {critical && <span className="text-[9.5px] font-mono uppercase tracking-[0.06em] text-fail">critical</span>}
      </span>
    </div>
  );
}

// ── Helpers ──────────────────────────────────────────────────────────────

function Counters({ items }: { items: Array<{ label: string; value: string | number }> }) {
  return (
    <div className="grid grid-cols-3 gap-2">
      {items.map(it => (
        <div key={it.label} className="border border-chrome-dark rounded-[2px] p-2 bg-chrome-darkest">
          <div className="text-[9.5px] uppercase tracking-[0.06em] text-text4 font-mono">{it.label}</div>
          <div className="text-[14px] text-text font-semibold tabular-nums leading-tight mt-0.5">{it.value}</div>
        </div>
      ))}
    </div>
  );
}
