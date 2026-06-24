"use client";

// Ribbon-style tabbed bar. Matches the contextual ribbon pattern used by
// Revit + AutoCAD — eight tabs, the active one rendered with the panel
// background and a top accent line.

import clsx from "clsx";

export type RibbonTabId =
  | "home" | "insert" | "annotate" | "modify"
  | "analyze" | "view" | "manage" | "ai_assist";

export interface RibbonTabDef {
  id: RibbonTabId;
  label: string;
}

export const RIBBON_TABS: RibbonTabDef[] = [
  { id: "home",      label: "Home" },
  { id: "insert",    label: "Insert" },
  { id: "annotate",  label: "Annotate" },
  { id: "modify",    label: "Modify" },
  { id: "analyze",   label: "Analyze" },
  { id: "view",      label: "View" },
  { id: "manage",    label: "Manage" },
  { id: "ai_assist", label: "AI Assist" },
];

export function RibbonBar({
  active, onChange,
}: {
  active: RibbonTabId;
  onChange?: (id: RibbonTabId) => void;
}) {
  return (
    <div className="bg-chrome border-b border-chrome-darkest px-1 flex items-end h-[26px]">
      {RIBBON_TABS.map(t => {
        const isActive = t.id === active;
        const isAi = t.id === "ai_assist";
        return (
          <button
            key={t.id}
            onClick={() => onChange?.(t.id)}
            className={clsx(
              "px-3.5 pt-1 pb-1.5 text-[11.5px] font-sans transition-colors",
              isActive
                ? "bg-chrome-light text-text border-t border-l border-r border-chrome-lighter -mb-px font-medium"
                : isAi
                  ? "text-accent hover:text-accent-strong"
                  : "text-text3 hover:text-text",
            )}
          >
            {t.label}
          </button>
        );
      })}
    </div>
  );
}
