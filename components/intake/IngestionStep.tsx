"use client";

import clsx from "clsx";
import type { Project } from "@/lib/projects/types";
import type { IntakeJob, IntakeStage } from "@/lib/intake/types";
import { PIPELINE_STAGES, STAGE_LABEL } from "@/lib/intake/types";

const STAGE_HINTS: Record<IntakeStage, string> = {
  queued:           "Waiting for runner",
  extracting_text:  "pdfplumber + pymupdf; OCR fallback for scanned pages",
  assembling_rooms: "Geometric segmentation builds rooms from walls + door openings",
  classifying:      "Claude classifies each room from extracted labels + geometry",
  scoring_trs:      "13-factor deterministic algorithm ranks TR / IDF candidates",
  ready_for_review: "Awaiting RCDD review",
  confirmed:        "Locked",
  failed:           "Failed",
};

function StageRow({ stage, currentStage, diagCounts }: { stage: IntakeStage; currentStage: IntakeStage; diagCounts: string }) {
  const order = PIPELINE_STAGES as readonly IntakeStage[];
  const idx = order.indexOf(stage);
  const cur = order.indexOf(currentStage);
  const past = cur > idx || currentStage === "ready_for_review" || currentStage === "confirmed";
  const active = cur === idx;

  return (
    <div className={clsx(
      "border-b border-chrome-dark last:border-b-0 px-4 py-3 flex items-center gap-4 transition-colors",
      active && "bg-accent/5",
    )}>
      <div className={clsx(
        "w-7 h-7 rounded-full flex items-center justify-center text-[11px] font-mono font-medium flex-shrink-0",
        past   ? "bg-pass text-chrome-darkest" :
        active ? "bg-accent text-chrome-darkest animate-pulse" :
                 "bg-chrome-dark border border-chrome-lighter text-text4",
      )}>
        {past ? "✓" : idx + 1}
      </div>
      <div className="flex-1 min-w-0">
        <div className={clsx("text-[12.5px] font-medium",
          past ? "text-text2" : active ? "text-text" : "text-text4",
        )}>
          {STAGE_LABEL[stage]}
        </div>
        <div className="text-[10.5px] text-text3 font-mono mt-0.5">{STAGE_HINTS[stage]}</div>
      </div>
      <div className="text-[11px] text-text3 font-mono tabular-nums flex-shrink-0">{diagCounts}</div>
    </div>
  );
}

export function IngestionStep({ project, job, onReset }: { project: Project; job: IntakeJob; onReset: () => void }) {
  const counts: Record<IntakeStage, string> = {
    queued: "",
    extracting_text:  job.diagnostics.pagesExtracted > 0 ? `${job.diagnostics.pagesExtracted} pages` : "—",
    assembling_rooms: job.diagnostics.roomsDetected > 0  ? `${job.diagnostics.roomsDetected} rooms`  : "—",
    classifying:      job.diagnostics.classifiedHigh > 0
      ? `${job.diagnostics.classifiedHigh} high · ${job.diagnostics.classifiedLow} low conf`
      : "—",
    scoring_trs:      job.diagnostics.trsRecommended > 0 ? `${job.diagnostics.trsRecommended} TRs ranked` : "—",
    ready_for_review: "",
    confirmed: "",
    failed: "",
  };

  const pct = Math.round(job.progress * 100);

  return (
    <div>
      <header className="mb-4 flex items-start justify-between gap-4">
        <div>
          <h1 className="text-[18px] font-semibold mb-0.5">Ingesting documents</h1>
          <p className="text-[11.5px] text-text3 font-mono">
            {job.files.length} file{job.files.length !== 1 ? "s" : ""} · {project.number} · started {new Date(job.startedAt).toLocaleTimeString()}
          </p>
        </div>
        <button onClick={onReset} className="btn btn-ghost text-[11px]">Cancel and restart</button>
      </header>

      {/* Overall progress */}
      <div className="card mb-4">
        <div className="card-body py-4">
          <div className="flex items-baseline justify-between mb-2">
            <div className="text-[12px] text-text2">{STAGE_LABEL[job.stage]}</div>
            <div className="text-[12px] font-mono text-accent tabular-nums">{pct}%</div>
          </div>
          <div className="h-1 bg-chrome-darkest rounded-full overflow-hidden">
            <div className="h-full bg-accent transition-all duration-300" style={{ width: pct + "%" }} />
          </div>
        </div>
      </div>

      {/* Stage breakdown */}
      <div className="card mb-4">
        <div className="card-header">
          <div className="card-title">Pipeline</div>
        </div>
        <div>
          {PIPELINE_STAGES.map(s => (
            <StageRow key={s} stage={s} currentStage={job.stage} diagCounts={counts[s]} />
          ))}
        </div>
      </div>

      {/* Files */}
      <div className="card">
        <div className="card-header"><div className="card-title">Files</div></div>
        <ul className="card-body p-0">
          {job.files.map(f => (
            <li key={f.id} className="flex items-center gap-3 px-3.5 py-2.5 border-b border-chrome-dark last:border-b-0">
              <span className="inline-flex items-center justify-center w-10 h-7 bg-chrome-dark border border-chrome-lighter rounded-[2px] text-[9.5px] font-mono text-text2">
                {f.kind.toUpperCase()}
              </span>
              <div className="flex-1 min-w-0">
                <div className="text-[12px] text-text2 truncate">{f.name}</div>
                <div className="text-[10.5px] text-text4 font-mono">
                  {(f.sizeBytes / 1024 / 1024).toFixed(1)} MB
                  {f.pages !== null && ` · ${f.pages} pages`}
                </div>
              </div>
              <span className={clsx(
                "text-[10px] font-mono uppercase tracking-[0.06em] px-2 py-0.5 rounded-[2px]",
                f.status === "parsed" ? "text-pass bg-pass/10" :
                f.status === "failed" ? "text-fail bg-fail/10" :
                "text-info bg-info/10",
              )}>{f.status === "parsed" ? "Parsed" : f.status === "failed" ? "Failed" : "Processing"}</span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
