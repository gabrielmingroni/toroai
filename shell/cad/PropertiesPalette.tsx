"use client";

// Properties Palette — right sidebar. Matches Revit's Properties palette:
// element name + type at top, then collapsible sections each containing a
// label-value pair list.

import clsx from "clsx";
import { useState } from "react";
import type { ReactNode } from "react";

export interface PropertyRow {
  label: string;
  /** Value — string or component (e.g., status pill). */
  value: ReactNode;
  /** Whether the value uses monospace (lengths, IDs, codes). */
  mono?: boolean;
  /** Tone for the value text. */
  tone?: "text" | "text2" | "pass" | "warn" | "fail";
}

export interface PropertySection {
  id: string;
  label: string;
  rows?: PropertyRow[];
  /** Custom content overrides rows. */
  body?: ReactNode;
  defaultOpen?: boolean;
}

export function PropertiesPalette({
  selectionLabel, selectionSubtitle, selectionIcon, selectionTone = "accent",
  sections, empty,
}: {
  selectionLabel?: string;
  selectionSubtitle?: string;
  selectionIcon?: string;       // Tabler icon class without "ti "
  selectionTone?: "accent" | "info" | "warn" | "pass";
  sections: PropertySection[];
  /** Shown when there's no selection. */
  empty?: ReactNode;
}) {
  const hasSelection = !!selectionLabel;
  return (
    <div className="font-sans">
      <div className="bg-chrome-light px-3 py-1.5 text-[11px] text-text font-medium border-b border-chrome-darkest">
        Properties
      </div>
      {!hasSelection ? (
        <div className="px-3 py-4 text-[11px] text-text3">
          {empty ?? "Select an element to see its properties."}
        </div>
      ) : (
        <>
          <div className="px-3 py-2 border-b border-chrome-darkest">
            <div className="flex items-center gap-1.5">
              {selectionIcon && (
                <i className={"ti " + selectionIcon}
                   style={{ fontSize: 14, color: toneColor(selectionTone) }}
                   aria-hidden="true" />
              )}
              <span className="text-[11.5px] text-text font-medium">{selectionLabel}</span>
            </div>
            {selectionSubtitle && (
              <div className="text-[10.5px] text-text3 mt-0.5 truncate">{selectionSubtitle}</div>
            )}
          </div>
          {sections.map(s => <Section key={s.id} section={s} />)}
        </>
      )}
    </div>
  );
}

function Section({ section }: { section: PropertySection }) {
  const [open, setOpen] = useState(section.defaultOpen ?? true);
  return (
    <div className="border-b border-chrome-darkest">
      <button
        onClick={() => setOpen(v => !v)}
        className="w-full bg-chrome-light/60 hover:bg-chrome-light px-3 py-1 flex items-center gap-1 text-[10.5px] text-text3 uppercase tracking-[0.05em] font-sans"
      >
        <i className={"ti " + (open ? "ti-chevron-down" : "ti-chevron-right")}
           style={{ fontSize: 11 }} aria-hidden="true" />
        <span>{section.label}</span>
      </button>
      {open && (
        <div className="px-3 py-1.5">
          {section.body ?? (section.rows ?? []).map((row, i) => (
            <Row key={i} row={row} />
          ))}
        </div>
      )}
    </div>
  );
}

function Row({ row }: { row: PropertyRow }) {
  return (
    <div className="flex justify-between items-baseline py-0.5 text-[11.5px]">
      <span className="text-text3">{row.label}</span>
      <span className={clsx(
        row.mono && "font-mono tabular-nums text-[11px]",
        row.tone === "pass" ? "text-pass"
        : row.tone === "warn" ? "text-warn"
        : row.tone === "fail" ? "text-fail"
        : row.tone === "text2" ? "text-text2"
        : "text-text",
      )}>{row.value}</span>
    </div>
  );
}

function toneColor(t: "accent" | "info" | "warn" | "pass"): string {
  switch (t) {
    case "accent": return "#f6a623";
    case "info":   return "#4a90d6";
    case "warn":   return "#c9931f";
    case "pass":   return "#3fae5d";
  }
}
