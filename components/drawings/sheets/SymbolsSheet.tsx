// T-002 — Symbols & Abbreviations. Single-page reference sheet.

import type { DrawingSet } from "@/lib/drawings/types";

interface Props {
  set: DrawingSet;
  region: { w: number; h: number };
}

const ABBREVIATIONS: Array<{ short: string; full: string }> = [
  { short: "AFF",    full: "Above Finished Floor" },
  { short: "AHJ",    full: "Authority Having Jurisdiction" },
  { short: "BBC",    full: "Backbone Cable" },
  { short: "BICSI",  full: "Building Industry Consulting Service International" },
  { short: "CER",    full: "Common Equipment Room" },
  { short: "EF",     full: "Entrance Facility" },
  { short: "ER",     full: "Equipment Room" },
  { short: "GEC",    full: "Grounding Electrode Conductor" },
  { short: "IDF",    full: "Intermediate Distribution Frame" },
  { short: "LC/UPC", full: "Lucent Connector / Ultra-Polished Contact" },
  { short: "MDF",    full: "Main Distribution Frame" },
  { short: "NEC",    full: "National Electrical Code (NFPA 70)" },
  { short: "OSP",    full: "Outside Plant" },
  { short: "RCDD",   full: "Registered Communications Distribution Designer" },
  { short: "TBB",    full: "Telecommunications Bonding Backbone" },
  { short: "TGB",    full: "Telecommunications Grounding Busbar" },
  { short: "TIA",    full: "Telecommunications Industry Association" },
  { short: "TMGB",   full: "Telecommunications Main Grounding Busbar" },
  { short: "TR",     full: "Telecommunications Room" },
  { short: "WAP",    full: "Wireless Access Point" },
];

export function SymbolsSheet({ set, region }: Props) {
  return (
    <g fontFamily="Helvetica, Arial, sans-serif">
      {/* Title */}
      <text x="60" y="60" fontSize="38" fontWeight="bold" fill="#0d1117">
        SYMBOLS & ABBREVIATIONS
      </text>
      <line x1="60" y1="78" x2={region.w - 80} y2="78" stroke="#0d1117" strokeWidth="3" />

      {/* Two-column layout: symbols left, abbreviations right */}
      <g transform="translate(60, 130)">
        <text x="0" y="0" fontSize="22" fontWeight="bold" fill="#0d1117" letterSpacing="1">
          GRAPHIC SYMBOLS
        </text>
        <line x1="0" y1="12" x2={region.w / 2 - 100} y2="12" stroke="#0d1117" strokeWidth="2" />

        {set.symbolsLegend.map((s, i) => {
          const y = 50 + i * 64;
          return (
            <g key={s.label}>
              {/* Symbol cell */}
              <rect x="0" y={y - 28} width="56" height="44" fill="#ffffff" stroke="#0d1117" strokeWidth="2" />
              <text x="28" y={y} textAnchor="middle" fontSize="26" fontWeight="bold" fill="#0d1117"
                    dominantBaseline="middle">{s.symbol}</text>
              {/* Label + description */}
              <text x="80"  y={y - 8} fontSize="18" fontWeight="bold" fill="#0d1117">{s.label}</text>
              <text x="80"  y={y + 16} fontSize="13" fill="#444">{s.description}</text>
            </g>
          );
        })}
      </g>

      {/* Abbreviations — right column */}
      <g transform={`translate(${region.w / 2 + 40}, 130)`}>
        <text x="0" y="0" fontSize="22" fontWeight="bold" fill="#0d1117" letterSpacing="1">
          ABBREVIATIONS
        </text>
        <line x1="0" y1="12" x2={region.w / 2 - 130} y2="12" stroke="#0d1117" strokeWidth="2" />

        {/* Two sub-columns of abbreviations */}
        {ABBREVIATIONS.map((a, i) => {
          const col = i % 2;
          const row = Math.floor(i / 2);
          const x = col * 560;
          const y = 50 + row * 32;
          return (
            <g key={a.short}>
              <text x={x}      y={y} fontSize="13" fontFamily="Courier, monospace" fontWeight="bold" fill="#a60000">
                {a.short}
              </text>
              <text x={x + 90} y={y} fontSize="13" fill="#0d1117">{a.full}</text>
            </g>
          );
        })}
      </g>

      {/* Bottom note */}
      <text x="60" y={region.h - 60} fontSize="13" fontFamily="Courier, monospace" fill="#666">
        Symbols and abbreviations on these drawings conform to TIA-606-C labeling conventions and BICSI TDMM standard symbology.
      </text>
    </g>
  );
}
