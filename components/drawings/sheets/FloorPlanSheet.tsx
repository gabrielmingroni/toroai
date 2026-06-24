// T-100 — Floor Plan. Renders room outlines from the intake state with TRs
// highlighted. Falls back to a placeholder grid if no rooms are confirmed.

import type { ExtractedRoom } from "@/lib/intake/types";
import { CANVAS_W, CANVAS_H, ROOM_TYPE_LABEL } from "@/lib/intake/types";

interface Props {
  rooms: ExtractedRoom[];
  region: { w: number; h: number };
}

// Map intake room types to a CAD-style hatch / fill convention.
function fillFor(r: ExtractedRoom): string {
  const t = r.overrideType ?? r.type;
  if (t === "mdf") return "#fff7d6";
  if (t === "idf") return "#fff7d6";
  if (t === "electrical" || t === "mechanical") return "#f5f5f5";
  if (t === "corridor" || t === "stairwell" || t === "elevator") return "#fafafa";
  return "#ffffff";
}

function strokeFor(r: ExtractedRoom): string {
  const t = r.overrideType ?? r.type;
  if (t === "mdf" || t === "idf") return "#a60000";
  return "#0d1117";
}

function strokeW(r: ExtractedRoom): number {
  const t = r.overrideType ?? r.type;
  return t === "mdf" || t === "idf" ? 6 : 3;
}

export function FloorPlanSheet({ rooms, region }: Props) {
  // Choose floor — for v1 always floor 1.
  const visible = rooms.filter(r => r.floor === 1 && !r.excluded);

  // Letterbox the 145×82 intake grid into the drawing region with 100-unit margin.
  const margin = 80;
  const availW = region.w - margin * 2;
  const availH = region.h - margin * 2;
  const sx = availW / CANVAS_W;
  const sy = availH / CANVAS_H;
  const s = Math.min(sx, sy);
  const renderedW = CANVAS_W * s;
  const renderedH = CANVAS_H * s;
  const offX = margin + (availW - renderedW) / 2;
  const offY = margin + (availH - renderedH) / 2;

  return (
    <g fontFamily="Helvetica, Arial, sans-serif">
      {/* Architectural background frame */}
      <rect x={offX} y={offY} width={renderedW} height={renderedH}
            fill="#ffffff" stroke="#0d1117" strokeWidth="8" />

      {visible.length === 0 ? (
        <EmptyState x={offX + renderedW / 2} y={offY + renderedH / 2} />
      ) : (
        <g transform={`translate(${offX}, ${offY}) scale(${s})`}>
          {visible.map(r => <Room key={r.id} room={r} />)}
        </g>
      )}

      {/* Match-line note bottom-center of the plate */}
      <text x={offX + renderedW / 2} y={offY + renderedH + 50} textAnchor="middle"
            fontSize="18" fontFamily="Courier, monospace" fill="#a60000" letterSpacing="2">
        ◀ MATCH LINE — SEE SHEET T-101 ▶
      </text>

      {/* Legend — top-right of the plate */}
      <Legend x={offX + renderedW - 380} y={offY + 20} />
    </g>
  );
}

function Room({ room }: { room: ExtractedRoom }) {
  const t = room.overrideType ?? room.type;
  const name = room.overrideName ?? room.name;
  const isTr = t === "mdf" || t === "idf";

  // Drawing-units (feet) — labels in intake grid space too, will be scaled.
  return (
    <g>
      <rect x={room.x} y={room.y} width={room.w} height={room.h}
            fill={fillFor(room)} stroke={strokeFor(room)} strokeWidth={strokeW(room) / 1}
            vectorEffect="non-scaling-stroke" />

      {/* Room label — name + area + type */}
      {room.w * room.h > 60 && (
        <g transform={`translate(${room.x + room.w / 2}, ${room.y + room.h / 2})`}>
          <text x="0" y="-3" textAnchor="middle" fontSize={Math.min(room.w, room.h) > 14 ? 3.2 : 2.4}
                fontWeight="bold" fill="#0d1117">
            {name.toUpperCase()}
          </text>
          <text x="0" y="2" textAnchor="middle" fontSize={Math.min(room.w, room.h) > 14 ? 2.2 : 1.6}
                fill="#444" fontFamily="Courier, monospace">
            {Math.round(room.area)} SF
          </text>
          {isTr && (
            <text x="0" y="7" textAnchor="middle" fontSize="3" fontWeight="bold" fill="#a60000"
                  fontFamily="Courier, monospace">
              {t === "mdf" ? "MDF" : "IDF"}
            </text>
          )}
        </g>
      )}
    </g>
  );
}

function Legend({ x, y }: { x: number; y: number }) {
  return (
    <g transform={`translate(${x}, ${y})`} fontFamily="Helvetica, Arial, sans-serif">
      <rect x="0" y="0" width="360" height="180" fill="#ffffff" stroke="#0d1117" strokeWidth="2" />
      <text x="14" y="24" fontSize="14" fontWeight="bold" letterSpacing="1" fill="#0d1117">LEGEND</text>
      <line x1="14" y1="32" x2="346" y2="32" stroke="#0d1117" />

      <g transform="translate(14, 50)">
        <rect x="0" y="0" width="20" height="14" fill="#fff7d6" stroke="#a60000" strokeWidth="2.5" />
        <text x="28" y="12" fontSize="13" fill="#0d1117">Telecommunications Room (MDF/IDF)</text>
      </g>
      <g transform="translate(14, 78)">
        <circle cx="10" cy="7" r="5" fill="#a60000" />
        <text x="28" y="12" fontSize="13" fill="#0d1117">Work Area Outlet — 2-port faceplate</text>
      </g>
      <g transform="translate(14, 106)">
        <polygon points="0,12 10,0 20,12" fill="none" stroke="#0066cc" strokeWidth="2" />
        <text x="28" y="12" fontSize="13" fill="#0d1117">WAP — ceiling-mounted 802.11ax</text>
      </g>
      <g transform="translate(14, 134)">
        <line x1="0" y1="7" x2="20" y2="7" stroke="#0066cc" strokeWidth="3" strokeDasharray="6,3" />
        <text x="28" y="12" fontSize="13" fill="#0d1117">Cable tray — ceiling pathway</text>
      </g>
      <g transform="translate(14, 158)">
        <text x="0" y="0" fontSize="11" fontFamily="Courier, monospace" fill="#666">SEE T-002 FOR FULL SYMBOLS LIST</text>
      </g>
    </g>
  );
}

function EmptyState({ x, y }: { x: number; y: number }) {
  return (
    <g transform={`translate(${x}, ${y})`} textAnchor="middle">
      <text fontSize="32" fill="#888" fontWeight="bold">NO ARCHITECTURAL BACKGROUND</text>
      <text y="40" fontSize="18" fill="#aaa" fontFamily="Courier, monospace">
        Confirm rooms in Document Intake to populate this sheet.
      </text>
    </g>
  );
}
