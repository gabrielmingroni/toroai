"use client";

import clsx from "clsx";
import type { LossResult } from "@/lib/results/types";

export function LossTab({ loss }: { loss: LossResult }) {
  return (
    <div className="p-6 max-w-[1100px]">
      <h2 className="text-[14px] font-semibold mb-1">Fiber loss budget</h2>
      <div className="text-[10.5px] text-text3 font-mono mb-4">
        OM4 multimode · IEC 61280-4-1 · attenuation 3.5 dB/km @ 850 nm · 0.3 dB per connector
      </div>

      {loss.runs.length === 0 && (
        <div className="card p-6 text-[11.5px] text-text3">
          No backbone runs to budget — single-story project.
        </div>
      )}

      {loss.runs.length > 0 && (
        <div className="card overflow-hidden">
          <table className="w-full">
            <thead className="bg-chrome-dark">
              <tr>
                <Th>Run ID</Th>
                <Th>Description</Th>
                <Th className="text-right w-[90px]">Length (m)</Th>
                <Th className="w-[140px]">Application</Th>
                <Th className="text-right w-[100px]">Budget (dB)</Th>
                <Th className="text-right w-[100px]">Loss (dB)</Th>
                <Th className="text-right w-[100px]">Margin (dB)</Th>
                <Th className="w-[80px]">Status</Th>
              </tr>
            </thead>
            <tbody>
              {loss.runs.map(r => (
                <tr key={r.id} className="border-b border-chrome-dark last:border-b-0">
                  <td className="px-3 py-2.5 text-[11.5px] text-text2 font-mono">{r.id}</td>
                  <td className="px-3 py-2.5 text-[11.5px] text-text2">{r.description}</td>
                  <td className="px-3 py-2.5 text-[11.5px] text-right text-text2 font-mono tabular-nums">{r.lengthM.toFixed(1)}</td>
                  <td className="px-3 py-2.5 text-[10.5px] text-text3 font-mono">{r.application}</td>
                  <td className="px-3 py-2.5 text-[11.5px] text-right text-text2 font-mono tabular-nums">{r.budgetDb.toFixed(2)}</td>
                  <td className="px-3 py-2.5 text-[11.5px] text-right text-text2 font-mono tabular-nums">{r.computedLossDb.toFixed(2)}</td>
                  <td className={clsx("px-3 py-2.5 text-[11.5px] text-right font-mono tabular-nums",
                    r.marginDb > 1.0 ? "text-pass" : r.marginDb > 0.1 ? "text-warn" : "text-fail")}>
                    {r.marginDb.toFixed(2)}
                  </td>
                  <td className="px-3 py-2.5">
                    <span className={clsx(
                      "inline-block px-2 py-0.5 rounded-[2px] text-[10.5px] font-mono uppercase tracking-[0.06em]",
                      r.passes ? "bg-pass/15 text-pass" : "bg-fail/15 text-fail",
                    )}>{r.passes ? "Pass" : "Fail"}</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function Th({ children, className }: { children: React.ReactNode; className?: string }) {
  return <th className={"px-3 py-2.5 text-left font-mono text-[10px] uppercase tracking-[0.06em] text-text3 font-medium " + (className ?? "")}>{children}</th>;
}
