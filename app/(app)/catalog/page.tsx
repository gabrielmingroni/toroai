"use client";

// /catalog — manufacturer SKU catalog. The product library an estimator
// pulls from when building a BOM. Filter by CSI section + manufacturer,
// search across description / SKU.

import { useMemo, useState } from "react";
import Link from "next/link";
import { TopBar } from "@/components/shell/TopBar";
import { CATALOG } from "@/lib/catalog/products";
import type { CatalogItem } from "@/lib/catalog/products";

type SortKey = "section" | "manufacturer" | "price_asc" | "price_desc" | "sku";

export default function CatalogPage() {
  const [sectionFilter, setSectionFilter] = useState<string>("all");
  const [mfrFilter, setMfrFilter] = useState<string>("all");
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState<SortKey>("section");

  const sections = useMemo(
    () => Array.from(new Set(CATALOG.map(c => c.specSection))).sort(),
    [],
  );
  const manufacturers = useMemo(
    () => Array.from(new Set(CATALOG.map(c => c.manufacturer))).sort(),
    [],
  );

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    let rows = CATALOG.filter(c => {
      if (sectionFilter !== "all" && c.specSection !== sectionFilter) return false;
      if (mfrFilter !== "all" && c.manufacturer !== mfrFilter) return false;
      if (!q) return true;
      return (
        c.sku.toLowerCase().includes(q) ||
        c.description.toLowerCase().includes(q) ||
        c.manufacturer.toLowerCase().includes(q)
      );
    });
    rows = [...rows].sort((a, b) => {
      switch (sort) {
        case "section":       return a.specSection.localeCompare(b.specSection);
        case "manufacturer":  return a.manufacturer.localeCompare(b.manufacturer);
        case "price_asc":     return a.unitCostCents - b.unitCostCents;
        case "price_desc":    return b.unitCostCents - a.unitCostCents;
        case "sku":           return a.sku.localeCompare(b.sku);
      }
    });
    return rows;
  }, [sectionFilter, mfrFilter, query, sort]);

  return (
    <>
      <TopBar breadcrumb={[{ label: "Workspace" }, { label: "Libraries" }, { label: "Manufacturer Catalog" }]} />
      <div className="flex-1 overflow-y-auto">
        <div className="max-w-[1280px] mx-auto px-6 py-5">

          {/* Header */}
          <header className="flex items-end justify-between gap-4 mb-4 flex-wrap">
            <div>
              <div className="text-[11px] text-text3 font-mono uppercase tracking-[0.06em]">Library · Reference</div>
              <h1 className="text-[20px] font-semibold leading-tight text-text mt-0.5">Manufacturer Catalog</h1>
              <div className="text-[11.5px] text-text3 mt-0.5">
                {CATALOG.length} SKUs across {sections.length} CSI Division 27 sections.
                {" "}<span className="text-text4">Pricing is mid-2025 distributor-list-ish — production swaps for live Anixter/Graybar/CDW.</span>
              </div>
            </div>
            <Link href="/dashboard" className="text-[11px] text-text3 hover:text-accent font-mono">
              ← Workspace
            </Link>
          </header>

          {/* Filters */}
          <div className="card mb-4">
            <div className="card-body py-3 grid grid-cols-1 md:grid-cols-[1fr_1fr_220px_180px] gap-3 items-end">
              <Field label="CSI Section">
                <select className="input text-[11.5px] py-1.5"
                        value={sectionFilter} onChange={e => setSectionFilter(e.target.value)}>
                  <option value="all">All sections</option>
                  {sections.map(s => <option key={s} value={s}>{s}</option>)}
                </select>
              </Field>
              <Field label="Manufacturer">
                <select className="input text-[11.5px] py-1.5"
                        value={mfrFilter} onChange={e => setMfrFilter(e.target.value)}>
                  <option value="all">All manufacturers</option>
                  {manufacturers.map(m => <option key={m} value={m}>{m}</option>)}
                </select>
              </Field>
              <Field label="Search">
                <input
                  type="search" value={query} onChange={e => setQuery(e.target.value)}
                  placeholder="SKU or description"
                  className="input text-[11.5px] py-1.5"
                />
              </Field>
              <Field label="Sort">
                <select className="input text-[11.5px] py-1.5"
                        value={sort} onChange={e => setSort(e.target.value as SortKey)}>
                  <option value="section">CSI section</option>
                  <option value="manufacturer">Manufacturer</option>
                  <option value="sku">SKU</option>
                  <option value="price_asc">Price ↑</option>
                  <option value="price_desc">Price ↓</option>
                </select>
              </Field>
            </div>
          </div>

          {/* Catalog table */}
          <section className="card">
            <div className="card-header">
              <div className="card-title">{filtered.length} item{filtered.length === 1 ? "" : "s"}</div>
              <span className="text-[10px] text-text4 font-mono">Unit prices in USD</span>
            </div>
            {filtered.length === 0 ? (
              <div className="px-4 py-8 text-center text-[12px] text-text3">
                No items match the current filters.
              </div>
            ) : (
              <table className="w-full text-[11.5px] table-fixed">
                <thead>
                  <tr className="text-left text-[9.5px] uppercase tracking-[0.06em] text-text4 font-mono border-b border-chrome-dark">
                    <th className="px-3 py-2 font-medium w-[16%]">Manufacturer · SKU</th>
                    <th className="px-3 py-2 font-medium w-[40%]">Description</th>
                    <th className="px-3 py-2 font-medium w-[26%]">CSI Section</th>
                    <th className="px-3 py-2 font-medium w-[8%]">Unit</th>
                    <th className="px-3 py-2 font-medium w-[10%] text-right tabular-nums">Unit price</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map(item => <Row key={item.sku} item={item} />)}
                </tbody>
              </table>
            )}
          </section>

        </div>
      </div>
    </>
  );
}

function Row({ item }: { item: CatalogItem }) {
  return (
    <tr className="border-b border-chrome-dark/60 hover:bg-chrome-dark/40 transition-colors">
      <td className="px-3 py-2 truncate">
        <div className="text-[11.5px] text-text font-medium truncate">{item.manufacturer}</div>
        <div className="text-[10px] text-text4 font-mono truncate">{item.sku}</div>
      </td>
      <td className="px-3 py-2">
        <div className="text-text2">{item.description}</div>
        {item.notes && !/TDD|patent|claim/i.test(item.notes) && (
          <div className="text-[10px] text-text4 italic mt-0.5">{item.notes}</div>
        )}
      </td>
      <td className="px-3 py-2 text-[10.5px] text-text3 font-mono truncate">
        {item.specSection}
      </td>
      <td className="px-3 py-2 text-[10.5px] text-text3 font-mono">{item.unit}</td>
      <td className="px-3 py-2 text-right tabular-nums text-text2 font-mono">
        ${(item.unitCostCents / 100).toFixed(2)}
      </td>
    </tr>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="flex flex-col gap-1">
      <span className="text-[9.5px] text-text4 font-mono uppercase tracking-[0.06em]">{label}</span>
      {children}
    </label>
  );
}
