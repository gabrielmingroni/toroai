"use client";

// Tool palette — appears below the ribbon and shows the active ribbon
// tab's tools grouped by function. Matches the Revit pattern where each
// group has icon+label buttons and a small group label at the bottom.

import clsx from "clsx";
import type { ReactNode } from "react";

export interface ToolDef {
  id: string;
  /** Tabler icon class without the "ti " prefix (e.g. "ti-route"). */
  icon: string;
  label: string;
  /** Disabled state. Disabled tools render but don't fire onClick. */
  disabled?: boolean;
}

export interface ToolGroup {
  id: string;
  /** Label rendered along the bottom of the group. */
  label: string;
  tools: ToolDef[];
}

export function ToolPalette({
  groups, activeToolId, onTool, trailing,
}: {
  groups: ToolGroup[];
  activeToolId?: string;
  onTool?: (toolId: string) => void;
  /** Optional right-hand content (e.g. context controls, properties). */
  trailing?: ReactNode;
}) {
  return (
    <div className="bg-chrome-light px-2 py-1.5 border-b border-chrome-darkest flex items-stretch gap-0 h-[80px]">
      {groups.map((g, idx) => (
        <div key={g.id} className={clsx(
          "flex flex-col px-2",
          idx < groups.length - 1 && "border-r border-chrome-lighter",
        )}>
          <div className="flex-1 flex items-center gap-1">
            {g.tools.map(t => (
              <ToolButton
                key={t.id}
                def={t}
                active={t.id === activeToolId}
                onClick={() => !t.disabled && onTool?.(t.id)}
              />
            ))}
          </div>
          <div className="text-[9.5px] text-text4 text-center pt-0.5 border-t border-chrome-lighter font-sans">
            {g.label}
          </div>
        </div>
      ))}
      {trailing && (
        <div className="ml-auto flex items-center pr-2 gap-2 text-[11px] text-text3">{trailing}</div>
      )}
    </div>
  );
}

function ToolButton({
  def, active, onClick,
}: { def: ToolDef; active: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      disabled={def.disabled}
      title={def.label}
      className={clsx(
        "flex flex-col items-center justify-center w-[54px] py-1.5 px-1 rounded-[1px] border transition-colors font-sans",
        active
          ? "bg-chrome-lighter text-accent border-accent/60"
          : def.disabled
            ? "text-text4 border-transparent cursor-not-allowed opacity-50"
            : "text-text2 border-transparent hover:bg-chrome-lighter hover:text-text",
      )}
    >
      <i className={"ti " + def.icon} style={{ fontSize: 22, lineHeight: 1 }} aria-hidden="true" />
      <span className="text-[9.5px] mt-1 leading-none">{def.label}</span>
    </button>
  );
}
