"use client";

// /spec-templates — canonical CSI Division 27 specification skeletons.
// Each section follows the 3-part CSI structure (General / Products / Execution).
// RCDDs browse the templates, copy the article list, and customize per-project.

import { useMemo, useState } from "react";
import Link from "next/link";
import { TopBar } from "@/components/shell/TopBar";

interface SectionTemplate {
  number: string;
  title: string;
  blurb: string;
  parts: Array<{
    label: string;
    articles: Array<{ number: string; title: string; body: string }>;
  }>;
}

// Compact canonical-article skeletons for the 5 most-spec'd sections.
const TEMPLATES: SectionTemplate[] = [
  {
    number: "27 05 26",
    title: "Grounding and Bonding for Communications",
    blurb: "TIA-607-C grounding system for telecommunications spaces. Establishes TMGB at MDF, TGBs at IDFs, and TBB backbone.",
    parts: [
      { label: "Part 1 — General", articles: [
        { number: "1.01", title: "SECTION INCLUDES", body: "Furnish all telecommunications grounding and bonding equipment, conductors, and accessories required for a complete TIA-607-C compliant system." },
        { number: "1.02", title: "REFERENCES", body: "TIA-607-C; NEC Article 250; BICSI TDMM 15 Chapter 8; UL 467." },
        { number: "1.03", title: "SUBMITTALS", body: "Product data, shop drawings showing TMGB and TGB locations, manufacturer cut sheets, bonding conductor schedule." },
        { number: "1.04", title: "QUALITY ASSURANCE", body: "Installation by BICSI-credentialed technician (ITS or TECH) under direction of RCDD." },
      ] },
      { label: "Part 2 — Products", articles: [
        { number: "2.01", title: "MANUFACTURERS", body: "Subject to compliance: ERICO, Harger, Chatsworth Products (CPI), or approved equal." },
        { number: "2.02", title: "TELECOMMUNICATIONS MAIN GROUNDING BUSBAR (TMGB)", body: "Predrilled copper busbar, 1/4″ × 4″ × 20″ minimum, NRTL-listed, complete with isolators and mounting hardware." },
        { number: "2.03", title: "TELECOMMUNICATIONS GROUNDING BUSBAR (TGB)", body: "Predrilled copper busbar, 1/4″ × 2″ × 12″ minimum, NRTL-listed, with isolators." },
        { number: "2.04", title: "BONDING CONDUCTORS", body: "Telecommunications Bonding Backbone (TBB): #6 AWG green-insulated stranded copper minimum, sized per TIA-607-C Table 9-1." },
      ] },
      { label: "Part 3 — Execution", articles: [
        { number: "3.01", title: "INSTALLATION", body: "Install TMGB at the entrance facility / MDF and TGB in each IDF. Bond all racks, cable trays, conduits, and metallic raceways to the local TGB with #6 AWG bonding conductor and listed irreversible connectors." },
        { number: "3.02", title: "FIELD QUALITY CONTROL", body: "Measure earth-to-ground resistance at TMGB; document below 5 ohms. Provide test report at project close-out." },
      ] },
    ],
  },
  {
    number: "27 05 28",
    title: "Pathways for Communications",
    blurb: "TIA-569-D conduit, cable tray, J-hook, and innerduct pathways for telecommunications cabling.",
    parts: [
      { label: "Part 1 — General", articles: [
        { number: "1.01", title: "SECTION INCLUDES", body: "Furnish all telecommunications pathways including conduit, cable tray, J-hooks, sleeves, and innerduct for a complete pathway system." },
        { number: "1.02", title: "REFERENCES", body: "TIA-569-D; NEC Article 800; NFPA 70." },
        { number: "1.03", title: "SUBMITTALS", body: "Shop drawings indicating pathway routing, fittings, and supports. Product data and cut sheets." },
      ] },
      { label: "Part 2 — Products", articles: [
        { number: "2.01", title: "CONDUIT", body: "Electrical metallic tubing (EMT) per ANSI C80.3, hot-dipped galvanized; trade sizes per drawings, minimum 1″ (DN 27)." },
        { number: "2.02", title: "CABLE TRAY", body: "Ladder rack, aluminum, 12″ wide minimum, side rail height 4″ minimum, with bonding hardware. Chatsworth, Cooper B-Line, or approved equal." },
        { number: "2.03", title: "J-HOOKS", body: "Listed J-hook, 2″ ID minimum, bridle-ring style. nVent CADDY CAT-HP series or approved equal. Max 5 ft spacing." },
        { number: "2.04", title: "SLEEVES AND FIRESTOP", body: "Listed metallic sleeve at all fire-rated wall penetrations. Firestop per UL 1479." },
      ] },
      { label: "Part 3 — Execution", articles: [
        { number: "3.01", title: "INSTALLATION", body: "Install pathways concealed in finished areas, exposed in unfinished areas. Maintain 12″ minimum clearance from EMI sources (motors, transformers, ballasts) per TIA-569-D." },
        { number: "3.02", title: "FILL", body: "Conduit fill shall not exceed 40% per NEC. Cable-tray fill shall not exceed 50% cross-sectional area." },
        { number: "3.03", title: "FIRESTOPPING", body: "Provide listed firestop assembly at every fire-rated penetration. Apply ID label adjacent to penetration." },
      ] },
    ],
  },
  {
    number: "27 11 16",
    title: "Communications Racks, Frames, and Enclosures",
    blurb: "Equipment racks and enclosures for MDF and IDF spaces. 42U two-post and four-post relay racks.",
    parts: [
      { label: "Part 1 — General", articles: [
        { number: "1.01", title: "SECTION INCLUDES", body: "Furnish 19″ EIA-310 equipment racks, vertical cable managers, ladder rack overhead supports, and accessories." },
        { number: "1.02", title: "REFERENCES", body: "EIA-310-E; TIA-569-D; NEC Article 800." },
      ] },
      { label: "Part 2 — Products", articles: [
        { number: "2.01", title: "MANUFACTURERS", body: "Chatsworth Products (CPI), Panduit, or approved equal." },
        { number: "2.02", title: "TWO-POST RELAY RACK", body: "19″ aluminum two-post rack, 7 ft tall (45U), threaded mounting holes 12-24, integrated bonding stud. CPI Combination Rack Model 46353-503 or equal." },
        { number: "2.03", title: "VERTICAL CABLE MANAGER", body: "Dual-sided vertical cable manager, 6″ wide minimum, 7 ft tall, with hinged front door." },
        { number: "2.04", title: "LADDER RACK", body: "Black-finished steel ladder rack, 12″ wide minimum, NRTL-listed for telecom support." },
      ] },
      { label: "Part 3 — Execution", articles: [
        { number: "3.01", title: "INSTALLATION", body: "Anchor racks to concrete floor with seismic-rated anchors per IBC seismic zone. Bond each rack to TGB with #6 AWG bonding conductor." },
        { number: "3.02", title: "ARRANGEMENT", body: "Provide minimum 36″ clear access in front and rear of each rack. Maintain TIA-569-D minimum clear floor area." },
      ] },
    ],
  },
  {
    number: "27 13 23",
    title: "Communications Optical Fiber Backbone Cabling",
    blurb: "Single-mode OS2 and multi-mode OM4 fiber backbone with LC/UPC connectors. TIA-568.3-D tested and labeled.",
    parts: [
      { label: "Part 1 — General", articles: [
        { number: "1.01", title: "SECTION INCLUDES", body: "Furnish, install, terminate, test, and label optical fiber backbone cabling between the entrance facility, MDF, and all IDFs." },
        { number: "1.02", title: "REFERENCES", body: "TIA-568.1-D; TIA-568.3-D; TIA-606-C; NEC Article 770; ANSI/IEEE 1584." },
        { number: "1.03", title: "QUALITY ASSURANCE", body: "Installation by certified fiber-optic technician (BICSI ITS or equivalent). Termination shall be performed only by a manufacturer-certified installer." },
      ] },
      { label: "Part 2 — Products", articles: [
        { number: "2.01", title: "FIBER CABLE", body: "Single-mode OS2 per ITU-T G.652.D, indoor/outdoor armored, plenum (OFNP) jacketed, strand count per drawings (minimum 12)." },
        { number: "2.02", title: "CONNECTORS", body: "LC/UPC duplex connectors. LC/APC connectors are not permitted." },
        { number: "2.03", title: "SPLICE TRAYS AND HOUSINGS", body: "Rack-mount fiber enclosure with LC duplex bulkheads, splice trays, and slack management." },
      ] },
      { label: "Part 3 — Execution", articles: [
        { number: "3.01", title: "INSTALLATION", body: "Provide 10 ft minimum service loop in each TR. Maintain manufacturer's minimum bend radius. Provide cable tray support every 5 ft maximum." },
        { number: "3.02", title: "FIELD QUALITY CONTROL", body: "Test all strands end-to-end per TIA-568.3-D Tier 1 (insertion loss with light-source/power-meter set) and Tier 2 (OTDR trace). Provide test results in PDF and DTX-1800 native format at project close-out." },
        { number: "3.03", title: "LABELING", body: "Label every strand at both ends per TIA-606-C hierarchical scheme: <Site>-<Building>-<Floor>-<TR>-<Cable#>-<Strand#>." },
      ] },
    ],
  },
  {
    number: "27 15 13",
    title: "Communications Copper Horizontal Cabling",
    blurb: "Category 6A UTP horizontal cabling from outlets to telecom rooms. 90 m permanent link, 100 m channel per TIA-568.2-D.",
    parts: [
      { label: "Part 1 — General", articles: [
        { number: "1.01", title: "SECTION INCLUDES", body: "Furnish, install, terminate, test, and label Category 6A UTP horizontal cabling between work-area outlets and telecommunications rooms." },
        { number: "1.02", title: "REFERENCES", body: "TIA-568.1-D; TIA-568.2-D; TIA-606-C; NEC Article 800; IEEE 802.3bt." },
        { number: "1.03", title: "QUALITY ASSURANCE", body: "Installation by BICSI-credentialed technician (ITS) under direction of RCDD. Test set: Fluke DSX-8000 series or equivalent." },
      ] },
      { label: "Part 2 — Products", articles: [
        { number: "2.01", title: "HORIZONTAL CABLE", body: "Category 6A U/UTP per TIA-568.2-D, plenum (CMP) rated, 23 AWG solid copper, 1000 ft reels." },
        { number: "2.02", title: "WORK AREA OUTLET", body: "Modular 2-port flush-mount faceplate with Category 6A jacks. T568B termination scheme." },
        { number: "2.03", title: "PATCH PANELS", body: "24-port and 48-port modular patch panels, 1U and 2U, with integrated rear cable manager." },
      ] },
      { label: "Part 3 — Execution", articles: [
        { number: "3.01", title: "INSTALLATION", body: "Maintain manufacturer's minimum bend radius (4× cable OD under load). Maintain 12″ minimum clearance from EMI sources. Cable tie tension shall not deform jacket." },
        { number: "3.02", title: "PERMANENT LINK LENGTH", body: "No horizontal permanent link shall exceed 90 m (295 ft). Verify with installed channel test." },
        { number: "3.03", title: "FIELD QUALITY CONTROL", body: "Test 100% of links per TIA-568.2-D Permanent Link template, Category 6A test parameters. Submit test reports in Fluke DSX native format and PDF. Re-terminate and re-test any failing link." },
        { number: "3.04", title: "LABELING", body: "Label every jack and patch panel port per TIA-606-C." },
      ] },
    ],
  },
];

export default function SpecTemplatesPage() {
  const [query, setQuery] = useState("");
  const [activeNumber, setActiveNumber] = useState<string>(TEMPLATES[0].number);
  const [copyState, setCopyState] = useState<string | null>(null);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return TEMPLATES;
    return TEMPLATES.filter(t =>
      t.title.toLowerCase().includes(q) ||
      t.number.includes(q) ||
      t.blurb.toLowerCase().includes(q) ||
      t.parts.some(p => p.articles.some(a =>
        a.title.toLowerCase().includes(q) || a.body.toLowerCase().includes(q),
      )),
    );
  }, [query]);

  const active = TEMPLATES.find(t => t.number === activeNumber) ?? TEMPLATES[0];

  async function copySection(t: SectionTemplate) {
    const lines: string[] = [];
    lines.push(`SECTION ${t.number} — ${t.title.toUpperCase()}`);
    lines.push("");
    for (const part of t.parts) {
      lines.push(part.label.toUpperCase());
      for (const a of part.articles) {
        lines.push("");
        lines.push(`  ${a.number}  ${a.title}`);
        lines.push(`         ${a.body}`);
      }
      lines.push("");
    }
    try {
      await navigator.clipboard.writeText(lines.join("\n"));
      setCopyState(t.number);
      setTimeout(() => setCopyState(null), 1500);
    } catch {
      // ignore
    }
  }

  return (
    <>
      <TopBar breadcrumb={[{ label: "Workspace" }, { label: "Libraries" }, { label: "CSI 27 Spec Templates" }]} />
      <div className="flex-1 overflow-y-auto">
        <div className="max-w-[1280px] mx-auto px-6 py-5">

          {/* Header */}
          <header className="flex items-end justify-between gap-4 mb-4 flex-wrap">
            <div>
              <div className="text-[11px] text-text3 font-mono uppercase tracking-[0.06em]">Library · Reference</div>
              <h1 className="text-[20px] font-semibold leading-tight text-text mt-0.5">CSI 27 Spec Templates</h1>
              <div className="text-[11.5px] text-text3 mt-0.5">
                {TEMPLATES.length} canonical Division 27 sections · 3-part CSI structure.
              </div>
            </div>
            <Link href="/dashboard" className="text-[11px] text-text3 hover:text-accent font-mono">
              ← Workspace
            </Link>
          </header>

          {/* Search */}
          <div className="card mb-4">
            <div className="card-body py-3">
              <input
                type="search" value={query} onChange={e => setQuery(e.target.value)}
                placeholder="Search section title, number, or article body"
                className="input text-[11.5px] py-1.5 w-full"
              />
            </div>
          </div>

          {/* Two-column layout */}
          <div className="grid grid-cols-1 lg:grid-cols-[280px_1fr] gap-4">

            {/* Section list */}
            <aside className="card h-fit lg:sticky lg:top-3">
              <div className="card-header">
                <div className="card-title">Sections</div>
                <span className="text-[10px] text-text4 font-mono">{filtered.length}</span>
              </div>
              <ul className="divide-y divide-chrome-dark">
                {filtered.map(t => {
                  const isActive = t.number === activeNumber;
                  return (
                    <li key={t.number}>
                      <button type="button" onClick={() => setActiveNumber(t.number)}
                              className={
                                "w-full text-left px-3 py-2.5 transition-colors " +
                                (isActive ? "bg-accent/15 border-l-2 border-l-accent" : "hover:bg-chrome-dark")
                              }>
                        <div className={"text-[11.5px] font-mono " + (isActive ? "text-accent" : "text-text2")}>
                          {t.number}
                        </div>
                        <div className={"text-[11px] mt-0.5 " + (isActive ? "text-text" : "text-text3")}>
                          {t.title}
                        </div>
                      </button>
                    </li>
                  );
                })}
              </ul>
            </aside>

            {/* Active section detail */}
            <section className="card">
              <div className="card-header">
                <div>
                  <div className="text-[11px] font-mono text-text3">{active.number}</div>
                  <div className="text-[14px] text-text font-medium">{active.title}</div>
                </div>
                <button type="button" onClick={() => copySection(active)}
                        className="btn btn-ghost text-[11px] px-3 py-1.5 inline-flex items-center gap-2">
                  <i className="ti ti-copy" style={{ fontSize: 12 }} aria-hidden="true" />
                  {copyState === active.number ? "Copied" : "Copy section"}
                </button>
              </div>
              <div className="card-body">
                <p className="text-[11.5px] text-text3 mb-4 leading-relaxed">{active.blurb}</p>
                {active.parts.map(part => (
                  <div key={part.label} className="mb-5 last:mb-0">
                    <div className="text-[10.5px] uppercase tracking-[0.06em] text-accent font-mono mb-2 pb-1 border-b border-chrome-dark">
                      {part.label}
                    </div>
                    {part.articles.map(a => (
                      <div key={a.number} className="mb-3">
                        <div className="flex items-baseline gap-3">
                          <code className="text-[10.5px] text-text4 font-mono">{a.number}</code>
                          <div className="text-[12px] text-text font-medium">{a.title}</div>
                        </div>
                        <div className="text-[11.5px] text-text2 mt-1 ml-[42px] leading-relaxed">
                          {a.body}
                        </div>
                      </div>
                    ))}
                  </div>
                ))}
              </div>
            </section>

          </div>

        </div>
      </div>
    </>
  );
}
