// D-size sheet wrapper. Renders an ANSI D / Arch D border, professional
// title block on the right edge, revision block, scale bar, and north arrow.
// The drawing region (left of the title block strip) is a slot — each sheet
// renderer (cover, floor plan, riser, schedule) fills it with its own SVG.
//
// Coordinate units: 1 unit = 0.01 inch. So a 36"×24" sheet is 3600×2400.

import type { DrawingSheet, SheetIssuance } from "@/lib/drawings/types";
import { SHEET_SIZE_IN } from "@/lib/drawings/types";
import type { Project } from "@/lib/projects/types";
import type { AuthUser } from "@/lib/auth/types";

interface Props {
  project: Project;
  sheet: DrawingSheet;
  rcdd: AuthUser;
  /** Latest issuance, if any. Shown above the title block. */
  issuance?: SheetIssuance;
  /** Drawing-region SVG content. Coordinate origin (0,0) is the drawing-region top-left. */
  children: (region: { w: number; h: number }) => React.ReactNode;
  /** Optional fixed display height in px. */
  displayHeightPx?: number;
}

// Layout constants — all in 0.01" units.
const PAGE_PAD = 50;          // 0.5" outer padding
const BORDER_INSET = 25;      // 0.25"
const TB_WIDTH = 550;         // 5.5" title block strip
const TB_INNER_PAD = 18;      // 0.18"

export function SheetCanvas({
  project, sheet, rcdd, issuance, children, displayHeightPx = 760,
}: Props) {
  const size = SHEET_SIZE_IN[sheet.size];
  const W = size.w * 100;     // 3600 for ANSI D
  const H = size.h * 100;     // 2400 for ANSI D

  // Drawing region — everything except the right-edge title block strip
  // and the surrounding 0.5" margin.
  const drawing = {
    x: PAGE_PAD,
    y: PAGE_PAD,
    w: W - PAGE_PAD * 2 - TB_WIDTH - 20,
    h: H - PAGE_PAD * 2,
  };

  // Title block strip rectangle.
  const tb = {
    x: W - PAGE_PAD - TB_WIDTH,
    y: PAGE_PAD,
    w: TB_WIDTH,
    h: H - PAGE_PAD * 2,
  };

  // CSS display: aspect-ratio honors the sheet's true proportion.
  const displayWidthPx = (displayHeightPx * W) / H;

  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      width={displayWidthPx}
      height={displayHeightPx}
      style={{
        background: "#ffffff",
        display: "block",
        boxShadow: "0 2px 12px rgba(0,0,0,0.35), 0 0 0 1px #444 inset",
      }}
      xmlns="http://www.w3.org/2000/svg"
    >
      {/* Drawing-region clipping path so renderers don't bleed into the title block */}
      <defs>
        <clipPath id={`region-${sheet.id}`}>
          <rect x={drawing.x} y={drawing.y} width={drawing.w} height={drawing.h} />
        </clipPath>
        <pattern id={`grid-${sheet.id}`} width="100" height="100" patternUnits="userSpaceOnUse">
          <path d="M 100 0 L 0 0 0 100" fill="none" stroke="#e8e8e0" strokeWidth="1" />
        </pattern>
      </defs>

      {/* Sheet borders — heavy outer + lighter inner */}
      <rect x={BORDER_INSET} y={BORDER_INSET} width={W - BORDER_INSET * 2} height={H - BORDER_INSET * 2}
            fill="none" stroke="#000" strokeWidth="4" />
      <rect x={BORDER_INSET + 12} y={BORDER_INSET + 12} width={W - BORDER_INSET * 2 - 24} height={H - BORDER_INSET * 2 - 24}
            fill="none" stroke="#000" strokeWidth="1.5" />

      {/* Zone markers along the border — A B C ... 1 2 3 ... pattern */}
      <ZoneMarkers W={W} H={H} />

      {/* Drawing region — light grid + clipped children */}
      <rect x={drawing.x} y={drawing.y} width={drawing.w} height={drawing.h}
            fill={`url(#grid-${sheet.id})`} />
      <g clipPath={`url(#region-${sheet.id})`} transform={`translate(${drawing.x}, ${drawing.y})`}>
        {children({ w: drawing.w, h: drawing.h })}
      </g>

      {/* Scale bar + north arrow — bottom-left of drawing region */}
      {sheet.kind !== "schedule" && sheet.kind !== "cover" && sheet.kind !== "symbols" && (
        <ScaleAndNorth x={drawing.x + 30} y={drawing.y + drawing.h - 130} scaleLabel={sheet.scale.label} />
      )}

      {/* Title block strip */}
      <TitleBlock tb={tb} project={project} sheet={sheet} rcdd={rcdd} issuance={issuance} />
    </svg>
  );
}

// ── Zone markers ──────────────────────────────────────────────────────────

function ZoneMarkers({ W, H }: { W: number; H: number }) {
  // Letters A-H across the top, numbers 1-6 down the side, just like a real
  // architectural sheet. They're decorative but readable.
  const cols = 8;
  const rows = 6;
  const top = BORDER_INSET + 5;
  const bottom = H - BORDER_INSET - 5;
  const left = BORDER_INSET + 5;
  const right = W - BORDER_INSET - 5;

  const letters = "ABCDEFGH".split("").slice(0, cols);
  const cellW = (W - BORDER_INSET * 2 - 24) / cols;
  const cellH = (H - BORDER_INSET * 2 - 24) / rows;

  return (
    <g fontFamily="Courier, monospace" fontSize="22" fill="#222">
      {letters.map((ch, i) => (
        <g key={ch}>
          <text x={BORDER_INSET + 12 + cellW * i + cellW / 2} y={top + 18} textAnchor="middle">{ch}</text>
          <text x={BORDER_INSET + 12 + cellW * i + cellW / 2} y={bottom + 3} textAnchor="middle">{ch}</text>
        </g>
      ))}
      {Array.from({ length: rows }, (_, i) => (
        <g key={i}>
          <text x={left + 14} y={BORDER_INSET + 12 + cellH * i + cellH / 2 + 8} textAnchor="middle">{i + 1}</text>
          <text x={right - 14} y={BORDER_INSET + 12 + cellH * i + cellH / 2 + 8} textAnchor="middle">{i + 1}</text>
        </g>
      ))}
    </g>
  );
}

// ── Scale + north ─────────────────────────────────────────────────────────

function ScaleAndNorth({ x, y, scaleLabel }: { x: number; y: number; scaleLabel: string }) {
  // Decorative — the actual on-paper scale depends on the renderer, this is
  // just a graphic reminder. 200 unit bar = 2" on paper.
  return (
    <g>
      {/* North arrow */}
      <g transform={`translate(${x}, ${y})`}>
        <circle cx="40" cy="40" r="40" fill="none" stroke="#222" strokeWidth="2" />
        <polygon points="40,8 30,55 40,45 50,55" fill="#222" />
        <text x="40" y="76" textAnchor="middle" fontFamily="Helvetica, Arial, sans-serif"
              fontSize="22" fontWeight="bold" fill="#222">N</text>
      </g>
      {/* Scale bar */}
      <g transform={`translate(${x + 110}, ${y + 28})`}>
        <rect x="0"   y="0" width="50" height="14" fill="#222" stroke="#000" />
        <rect x="50"  y="0" width="50" height="14" fill="#fff" stroke="#000" />
        <rect x="100" y="0" width="50" height="14" fill="#222" stroke="#000" />
        <rect x="150" y="0" width="50" height="14" fill="#fff" stroke="#000" />
        {[0, 50, 100, 150, 200].map((px, i) => (
          <text key={px} x={px} y="32" textAnchor="middle" fontFamily="Helvetica, Arial, sans-serif"
                fontSize="18" fill="#222">{i * 4}'</text>
        ))}
        <text x="100" y="-6" textAnchor="middle" fontFamily="Helvetica, Arial, sans-serif"
              fontSize="18" fill="#222">{scaleLabel}</text>
      </g>
    </g>
  );
}

// ── Title block ───────────────────────────────────────────────────────────

function TitleBlock({
  tb, project, sheet, rcdd, issuance,
}: {
  tb: { x: number; y: number; w: number; h: number };
  project: Project;
  sheet: DrawingSheet;
  rcdd: AuthUser;
  issuance?: SheetIssuance;
}) {
  const x0 = tb.x;
  const y0 = tb.y;
  const tx = (dx: number) => x0 + TB_INNER_PAD + dx;
  const w = tb.w - TB_INNER_PAD * 2;

  // Vertical layout: top → bottom
  // [Firm block ~12%] [Project block ~14%] [Site/Owner ~9%] [Sheet title ~9%]
  // [General data ~10%] [Revision block ~20%] [Stamp ~16%] [Number ~10%]
  const rowH = (frac: number) => tb.h * frac;
  let y = y0;
  const firmH    = rowH(0.10);
  const projectH = rowH(0.13);
  const siteH    = rowH(0.09);
  const titleH   = rowH(0.09);
  const dataH    = rowH(0.10);
  const revH     = rowH(0.22);
  const stampH   = rowH(0.17);
  const numberH  = tb.h - firmH - projectH - siteH - titleH - dataH - revH - stampH;

  return (
    <g fontFamily="Helvetica, Arial, sans-serif">
      {/* Title block frame */}
      <rect x={x0} y={y0} width={tb.w} height={tb.h} fill="#fff" stroke="#000" strokeWidth="2.5" />

      {/* Firm row */}
      <rect x={x0} y={y} width={tb.w} height={firmH} fill="#0d1117" />
      <text x={tx(0)} y={y + firmH * 0.5 - 4} fontSize="36" fontWeight="bold" fill="#fff">
        Toro<tspan fill="#f5b800">AI</tspan>
      </text>
      <text x={tx(0)} y={y + firmH * 0.5 + 26} fontSize="14" fill="#9aa0a6"
            letterSpacing="2">ICT DESIGN WORKSPACE</text>
      <text x={x0 + tb.w - TB_INNER_PAD} y={y + firmH * 0.5 + 26} textAnchor="end"
            fontSize="14" fill="#9aa0a6">PHOENIX INFRASTRUCTURE SERVICES GROUP</text>
      {/* Stripe divider */}
      <line x1={x0} y1={y + firmH} x2={x0 + tb.w} y2={y + firmH} stroke="#000" strokeWidth="1.5" />
      {(y += firmH)}

      {/* Project block */}
      <TbField y={y} label="PROJECT" w={w} h={projectH}>
        <text x={tx(0)} y={y + 38} fontSize="22" fontWeight="bold" fill="#000">{project.name}</text>
        <text x={tx(0)} y={y + 62} fontSize="14" fill="#222">{project.owner}</text>
        <text x={tx(0)} y={y + 82} fontSize="14" fill="#222">
          {project.addressLine1}, {project.city}, {project.state} {project.zip}
        </text>
      </TbField>
      <SepLine y={y + projectH} x0={x0} w={tb.w} />
      {(y += projectH)}

      {/* AHJ / Project number */}
      <TbSplit y={y} h={siteH} x0={x0} w={tb.w}>
        <g>
          <TbLabel x={tx(0)} y={y + 14} text="AHJ" />
          <text x={tx(0)} y={y + 38} fontSize="14" fill="#000">{project.ahj}</text>
        </g>
        <g>
          <TbLabel x={x0 + tb.w * 0.55} y={y + 14} text="PROJECT NO." />
          <text x={x0 + tb.w * 0.55} y={y + 38} fontSize="14" fontFamily="Courier, monospace" fill="#000">
            {project.number}
          </text>
        </g>
      </TbSplit>
      <SepLine y={y + siteH} x0={x0} w={tb.w} />
      {(y += siteH)}

      {/* Sheet title */}
      <TbField y={y} label="SHEET TITLE" w={w} h={titleH}>
        <text x={tx(0)} y={y + 44} fontSize="22" fontWeight="bold" fill="#000" letterSpacing="0.5">
          {sheet.title.toUpperCase()}
        </text>
      </TbField>
      <SepLine y={y + titleH} x0={x0} w={tb.w} />
      {(y += titleH)}

      {/* General data */}
      <g>
        <TbSplit y={y} h={dataH} x0={x0} w={tb.w}>
          <g>
            <TbLabel x={tx(0)} y={y + 14} text="DRAWN BY" />
            <text x={tx(0)} y={y + 38} fontSize="14" fill="#000">{initials(rcdd)}</text>
          </g>
          <g>
            <TbLabel x={x0 + tb.w * 0.30} y={y + 14} text="CHECKED" />
            <text x={x0 + tb.w * 0.30} y={y + 38} fontSize="14" fill="#000">{initials(rcdd)}</text>
          </g>
          <g>
            <TbLabel x={x0 + tb.w * 0.55} y={y + 14} text="DATE" />
            <text x={x0 + tb.w * 0.55} y={y + 38} fontSize="14" fontFamily="Courier, monospace" fill="#000">
              {formatDate(sheet.updatedAt)}
            </text>
          </g>
          <g>
            <TbLabel x={x0 + tb.w * 0.80} y={y + 14} text="SCALE" />
            <text x={x0 + tb.w * 0.80} y={y + 38} fontSize="14" fontFamily="Courier, monospace" fill="#000">
              {sheet.scale.label}
            </text>
          </g>
        </TbSplit>
      </g>
      <SepLine y={y + dataH} x0={x0} w={tb.w} />
      {(y += dataH)}

      {/* Revision block */}
      <g>
        <TbLabel x={tx(0)} y={y + 14} text="REVISIONS" />
        {/* Column headers */}
        <text x={tx(0)}      y={y + 30} fontSize="11" fontFamily="Courier, monospace" fill="#444">Δ</text>
        <text x={tx(28)}     y={y + 30} fontSize="11" fontFamily="Courier, monospace" fill="#444">DATE</text>
        <text x={tx(110)}    y={y + 30} fontSize="11" fontFamily="Courier, monospace" fill="#444">DESCRIPTION</text>
        <text x={tx(w - 30)} y={y + 30} fontSize="11" fontFamily="Courier, monospace" fill="#444">BY</text>
        <line x1={x0 + TB_INNER_PAD - 4} y1={y + 36} x2={x0 + tb.w - TB_INNER_PAD + 4} y2={y + 36} stroke="#666" />
        {sheet.revisions.slice(-6).map((rev, i) => {
          const ry = y + 50 + i * 17;
          return (
            <g key={i} fontSize="12" fontFamily="Courier, monospace" fill="#000">
              <text x={tx(0)}      y={ry}>{rev.tag}</text>
              <text x={tx(28)}     y={ry}>{formatShortDate(rev.date)}</text>
              <text x={tx(110)}    y={ry}>{rev.description}</text>
              <text x={tx(w - 30)} y={ry}>{rev.by}</text>
            </g>
          );
        })}
        {sheet.revisions.length === 0 && (
          <text x={tx(0)} y={y + 56} fontSize="12" fontFamily="Courier, monospace" fill="#888">
            — no revisions —
          </text>
        )}
      </g>
      <SepLine y={y + revH} x0={x0} w={tb.w} />
      {(y += revH)}

      {/* RCDD stamp area */}
      <g>
        <TbLabel x={tx(0)} y={y + 14} text="STAMP" />
        {/* Stamp box */}
        <rect x={tx(0)} y={y + 22} width={w * 0.45} height={stampH - 30}
              fill="none" stroke="#000" strokeWidth="1.2" />
        <text x={tx(w * 0.45 * 0.5)} y={y + 22 + 24} textAnchor="middle"
              fontSize="11" fontFamily="Courier, monospace" fill="#666">RCDD STAMP</text>
        {/* RCDD details on the right */}
        <g>
          <text x={tx(w * 0.50)} y={y + 30} fontSize="14" fontWeight="bold" fill="#000">
            {rcdd.firstName} {rcdd.lastName}
          </text>
          {rcdd.rcddNumber && (
            <text x={tx(w * 0.50)} y={y + 48} fontSize="12" fontFamily="Courier, monospace" fill="#000">
              RCDD #{rcdd.rcddNumber}{rcdd.rcddState && ` (${rcdd.rcddState})`}
            </text>
          )}
          {rcdd.firmName && (
            <text x={tx(w * 0.50)} y={y + 66} fontSize="12" fill="#222">
              {rcdd.firmName}
            </text>
          )}
          {issuance && (
            <text x={tx(w * 0.50)} y={y + stampH - 24} fontSize="11"
                  fontFamily="Courier, monospace" fill="#a60000">
              {issuance.label.toUpperCase()} · {formatShortDate(issuance.date)}
            </text>
          )}
        </g>
      </g>
      <SepLine y={y + stampH} x0={x0} w={tb.w} />
      {(y += stampH)}

      {/* Sheet number — big and bold at the bottom */}
      <g>
        <rect x={x0} y={y} width={tb.w} height={numberH} fill="#fff" />
        <text x={tx(0)} y={y + 18} fontSize="11" fontFamily="Courier, monospace" fill="#444">SHEET NUMBER</text>
        <text x={x0 + tb.w / 2} y={y + numberH - 24} textAnchor="middle"
              fontSize="60" fontWeight="bold" fontFamily="Helvetica, Arial, sans-serif" fill="#000">
          {sheet.number}
        </text>
      </g>
    </g>
  );
}

// ── Title-block helpers ───────────────────────────────────────────────────

function TbField({ y, label, w: _w, h: _h, children }: {
  y: number; label: string; w: number; h: number; children: React.ReactNode;
}) {
  return (
    <g>
      <TbLabel x={undefined} y={y + 14} text={label} fromGroup />
      {children}
    </g>
  );
}

function TbSplit({ y, h, x0, w, children }: {
  y: number; h: number; x0: number; w: number; children: React.ReactNode;
}) {
  return (
    <g>
      {children}
      {/* Hairline dividers — implicit; columns are positioned manually above */}
      <line x1={x0} y1={y + h} x2={x0 + w} y2={y + h} stroke="#cccfd2" strokeWidth="0.5" />
    </g>
  );
}

function TbLabel({ x, y, text, fromGroup = false }: {
  x: number | undefined; y: number; text: string; fromGroup?: boolean;
}) {
  // Render labels as compact uppercase courier so the title block reads like
  // a real industry sheet. fromGroup is unused but kept for caller clarity.
  void fromGroup;
  return (
    <text x={x ?? 0} y={y} fontSize="10" letterSpacing="0.5"
          fontFamily="Courier, monospace" fill="#666">{text}</text>
  );
}

function SepLine({ y, x0, w }: { y: number; x0: number; w: number }) {
  return <line x1={x0} y1={y} x2={x0 + w} y2={y} stroke="#000" strokeWidth="1.2" />;
}

// ── Formatters ────────────────────────────────────────────────────────────

function initials(u: AuthUser): string {
  const f = (u.firstName ?? "").trim();
  const l = (u.lastName ?? "").trim();
  if (!f && !l) return "—";
  return `${f[0] ?? ""}${l[0] ?? ""}`.toUpperCase();
}

function formatDate(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString("en-US", { year: "numeric", month: "2-digit", day: "2-digit" });
}

function formatShortDate(iso: string): string {
  const d = new Date(iso);
  const yy = String(d.getFullYear()).slice(2);
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${mm}/${dd}/${yy}`;
}
