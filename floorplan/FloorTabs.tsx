"use client";

import clsx from "clsx";

export function FloorTabs({ floors, active, onChange }: { floors: number[]; active: number; onChange: (n: number) => void }) {
  if (floors.length <= 1) {
    return (
      <div className="bg-chrome border-b border-chrome-dark px-4 py-1 text-[11px] font-mono text-text3">
        Floor {active}
      </div>
    );
  }
  return (
    <div className="bg-chrome border-b border-chrome-dark px-4 flex items-center">
      {floors.map(f => (
        <button
          key={f}
          onClick={() => onChange(f)}
          className={clsx(
            "px-3 py-1.5 text-[11.5px] font-medium border-b-2 transition-colors -mb-px",
            active === f
              ? "border-accent text-accent"
              : "border-transparent text-text3 hover:text-text",
          )}
        >
          Floor {f}
        </button>
      ))}
    </div>
  );
}
