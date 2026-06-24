// T-501 — Rack Elevation. Front-elevation of a 45U two-post rack with all
// equipment placed at correct U positions, alongside an equipment schedule.
//
// Inspired by every real Division 27 submittal. Patch panels are sized by
// outlet count from the project; if no outlets are present, a sensible 96-port
// default rack populates so the sheet is never empty.

import type { Project } from "@/lib/projects/types";

interface Props {
  project: Project;
  outletCount: number;
  region: { w: number; h: number };
}

// Equipment slot: one item, sized in U.
interface Slot {
  /** U height of this item. */
  u: number;
  /** Slot kind for fill / styling. */
  kind: "fiber" | "patch_cu" | "patch_fi" | "switch" | "manager" | "pdu" | "blank";
  /** Label rendered on the face. */
  label: string;
  /** Smaller secondary line — port count / model / capacity. */
  sub?: string;
  /** Optional cable label callout (TIA-606-C). */
  callout?: string;
}

const RACK_U = 45;
const U_HEIGHT = 32;       // SVG units per U
const RACK_FACE_W = 540;   // 19" face

export function RackElevationSheet({ project, outletCount, region }: Props) {
  // Compute equipment list from outlet count.
  const slots = computeSlots(outletCount);

  const margin = 80;
  const titleY = 60;
  const rackX = margin + 200;
  const rackTopY = margin + 80;

  return (
    <g fontFamily="Helvetica, Arial, sans-serif">
      {/* Title */}
      <text x={margin} y={titleY} fontSize="38" fontWeight="bold" fill="#0d1117">
        MDF RACK ELEVATION
      </text>
      <text x={margin} y={titleY + 26} fontSize="13" fontFamily="Courier, monospace" fill="#666">
        45U two-post rack · 19&quot; EIA-310 · viewed from front · {project.name}
      </text>
      <line x1={margin} y1={titleY + 38} x2={region.w - margin} y2={titleY + 38} stroke="#0d1117" strokeWidth="2" />

      {/* U number labels — left of the rack face */}
      <g fontSize="11" fontFamily="Courier, monospace" fill="#444" textAnchor="end">
        {Array.from({ length: RACK_U + 1 }, (_, i) => {
          const u = RACK_U - i;
          const y = rackTopY + i * U_HEIGHT + 4;
          if (u === 0 || u % 2 !== 0 && u !== RACK_U) return null;
          return <text key={u} x={rackX - 12} y={y}>{u}U</text>;
        })}
      </g>

      {/* Rack frame — outer rails */}
      <rect x={rackX - 14} y={rackTopY} width="14" height={RACK_U * U_HEIGHT} fill="#cccfd2" stroke="#0d1117" />
      <rect x={rackX + RACK_FACE_W} y={rackTopY} width="14" height={RACK_U * U_HEIGHT} fill="#cccfd2" stroke="#0d1117" />

      {/* Rack face background */}
      <rect x={rackX} y={rackTopY} width={RACK_FACE_W} height={RACK_U * U_HEIGHT}
            fill="#f4f4f0" stroke="#0d1117" strokeWidth="2" />

      {/* Slots (rendered bottom-up since U numbering starts at the bottom) */}
      <SlotStack slots={slots} rackX={rackX} rackTopY={rackTopY} />

      {/* Bonding stud */}
      <g transform={`translate(${rackX + RACK_FACE_W + 30}, ${rackTopY + RACK_U * U_HEIGHT - 10})`}>
        <circle cx="0" cy="0" r="6" fill="#a60000" />
        <text x="14" y="4" fontSize="11" fontFamily="Courier, monospace" fontWeight="bold" fill="#a60000">
          BOND TO TGB
        </text>
        <text x="14" y="18" fontSize="11" fontFamily="Courier, monospace" fill="#666">
          #6 AWG, listed connector
        </text>
      </g>

      {/* Floor line */}
      <line x1={rackX - 60} y1={rackTopY + RACK_U * U_HEIGHT + 8}
            x2={rackX + RACK_FACE_W + 60} y2={rackTopY + RACK_U * U_HEIGHT + 8}
            stroke="#0d1117" strokeWidth="3" />
      <text x={rackX + RACK_FACE_W / 2} y={rackTopY + RACK_U * U_HEIGHT + 30}
            textAnchor="middle" fontSize="11" fontFamily="Courier, monospace" fill="#666">
        FINISHED FLOOR
      </text>

      {/* Equipment schedule on the right */}
      <EquipmentSchedule
        slots={slots}
        x={rackX + RACK_FACE_W + 220}
        y={rackTopY}
        w={region.w - (rackX + RACK_FACE_W + 220) - margin}
      />

      {/* Notes bottom */}
      <g transform={`translate(${margin}, ${region.h - 200})`}>
        <text x="0" y="0" fontSize="16" fontWeight="bold" fill="#0d1117" letterSpacing="1">NOTES</text>
        <line x1="0" y1="8" x2={region.w - margin * 2} y2="8" stroke="#0d1117" strokeWidth="2" />
        <NoteRow y={32} n={1} text="Mount all equipment per manufacturer instructions. Use 12-24 cage nuts and panel screws supplied with rack." />
        <NoteRow y={56} n={2} text="Provide 1U horizontal cable manager between every 48-port patch panel and every active switch." />
        <NoteRow y={80} n={3} text="Dress all patch cords through vertical cable manager. Maintain min bend radius. Color-code per project plan." />
        <NoteRow y={104} n={4} text="Bond rack to TGB with #6 AWG bonding conductor via listed irreversible connector per TIA-607-C." />
        <NoteRow y={128} n={5} text="Label all patch-panel ports per TIA-606-C: SITE-BUILDING-FLOOR-TR-CABLE#-STRAND#." />
      </g>
    </g>
  );
}

// ── Slot rendering ───────────────────────────────────────────────────────

function SlotStack({ slots, rackX, rackTopY }: { slots: Slot[]; rackX: number; rackTopY: number }) {
  // Bottom-up: U 1 is at the bottom. Walk slots from bottom to top.
  let uCursor = 0;
  const renderedSlots: React.ReactNode[] = [];
  for (let i = 0; i < slots.length; i++) {
    const slot = slots[i];
    const y = rackTopY + (RACK_U - uCursor - slot.u) * U_HEIGHT;
    renderedSlots.push(
      <SlotPanel key={i} slot={slot} x={rackX} y={y} />,
    );
    uCursor += slot.u;
  }
  return <>{renderedSlots}</>;
}

const KIND_STYLE: Record<Slot["kind"], { fill: string; stroke: string; text: string; accent: string }> = {
  fiber:    { fill: "#fff7d6", stroke: "#a66a00", text: "#0d1117", accent: "#a66a00" },
  patch_cu: { fill: "#ffffff", stroke: "#0d1117", text: "#0d1117", accent: "#0066cc" },
  patch_fi: { fill: "#fff7d6", stroke: "#a66a00", text: "#0d1117", accent: "#a66a00" },
  switch:   { fill: "#d8eef5", stroke: "#1c6a99", text: "#0d1117", accent: "#1c6a99" },
  manager:  { fill: "#e7e7e0", stroke: "#666",    text: "#444",    accent: "#666" },
  pdu:      { fill: "#0d1117", stroke: "#0d1117", text: "#ffffff", accent: "#f5b800" },
  blank:    { fill: "#cccfd2", stroke: "#666",    text: "#666",    accent: "#666" },
};

function SlotPanel({ slot, x, y }: { slot: Slot; x: number; y: number }) {
  const h = slot.u * U_HEIGHT;
  const style = KIND_STYLE[slot.kind];
  const labelFontSize = slot.u >= 2 ? 14 : 12;
  return (
    <g>
      <rect x={x} y={y} width={RACK_FACE_W} height={h}
            fill={style.fill} stroke={style.stroke} strokeWidth="1.5" />
      {/* Faceplate detail — ports for patch panels, blade slots for switches */}
      {slot.kind === "patch_cu" && (
        <g>
          {Array.from({ length: 24 }, (_, i) => (
            <rect key={i} x={x + 16 + i * 21} y={y + h * 0.35} width="14" height={h * 0.30}
                  fill="#222" stroke="#000" />
          ))}
        </g>
      )}
      {slot.kind === "patch_fi" && (
        <g>
          {Array.from({ length: 12 }, (_, i) => (
            <circle key={i} cx={x + 30 + i * 40} cy={y + h * 0.5} r="6"
                    fill="#fff" stroke="#a66a00" strokeWidth="1.5" />
          ))}
        </g>
      )}
      {slot.kind === "switch" && (
        <g>
          {Array.from({ length: 48 }, (_, i) => (
            <rect key={i} x={x + 16 + i * 10} y={y + h * 0.45} width="6" height={h * 0.30}
                  fill="#222" />
          ))}
          {/* LED bar */}
          <rect x={x + RACK_FACE_W - 32} y={y + 4} width="24" height="6" fill={style.accent} />
        </g>
      )}
      {slot.kind === "manager" && (
        <g>
          <line x1={x + 10} y1={y + h / 2} x2={x + RACK_FACE_W - 10} y2={y + h / 2}
                stroke="#888" strokeWidth="1" strokeDasharray="8,4" />
        </g>
      )}

      {/* Label */}
      <text x={x + RACK_FACE_W / 2} y={y + h / 2 + labelFontSize / 3}
            textAnchor="middle" fontSize={labelFontSize}
            fontWeight={slot.kind === "blank" ? "normal" : "bold"} fill={style.text}>
        {slot.label}
      </text>
      {slot.sub && (
        <text x={x + RACK_FACE_W / 2} y={y + h - 6}
              textAnchor="middle" fontSize="10" fontFamily="Courier, monospace" fill={style.text}>
          {slot.sub}
        </text>
      )}
      {/* Cable callout — emerges to the left */}
      {slot.callout && (
        <g>
          <line x1={x - 32} y1={y + h / 2} x2={x} y2={y + h / 2}
                stroke={style.accent} strokeWidth="2" />
          <circle cx={x - 36} cy={y + h / 2} r="3" fill={style.accent} />
          <text x={x - 44} y={y + h / 2 + 4} textAnchor="end"
                fontSize="10" fontFamily="Courier, monospace" fill={style.accent}>
            {slot.callout}
          </text>
        </g>
      )}
    </g>
  );
}

// ── Equipment schedule ───────────────────────────────────────────────────

function EquipmentSchedule({ slots, x, y, w }: { slots: Slot[]; x: number; y: number; w: number }) {
  const rowH = 26;
  // Aggregate counts by label so the schedule isn't 30 rows long.
  const map = new Map<string, { count: number; sub?: string }>();
  for (const s of slots) {
    if (s.kind === "blank" || s.kind === "manager") continue;
    const prev = map.get(s.label);
    map.set(s.label, { count: (prev?.count ?? 0) + 1, sub: s.sub });
  }
  const items = Array.from(map.entries());

  return (
    <g>
      <text x={x} y={y + 12} fontSize="22" fontWeight="bold" fill="#0d1117" letterSpacing="0.5">
        EQUIPMENT SCHEDULE
      </text>
      <line x1={x} y1={y + 28} x2={x + w} y2={y + 28} stroke="#0d1117" strokeWidth="2" />

      {/* Header */}
      <g fontSize="11" fontFamily="Courier, monospace" fill="#666">
        <text x={x}        y={y + 50}>ITEM</text>
        <text x={x + w - 80} y={y + 50} textAnchor="end">QTY</text>
      </g>
      <line x1={x} y1={y + 56} x2={x + w} y2={y + 56} stroke="#cccfd2" />

      {items.map(([label, info], i) => (
        <g key={label}>
          {i % 2 === 1 && (
            <rect x={x - 4} y={y + 64 + i * rowH - 16} width={w + 8} height={rowH} fill="#fafafa" />
          )}
          <text x={x}        y={y + 64 + i * rowH} fontSize="13" fill="#0d1117">{label}</text>
          {info.sub && (
            <text x={x} y={y + 64 + i * rowH + 14} fontSize="10" fontFamily="Courier, monospace" fill="#666">
              {info.sub}
            </text>
          )}
          <text x={x + w - 80} y={y + 64 + i * rowH} textAnchor="end"
                fontSize="13" fontFamily="Courier, monospace" fill="#0d1117">
            {info.count}
          </text>
        </g>
      ))}
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

// ── Equipment-list compute ───────────────────────────────────────────────

function computeSlots(outletCount: number): Slot[] {
  // 48-port patch panels populated to cover outlet count + 30% growth + spare.
  const ports = Math.max(96, Math.ceil(outletCount * 1.3 / 48) * 48);
  const patchPanels = Math.max(2, Math.ceil(ports / 48));

  const slots: Slot[] = [];

  // Top-of-rack: fiber housing
  slots.push({ u: 1, kind: "fiber", label: "Fiber housing", sub: "12-port LC duplex · OS2", callout: "BBC-01" });
  slots.push({ u: 1, kind: "manager", label: "Horizontal mgr", sub: "1U" });

  // Patch panels with managers
  for (let i = 0; i < patchPanels; i++) {
    slots.push({
      u: 1, kind: "patch_cu",
      label: `Cat 6A Patch Panel ${i + 1}`,
      sub: "48-port modular · Cat 6A",
      callout: `HC-${String(i + 1).padStart(2, "0")}`,
    });
    slots.push({ u: 1, kind: "manager", label: "Horizontal mgr", sub: "1U" });
  }

  // Core switch
  slots.push({
    u: 1, kind: "switch",
    label: "Core L3 switch",
    sub: "48-port PoE+ · 10 Gb uplinks",
  });
  slots.push({ u: 1, kind: "manager", label: "Horizontal mgr", sub: "1U" });

  // Edge switches — one per patch panel, capped at 4 total
  const edgeSwitches = Math.min(patchPanels, 4);
  for (let i = 0; i < edgeSwitches; i++) {
    slots.push({
      u: 1, kind: "switch",
      label: `Edge switch ${i + 1}`,
      sub: "48-port PoE++ · 802.3bt",
    });
    slots.push({ u: 1, kind: "manager", label: "Horizontal mgr", sub: "1U" });
  }

  // UPS placeholder (rack-mount 2U)
  slots.push({ u: 2, kind: "pdu", label: "Rack UPS · 1500 VA", sub: "Network management · APC SMT1500RM2UC" });
  slots.push({ u: 1, kind: "manager", label: "Horizontal mgr", sub: "1U" });

  // PDU at the bottom
  slots.push({ u: 1, kind: "pdu", label: "Horizontal PDU · 20A", sub: "L5-20P input · 8× 5-20R" });

  // Fill remaining with blanking panels
  const usedU = slots.reduce((s, x) => s + x.u, 0);
  const remainingU = RACK_U - usedU;
  if (remainingU > 0) {
    // Single big blanking row at the bottom is fine; pretend they're 4U groups.
    let left = remainingU;
    while (left > 0) {
      const u = Math.min(4, left);
      slots.push({ u, kind: "blank", label: "BLANKING PANEL" });
      left -= u;
    }
  }

  return slots;
}
