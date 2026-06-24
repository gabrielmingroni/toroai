"use client";

import type { DesignParameters, DesignResults } from "@/lib/design/types";

function money(cents: number): string {
  return "$" + Math.round(cents / 100).toLocaleString();
}

export function ResultsPanel({ results, parameters }: { results: DesignResults; parameters: DesignParameters }) {
  return (
    <aside className="lg:sticky lg:top-0 lg:self-start space-y-4">

      {/* Live counts */}
      <div className="card">
        <div className="card-header">
          <div className="card-title">Design output</div>
          <span className="text-[9.5px] text-text4 font-mono">live</span>
        </div>
        <div className="grid grid-cols-2 gap-px bg-chrome-dark">
          <Big label="Design positions" value={results.designPositions.toLocaleString()} sub={`${results.basePositions} base + ${results.growthPositions} growth`} />
          <Big label="Outlets"            value={results.outlets.toLocaleString()}        sub={`${results.ports} total ports`} />
          <Big label="Wireless APs"       value={results.waps}                            sub={`${parameters.wapCoverageRadiusFt}-ft radius coverage`} />
          <Big label="Racks · Panels"     value={`${results.racksRequired} · ${results.panelsRequired}`} sub={`${results.panelsRequired} × 48-port`} />
        </div>
      </div>

      {/* Workarea */}
      <div className="card">
        <div className="card-header"><div className="card-title">Workarea</div></div>
        <div className="card-body">
          <Row k="Confirmed workarea SF" v={results.workareaSf.toLocaleString()} mono />
          <Row k="Density"               v={`${parameters.workareaDensity} SF / WS`} mono />
          <Row k="Base positions"        v={results.basePositions.toLocaleString()} mono />
          <Row k="+ Growth"              v={`+ ${results.growthPositions.toLocaleString()} (${Math.round(parameters.growthFactor * 100)}%)`} mono />
          <Row k="Design positions"      v={results.designPositions.toLocaleString()} mono highlight />
        </div>
      </div>

      {/* Backbone formula */}
      <div className="card">
        <div className="card-header">
          <div className="card-title">Backbone strands · BICSI §13.2</div>
        </div>
        <div className="card-body font-mono text-[11px] text-text2 leading-relaxed whitespace-pre-line">
          {results.backbone.formula}
        </div>
        <div className="px-4 py-2 border-t border-chrome-dark bg-accent/5 flex items-center justify-between">
          <span className="text-[10.5px] text-text3 font-mono">per riser</span>
          <span className="text-[16px] font-semibold text-accent font-mono tabular-nums">
            {results.backbone.perRiser} strands
          </span>
        </div>
      </div>

      {/* BOM */}
      <div className="card">
        <div className="card-header"><div className="card-title">Budget estimate</div></div>
        <div className="card-body">
          <Row k="Materials"  v={money(results.bom.materialCents)} mono />
          <Row k="Labor"      v={`${money(results.bom.laborCents)} (${results.bom.laborHours} hr)`} mono />
          <div className="flex items-center justify-between border-t border-chrome-dark mt-2 pt-2">
            <span className="text-[12px] text-text2 font-medium">Grand total</span>
            <span className="text-[16px] text-pass font-semibold font-mono tabular-nums">{money(results.bom.grandTotalCents)}</span>
          </div>
          <div className="text-[10px] text-text4 font-mono mt-2 leading-relaxed">
            NECA MLU labor model · RSMeans unit pricing.<br />Pre-design estimate; refined by BOM run.
          </div>
        </div>
      </div>

      {/* Tray */}
      <div className="card">
        <div className="card-header"><div className="card-title">Pathways</div></div>
        <div className="card-body">
          <Row k="Tray length (est.)"  v={`${results.trayLength.toLocaleString()} LF`} mono />
          <Row k="Tray fill target"    v={`${(parameters.trayFillTarget * 100).toFixed(0)}%`} mono />
          <div className="text-[10px] text-text4 font-mono mt-2">TIA-569-D §8 · maximum 40% fill</div>
        </div>
      </div>

    </aside>
  );
}

function Big({ label, value, sub }: { label: string; value: string | number; sub?: string }) {
  return (
    <div className="bg-chrome p-3">
      <div className="text-[9.5px] text-text3 uppercase tracking-[0.06em] font-mono">{label}</div>
      <div className="text-[22px] font-semibold text-accent tabular-nums mt-1 mb-0.5">{value}</div>
      {sub && <div className="text-[10px] text-text4 font-mono">{sub}</div>}
    </div>
  );
}

function Row({ k, v, mono = false, highlight = false }: { k: string; v: string | number; mono?: boolean; highlight?: boolean }) {
  return (
    <div className={"flex justify-between py-1.5 text-[11.5px] border-b border-chrome-dark last:border-b-0 " + (highlight ? "text-text font-medium" : "")}>
      <span className="text-text3">{k}</span>
      <span className={(mono ? "font-mono tabular-nums " : "") + (highlight ? "text-accent" : "text-text2")}>{v}</span>
    </div>
  );
}
