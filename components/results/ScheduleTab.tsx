"use client";

import type { ScheduleResult, ScheduleTask } from "@/lib/results/types";

function money(cents: number): string {
  return "$" + Math.round(cents / 100).toLocaleString();
}

export function ScheduleTab({ schedule }: { schedule: ScheduleResult }) {
  const { tasks, totalDays } = schedule;
  const totalCost = tasks.reduce((s, t) => s + t.costCents, 0);

  // Gantt sizing: each day = 18px; left col = 220px task names
  const DAY_W = 18;
  const ROW_H = 28;
  const NAME_W = 280;
  const ganttW = NAME_W + totalDays * DAY_W + 20;

  return (
    <div className="p-6">
      <div className="flex items-baseline justify-between mb-3">
        <div>
          <h2 className="text-[14px] font-semibold">Construction schedule</h2>
          <div className="text-[10.5px] text-text3 font-mono mt-0.5">
            CSI MasterFormat Div 27 · NECA MLU labor units · {totalDays} working days · {money(totalCost)} total
          </div>
        </div>
      </div>

      <div className="card overflow-x-auto">
        <div className="relative" style={{ width: ganttW, minHeight: tasks.length * ROW_H + 40 }}>
          {/* Day axis */}
          <div className="flex border-b border-chrome-dark sticky top-0 bg-chrome-dark z-10" style={{ paddingLeft: NAME_W }}>
            {Array.from({ length: totalDays }).map((_, d) => (
              <div key={d} className="flex-shrink-0 text-center text-[9px] font-mono text-text4 py-1.5" style={{ width: DAY_W }}>
                {d % 5 === 0 ? d + 1 : ""}
              </div>
            ))}
          </div>

          {/* Rows */}
          {tasks.map((t, i) => (
            <div key={t.id} className="flex items-center border-b border-chrome-dark last:border-b-0" style={{ height: ROW_H }}>
              {/* Task name + WBS + duration */}
              <div className="flex-shrink-0 px-3 flex items-center gap-2" style={{ width: NAME_W }}>
                <span className="text-[10px] font-mono text-text4 tabular-nums w-[60px]">{t.wbs}</span>
                <span className="text-[11.5px] text-text2 truncate flex-1">{t.name}</span>
                <span className="text-[10px] font-mono text-text3 tabular-nums">{t.durationDays}d</span>
              </div>
              {/* Bar */}
              <div className="relative flex-1 h-full">
                <div
                  className="absolute top-1/2 -translate-y-1/2 rounded-[2px] flex items-center justify-end pr-1.5 text-[9.5px] font-mono text-white tabular-nums"
                  style={{
                    left: t.startDay * DAY_W,
                    width: t.durationDays * DAY_W,
                    height: 14,
                    background: t.color,
                    opacity: 0.9,
                  }}
                >
                  {money(t.costCents)}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="mt-3 text-[10.5px] text-text4 font-mono">
        Bars use CSI MasterFormat Division 27 colors. Cost shown is per-task NECA MLU labor + materials extended.
      </div>
    </div>
  );
}
