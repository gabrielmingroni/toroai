// AppFrame — top-level CAD shell composer.
//
// Layout mirrors Revit's main window:
//   ┌──────────────────────────────────────────────────────────────────┐
//   │  Title bar  (project filename · user identity)                   │
//   ├──────────────────────────────────────────────────────────────────┤
//   │  Ribbon  (Home / Insert / Annotate / Modify / View / Manage / …) │
//   │  ─ Tool palette (grouped icon+label buttons)                     │
//   ├────────────┬────────────────────────────────────┬────────────────┤
//   │  Project   │                                    │   Properties   │
//   │  Browser   │           Drawing canvas           │   Palette      │
//   │  (220px)   │                                    │   (260px)      │
//   ├────────────┴────────────────────────────────────┴────────────────┤
//   │  Status bar  (coords · scale · snap · save state · active tool)  │
//   └──────────────────────────────────────────────────────────────────┘
//
// Each region is a slot — pages compose their own content into the
// `browser`, `canvas`, and `properties` props. The shell handles the
// chrome itself.

import type { ReactNode } from "react";

export interface AppFrameProps {
  /** Title bar — typically project filename. */
  title: string;
  /** Subtitle on the title bar (right side) — typically user identity. */
  identity?: string;
  /** Ribbon component (tabs). */
  ribbon: ReactNode;
  /** Tool palette below the ribbon. */
  toolPalette: ReactNode;
  /** Left sidebar — Project Browser. */
  browser: ReactNode;
  /** Center pane — the drawing canvas. */
  canvas: ReactNode;
  /** Right sidebar — Properties palette. */
  properties: ReactNode;
  /** Status bar at the bottom. */
  status: ReactNode;
}

export function AppFrame({
  title, identity, ribbon, toolPalette, browser, canvas, properties, status,
}: AppFrameProps) {
  return (
    <div className="h-full flex flex-col bg-chrome overflow-hidden font-sans">

      {/* Title bar */}
      <div className="h-7 flex items-center px-3 bg-chrome-dark text-text2 text-[11.5px] border-b border-chrome-darkest flex-shrink-0">
        <div className="flex items-center gap-1.5 mr-3">
          <span className="w-2.5 h-2.5 rounded-full bg-[#ed6a5e]" />
          <span className="w-2.5 h-2.5 rounded-full bg-[#f4be4f]" />
          <span className="w-2.5 h-2.5 rounded-full bg-[#61c554]" />
        </div>
        <span className="text-accent font-medium mr-2">ToroAI</span>
        <span className="text-text4 mr-2">—</span>
        <span className="truncate">{title}</span>
        {identity && (
          <span className="ml-auto text-text4 text-[10.5px]">{identity}</span>
        )}
      </div>

      {/* Ribbon (tabs) */}
      <div className="flex-shrink-0">{ribbon}</div>

      {/* Tool palette (under ribbon) */}
      <div className="flex-shrink-0">{toolPalette}</div>

      {/* Body — three columns */}
      <div className="flex-1 grid grid-cols-[220px_minmax(0,1fr)_260px] min-h-0">

        {/* Project Browser */}
        <aside className="bg-chrome border-r border-chrome-darkest overflow-y-auto min-h-0">
          {browser}
        </aside>

        {/* Drawing canvas */}
        <section className="bg-canvas-bg min-h-0 overflow-hidden relative">
          {canvas}
        </section>

        {/* Properties Palette */}
        <aside className="bg-chrome border-l border-chrome-darkest overflow-y-auto min-h-0">
          {properties}
        </aside>

      </div>

      {/* Status bar */}
      <div className="flex-shrink-0">{status}</div>

    </div>
  );
}
