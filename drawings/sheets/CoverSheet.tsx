// T-001 — Cover & Sheet Index. Renders inside the drawing region of a
// SheetCanvas. Coordinate origin (0,0) is region top-left, units are 0.01".

import type { Project } from "@/lib/projects/types";
import { SECTOR_LABEL, BUILDING_TYPE_LABEL, TYPE_LABEL } from "@/lib/projects/types";
import type { DrawingSet, DrawingSheet } from "@/lib/drawings/types";
import { SHEET_KIND_LABEL } from "@/lib/drawings/types";

interface Props {
  project: Project;
  set: DrawingSet;
  region: { w: number; h: number };
}

export function CoverSheet({ project, set, region }: Props) {
  // Big project nameplate at the top
  const titleY = 130;
  const lineH = 36;

  return (
    <g fontFamily="Helvetica, Arial, sans-serif">
      {/* Project nameplate */}
      <text x="60" y={titleY} fontSize="64" fontWeight="bold" fill="#0d1117" letterSpacing="-0.5">
        {project.name.toUpperCase()}
      </text>
      <text x="60" y={titleY + 48} fontSize="22" fill="#444">
        {project.owner}  ·  {project.addressLine1}, {project.city}, {project.state} {project.zip}
      </text>

      {/* Discipline plate */}
      <g transform="translate(60, 240)">
        <rect x="0" y="0" width="380" height="100" fill="#0d1117" />
        <text x="20" y="42" fontSize="20" fill="#9aa0a6" letterSpacing="2">DISCIPLINE</text>
        <text x="20" y="80" fontSize="38" fontWeight="bold" fill="#f5b800">TELECOMMUNICATIONS</text>
      </g>

      {/* Project facts panel — right of the nameplate */}
      <g transform="translate(540, 250)" fontSize="18" fill="#0d1117">
        <FactRow y={0}  label="PROJECT TYPE"    value={`${TYPE_LABEL[project.type]} · ${BUILDING_TYPE_LABEL[project.buildingType]}`} />
        <FactRow y={28} label="SECTOR"          value={SECTOR_LABEL[project.sector]} />
        <FactRow y={56} label="GROSS AREA"      value={`${project.totalSf.toLocaleString()} SF · ${project.floors} ${project.floors === 1 ? "FLOOR" : "FLOORS"}`} />
        <FactRow y={84} label="AHJ"             value={project.ahj} />
        <FactRow y={112} label="TARGET OCCUPANCY"
                 value={project.occupancyDate ? new Date(project.occupancyDate).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" }) : "—"} />
      </g>

      {/* Sheet index — primary mid-page block */}
      <g transform={`translate(60, 460)`}>
        <text x="0" y="0" fontSize="22" fontWeight="bold" fill="#0d1117" letterSpacing="0.5">
          SHEET INDEX
        </text>
        <line x1="0" y1="14" x2={region.w - 120} y2="14" stroke="#0d1117" strokeWidth="2" />

        {/* Headers */}
        <g fontSize="13" fontFamily="Courier, monospace" fill="#666">
          <text x="0"   y="44">SHEET</text>
          <text x="160" y="44">TITLE</text>
          <text x="1100" y="44">KIND</text>
          <text x="1500" y="44">REV</text>
          <text x="1640" y="44">DATE</text>
        </g>
        <line x1="0" y1="52" x2={region.w - 120} y2="52" stroke="#cccfd2" />

        {set.sheets.map((s, i) => {
          const ry = 80 + i * lineH;
          const lastRev = s.revisions[s.revisions.length - 1];
          return (
            <g key={s.id}>
              <text x="0"    y={ry} fontSize="18" fontFamily="Courier, monospace" fontWeight="bold" fill="#0d1117">{s.number}</text>
              <text x="160"  y={ry} fontSize="18" fill="#0d1117">{s.title}</text>
              <text x="1100" y={ry} fontSize="14" fill="#444">{SHEET_KIND_LABEL[s.kind]}</text>
              <text x="1500" y={ry} fontSize="14" fontFamily="Courier, monospace" fill="#0d1117">{lastRev?.tag ?? "—"}</text>
              <text x="1640" y={ry} fontSize="14" fontFamily="Courier, monospace" fill="#444">{formatShortDate(s.updatedAt)}</text>
            </g>
          );
        })}
      </g>

      {/* General notes — right column or bottom */}
      <g transform={`translate(60, ${460 + 80 + set.sheets.length * lineH + 60})`}>
        <text x="0" y="0" fontSize="22" fontWeight="bold" fill="#0d1117" letterSpacing="0.5">
          GENERAL NOTES
        </text>
        <line x1="0" y1="14" x2={region.w - 120} y2="14" stroke="#0d1117" strokeWidth="2" />
        {set.generalNotes.map((n, i) => (
          <g key={i}>
            <text x="0" y={50 + i * 60} fontSize="14" fontFamily="Courier, monospace" fontWeight="bold" fill="#a60000">
              {String(i + 1).padStart(2, "0")}.
            </text>
            {/* Wrap each note to ~110 chars per line. */}
            {wrapNote(n).map((line, lineIdx) => (
              <text key={lineIdx}
                    x="60" y={50 + i * 60 + lineIdx * 22}
                    fontSize="14" fill="#0d1117">{line}</text>
            ))}
          </g>
        ))}
      </g>

      {/* Issuance summary — bottom-left footer */}
      <g transform={`translate(60, ${region.h - 180})`}>
        <text x="0" y="0" fontSize="13" fontFamily="Courier, monospace" fill="#666" letterSpacing="2">
          ISSUANCE HISTORY
        </text>
        {set.issuances.map((iss, i) => (
          <text key={i} x="0" y={24 + i * 22} fontSize="14" fontFamily="Courier, monospace" fill="#0d1117">
            {formatShortDate(iss.date)} · {iss.label.toUpperCase()} · {iss.by}
          </text>
        ))}
      </g>
    </g>
  );
}

function FactRow({ y, label, value }: { y: number; label: string; value: string }) {
  return (
    <g>
      <text x="0"   y={y} fontSize="12" fontFamily="Courier, monospace" letterSpacing="1" fill="#666">{label}</text>
      <text x="240" y={y} fontSize="16" fill="#0d1117">{value}</text>
    </g>
  );
}

// Naive line wrap. Splits a long sentence into ~110-char lines without
// breaking mid-word. SVG <text> doesn't reflow, so we wrap manually.
function wrapNote(text: string, maxChars = 110): string[] {
  const words = text.split(/\s+/);
  const lines: string[] = [];
  let cur = "";
  for (const w of words) {
    if (cur.length === 0) {
      cur = w;
    } else if (cur.length + 1 + w.length <= maxChars) {
      cur += " " + w;
    } else {
      lines.push(cur);
      cur = w;
    }
  }
  if (cur) lines.push(cur);
  return lines;
}

function formatShortDate(iso: string): string {
  const d = new Date(iso);
  const yy = String(d.getFullYear()).slice(2);
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${mm}/${dd}/${yy}`;
}
