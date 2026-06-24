"use client";

import React from "react";
import type { BomResult, BomLineItem } from "@/lib/results/types";

function money(cents: number, decimals = 2): string {
  return "$" + (cents / 100).toLocaleString(undefined, { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
}

function exportCsv(bom: BomResult) {
  const rows: string[] = ["Category,Description,Qty,Unit,Unit Price,Extended,Citation"];
  for (const i of bom.items) {
    rows.push([i.category, `"${i.desc.replace(/"/g, '""')}"`, i.qty, i.unit, (i.unitPriceCents / 100).toFixed(2), (i.extendedCents / 100).toFixed(2), i.citation ?? ""].join(","));
  }
  rows.push(`Materials subtotal,,,,, ${(bom.materialSubtotalCents / 100).toFixed(2)},`);
  rows.push(`Labor (${bom.laborHours} hr @ $${(bom.laborRateCentsPerHr / 100).toFixed(2)}/hr),,,,, ${(bom.laborSubtotalCents / 100).toFixed(2)},`);
  rows.push(`Grand total,,,,, ${(bom.grandTotalCents / 100).toFixed(2)},`);
  const blob = new Blob([rows.join("\n")], { type: "text/csv" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = "bom.csv"; a.click();
  URL.revokeObjectURL(url);
}

export function BomTab({ bom }: { bom: BomResult }) {
  // Group by category, preserving original ordering
  const order: string[] = [];
  const grouped = new Map<string, BomLineItem[]>();
  for (const i of bom.items) {
    if (!grouped.has(i.category)) { grouped.set(i.category, []); order.push(i.category); }
    grouped.get(i.category)!.push(i);
  }

  return (
    <div className="p-6 max-w-[1100px]">
      <div className="flex items-baseline justify-between mb-3">
        <div>
          <h2 className="text-[14px] font-semibold">Bill of Materials</h2>
          <div className="text-[10.5px] text-text3 font-mono">RSMeans unit pricing · NECA MLU labor</div>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => exportCsv(bom)} className="btn btn-ghost text-[11px]">Export CSV</button>
        </div>
      </div>

      <div className="card overflow-hidden">
        <table className="w-full">
          <thead className="bg-chrome-dark">
            <tr>
              <Th>Description</Th>
              <Th className="text-right w-[80px]">Qty</Th>
              <Th className="w-[60px]">Unit</Th>
              <Th className="text-right w-[110px]">Unit price</Th>
              <Th className="text-right w-[110px]">Extended</Th>
              <Th className="w-[160px]">Citation</Th>
            </tr>
          </thead>
          <tbody>
            {order.map(cat => (
              <React.Fragment key={cat}>
                <tr>
                  <td colSpan={6} className="bg-chrome-light px-3 py-1.5 text-[10px] font-mono uppercase tracking-[0.06em] text-text2 border-y border-chrome-dark">{cat}</td>
                </tr>
                {grouped.get(cat)!.map((i, idx) => (
                  <tr key={cat + idx} className="border-b border-chrome-dark hover:bg-chrome-light/50">
                    <td className="px-3 py-2 text-[11.5px] text-text2">{i.desc}</td>
                    <td className="px-3 py-2 text-[11.5px] text-right text-text2 font-mono tabular-nums">{i.qty.toLocaleString()}</td>
                    <td className="px-3 py-2 text-[11.5px] text-text3 font-mono">{i.unit}</td>
                    <td className="px-3 py-2 text-[11.5px] text-right text-text2 font-mono tabular-nums">{money(i.unitPriceCents, 2)}</td>
                    <td className="px-3 py-2 text-[11.5px] text-right text-text font-mono tabular-nums">{money(i.extendedCents, 2)}</td>
                    <td className="px-3 py-2 text-[10px] text-text4 font-mono">{i.citation ?? ""}</td>
                  </tr>
                ))}
              </React.Fragment>
            ))}
            <tr className="border-t-2 border-chrome-lighter">
              <td colSpan={4} className="px-3 py-2 text-right text-[12px] text-text2 font-medium">Materials subtotal</td>
              <td className="px-3 py-2 text-right text-[12px] text-text font-mono tabular-nums">{money(bom.materialSubtotalCents)}</td>
              <td></td>
            </tr>
            <tr>
              <td colSpan={4} className="px-3 py-2 text-right text-[12px] text-text2 font-medium">
                Labor · {bom.laborHours} hr @ ${(bom.laborRateCentsPerHr / 100).toFixed(2)}/hr
              </td>
              <td className="px-3 py-2 text-right text-[12px] text-text font-mono tabular-nums">{money(bom.laborSubtotalCents)}</td>
              <td></td>
            </tr>
            <tr className="bg-chrome-dark">
              <td colSpan={4} className="px-3 py-2.5 text-right text-[13px] text-text font-semibold">Grand total</td>
              <td className="px-3 py-2.5 text-right text-[15px] text-pass font-semibold font-mono tabular-nums">{money(bom.grandTotalCents)}</td>
              <td></td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
}

function Th({ children, className }: { children: React.ReactNode; className?: string }) {
  return <th className={"px-3 py-2.5 text-left font-mono text-[10px] uppercase tracking-[0.06em] text-text3 font-medium " + (className ?? "")}>{children}</th>;
}
