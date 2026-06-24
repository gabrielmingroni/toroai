"use client";

// NPE Reasoning workspace — wraps NpeView in the Revit-style AppFrame so
// the two-call Claude architecture (TDD §5.5) reads as patent-grade
// engineering software rather than a SaaS report.

import { useState } from "react";
import Link from "next/link";
import type { Project } from "@/lib/projects/types";
import type { TwoCallBundle } from "@/lib/npe/types";
import type { TwoCallBundleWithDiagnostics } from "@/lib/npe/orchestrator";
import { NpeView } from "@/components/npe/NpeView";
import { AppFrame } from "@/components/shell/cad/AppFrame";
import { RibbonBar, type RibbonTabId } from "@/components/shell/cad/RibbonBar";
import { ToolPalette, type ToolGroup } from "@/components/shell/cad/ToolPalette";
import { ProjectBrowser, type BrowserNode } from "@/components/shell/cad/ProjectBrowser";
import { PropertiesPalette, type PropertySection } from "@/components/shell/cad/PropertiesPalette";
import { StatusBar } from "@/components/shell/cad/StatusBar";

export function NpeWorkspace({
  project, identity, bundle,
}: { project: Project; identity?: string; bundle: TwoCallBundle | TwoCallBundleWithDiagnostics }) {
  const warnings = (bundle as TwoCallBundleWithDiagnostics).warnings;
  const notes    = (bundle as TwoCallBundleWithDiagnostics).notes;
  const [activeTab, setActiveTab] = useState<RibbonTabId>("ai_assist");
  const [activeToolId, setActiveToolId] = useState<string>("trace");

  // ── Tool palette ─────────────────────────────────────────────────────
  const toolGroups: ToolGroup[] = [
    {
      id: "reasoning", label: "Reasoning", tools: [
        { id: "call1",  icon: "ti-prompt",        label: "Call 1" },
        { id: "call2",  icon: "ti-prompt",        label: "Call 2" },
        { id: "trace",  icon: "ti-list-tree",     label: "Rule Trace" },
      ],
    },
    {
      id: "inspect", label: "Inspect", tools: [
        { id: "entities", icon: "ti-tags",        label: "Entities" },
        { id: "bom",      icon: "ti-receipt",     label: "BOM" },
        { id: "labor",    icon: "ti-users",       label: "Labor SOV" },
        { id: "schedule", icon: "ti-calendar",    label: "Schedule" },
      ],
    },
    {
      id: "export", label: "Export", tools: [
        { id: "p6",       icon: "ti-file-export",     label: "P6 XML" },
        { id: "json",     icon: "ti-braces",          label: "JSON" },
      ],
    },
    {
      id: "verify", label: "Verify", tools: [
        { id: "enforcement", icon: "ti-gavel",        label: "Enforce" },
        { id: "compliance",  icon: "ti-shield-check", label: "Compliance" },
        { id: "regulatory",  icon: "ti-clipboard-list", label: "Regulatory" },
      ],
    },
  ];

  // ── Project Browser ──────────────────────────────────────────────────
  const browserSections: BrowserNode[] = [
    {
      id: "npe", label: "Document Intake", icon: "ti-cpu",
      children: [
        { id: "l1", label: "Layer 1 · File routing" },
        { id: "l2", label: "Layer 2 · OCR + CAD parsing" },
        { id: "l3", label: "Layer 3 · NER entities", meta: `${Object.values(bundle.call1Input.entityDict).flat().length}` },
        { id: "l4", label: "Layer 4 · Two-call AI" },
      ],
    },
    {
      id: "calls", label: "Calls", icon: "ti-stack-2",
      children: [
        { id: "call-1", label: "Call 1 · BOM + Labor",   meta: bundle.call1Output.estimatedTokens.input + bundle.call1Output.estimatedTokens.output + "t" },
        { id: "call-2", label: "Call 2 · CPM + P6",       meta: bundle.call2Output.estimatedTokens.input + bundle.call2Output.estimatedTokens.output + "t" },
      ],
    },
    {
      id: "outputs", label: "Outputs", icon: "ti-package",
      children: [
        { id: "out-bom",       label: "BOM line items",      meta: `${bundle.call1Output.bomLineItems.length}` },
        { id: "out-labor",     label: "Labor tasks",          meta: `${bundle.call1Output.laborTasks.length}` },
        { id: "out-permits",   label: "Permit candidates",    meta: `${bundle.call1Output.permitCandidates.length}` },
        { id: "out-cpm",       label: "CPM activities",       meta: `${bundle.call2Output.cpmActivities.length}` },
        { id: "out-critical",  label: "Critical path",        meta: `${bundle.call2Output.criticalPath.length}` },
        { id: "out-p6",        label: "Primavera P6 XML",     meta: "ready" },
      ],
    },
  ];

  // ── Properties palette ───────────────────────────────────────────────
  const totalIn  = bundle.call1Output.estimatedTokens.input  + bundle.call2Output.estimatedTokens.input;
  const totalOut = bundle.call1Output.estimatedTokens.output + bundle.call2Output.estimatedTokens.output;
  const ranAt = new Date(bundle.ranAt);
  const propsSections: PropertySection[] = [
    {
      id: "run", label: "Run", defaultOpen: true,
      rows: [
        { label: "Project",   value: project.number, mono: true },
        { label: "Strategy",  value: bundle.strategy, mono: true, tone: "text2" },
        { label: "Ran at",    value: ranAt.toLocaleTimeString(), mono: true },
        { label: "Elapsed",   value: `${bundle.elapsedMs} ms`, mono: true },
      ],
    },
    {
      id: "tokens", label: "Token estimate", defaultOpen: true,
      rows: [
        { label: "Call 1 in",  value: bundle.call1Output.estimatedTokens.input.toLocaleString(),  mono: true },
        { label: "Call 1 out", value: bundle.call1Output.estimatedTokens.output.toLocaleString(), mono: true },
        { label: "Call 2 in",  value: bundle.call2Output.estimatedTokens.input.toLocaleString(),  mono: true },
        { label: "Call 2 out", value: bundle.call2Output.estimatedTokens.output.toLocaleString(), mono: true },
        { label: "Total in",   value: totalIn.toLocaleString(),  mono: true, tone: "text2" },
        { label: "Total out",  value: totalOut.toLocaleString(), mono: true, tone: "text2" },
      ],
    },
    {
      id: "rule-trace", label: "Rule trace", defaultOpen: true,
      rows: bundle.call1Output.ruleApplications.map(r => ({
        label: `Rule ${r.ruleNumber}`,
        value: `${r.appliedTo.length} item${r.appliedTo.length === 1 ? "" : "s"}`,
        mono: true,
        tone: "text2",
      })),
    },
    {
      id: "schedule", label: "Schedule summary", defaultOpen: true,
      rows: [
        { label: "Activities",      value: String(bundle.call2Output.cpmActivities.length), mono: true },
        { label: "Critical path",   value: String(bundle.call2Output.criticalPath.length),  mono: true, tone: "warn" },
        { label: "Total duration",  value: `${bundle.call2Output.totalDurationDays} days`,  mono: true },
        { label: "Milestones",      value: String(bundle.call2Output.milestones.length),    mono: true },
      ],
    },
  ];

  return (
    <AppFrame
      title={`${project.name}.toro`}
      identity={identity ?? `${project.owner} · ${project.number}`}
      ribbon={<RibbonBar active={activeTab} onChange={setActiveTab} />}
      toolPalette={
        <ToolPalette
          groups={toolGroups}
          activeToolId={activeToolId}
          onTool={setActiveToolId}
          trailing={
            <>
              <span className="text-text4">Strategy:</span>
              <span className={
                bundle.strategy === "live_anthropic_api"
                  ? "text-pass font-medium"
                  : "text-text3"
              }>
                {bundle.strategy === "live_anthropic_api" ? "live · Claude API" : "deterministic mock"}
              </span>
              {warnings && warnings.length > 0 && (
                <span className="text-warn ml-2" title={warnings.join("\n")}>
                  <i className="ti ti-alert-triangle" style={{ fontSize: 11 }} aria-hidden="true" /> {warnings.length}
                </span>
              )}
              <Link href={`/projects/${project.id}`} className="ml-3 text-info hover:text-accent text-[11px] inline-flex items-center gap-1">
                <i className="ti ti-arrow-left" style={{ fontSize: 11 }} aria-hidden="true" /> Project
              </Link>
            </>
          }
        />
      }
      browser={
        <ProjectBrowser
          projectName={project.name}
          sections={browserSections}
          currentNodeId="call-1"
        />
      }
      canvas={
        <div className="w-full h-full overflow-y-auto bg-canvas-bg">
          {notes && notes.length > 0 && (
            <div className="mx-6 mt-4 px-4 py-2 border border-info/40 border-l-2 border-l-info bg-info/10 rounded-[2px] text-[11px] text-canvas-text">
              <div className="text-info font-medium mb-1">
                <i className="ti ti-info-circle" style={{ fontSize: 12 }} aria-hidden="true" />{" "}
                Input source
              </div>
              <ul className="leading-snug">
                {notes.map((n, i) => (<li key={i} className="text-canvas-text2">· {n}</li>))}
              </ul>
            </div>
          )}
          {warnings && warnings.length > 0 && (
            <div className="mx-6 mt-3 px-4 py-2 border border-warn/40 border-l-2 border-l-warn bg-warn/10 rounded-[2px] text-[11px] text-canvas-text">
              <div className="text-warn font-medium mb-1">
                <i className="ti ti-alert-triangle" style={{ fontSize: 12 }} aria-hidden="true" />{" "}
                {warnings.length} warning{warnings.length === 1 ? "" : "s"} during run
              </div>
              <ul className="leading-snug">
                {warnings.map((w, i) => (<li key={i} className="text-canvas-text2">· {w}</li>))}
              </ul>
            </div>
          )}
          <NpeView project={project} bundle={bundle} />
        </div>
      }
      properties={
        <PropertiesPalette
          selectionLabel="Two-call run"
          selectionSubtitle={bundle.strategy}
          selectionIcon="ti-cpu"
          selectionTone="accent"
          sections={propsSections}
        />
      }
      status={
        <StatusBar
          segments={[
            { kind: "coord", text: `Call 1 + Call 2 · ${bundle.elapsedMs} ms` },
            { kind: "pass", icon: "ti-circle-check", text: "OK" },
            { text: `${bundle.call2Output.totalDurationDays} day schedule` },
            { kind: "warn", text: `${bundle.call2Output.criticalPath.length} on critical path` },
          ]}
          trailing={[
            { icon: "ti-prompt", text: `Tokens ${(totalIn + totalOut).toLocaleString()}` },
            { text: "| Strategy:" },
            { kind: "info", text: bundle.strategy },
          ]}
        />
      }
    />
  );
}
