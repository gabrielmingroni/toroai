"use client";

import clsx from "clsx";

export type LayerKey =
  | "rooms" | "walls" | "doors" | "outlets" | "waps"
  | "tray" | "cableRuns" | "coverage"
  | "grid" | "titleBlock" | "trEquipment";

export type LayerState = Record<LayerKey, boolean>;

export const DEFAULT_LAYERS: LayerState = {
  rooms:        true,
  walls:        true,
  doors:        true,
  outlets:      true,
  waps:         true,
  tray:         true,
  cableRuns:    true,
  coverage:     true,
  grid:         true,
  titleBlock:   true,
  trEquipment:  true,
};

const SECTIONS: { title: string; items: { key: LayerKey; label: string }[] }[] = [
  { title: "Architecture", items: [
    { key: "rooms",       label: "Room fills" },
    { key: "walls",       label: "Walls" },
    { key: "doors",       label: "Doors" },
    { key: "grid",        label: "Column grid" },
    { key: "titleBlock",  label: "Title block" },
  ]},
  { title: "ICT", items: [
    { key: "outlets",     label: "Outlets" },
    { key: "waps",        label: "Wireless APs" },
    { key: "coverage",    label: "WAP coverage" },
    { key: "tray",        label: "Cable tray" },
    { key: "cableRuns",   label: "Cable runs" },
    { key: "trEquipment", label: "TR equipment" },
  ]},
];

export function LayerPanel({ value, onChange }: { value: LayerState; onChange: (k: LayerKey, v: boolean) => void }) {
  return (
    <div className="w-[200px] bg-chrome border-l border-chrome-dark flex-shrink-0 overflow-y-auto">
      <div className="px-3 py-2 border-b border-chrome-dark bg-chrome-dark">
        <div className="text-[10px] uppercase tracking-[0.06em] text-text3 font-mono">Layers</div>
      </div>
      {SECTIONS.map(section => (
        <div key={section.title} className="border-b border-chrome-dark py-1.5">
          <div className="px-3 pt-1.5 pb-1 text-[9.5px] uppercase tracking-[0.06em] text-text4 font-mono">{section.title}</div>
          {section.items.map(item => (
            <label key={item.key}
              className={clsx(
                "flex items-center gap-2 px-3 py-1 cursor-pointer text-[11.5px]",
                value[item.key] ? "text-text2 hover:text-text" : "text-text4 hover:text-text3",
              )}
            >
              <input
                type="checkbox"
                checked={value[item.key]}
                onChange={(e) => onChange(item.key, e.target.checked)}
                className="w-3 h-3 accent-accent"
              />
              <span>{item.label}</span>
            </label>
          ))}
        </div>
      ))}
    </div>
  );
}
