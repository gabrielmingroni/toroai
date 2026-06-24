"use client";

import clsx from "clsx";
import type { IntakeJob } from "@/lib/intake/types";

type SubStep = "upload" | "ingest" | "rooms" | "trs" | "confirm";

const STEPS: { id: SubStep; label: string; hint: string }[] = [
  { id: "upload",  label: "Upload",        hint: "Architectural backgrounds" },
  { id: "ingest",  label: "Ingestion",     hint: "Extract · Classify · Score" },
  { id: "rooms",   label: "Review Rooms",  hint: "Confirm room schedule" },
  { id: "trs",     label: "Confirm TRs",   hint: "Telecom rooms" },
  { id: "confirm", label: "Finalize",      hint: "Lock + launch design" },
];

export function StageStepper({ substep, job, onJump }: { substep: SubStep; job: IntakeJob | null; onJump: (s: SubStep) => void }) {
  const reached = STEPS.findIndex(s => s.id === substep);
  return (
    <div className="bg-chrome-dark border-b border-divider px-6 py-2.5">
      <div className="flex items-center gap-2 max-w-[1100px]">
        {STEPS.map((s, i) => {
          const isPast = i < reached;
          const isCurrent = i === reached;
          const isFuture = i > reached;
          return (
            <div key={s.id} className="flex items-center gap-2 flex-1">
              <button
                onClick={() => !isFuture && onJump(s.id)}
                disabled={isFuture}
                className={clsx(
                  "flex items-center gap-2 text-left min-w-0",
                  isFuture && "cursor-not-allowed",
                )}
              >
                <span className={clsx(
                  "w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-mono font-medium flex-shrink-0",
                  isPast    && "bg-pass text-chrome-darkest",
                  isCurrent && "bg-accent text-chrome-darkest",
                  isFuture  && "bg-chrome border border-chrome-lighter text-text4",
                )}>
                  {isPast ? "✓" : (i + 1)}
                </span>
                <div className="min-w-0">
                  <div className={clsx(
                    "text-[11.5px] font-medium leading-tight truncate",
                    isCurrent ? "text-text" : isPast ? "text-text2" : "text-text4",
                  )}>
                    {s.label}
                  </div>
                  <div className={clsx("text-[10px] font-mono leading-tight truncate", isCurrent ? "text-text3" : "text-text4")}>
                    {s.hint}
                  </div>
                </div>
              </button>
              {i < STEPS.length - 1 && (
                <div className={clsx("h-px flex-1", i < reached ? "bg-pass" : "bg-chrome-lighter")} />
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
