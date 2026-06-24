// T-300 — Enlarged TR Plan. A zoomed view of one telecommunications room
// showing rack positions, overhead ladder rack, conduit entries, TGB, and
// the BICSI / TIA-569-D minimum clear-floor area annotations.
//
// Inputs: the project (for TR scope context), the intake rooms (we pick the
// first MDF/IDF on floor 1), and the region size. Falls back to a synthetic
// 14′×16′ MDF layout when no TR room is in the intake state.

import type { Project } from "@/lib/projects/types";
import type { ExtractedRoom } from "@/lib/intake/types";

interface Props {
  project: Project;
  rooms: ExtractedRoom[];
  region: { w: number; h: number };
}

export function EnlargedTrSheet({ project, rooms, region }: Props) {
  // Find an MDF or IDF on floor 1; otherwise fall back to a synthetic 14×16 room.
  const target =
    rooms.find(r => !r.excluded && r.floor === 1 && (r.overrideType ?? r.type) === "mdf") ??
    rooms.find(r => !r.excluded && r.floor === 1 && (r.overrideType ?? r.type) === "idf");

  const roomName = target
    ? (target.overrideName ?? target.name).toUpperCase()
    : (project.exhibit?.cable.startLocation ?? "MAIN DISTRIBUTION FRAME").toUpperCase();
  const roomKindLabel = target
    ? ((target.overrideType ?? target.type) === "mdf" ? "MDF" : "IDF")
    : "MDF";

  // Room dimensions in feet — fall back to a 14×16 reference room.
  const roomW = target?.w && target.w > 4 ? Math.round(target.w) : 14;
  const roomH = target?.h && target.h > 4 ? Math.round(target.h) : 16;

  // Drawing region scale. Margin 80; plan occupies left ~65%, schedule on right.
  const margin = 80;
  const planAreaW = region.w * 0.62 - margin * 2;
  const planAreaH = region.h - margin * 2;

  const sx = planAreaW / roomW;
  const sy = planAreaH / roomH;
  const s = Math.min(sx, sy);
  const drawnW = roomW * s;
  const drawnH = roomH * s;
  const offX = margin + (planAreaW - drawnW) / 2;
  const offY = margin + (planAreaH - drawnH) / 2;

  // Title above plan
  const planTitle = `ENLARGED ${roomKindLabel} PLAN — ${roomName}`;

  return (
    <g fontFamily="Helvetica, Arial, sans-serif">
      {/* Title strip */}
      <text x={offX} y={offY - 32} fontSize="22" fontWeight="bold" fill="#0d1117">
        {planTitle}
      </text>
      <text x={offX} y={offY - 12} fontSize="13" fontFamily="Courier, monospace" fill="#666">
        SCALE 1/2&quot; = 1&apos;-0&quot;  ·  TIA-569-D MINIMUM CLEAR FLOOR AREA
      </text>

      {/* Room outline */}
      <rect x={offX} y={offY} width={drawnW} height={drawnH}
            fill="#ffffff" stroke="#0d1117" strokeWidth="8" />

      {/* Walls — thick lines */}
      <g stroke="#0d1117" strokeWidth="6" fill="none">
        <line x1={offX}          y1={offY}          x2={offX + drawnW} y2={offY} />
        <line x1={offX + drawnW} y1={offY}          x2={offX + drawnW} y2={offY + drawnH} />
        <line x1={offX}          y1={offY + drawnH} x2={offX + drawnW} y2={offY + drawnH} />
        <line x1={offX}          y1={offY}          x2={offX}          y2={offY + drawnH} />
      </g>

      {/* Door swing — bottom wall, left side */}
      <DoorSwing x={offX + 80} y={offY + drawnH} swing="up" />

      {/* Overhead ladder rack — runs along ceiling north→south, dashed */}
      <line
        x1={offX + drawnW * 0.45} y1={offY + 30}
        x2={offX + drawnW * 0.45} y2={offY + drawnH - 30}
        stroke="#0066cc" strokeWidth="6" strokeDasharray="14,6"
      />
      <text x={offX + drawnW * 0.45 + 10} y={offY + 50} fontSize="11"
            fontFamily="Courier, monospace" fill="#0066cc">
        12&quot; LADDER RACK
      </text>
      <text x={offX + drawnW * 0.45 + 10} y={offY + 64} fontSize="11"
            fontFamily="Courier, monospace" fill="#0066cc">
        OVERHEAD, +10&apos;-0&quot; AFF
      </text>

      {/* Two-post racks — center of the room, beneath the ladder rack */}
      <Rack x={offX + drawnW * 0.45 - 84} y={offY + drawnH * 0.40} label="RACK A" />
      <Rack x={offX + drawnW * 0.45 - 84} y={offY + drawnH * 0.55} label="RACK B" />

      {/* TGB on the rear wall */}
      <g transform={`translate(${offX + drawnW - 70}, ${offY + 60})`}>
        <rect x="0" y="0" width="40" height="14" fill="#fff7d6" stroke="#a60000" strokeWidth="3" />
        <text x="50" y="12" fontSize="11" fontFamily="Courier, monospace" fontWeight="bold" fill="#a60000">
          TGB
        </text>
        <text x="-40" y="12" fontSize="10" fontFamily="Courier, monospace" fill="#666">
          ↓ #6 AWG TBB
        </text>
      </g>

      {/* Conduit entries — top wall, 3 stubs */}
      {[0.3, 0.45, 0.6].map((frac, i) => (
        <g key={i}>
          <rect
            x={offX + drawnW * frac - 8} y={offY - 20}
            width="16" height="20" fill="#cccfd2" stroke="#0d1117" strokeWidth="2"
          />
          <text x={offX + drawnW * frac} y={offY - 26} textAnchor="middle"
                fontSize="9" fontFamily="Courier, monospace" fill="#666">
            {i === 0 ? "BBC" : i === 1 ? "HOR" : "SPARE"}
          </text>
        </g>
      ))}
      <text x={offX + drawnW * 0.45} y={offY - 50} textAnchor="middle"
            fontSize="11" fontFamily="Courier, monospace" fill="#444">
        2&quot; EMT CONDUIT STUBS (3) — FIRE-STOP AT PENETRATION
      </text>

      {/* Dimensions — front + rear clearance */}
      <Dimension
        x1={offX + drawnW * 0.45 - 84} y1={offY + drawnH * 0.40 - 30}
        x2={offX + drawnW * 0.45 - 84} y2={offY + 16}
        label="3'-0&quot; MIN" />
      <Dimension
        x1={offX + drawnW * 0.45 + 70} y1={offY + drawnH * 0.40 + 10}
        x2={offX + drawnW - 16} y2={offY + drawnH * 0.40 + 10}
        label="3'-0&quot; MIN" horizontal />

      {/* Overall dimensions outside the walls */}
      <text x={offX + drawnW / 2} y={offY + drawnH + 36} textAnchor="middle"
            fontSize="13" fontFamily="Courier, monospace" fill="#0d1117">
        {roomW}&apos;-0&quot;
      </text>
      <text x={offX - 24} y={offY + drawnH / 2} textAnchor="middle"
            fontSize="13" fontFamily="Courier, monospace" fill="#0d1117"
            transform={`rotate(-90, ${offX - 24}, ${offY + drawnH / 2})`}>
        {roomH}&apos;-0&quot;
      </text>

      {/* North arrow lower-left */}
      <g transform={`translate(${offX + 30}, ${offY + drawnH - 80})`}>
        <circle cx="20" cy="20" r="20" fill="none" stroke="#222" strokeWidth="2" />
        <polygon points="20,4 14,28 20,22 26,28" fill="#222" />
        <text x="20" y="42" textAnchor="middle" fontSize="12" fontWeight="bold" fill="#222">N</text>
      </g>

      {/* Equipment / Clearance schedule on the right */}
      <ClearanceSchedule
        x={offX + planAreaW + 60}
        y={offY}
        w={region.w - (offX + planAreaW + 60) - margin}
        roomKind={roomKindLabel}
        roomW={roomW}
        roomH={roomH}
      />
    </g>
  );
}

// ── Rack ─────────────────────────────────────────────────────────────────

function Rack({ x, y, label }: { x: number; y: number; label: string }) {
  // 19" rack = 24" footprint; drawn at scale s applied by caller. Render as
  // a 84×56 rectangle here — caller positions us, the SheetCanvas absolute
  // grid does the rest.
  return (
    <g>
      <rect x={x} y={y} width="84" height="56" fill="#fafafa" stroke="#0d1117" strokeWidth="3" />
      {/* Interior — patch-panel suggestion lines */}
      {[10, 22, 34, 46].map(dy => (
        <line key={dy} x1={x + 6} y1={y + dy} x2={x + 78} y2={y + dy} stroke="#aaa" strokeWidth="1" />
      ))}
      <text x={x + 42} y={y + 38} textAnchor="middle"
            fontSize="11" fontWeight="bold" fontFamily="Helvetica, Arial, sans-serif" fill="#0d1117">
        {label}
      </text>
      <text x={x + 42} y={y - 6} textAnchor="middle"
            fontSize="9" fontFamily="Courier, monospace" fill="#666">
        7'-0" 45U
      </text>
    </g>
  );
}

// ── Door swing ───────────────────────────────────────────────────────────

function DoorSwing({ x, y, swing }: { x: number; y: number; swing: "up" | "down" }) {
  const r = 80;
  const isUp = swing === "up";
  return (
    <g stroke="#0d1117" fill="none" strokeWidth="2">
      <line x1={x} y1={y} x2={x + r} y2={y} strokeWidth="0" />
      <path
        d={isUp
          ? `M ${x} ${y} A ${r} ${r} 0 0 1 ${x + r} ${y - r}`
          : `M ${x} ${y} A ${r} ${r} 0 0 0 ${x + r} ${y + r}`} />
      <line x1={x} y1={y} x2={x} y2={isUp ? y - r : y + r} />
    </g>
  );
}

// ── Dimension line ───────────────────────────────────────────────────────

function Dimension({
  x1, y1, x2, y2, label, horizontal = false,
}: {
  x1: number; y1: number; x2: number; y2: number; label: string; horizontal?: boolean;
}) {
  const mx = (x1 + x2) / 2;
  const my = (y1 + y2) / 2;
  return (
    <g stroke="#a60000" fill="#a60000">
      <line x1={x1} y1={y1} x2={x2} y2={y2} strokeWidth="2" />
      {/* End ticks */}
      <line x1={x1 - 6} y1={y1 - (horizontal ? 6 : 0)}
            x2={x1 + 6} y2={y1 + (horizontal ? 6 : 0)} strokeWidth="2" />
      <line x1={x2 - 6} y1={y2 - (horizontal ? 6 : 0)}
            x2={x2 + 6} y2={y2 + (horizontal ? 6 : 0)} strokeWidth="2" />
      <text x={mx + (horizontal ? 0 : 8)} y={my + (horizontal ? -6 : 4)}
            textAnchor="middle"
            fontSize="11" fontFamily="Courier, monospace">{label}</text>
    </g>
  );
}

// ── Schedule on the right ────────────────────────────────────────────────

function ClearanceSchedule({
  x, y, w, roomKind, roomW, roomH,
}: { x: number; y: number; w: number; roomKind: string; roomW: number; roomH: number }) {
  const rowH = 28;
  const rows: Array<{ k: string; v: string }> = [
    { k: "Room",                v: roomKind },
    { k: "Inside dimensions",   v: `${roomW}'-0" × ${roomH}'-0"` },
    { k: "Net floor area",      v: `${roomW * roomH} SF` },
    { k: "Front clearance",     v: "3'-0\" min per TIA-569-D" },
    { k: "Rear clearance",      v: "3'-0\" min per TIA-569-D" },
    { k: "Ceiling height",      v: "10'-0\" min" },
    { k: "Door",                v: "36\" wide, opens outward" },
    { k: "HVAC",                v: "Dedicated AC, 64-75°F" },
    { k: "Lighting",            v: "50 fc maintained @ 3' AFF" },
    { k: "Power",               v: "Dedicated 20A 120V circuits + UPS" },
    { k: "Grounding",           v: "TGB bonded to TMGB with #6 AWG TBB" },
    { k: "Fire suppression",    v: "Per AHJ — clean agent preferred" },
  ];
  return (
    <g>
      <text x={x} y={y + 12} fontSize="22" fontWeight="bold" fill="#0d1117" letterSpacing="0.5">
        TR REQUIREMENTS
      </text>
      <text x={x} y={y + 36} fontSize="12" fontFamily="Courier, monospace" fill="#666">
        Per TIA-569-D and BICSI TDMM Ch. 7
      </text>
      <line x1={x} y1={y + 46} x2={x + w} y2={y + 46} stroke="#0d1117" strokeWidth="2" />

      {rows.map((r, i) => (
        <g key={r.k} fontFamily="Helvetica, Arial, sans-serif">
          {i % 2 === 1 && (
            <rect x={x} y={y + 56 + i * rowH - 18} width={w} height={rowH} fill="#fafafa" />
          )}
          <text x={x + 8} y={y + 56 + i * rowH} fontSize="12" fontFamily="Courier, monospace" fill="#666">
            {r.k.toUpperCase()}
          </text>
          <text x={x + 220} y={y + 56 + i * rowH} fontSize="13" fill="#0d1117">{r.v}</text>
        </g>
      ))}

      {/* Note */}
      <g transform={`translate(${x}, ${y + 56 + rows.length * rowH + 30})`}>
        <text x="0" y="0" fontSize="13" fontFamily="Courier, monospace" fontWeight="bold" fill="#a60000">
          NOTES
        </text>
        <NoteRow y={22} n={1} text="Maintain minimum 12&quot; clearance from EMI sources (motors, transformers, ballasts) per TIA-569-D." />
        <NoteRow y={48} n={2} text="Provide service loop in cable tray per BICSI TDMM Ch. 14 — 10 ft minimum at each TR." />
        <NoteRow y={74} n={3} text="Verify floor loading capacity prior to rack installation. Anchor racks with seismic-rated hardware per IBC zone." />
      </g>
    </g>
  );
}

function NoteRow({ y, n, text }: { y: number; n: number; text: string }) {
  return (
    <g>
      <text x="0"  y={y} fontSize="12" fontFamily="Courier, monospace" fontWeight="bold" fill="#a60000">
        {String(n).padStart(2, "0")}.
      </text>
      <text x="32" y={y} fontSize="12" fill="#0d1117">{text}</text>
    </g>
  );
}
