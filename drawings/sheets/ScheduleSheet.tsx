// T-400 — Horizontal Cable Schedule. Tabular sheet rendering the from-to
// schedule. Falls back to a placeholder if no schedule has been generated.

import type { CableScheduleRow } from "@/lib/design/cable-schedule";

interface Props {
  rows: CableScheduleRow[];
  totalLf: number;
  region: { w: number; h: number };
}

export function ScheduleSheet({ rows, totalLf, region }: Props) {
  const headerY = 100;
  const rowH = 28;
  const tableY = headerY + 50;
  const maxRows = Math.floor((region.h - tableY - 200) / rowH);
  const visible = rows.slice(0, maxRows);
  const overflow = rows.length - visible.length;

  return (
    <g fontFamily="Helvetica, Arial, sans-serif">
      {/* Title */}
      <text x="60" y="60" fontSize="38" fontWeight="bold" fill="#0d1117">
        HORIZONTAL CABLE SCHEDULE
      </text>
      <text x="60" y="90" fontSize="14" fontFamily="Courier, monospace" fill="#666">
        TIA-606-C labeled · Cat 6A horizontal · 90 m permanent-link limit per TIA-568.2-D
      </text>
      <line x1="60" y1={headerY + 8} x2={region.w - 80} y2={headerY + 8} stroke="#0d1117" strokeWidth="3" />

      {/* Column headers */}
      <g fontSize="13" fontFamily="Courier, monospace" fill="#0d1117">
        <text x="60"   y={tableY - 6} fontWeight="bold">LABEL</text>
        <text x="300"  y={tableY - 6} fontWeight="bold">FROM (TR / RACK / PORT)</text>
        <text x="950"  y={tableY - 6} fontWeight="bold">TO (FLOOR · ROOM · OUTLET)</text>
        <text x="1750" y={tableY - 6} fontWeight="bold">CABLE</text>
        <text x="2050" y={tableY - 6} fontWeight="bold" textAnchor="end">LENGTH</text>
        <text x="2200" y={tableY - 6} fontWeight="bold">STATUS</text>
      </g>
      <line x1="60" y1={tableY} x2={region.w - 80} y2={tableY} stroke="#0d1117" strokeWidth="1.5" />

      {/* Rows */}
      {visible.length === 0 ? (
        <text x={region.w / 2 - 40} y={tableY + 100} textAnchor="middle"
              fontSize="22" fill="#888" fontFamily="Courier, monospace">
          — no cable schedule generated yet —
        </text>
      ) : (
        visible.map((row, i) => {
          const y = tableY + 24 + i * rowH;
          const tone =
            row.status === "fail" ? "#a60000"
            : row.status === "warn" ? "#a66a00"
            : "#0d1117";
          return (
            <g key={row.label}>
              {i % 2 === 1 && (
                <rect x="56" y={y - 20} width={region.w - 56 - 70} height={rowH} fill="#fafafa" />
              )}
              <text x="60"   y={y} fontSize="13" fontFamily="Courier, monospace" fill={tone}>{row.label}</text>
              <text x="300"  y={y} fontSize="13" fontFamily="Courier, monospace" fill="#0d1117">
                {row.sourceTrLabel} · {row.sourceRack} · {row.sourcePort}
              </text>
              <text x="950"  y={y} fontSize="13" fill="#0d1117">
                Fl {row.destFloor} · {row.destRoomName} · {row.outletId}
              </text>
              <text x="1750" y={y} fontSize="13" fontFamily="Courier, monospace" fill="#0d1117">{row.cableType}</text>
              <text x="2050" y={y} fontSize="13" fontFamily="Courier, monospace" textAnchor="end"
                    fill={tone}>{row.lengthFt.toFixed(0)} ft</text>
              <text x="2200" y={y} fontSize="13" fontFamily="Courier, monospace" fill={tone}>
                {row.status.toUpperCase()}
              </text>
            </g>
          );
        })
      )}

      {overflow > 0 && (
        <text x="60" y={tableY + 24 + visible.length * rowH + 14}
              fontSize="13" fontFamily="Courier, monospace" fill="#666">
          + {overflow} additional rows — see schedule .csv export for full schedule.
        </text>
      )}

      {/* Totals */}
      <g transform={`translate(60, ${region.h - 180})`}>
        <line x1="0" y1="0" x2={region.w - 140} y2="0" stroke="#0d1117" strokeWidth="2" />
        <text x="0" y="32" fontSize="16" fontWeight="bold" fill="#0d1117">TOTAL CABLE LENGTH</text>
        <text x={region.w - 140} y="32" textAnchor="end" fontSize="20" fontWeight="bold"
              fontFamily="Courier, monospace" fill="#0d1117">
          {totalLf.toLocaleString()} LF
        </text>
        <text x="0" y="60" fontSize="13" fontFamily="Courier, monospace" fill="#666">
          Includes service loops (10 ft per BICSI TDMM Ch. 14) and channel slack (5 ft drop at each end).
        </text>
        <text x="0" y="82" fontSize="13" fontFamily="Courier, monospace" fill="#666">
          Status legend: PASS ≤ 90 m permanent link · WARN 90–100 m channel · FAIL &gt; 100 m channel.
        </text>
      </g>
    </g>
  );
}
