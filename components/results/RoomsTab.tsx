"use client";

import { useMemo, useState } from "react";
import clsx from "clsx";
import type { RoomScheduleResult } from "@/lib/results/types";
import { ROOM_TYPE_LABEL } from "@/lib/intake/types";

export function RoomsTab({ rooms }: { rooms: RoomScheduleResult }) {
  const [floor, setFloor] = useState<number | "all">("all");
  const floors = useMemo(() => {
    const set = new Set(rooms.items.map(r => r.floor));
    return Array.from(set).sort((a, b) => a - b);
  }, [rooms]);

  const filtered = useMemo(() => floor === "all" ? rooms.items : rooms.items.filter(r => r.floor === floor), [rooms, floor]);
  const totalArea = filtered.reduce((s, r) => s + r.area, 0);

  return (
    <div className="p-6 max-w-[1100px]">
      <div className="flex items-baseline justify-between mb-3">
        <div>
          <h2 className="text-[14px] font-semibold">Room schedule</h2>
          <div className="text-[10.5px] text-text3 font-mono mt-0.5">
            {filtered.length} room{filtered.length !== 1 ? "s" : ""} · {totalArea.toLocaleString()} SF total
          </div>
        </div>
        <select
          className="input w-auto text-[12px]"
          value={floor}
          onChange={(e) => setFloor(e.target.value === "all" ? "all" : Number(e.target.value))}
        >
          <option value="all">All floors</option>
          {floors.map(f => <option key={f} value={f}>Floor {f}</option>)}
        </select>
      </div>

      <div className="card overflow-hidden">
        <table className="w-full">
          <thead className="bg-chrome-dark">
            <tr>
              <Th className="w-[100px]">Room ID</Th>
              <Th>Name</Th>
              <Th className="w-[180px]">Type</Th>
              <Th className="text-right w-[100px]">Area (SF)</Th>
              <Th className="text-center w-[80px]">Floor</Th>
              <Th className="w-[100px]">Confirmed</Th>
              <Th className="w-[80px]">Source</Th>
            </tr>
          </thead>
          <tbody>
            {filtered.map(r => (
              <tr key={r.id} className="border-b border-chrome-dark last:border-b-0 hover:bg-chrome-light/50">
                <td className="px-3 py-2 text-[11.5px] font-mono text-text2">{r.id}</td>
                <td className="px-3 py-2 text-[11.5px] text-text2">{r.name}</td>
                <td className="px-3 py-2 text-[11.5px] text-text3">{ROOM_TYPE_LABEL[r.type as keyof typeof ROOM_TYPE_LABEL] ?? r.type}</td>
                <td className="px-3 py-2 text-[11.5px] text-right text-text2 font-mono tabular-nums">{r.area.toLocaleString()}</td>
                <td className="px-3 py-2 text-[11.5px] text-center text-text2 font-mono">{r.floor}</td>
                <td className={clsx("px-3 py-2 text-[11px] font-mono uppercase tracking-[0.06em]",
                  r.confirmed ? "text-pass" : "text-warn")}>
                  {r.confirmed ? "Yes" : "Pending"}
                </td>
                <td className="px-3 py-2 text-[10.5px] text-text3 font-mono">{r.source}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function Th({ children, className }: { children: React.ReactNode; className?: string }) {
  return <th className={"px-3 py-2.5 text-left font-mono text-[10px] uppercase tracking-[0.06em] text-text3 font-medium " + (className ?? "")}>{children}</th>;
}
