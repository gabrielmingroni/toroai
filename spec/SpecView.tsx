"use client";

// CSI 27 specification viewer + generator UI.
//
// "Generate" calls /api/projects/[id]/spec which fires the live Claude call
// (or deterministic mock). The result renders below as collapsible section
// + part cards. Markdown export builds a real spec document the RCDD can
// paste into their submittal package or attach to a bid.

import { useState } from "react";
import clsx from "clsx";
import type { Project } from "@/lib/projects/types";
import type { SpecDocument, SpecSection } from "@/lib/spec/types";
import { SPEC_PART_LABEL } from "@/lib/spec/types";

export function SpecView({
  project, initialDoc,
}: { project: Project; initialDoc: SpecDocument | null }) {
  const [doc, setDoc] = useState<SpecDocument | null>(initialDoc);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function generate() {
    setBusy(true); setError(null);
    try {
      const res = await fetch(`/api/projects/${project.id}/spec`, { method: "POST" });
      const j = await res.json();
      if (!j.ok) {
        setError(j.error?.message ?? "Generation failed.");
      } else {
        setDoc(j.document);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Network error.");
    }
    setBusy(false);
  }

  async function clearDoc() {
    if (!confirm("Clear the generated specification?")) return;
    setBusy(true);
    await fetch(`/api/projects/${project.id}/spec`, { method: "DELETE" });
    setDoc(null); setBusy(false);
  }

  const markdown = doc ? toMarkdown(project, doc) : "";

  return (
    <div className="p-6 max-w-[1000px] mx-auto">

      {/* Header */}
      <header className="mb-5 flex items-start justify-between gap-4">
        <div>
          <h1 className="text-[20px] font-semibold mb-1">CSI Division 27 Specifications</h1>
          <p className="text-[11.5px] text-text3 font-mono">
            Telecommunications specification text generator · 5 sections × 3 parts each
          </p>
        </div>
        <div className="flex items-center gap-2">
          {doc && (
            <a href={`data:text/markdown;charset=utf-8,${encodeURIComponent(markdown)}`}
               download={`${project.number}-csi27-spec.md`}
               className="btn btn-ghost text-[11.5px]">Download .md</a>
          )}
          <button onClick={generate} disabled={busy}
                  className="btn btn-primary text-[12px] px-4 py-2 inline-flex items-center gap-2 disabled:opacity-50">
            <i className="ti ti-wand" style={{ fontSize: 13 }} aria-hidden="true" />
            {busy ? "Generating…" : doc ? "Regenerate" : "Generate specification"}
          </button>
        </div>
      </header>

      {/* Generation note */}
      {!doc && (
        <div className="card mb-5 border-l-2 border-l-accent">
          <div className="card-body">
            <div className="text-[10px] uppercase tracking-[0.06em] text-accent font-mono mb-1">
              Auto-generated · grounded in project state
            </div>
            <p className="text-[12px] text-text2 mb-2">
              Click <span className="text-accent">Generate specification</span> to produce
              a full Division 27 spec document grounded in this project's BOM (real manufacturer SKUs),
              compliance check (which standards apply), and regulatory readiness (which jurisdiction).
              The generator embeds the same 13 engineering rules used by the NPE Two-Call Reasoning
              layer, so the spec is consistent with the BOM, labor estimate, and CPM schedule.
            </p>
            <p className="text-[11px] text-text3">
              When <code className="text-text2 font-mono">ANTHROPIC_API_KEY</code> is set, the generator
              uses Claude for project-specific text. Without it, returns a deterministic mock with
              realistic boilerplate.
            </p>
          </div>
        </div>
      )}

      {/* Metadata bar */}
      {doc && (
        <div className="card mb-5">
          <div className="card-body py-3">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-[11px]">
              <Field label="Sections"   value={String(doc.sections.length)} mono />
              <Field label="Generated"  value={new Date(doc.generatedAt).toLocaleString()} />
              <Field label="Strategy"
                     value={doc.strategy === "live_anthropic_api" ? "live · Claude API" : "deterministic mock"}
                     tone={doc.strategy === "live_anthropic_api" ? "pass" : "text"} />
              <Field label="Tokens"
                     value={doc.tokens ? `${(doc.tokens.input + doc.tokens.output).toLocaleString()}` : "—"}
                     mono />
            </div>
            {doc.warnings && doc.warnings.length > 0 && (
              <div className="mt-3 text-[10.5px] text-warn">
                {doc.warnings.map((w, i) => <div key={i}>• {w}</div>)}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Error toast */}
      {error && (
        <div className="card mb-5 border-l-2 border-l-fail">
          <div className="card-body py-3 text-[11.5px] text-fail font-mono">
            {error}
          </div>
        </div>
      )}

      {/* Sections */}
      {doc && doc.sections.map(s => <SectionCard key={s.number} section={s} />)}

      {doc && (
        <div className="flex items-center gap-3 mt-6">
          <button onClick={clearDoc} className="text-[11px] text-text4 hover:text-fail font-mono">
            Clear generated spec
          </button>
        </div>
      )}

      <footer className="mt-8 text-[10px] text-text4 font-mono leading-snug">
        Generator embeds the 13 engineering rules from the design reasoning prompt so spec text
        stays consistent with the BOM + labor + schedule. Production: DOCX export with project
        header/footer, and a side-by-side diff against the firm's master spec library.
      </footer>
    </div>
  );
}

// ── Section card ────────────────────────────────────────────────────────

function SectionCard({ section }: { section: SpecSection }) {
  return (
    <section className="card mb-5">
      <div className="card-header">
        <div className="card-title">
          <span className="font-mono text-accent mr-2">{section.number}</span>
          {section.title}
        </div>
        <span className="text-[9.5px] text-text4 font-mono uppercase tracking-[0.06em]">
          {section.parts.length} parts · {section.parts.reduce((s, p) => s + p.articles.length, 0)} articles
        </span>
      </div>
      <div className="divide-y divide-chrome-dark">
        {section.parts.map(part => <PartCard key={part.id} part={part} />)}
      </div>
    </section>
  );
}

function PartCard({ part }: { part: SpecSection["parts"][number] }) {
  const [open, setOpen] = useState(true);
  return (
    <div>
      <button
        onClick={() => setOpen(v => !v)}
        className="w-full px-4 py-2 flex items-center gap-2 text-[11px] text-text2 font-medium bg-chrome-darkest/40 hover:bg-chrome-dark/60 text-left"
      >
        <i className={"ti " + (open ? "ti-chevron-down" : "ti-chevron-right")}
           style={{ fontSize: 12 }} aria-hidden="true" />
        <span>{SPEC_PART_LABEL[part.id]}</span>
        <span className="ml-auto text-[9.5px] text-text4 font-mono">{part.articles.length} articles</span>
      </button>
      {open && (
        <div className="px-4 py-3 space-y-3">
          {part.articles.map(a => (
            <div key={a.number}>
              <div className="flex items-baseline gap-3 mb-1">
                <span className="text-[11px] font-mono text-accent">{a.number}</span>
                <span className="text-[11.5px] text-text font-medium uppercase tracking-[0.04em]">{a.title}</span>
              </div>
              <div className="text-[11px] text-text2 leading-relaxed whitespace-pre-wrap pl-12">{a.body}</div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Atoms ───────────────────────────────────────────────────────────────

function Field({ label, value, mono, tone = "text" }: {
  label: string; value: string; mono?: boolean; tone?: "text" | "pass";
}) {
  const cls = tone === "pass" ? "text-pass" : "text-text2";
  return (
    <div className="flex flex-col">
      <span className="text-[9.5px] text-text4 font-mono uppercase tracking-[0.06em]">{label}</span>
      <span className={clsx(mono && "font-mono tabular-nums", cls)}>{value}</span>
    </div>
  );
}

// ── Markdown export ─────────────────────────────────────────────────────

function toMarkdown(project: Project, doc: SpecDocument): string {
  const lines: string[] = [];
  lines.push(`# CSI Division 27 Specification — ${project.name}`);
  lines.push("");
  lines.push(`**Project:** ${project.number}`);
  lines.push(`**Site:** ${project.addressLine1}, ${project.city}, ${project.state} ${project.zip}`);
  lines.push(`**Generated:** ${new Date(doc.generatedAt).toLocaleString()}`);
  lines.push(`**Strategy:** ${doc.strategy}`);
  lines.push("");
  for (const s of doc.sections) {
    lines.push(`## Section ${s.number} — ${s.title}`);
    lines.push("");
    for (const p of s.parts) {
      lines.push(`### ${SPEC_PART_LABEL[p.id]}`);
      lines.push("");
      for (const a of p.articles) {
        lines.push(`**${a.number}  ${a.title}**`);
        lines.push("");
        lines.push(a.body);
        lines.push("");
      }
    }
    lines.push("---");
    lines.push("");
  }
  return lines.join("\n");
}
