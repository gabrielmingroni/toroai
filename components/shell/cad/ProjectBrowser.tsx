"use client";

// Project Browser — left sidebar tree. Matches Revit's Project Browser:
// project root at top, expandable nodes for Floors / Views / Sheets /
// Schedules / Families. Selected leaf highlights in amber.

import clsx from "clsx";
import { useState } from "react";

export interface BrowserNode {
  id: string;
  label: string;
  /** Optional href — leaf nodes link to a page. Branches don't. */
  href?: string;
  /** Tabler icon class without "ti " prefix. */
  icon?: string;
  /** Children nodes — if present, this is a branch. */
  children?: BrowserNode[];
  /** Subtitle text — useful for showing sheet revision / count. */
  meta?: string;
}

export function ProjectBrowser({
  projectName, sections, currentNodeId, onSelect,
}: {
  projectName: string;
  sections: BrowserNode[];
  currentNodeId?: string;
  onSelect?: (node: BrowserNode) => void;
}) {
  return (
    <div className="font-sans">
      <div className="bg-chrome-light px-3 py-1.5 text-[11px] text-text font-medium border-b border-chrome-darkest">
        Project Browser
      </div>
      <div className="py-1.5">
        <div className="px-3 py-1 flex items-center gap-1.5 text-[11.5px] text-text">
          <i className="ti ti-folder-open text-accent" style={{ fontSize: 13 }} aria-hidden="true" />
          <span className="font-medium truncate">{projectName}</span>
        </div>
        {sections.map(n => (
          <TreeNode key={n.id} node={n} depth={1} currentNodeId={currentNodeId} onSelect={onSelect} />
        ))}
      </div>
    </div>
  );
}

function TreeNode({
  node, depth, currentNodeId, onSelect,
}: {
  node: BrowserNode; depth: number;
  currentNodeId?: string;
  onSelect?: (n: BrowserNode) => void;
}) {
  const [expanded, setExpanded] = useState(true);
  const hasChildren = !!node.children?.length;
  const isCurrent = currentNodeId === node.id;
  const indent = depth * 14;

  function activate() {
    if (hasChildren) setExpanded(v => !v);
    if (!hasChildren) onSelect?.(node);
  }

  return (
    <>
      <button
        onClick={activate}
        className={clsx(
          "w-full text-left px-3 py-[2px] flex items-center gap-1 text-[11.5px] transition-colors",
          isCurrent
            ? "bg-chrome-lighter text-accent"
            : "text-text2 hover:bg-chrome-light hover:text-text",
        )}
        style={{ paddingLeft: 12 + indent }}
      >
        {hasChildren ? (
          <i
            className={"ti " + (expanded ? "ti-chevron-down" : "ti-chevron-right")}
            style={{ fontSize: 11, color: "var(--toroai-text-tertiary, #8a8e95)" }}
            aria-hidden="true"
          />
        ) : (
          <span style={{ width: 11, display: "inline-block" }} />
        )}
        {node.icon && (
          <i className={"ti " + node.icon} style={{ fontSize: 12 }} aria-hidden="true" />
        )}
        <span className="truncate flex-1">{node.label}</span>
        {node.meta && (
          <span className="text-[10px] text-text4 font-mono ml-2 flex-shrink-0">{node.meta}</span>
        )}
      </button>
      {hasChildren && expanded && (
        node.children!.map(child => (
          <TreeNode key={child.id} node={child} depth={depth + 1} currentNodeId={currentNodeId} onSelect={onSelect} />
        ))
      )}
    </>
  );
}
