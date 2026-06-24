// Bill of Materials view — Division 27 itemized BOM with grouping by CSI
// spec section, manufacturer SKUs, quantity derivations, section subtotals,
// labor estimate, tax, grand total. CSV + Markdown export for the submittal.
//
// This is what an RCDD actually attaches to a bid. Every line ties back to
// a real catalog item with a derivation note explaining where the quantity
// came from, so a reviewer can audit the BOM in seconds.

import type { BomDocument, BomLine } from "@/lib/bom/types";

export function BomView({ document }: { document: BomDocument }) {
  const csv = toCsv(document);
  const markdown = toMarkdown(document);
  return (
    <div className="p-6 max-w-[1200px] mx-auto">
      <header className="mb-5 flex items-start justify-between gap-4">
        <div>
          <h1 className="text-[20px] font-semibold mb-1">Bill of Materials</h1>
          <p className="text-[11.5px] text-text3 font-mono">
            CSI Division 27 · {document.lineItems.length} line items · generated {new Date(document.generatedAt).toLocaleString()}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <a
            href={`data:text/csv;charset=utf-8,${encodeURIComponent(csv)}`}
            download={`${document.project.number}-bom.csv`}
            className="btn btn-ghost text-[11.5px]"
          >Download .csv</a>
          <a
            href={`data:text/markdown;charset=utf-8,${encodeURIComponent(markdown)}`}
            download={`${document.project.number}-bom.md`}
            className="btn btn-ghost text-[11.5px]"
          >Download .md</a>
        </div>
      </header>

      {/* Project header */}
      <div className="card mb-5">
        <div className="card-body py-3">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-[11.5px]">
            <Field label="Project number" value={document.project.number} mono />
            <Field label="Project name"   value={document.project.name} />
            <Field label="Owner"          value={document.project.owner} />
            <Field label="Site"           value={document.project.address} />
          </div>
        </div>
      </div>

      {/* Totals summary */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-2.5 mb-5">
        <Tile label="Material subtotal"  value={dollars(document.materialSubtotalCents)} />
        <Tile label="Labor"               value={`${document.labor.hours} hr · ${dollars(document.labor.subtotalCents)}`} />
        <Tile label="Tax"                 value={`${(document.tax.rate * 100).toFixed(2)}% · ${dollars(document.tax.cents)}`} />
        <Tile label="Grand total"         value={dollars(document.grandTotalCents)} highlight />
      </div>

      {/* Section rollup */}
      <section className="card mb-5">
        <div className="card-header">
          <div className="card-title">Section rollup · {document.sections.length}</div>
          <span className="text-[9.5px] text-text4 font-mono uppercase tracking-[0.06em]">CSI MasterFormat Division 27</span>
        </div>
        <div className="divide-y divide-chrome-dark">
          {document.sections.map(s => (
            <div key={s.section} className="px-4 py-2 flex items-baseline gap-3 text-[11.5px]">
              <span className="text-text2 flex-1 truncate">{s.section}</span>
              <span className="text-text4 font-mono text-[10.5px] w-[80px] text-right">{s.itemCount} item{s.itemCount === 1 ? "" : "s"}</span>
              <span className="text-text font-mono tabular-nums w-[140px] text-right">{dollars(s.subtotalCents)}</span>
            </div>
          ))}
        </div>
      </section>

      {/* Line items grouped by section */}
      {document.sections.map(s => {
        const lines = document.lineItems.filter(l => l.csiSection === s.section);
        return <SectionTable key={s.section} title={s.section} lines={lines} subtotalCents={s.subtotalCents} />;
      })}

      {/* Labor breakdown */}
      <section className="card mb-5">
        <div className="card-header">
          <div className="card-title">Labor estimate · {document.labor.hours} hr</div>
          <span className="text-[9.5px] text-text4 font-mono uppercase tracking-[0.06em]">
            Blended rate {(document.labor.blendedRateCentsPerHr / 100).toFixed(2)} $/hr
          </span>
        </div>
        <div className="divide-y divide-chrome-dark">
          {document.labor.breakdown.map(t => (
            <div key={t.task} className="px-4 py-1.5 flex items-baseline gap-3 text-[11.5px]">
              <span className="text-text2 flex-1 truncate">{t.task}</span>
              <span className="text-text font-mono tabular-nums w-[80px] text-right">{t.hours.toFixed(1)} hr</span>
              <span className="text-text2 font-mono tabular-nums w-[120px] text-right">
                {dollars(Math.round(t.hours * document.labor.blendedRateCentsPerHr))}
              </span>
            </div>
          ))}
          <div className="px-4 py-2 flex items-baseline gap-3 text-[12px] bg-chrome-darkest/40 font-medium">
            <span className="text-text flex-1">Labor subtotal</span>
            <span className="text-text font-mono tabular-nums w-[80px] text-right">{document.labor.hours.toFixed(1)} hr</span>
            <span className="text-accent font-mono tabular-nums w-[120px] text-right">{dollars(document.labor.subtotalCents)}</span>
          </div>
        </div>
      </section>

      {/* Grand total footer */}
      <section className="card mb-5 border-l-2 border-l-accent">
        <div className="card-body py-3">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-[12px]">
            <Field label="Material"      value={dollars(document.materialSubtotalCents)} mono />
            <Field label="Labor"         value={dollars(document.labor.subtotalCents)}  mono />
            <Field label="Tax"           value={dollars(document.tax.cents)}            mono />
            <Field label="Grand total"   value={dollars(document.grandTotalCents)}      mono highlight />
          </div>
        </div>
      </section>

      <footer className="mt-6 text-[10px] text-text4 font-mono leading-snug">
        BOM generated by computeBom(project, rooms, placement, pathway). Every
        line item ties to a real catalog SKU (lib/catalog/products.ts) and
        carries a derivation note. Pricing reflects mid-2025 distributor list;
        production swaps for live Anixter / Graybar / CDW API. Labor uses a
        blended Davis-Bacon rate ({(document.labor.blendedRateCentsPerHr / 100).toFixed(2)} $/hr);
        production swaps for NECA MLU per-task lookup.
      </footer>
    </div>
  );
}

// ── Atoms ───────────────────────────────────────────────────────────────

function Field({ label, value, mono, highlight }: {
  label: string; value: string; mono?: boolean; highlight?: boolean;
}) {
  return (
    <div className="flex flex-col">
      <span className="text-[9.5px] text-text4 font-mono uppercase tracking-[0.06em]">{label}</span>
      <span className={
        (mono ? "font-mono tabular-nums " : "") +
        (highlight ? "text-accent font-medium text-[14px] " : "text-text2 ")
      }>{value}</span>
    </div>
  );
}

function Tile({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  return (
    <div className="border border-chrome-dark rounded-[2px] p-3 bg-chrome-darkest">
      <div className="text-[9.5px] uppercase tracking-[0.06em] text-text4 font-mono">{label}</div>
      <div className={"text-[18px] font-semibold tabular-nums mt-1 " + (highlight ? "text-accent" : "text-text2")}>
        {value}
      </div>
    </div>
  );
}

function SectionTable({ title, lines, subtotalCents }: { title: string; lines: BomLine[]; subtotalCents: number }) {
  return (
    <section className="card mb-4">
      <div className="card-header">
        <div className="card-title">{title}</div>
        <span className="text-[9.5px] text-text4 font-mono uppercase tracking-[0.06em]">
          {lines.length} item{lines.length === 1 ? "" : "s"} · {dollars(subtotalCents)}
        </span>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-[10.5px]">
          <thead>
            <tr className="border-b border-chrome-dark text-[9.5px] uppercase tracking-[0.06em] text-text4 font-mono">
              <th className="text-left  px-3 py-1.5 w-[40px]">#</th>
              <th className="text-left  px-3 py-1.5">Manufacturer · SKU</th>
              <th className="text-left  px-3 py-1.5">Description</th>
              <th className="text-right px-3 py-1.5 w-[80px]">Qty</th>
              <th className="text-left  px-3 py-1.5 w-[60px]">Unit</th>
              <th className="text-right px-3 py-1.5 w-[100px]">Unit $</th>
              <th className="text-right px-3 py-1.5 w-[120px]">Extended</th>
            </tr>
          </thead>
          <tbody>
            {lines.map(line => (
              <tr key={line.lineNo} className="border-b border-chrome-dark/40">
                <td className="px-3 py-1.5 text-text4 font-mono">{line.lineNo}</td>
                <td className="px-3 py-1.5">
                  <div className="text-text2">{line.manufacturer}</div>
                  <div className="text-text4 font-mono text-[10px]">{line.sku}</div>
                </td>
                <td className="px-3 py-1.5">
                  <div className="text-text3">{line.description}</div>
                  <div className="text-text4 text-[10px] mt-0.5 leading-snug">{line.derivedFrom}</div>
                  {line.notes && <div className="text-warn text-[10px] mt-0.5 font-mono leading-snug">{line.notes}</div>}
                </td>
                <td className="px-3 py-1.5 text-right text-text font-mono tabular-nums">{line.quantity}</td>
                <td className="px-3 py-1.5 text-text4 font-mono">{line.unit}</td>
                <td className="px-3 py-1.5 text-right text-text2 font-mono tabular-nums">{(line.unitCostCents / 100).toFixed(2)}</td>
                <td className="px-3 py-1.5 text-right text-text font-mono tabular-nums">{dollars(line.extendedCents)}</td>
              </tr>
            ))}
            <tr className="bg-chrome-darkest/40">
              <td colSpan={6} className="px-3 py-1.5 text-right text-text3 text-[11px] font-medium">Section subtotal</td>
              <td className="px-3 py-1.5 text-right text-accent font-mono tabular-nums font-medium">{dollars(subtotalCents)}</td>
            </tr>
          </tbody>
        </table>
      </div>
    </section>
  );
}

// ── Helpers ─────────────────────────────────────────────────────────────

function dollars(cents: number): string {
  return "$" + (cents / 100).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function toCsv(d: BomDocument): string {
  const rows: string[] = [];
  rows.push("Line,CSI Section,Manufacturer,SKU,Description,Quantity,Unit,Unit Cost USD,Extended USD,Derived From,Notes");
  function esc(s: string): string {
    if (s.includes(",") || s.includes("\"") || s.includes("\n")) return `"${s.replace(/"/g, "\"\"")}"`;
    return s;
  }
  for (const l of d.lineItems) {
    rows.push([
      l.lineNo, esc(l.csiSection), esc(l.manufacturer), esc(l.sku), esc(l.description),
      l.quantity, l.unit, (l.unitCostCents / 100).toFixed(2), (l.extendedCents / 100).toFixed(2),
      esc(l.derivedFrom), esc(l.notes ?? ""),
    ].join(","));
  }
  rows.push("");
  rows.push(`,,,Material subtotal,,,,,,${(d.materialSubtotalCents / 100).toFixed(2)},`);
  rows.push(`,,,Labor,${d.labor.hours} hr,,,,${(d.labor.subtotalCents / 100).toFixed(2)},`);
  rows.push(`,,,Tax (${(d.tax.rate * 100).toFixed(2)}%),,,,,${(d.tax.cents / 100).toFixed(2)},`);
  rows.push(`,,,GRAND TOTAL,,,,,,${(d.grandTotalCents / 100).toFixed(2)},`);
  return rows.join("\n");
}

function toMarkdown(d: BomDocument): string {
  const lines: string[] = [];
  lines.push(`# Bill of Materials — ${d.project.name}`);
  lines.push("");
  lines.push(`**Project:** ${d.project.number} · ${d.project.name}`);
  lines.push(`**Owner:** ${d.project.owner}`);
  lines.push(`**Site:** ${d.project.address}`);
  lines.push(`**Generated:** ${new Date(d.generatedAt).toLocaleString()}`);
  lines.push("");
  for (const sec of d.sections) {
    const items = d.lineItems.filter(l => l.csiSection === sec.section);
    lines.push(`## ${sec.section}`);
    lines.push("");
    lines.push(`| # | Manufacturer · SKU | Description | Qty | Unit | Unit $ | Extended |`);
    lines.push(`|---|---|---|---|---|---|---|`);
    for (const l of items) {
      lines.push(`| ${l.lineNo} | ${l.manufacturer} · \`${l.sku}\` | ${l.description}${l.derivedFrom ? `<br/>_${l.derivedFrom}_` : ""}${l.notes ? `<br/>**Note:** ${l.notes}` : ""} | ${l.quantity} | ${l.unit} | ${(l.unitCostCents/100).toFixed(2)} | ${dollars(l.extendedCents)} |`);
    }
    lines.push("");
    lines.push(`**Section subtotal:** ${dollars(sec.subtotalCents)}`);
    lines.push("");
  }
  lines.push("## Totals");
  lines.push("");
  lines.push(`- Material subtotal: ${dollars(d.materialSubtotalCents)}`);
  lines.push(`- Labor (${d.labor.hours} hr @ $${(d.labor.blendedRateCentsPerHr/100).toFixed(2)}/hr): ${dollars(d.labor.subtotalCents)}`);
  lines.push(`- Tax (${(d.tax.rate * 100).toFixed(2)}%): ${dollars(d.tax.cents)}`);
  lines.push(`- **Grand total: ${dollars(d.grandTotalCents)}**`);
  lines.push("");
  return lines.join("\n");
}
