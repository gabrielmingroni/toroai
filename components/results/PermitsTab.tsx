"use client";

import { useState } from "react";
import clsx from "clsx";
import type { PermitsResult, PermitStatus } from "@/lib/results/types";

function money(cents: number): string {
  return "$" + (cents / 100).toLocaleString(undefined, { minimumFractionDigits: 0 });
}

const STATUS_LABEL: Record<PermitStatus, string> = {
  required: "Required",
  filed:    "Filed",
  approved: "Approved",
  n_a:      "N/A",
};
const STATUS_CLASS: Record<PermitStatus, string> = {
  required: "bg-warn/15 text-warn",
  filed:    "bg-info/15 text-info",
  approved: "bg-pass/15 text-pass",
  n_a:      "bg-chrome-dark text-text3",
};

export function PermitsTab({ permits }: { permits: PermitsResult }) {
  // Track local status overrides (UI-only — would persist via PATCH in real backend)
  const [status, setStatus] = useState<Record<string, PermitStatus>>(
    Object.fromEntries(permits.permits.map(p => [p.id, p.status]))
  );

  function advance(id: string) {
    setStatus(prev => {
      const cur = prev[id];
      const next: PermitStatus = cur === "required" ? "filed" : cur === "filed" ? "approved" : "required";
      return { ...prev, [id]: next };
    });
  }

  const totalFee = permits.permits.reduce((s, p) => s + p.feeCents, 0);

  return (
    <div className="p-6 max-w-[900px]">
      <h2 className="text-[15px] font-semibold mb-3">Permits &amp; AHJ</h2>

      {/* AHJ block */}
      <div className="card mb-5">
        <div className="card-header"><div className="card-title">Authority having jurisdiction</div></div>
        <div className="card-body grid grid-cols-2 gap-x-6 gap-y-1.5 text-[11.5px]">
          <Row k="AHJ"            v={permits.ahj.name} />
          <Row k="Contact"        v={permits.ahj.contact} />
          <Row k="PE stamp"       v={permits.ahj.requiresPeStamp ? "Required" : "Not required"} tone={permits.ahj.requiresPeStamp ? "warn" : "pass"} />
          <Row k="RCDD stamp"     v={permits.ahj.requiresRcddStamp ? "Required" : "Not required"} tone={permits.ahj.requiresRcddStamp ? "warn" : "pass"} />
        </div>
      </div>

      {/* Permits list */}
      <div className="card overflow-hidden mb-5">
        <table className="w-full">
          <thead className="bg-chrome-dark">
            <tr>
              <Th>Permit</Th>
              <Th>Form</Th>
              <Th className="text-right w-[100px]">Fee</Th>
              <Th className="text-right w-[90px]">Days</Th>
              <Th className="w-[140px]">Status</Th>
            </tr>
          </thead>
          <tbody>
            {permits.permits.map(p => (
              <tr key={p.id} className="border-b border-chrome-dark last:border-b-0">
                <td className="px-3 py-2.5">
                  <div className="text-[12px] text-text2">{p.name}</div>
                  <div className="text-[10px] text-text4 font-mono mt-0.5">{p.citation}</div>
                </td>
                <td className="px-3 py-2.5 text-[11.5px] text-text3 font-mono">{p.form}</td>
                <td className="px-3 py-2.5 text-[11.5px] text-right text-text2 font-mono tabular-nums">{p.feeCents > 0 ? money(p.feeCents) : "—"}</td>
                <td className="px-3 py-2.5 text-[11.5px] text-right text-text2 font-mono tabular-nums">{p.processingDays}</td>
                <td className="px-3 py-2.5">
                  <button
                    onClick={() => advance(p.id)}
                    className={clsx(
                      "px-2 py-0.5 text-[10.5px] font-mono uppercase tracking-[0.06em] rounded-[2px]",
                      STATUS_CLASS[status[p.id]]
                    )}
                  >
                    {STATUS_LABEL[status[p.id]]}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="text-[11px] text-text3 font-mono">
        Total fees: <span className="text-text2">{money(totalFee)}</span>{" · "}
        Click a status pill to cycle Required → Filed → Approved.
      </div>
    </div>
  );
}

function Row({ k, v, tone }: { k: string; v: string; tone?: "pass" | "warn" }) {
  return (
    <div className="flex justify-between">
      <span className="text-text3">{k}</span>
      <span className={tone === "warn" ? "text-warn" : tone === "pass" ? "text-pass" : "text-text2"}>{v}</span>
    </div>
  );
}
function Th({ children, className }: { children: React.ReactNode; className?: string }) {
  return <th className={"px-3 py-2.5 text-left font-mono text-[10px] uppercase tracking-[0.06em] text-text3 font-medium " + (className ?? "")}>{children}</th>;
}
