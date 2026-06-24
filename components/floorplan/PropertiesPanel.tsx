"use client";

import clsx from "clsx";
import type { ExtractedRoom } from "@/lib/intake/types";
import { ROOM_TYPE_LABEL } from "@/lib/intake/types";
import type { PlacementState } from "@/lib/placement/types";
import type { DesignParameters } from "@/lib/design/types";

type SingleSelection = { kind: "room" | "outlet" | "wap"; id: string };

export function PropertiesPanel({
  selection, multiCount, rooms, placements, designParameters,
  onOutletApproval, onWapApproval, onDelete,
}: {
  selection: SingleSelection | null;
  multiCount: number;
  rooms: ExtractedRoom[];
  placements: PlacementState;
  designParameters: DesignParameters;
  onOutletApproval: (id: string, approved: boolean) => void;
  onWapApproval: (id: string, approved: boolean) => void;
  onDelete: () => void;
}) {
  return (
    <aside className="w-[280px] bg-chrome border-l border-chrome-dark flex-shrink-0 flex flex-col">
      <div className="px-3 py-2 border-b border-chrome-dark bg-chrome-dark flex items-center justify-between">
        <div className="text-[10px] uppercase tracking-[0.06em] text-text3 font-mono">Properties</div>
        {multiCount > 0 && <div className="text-[10.5px] text-accent font-mono">{multiCount} selected</div>}
      </div>
      <div className="flex-1 overflow-y-auto">
        {!selection && multiCount === 0 && <EmptyState />}
        {multiCount > 0 && <MultiState count={multiCount} onDelete={onDelete} />}
        {selection?.kind === "room" && (
          <RoomPanel room={rooms.find(r => r.id === selection.id)!} placements={placements} />
        )}
        {selection?.kind === "outlet" && (
          <OutletPanel
            outlet={placements.outlets.find(o => o.id === selection.id)!}
            rooms={rooms}
            designParameters={designParameters}
            onApproval={onOutletApproval}
            onDelete={onDelete}
          />
        )}
        {selection?.kind === "wap" && (
          <WapPanel
            wap={placements.waps.find(w => w.id === selection.id)!}
            rooms={rooms}
            designParameters={designParameters}
            onApproval={onWapApproval}
            onDelete={onDelete}
          />
        )}
      </div>
    </aside>
  );
}

function EmptyState() {
  return (
    <div className="px-4 py-8 text-[11px] text-text4 leading-relaxed">
      Select a room, outlet, or WAP on the canvas.
      <div className="mt-3 font-mono text-[10.5px] text-text4">
        Tools:
        <ul className="mt-1 space-y-0.5">
          <li><span className="text-text3">Click</span> · select element</li>
          <li><span className="text-text3">Drag</span> · box-select</li>
          <li><span className="text-text3">Shift+click</span> · add to selection</li>
          <li><span className="text-text3">Space+drag</span> · pan</li>
          <li><span className="text-text3">Wheel</span> · zoom</li>
          <li><span className="text-text3">Esc</span> · clear · <span className="text-text3">Del</span> · delete</li>
        </ul>
      </div>
    </div>
  );
}

function MultiState({ count, onDelete }: { count: number; onDelete: () => void }) {
  return (
    <div>
      <div className="px-4 py-3 border-b border-chrome-dark bg-chrome-light">
        <div className="text-[10.5px] text-text3 font-mono uppercase tracking-[0.06em]">Multi-select</div>
        <div className="text-[14px] font-semibold mt-0.5">{count} elements</div>
      </div>
      <div className="px-4 py-4">
        <button onClick={onDelete}
          className="w-full text-[11.5px] text-fail border border-fail/40 hover:bg-fail/10 rounded-[2px] py-2 font-medium">
          Delete all selected
        </button>
      </div>
    </div>
  );
}

function RoomPanel({ room, placements }: { room: ExtractedRoom; placements: PlacementState }) {
  const outletsInRoom = placements.outlets.filter(o => o.roomId === room.id).length;
  const wapsInRoom    = placements.waps.filter(w => w.roomId === room.id).length;
  return (
    <div>
      <div className="px-4 py-3 border-b border-chrome-dark bg-chrome-light">
        <div className="text-[10.5px] text-text3 font-mono uppercase tracking-[0.06em]">Room</div>
        <div className="text-[14px] font-semibold mt-0.5">{room.overrideName ?? room.name}</div>
        <div className="text-[10.5px] text-text3 font-mono mt-0.5">{room.id} · Floor {room.floor}</div>
      </div>
      <Section title="Geometry">
        <Row k="Type"       v={ROOM_TYPE_LABEL[room.overrideType ?? room.type]} />
        <Row k="Area"       v={`${room.area.toLocaleString()} SF`} mono />
        <Row k="Dimensions" v={`${room.w} × ${room.h}`} mono />
        <Row k="Source"     v={room.source} mono />
        <Row k="Confidence" v={`${(room.confidence * 100).toFixed(0)}%`} mono />
      </Section>
      <Section title="Equipment">
        <Row k="Outlets" v={outletsInRoom} mono />
        <Row k="WAPs"    v={wapsInRoom} mono />
      </Section>
    </div>
  );
}

function OutletPanel({
  outlet, rooms, designParameters, onApproval, onDelete,
}: {
  outlet: PlacementState["outlets"][number];
  rooms: ExtractedRoom[];
  designParameters: DesignParameters;
  onApproval: (id: string, approved: boolean) => void;
  onDelete: () => void;
}) {
  const room = outlet.roomId ? rooms.find(r => r.id === outlet.roomId) : undefined;
  return (
    <div>
      <div className="px-4 py-3 border-b border-chrome-dark bg-chrome-light">
        <div className="text-[10.5px] text-text3 font-mono uppercase tracking-[0.06em]">Outlet</div>
        <div className="text-[14px] font-semibold mt-0.5">{outlet.labelOverride ?? outlet.id}</div>
        <div className="text-[10.5px] text-text3 font-mono mt-0.5">
          {room ? room.name : "Unassigned"} · {outlet.source.toUpperCase()}
        </div>
      </div>
      <ApprovalBlock approval={outlet.approval} onApprove={() => onApproval(outlet.id, true)} onReject={() => onApproval(outlet.id, false)} />
      <Section title="Specification">
        <Row k="Ports"    v={outlet.ports} mono />
        <Row k="Media"    v={`Cat6A · 10 Gbps · ${designParameters.standards.poePlus}`} />
        <Row k="Standard" v="TIA-568.1-D §6.6" mono />
      </Section>
      <Section title="Location">
        <Row k="Floor"    v={outlet.floor} mono />
        <Row k="Position" v={`X ${outlet.x.toFixed(1)}, Y ${outlet.y.toFixed(1)}`} mono />
        <Row k="Mounting" v="Wall, 18″ AFF" />
      </Section>
      <DeleteRow onDelete={onDelete} />
    </div>
  );
}

function WapPanel({
  wap, rooms, designParameters, onApproval, onDelete,
}: {
  wap: PlacementState["waps"][number];
  rooms: ExtractedRoom[];
  designParameters: DesignParameters;
  onApproval: (id: string, approved: boolean) => void;
  onDelete: () => void;
}) {
  const room = wap.roomId ? rooms.find(r => r.id === wap.roomId) : undefined;
  return (
    <div>
      <div className="px-4 py-3 border-b border-chrome-dark bg-chrome-light">
        <div className="text-[10.5px] text-text3 font-mono uppercase tracking-[0.06em]">Wireless AP</div>
        <div className="text-[14px] font-semibold mt-0.5">{wap.labelOverride ?? wap.id}</div>
        <div className="text-[10.5px] text-text3 font-mono mt-0.5">
          {room ? room.name : "Unassigned"} · {wap.source.toUpperCase()}
        </div>
      </div>
      <ApprovalBlock approval={wap.approval} onApprove={() => onApproval(wap.id, true)} onReject={() => onApproval(wap.id, false)} />
      <Section title="Specification">
        <Row k="Standard" v={designParameters.wapStandard === "802_11be" ? "802.11be (Wi-Fi 7)" : "802.11ax (Wi-Fi 6/6E)"} />
        <Row k="PoE"      v={designParameters.standards.poePlus} mono />
        <Row k="Mounting" v="Ceiling" />
      </Section>
      <Section title="Coverage">
        <Row k="Radius" v={`${wap.coverageRadiusFt} ft`} mono />
        <Row k="Area"   v={`${Math.round(Math.PI * wap.coverageRadiusFt ** 2).toLocaleString()} SF`} mono />
        <Row k="Standard" v="BICSI §12.3" mono />
      </Section>
      <Section title="Location">
        <Row k="Floor"    v={wap.floor} mono />
        <Row k="Position" v={`X ${wap.x.toFixed(1)}, Y ${wap.y.toFixed(1)}`} mono />
      </Section>
      <DeleteRow onDelete={onDelete} />
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="px-4 py-3 border-b border-chrome-dark">
      <div className="text-[9.5px] text-text4 font-mono uppercase tracking-[0.06em] mb-1.5">{title}</div>
      {children}
    </div>
  );
}

function Row({ k, v, mono = false }: { k: string; v: string | number; mono?: boolean }) {
  return (
    <div className="flex justify-between py-1 text-[11.5px]">
      <span className="text-text3">{k}</span>
      <span className={clsx("text-text2", mono && "font-mono tabular-nums")}>{v}</span>
    </div>
  );
}

function ApprovalBlock({ approval, onApprove, onReject }: {
  approval: "approved" | "rejected" | "pending"; onApprove: () => void; onReject: () => void;
}) {
  return (
    <div className="px-4 py-3 border-b border-chrome-dark flex items-center gap-2">
      <span className={clsx(
        "px-2 py-1 rounded-[2px] text-[10.5px] font-mono uppercase tracking-[0.06em] flex-1 text-center",
        approval === "approved" && "bg-pass/15 text-pass",
        approval === "rejected" && "bg-fail/15 text-fail",
        approval === "pending"  && "bg-warn/15 text-warn",
      )}>
        {approval}
      </span>
      <button
        onClick={onApprove}
        className="px-2.5 py-1 text-[11px] bg-pass/15 text-pass hover:bg-pass/25 rounded-[2px] font-medium"
      >✓ Approve</button>
      <button
        onClick={onReject}
        className="px-2.5 py-1 text-[11px] text-text3 hover:text-fail font-mono"
      >Reject</button>
    </div>
  );
}

function DeleteRow({ onDelete }: { onDelete: () => void }) {
  return (
    <div className="px-4 py-3">
      <button
        onClick={onDelete}
        className="w-full text-[11px] text-fail border border-fail/40 hover:bg-fail/10 rounded-[2px] py-1.5 font-medium"
      >Delete</button>
    </div>
  );
}
