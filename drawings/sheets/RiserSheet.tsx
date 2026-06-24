// T-200 — Riser & Backbone Diagram. Synthetic single-line diagram showing
// ER → MDF → IDFs vertical stack with backbone fiber labeled. Pulls floor
// count from the project and TR count from intake rooms.

import type { Project } from "@/lib/projects/types";
import type { ExtractedRoom } from "@/lib/intake/types";

interface Props {
  project: Project;
  rooms: ExtractedRoom[];
  region: { w: number; h: number };
}

export function RiserSheet({ project, rooms, region }: Props) {
  // Count TR rooms per floor.
  const trsByFloor = new Map<number, ExtractedRoom[]>();
  for (const r of rooms) {
    if (r.excluded) continue;
    const t = r.overrideType ?? r.type;
    if (t !== "mdf" && t !== "idf") continue;
    const list = trsByFloor.get(r.floor) ?? [];
    list.push(r);
    trsByFloor.set(r.floor, list);
  }

  const floors = Math.max(project.floors, 1);
  const floorH = (region.h - 280) / floors;
  const startY = 200;

  // Backbone strand count derived from exhibit, otherwise default 12 strand.
  const strandCount = project.exhibit?.cable.strandCount ?? 12;
  const cableType =
    project.exhibit?.cable.type === "SM_OS2" ? "OS2 SM"
    : project.exhibit?.cable.type ?? "OS2 SM";

  return (
    <g fontFamily="Helvetica, Arial, sans-serif">
      {/* Title strip */}
      <text x="60" y="80" fontSize="44" fontWeight="bold" fill="#0d1117">
        BACKBONE RISER DIAGRAM
      </text>
      <text x="60" y="124" fontSize="18" fill="#444">
        {strandCount}-strand {cableType} backbone — {floors}-floor distribution
      </text>
      <line x1="60" y1="150" x2={region.w - 80} y2="150" stroke="#0d1117" strokeWidth="3" />

      {/* Floor-line backdrop */}
      <g>
        {Array.from({ length: floors }, (_, i) => {
          const floorNum = floors - i; // top of page = highest floor
          const y = startY + i * floorH;
          return (
            <g key={floorNum}>
              <line x1="60" y1={y + floorH} x2={region.w - 80} y2={y + floorH}
                    stroke="#cccfd2" strokeWidth="2" strokeDasharray="12,6" />
              <text x="80" y={y + floorH - 14} fontSize="22" fontWeight="bold" fill="#0d1117">
                FLOOR {floorNum}
              </text>
              <text x="80" y={y + floorH + 6} fontSize="12" fontFamily="Courier, monospace" fill="#888">
                EL +{floorNum * 12}'-0" AFF
              </text>
            </g>
          );
        })}
      </g>

      {/* Riser column — center of page */}
      <RiserColumn
        x={region.w / 2 - 80}
        floors={floors}
        startY={startY}
        floorH={floorH}
        strandCount={strandCount}
        cableType={cableType}
        trsByFloor={trsByFloor}
      />

      {/* Entrance / demarc — bottom-left */}
      <g transform={`translate(80, ${startY + floors * floorH + 60})`}>
        <rect x="0" y="0" width="280" height="80" fill="#fff7d6" stroke="#a60000" strokeWidth="4" />
        <text x="140" y="32" textAnchor="middle" fontSize="22" fontWeight="bold" fill="#0d1117">
          ENTRANCE FACILITY
        </text>
        <text x="140" y="58" textAnchor="middle" fontSize="14" fontFamily="Courier, monospace" fill="#444">
          DEMARC · TIA-758-B
        </text>
        {/* Connection up to ground floor MDF */}
        <line x1="140" y1="0" x2="140" y2={-30} stroke="#0066cc" strokeWidth="4" />
        <line x1="140" y1={-30} x2={region.w / 2 - 80 + 80} y2={-30}
              stroke="#0066cc" strokeWidth="4" />
        <line x1={region.w / 2 - 80 + 80} y1={-30}
              x2={region.w / 2 - 80 + 80}
              y2={startY + (floors - 1) * floorH + floorH / 2 - (startY + floors * floorH + 60) + 60}
              stroke="#0066cc" strokeWidth="4" />
      </g>

      {/* Notes — bottom-right */}
      <g transform={`translate(${region.w - 800}, ${startY + floors * floorH + 60})`}
         fontSize="14" fontFamily="Helvetica, Arial, sans-serif">
        <text x="0" y="0" fontSize="16" fontWeight="bold" fill="#0d1117" letterSpacing="1">NOTES</text>
        <line x1="0" y1="8" x2="720" y2="8" stroke="#0d1117" strokeWidth="2" />
        <NoteRow y={32} n={1} text={`Backbone: ${strandCount}-strand ${cableType} fiber, LC/UPC connectors at both ends.`} />
        <NoteRow y={56} n={2} text="Provide 10 ft service loop in MDF and each IDF per BICSI TDMM Ch. 14." />
        <NoteRow y={80} n={3} text="Test all strands end-to-end per TIA-568.3-D Tier 1 (insertion loss) and Tier 2 (OTDR)." />
        <NoteRow y={104} n={4} text="Bond all telecom racks to TBB / TGB per TIA-607-C; #6 AWG bonding conductor." />
      </g>
    </g>
  );
}

function RiserColumn({
  x, floors, startY, floorH, strandCount, cableType, trsByFloor,
}: {
  x: number; floors: number; startY: number; floorH: number;
  strandCount: number; cableType: string;
  trsByFloor: Map<number, ExtractedRoom[]>;
}) {
  const trWidth = 160;
  const trHeight = 70;
  const cx = x + trWidth / 2;
  return (
    <g>
      {/* Backbone strand label */}
      <text x={cx + 100} y={startY + floors * floorH / 2 - 6} fontSize="14"
            fontFamily="Courier, monospace" fill="#0066cc">
        ▲ {strandCount}-STRAND {cableType}
      </text>

      {Array.from({ length: floors }, (_, i) => {
        const floorIdx = floors - i; // top first
        const y = startY + i * floorH + floorH / 2 - trHeight / 2;
        const trsHere = trsByFloor.get(floorIdx) ?? [];
        const labelMain = floorIdx === 1 ? "MDF" : `IDF-${String.fromCharCode(64 + floorIdx - 1)}`;
        const heading = trsHere[0]?.overrideName ?? trsHere[0]?.name ?? `TR ${floorIdx}`;

        return (
          <g key={floorIdx}>
            {/* Vertical backbone segment to next floor */}
            {i < floors - 1 && (
              <line x1={cx} y1={y + trHeight} x2={cx} y2={y + floorH}
                    stroke="#0066cc" strokeWidth="6" />
            )}

            {/* TR rack box */}
            <rect x={x} y={y} width={trWidth} height={trHeight}
                  fill={floorIdx === 1 ? "#fff7d6" : "#ffffff"}
                  stroke="#a60000" strokeWidth="4" />
            <text x={cx} y={y + 26} textAnchor="middle" fontSize="22" fontWeight="bold" fill="#0d1117">
              {labelMain}
            </text>
            <text x={cx} y={y + 46} textAnchor="middle" fontSize="12" fontFamily="Courier, monospace" fill="#444">
              {heading.toUpperCase().slice(0, 18)}
            </text>
            <text x={cx} y={y + 62} textAnchor="middle" fontSize="11" fontFamily="Courier, monospace" fill="#666">
              {trsHere[0] ? `${Math.round(trsHere[0].area)} SF` : "—"}
            </text>

            {/* Horizontal labels for switches / racks served */}
            <g transform={`translate(${x - 240}, ${y + 12})`}>
              <text x="0" y="0" fontSize="13" fontFamily="Courier, monospace" fill="#444">
                Cat 6A horizontal
              </text>
              <text x="0" y="18" fontSize="13" fontFamily="Courier, monospace" fill="#444">
                to workstation outlets
              </text>
              <line x1="200" y1="-4" x2="240" y2="-4" stroke="#0d1117" strokeWidth="2" />
              <polygon points="240,-8 252,-4 240,0" fill="#0d1117" />
            </g>
          </g>
        );
      })}
    </g>
  );
}

function NoteRow({ y, n, text }: { y: number; n: number; text: string }) {
  return (
    <g>
      <text x="0"  y={y} fontSize="13" fontFamily="Courier, monospace" fontWeight="bold" fill="#a60000">
        {String(n).padStart(2, "0")}.
      </text>
      <text x="36" y={y} fontSize="13" fill="#0d1117">{text}</text>
    </g>
  );
}
