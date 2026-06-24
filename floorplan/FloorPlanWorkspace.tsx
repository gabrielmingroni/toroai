"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type { Project } from "@/lib/projects/types";
import type { ExtractedRoom } from "@/lib/intake/types";
import type { PlacementState } from "@/lib/placement/types";
import type { DesignParameters } from "@/lib/design/types";
import { placementClient } from "@/lib/placement/client";
import { snapToWall } from "@/lib/floorplan/geometry";
import { FloorPlanToolbar, type Tool } from "./FloorPlanToolbar";
import { FloorPlanCanvas } from "./FloorPlanCanvas";
import { PropertiesPanel } from "./PropertiesPanel";
import { FloorTabs } from "./FloorTabs";
import { LayerPanel, DEFAULT_LAYERS, type LayerKey, type LayerState } from "./LayerPanel";

/** Selection keys: "room:R101", "outlet:o_abc", "wap:ap_xyz" */
export type SelectionSet = Set<string>;

export function FloorPlanWorkspace({
  project, rooms, initialPlacements, designParameters,
}: {
  project: Project;
  rooms: ExtractedRoom[];
  initialPlacements: PlacementState;
  designParameters: DesignParameters;
}) {
  const [placements, setPlacements] = useState<PlacementState>(initialPlacements);
  const [tool, setTool] = useState<Tool>("select");
  const [floor, setFloor] = useState<number>(1);
  const [selection, setSelection] = useState<SelectionSet>(new Set());
  const [layers, setLayers] = useState<LayerState>(DEFAULT_LAYERS);
  const [busy, setBusy] = useState(false);

  const floorList = useMemo(() => {
    const set = new Set(rooms.map(r => r.floor));
    return Array.from(set).sort((a, b) => a - b);
  }, [rooms]);

  const roomsOnFloor   = useMemo(() => rooms.filter(r => r.floor === floor && !r.excluded), [rooms, floor]);
  const outletsOnFloor = useMemo(() => placements.outlets.filter(o => o.floor === floor), [placements, floor]);
  const wapsOnFloor    = useMemo(() => placements.waps.filter(w => w.floor === floor), [placements, floor]);

  useEffect(() => { setSelection(new Set()); }, [floor]);

  // Keyboard shortcuts
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if ((e.target as HTMLElement)?.tagName === "INPUT") return;
      if (e.key === "Escape") { setTool("select"); setSelection(new Set()); }
      if ((e.key === "Delete" || e.key === "Backspace") && selection.size) deleteSelection();
      if (e.key === "o" || e.key === "O") setTool("outlet");
      else if (e.key === "w" || e.key === "W") setTool("wap");
      else if (e.key === "v" || e.key === "V") setTool("select");
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selection]);

  function findRoomAt(x: number, y: number): ExtractedRoom | undefined {
    return roomsOnFloor.find(r => x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h);
  }

  // ── Canvas click → placement or deselect ───────────────────────────────────
  const handleCanvasClick = useCallback(async (x: number, y: number, additive: boolean) => {
    if (tool === "select") {
      if (!additive) setSelection(new Set());
      return;
    }
    setBusy(true);
    if (tool === "outlet") {
      const snap = snapToWall(x, y, roomsOnFloor);
      const sx = snap?.x ?? x;
      const sy = snap?.y ?? y;
      const roomId = snap?.roomId ?? findRoomAt(x, y)?.id ?? null;
      const res = await placementClient.addOutlet(project.id, {
        x: sx, y: sy, floor, roomId, ports: designParameters.portsPerOutlet, source: "rcdd",
      });
      if (res.ok && res.state) setPlacements(res.state);
    } else if (tool === "wap") {
      const room = findRoomAt(x, y);
      const res = await placementClient.addWap(project.id, {
        x, y, floor, roomId: room?.id ?? null, coverageRadiusFt: designParameters.wapCoverageRadiusFt, source: "rcdd",
      });
      if (res.ok && res.state) setPlacements(res.state);
    }
    setBusy(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tool, floor, roomsOnFloor, designParameters, project.id]);

  // ── Element click → select with optional additive ──────────────────────────
  function handleSelect(kind: "room" | "outlet" | "wap", id: string, additive: boolean) {
    const key = `${kind}:${id}`;
    setSelection(prev => {
      const next = new Set(prev);
      if (additive) {
        if (next.has(key)) next.delete(key);
        else next.add(key);
      } else {
        next.clear();
        next.add(key);
      }
      return next;
    });
  }

  // ── Box select → grab everything inside the rect ───────────────────────────
  function handleBoxSelect(x1: number, y1: number, x2: number, y2: number, additive: boolean) {
    setSelection(prev => {
      const next = additive ? new Set(prev) : new Set<string>();
      outletsOnFloor.forEach(o => { if (o.x >= x1 && o.x <= x2 && o.y >= y1 && o.y <= y2) next.add(`outlet:${o.id}`); });
      wapsOnFloor   .forEach(w => { if (w.x >= x1 && w.x <= x2 && w.y >= y1 && w.y <= y2) next.add(`wap:${w.id}`); });
      return next;
    });
  }

  async function deleteSelection() {
    if (!selection.size) return;
    setBusy(true);
    const ids = Array.from(selection);
    for (const key of ids) {
      const [kind, id] = key.split(":");
      if (kind === "outlet") {
        const res = await placementClient.removeOutlet(project.id, id);
        if (res.ok && res.state) setPlacements(res.state);
      } else if (kind === "wap") {
        const res = await placementClient.removeWap(project.id, id);
        if (res.ok && res.state) setPlacements(res.state);
      }
    }
    setSelection(new Set());
    setBusy(false);
  }

  async function autoOutlets() {
    setBusy(true);
    const res = await placementClient.autoOutlets(project.id);
    if (res.ok && res.state) setPlacements(res.state);
    setBusy(false);
  }
  async function autoWaps() {
    setBusy(true);
    const res = await placementClient.autoWaps(project.id);
    if (res.ok && res.state) setPlacements(res.state);
    setBusy(false);
  }
  async function approveAll() {
    setBusy(true);
    const res = await placementClient.approveAllPending(project.id);
    if (res.ok && res.state) setPlacements(res.state);
    setBusy(false);
  }
  async function clearAi() {
    setBusy(true);
    const res = await placementClient.clearAi(project.id);
    if (res.ok && res.state) setPlacements(res.state);
    setBusy(false);
  }
  async function setOutletApproval(id: string, approved: boolean) {
    setBusy(true);
    const res = await placementClient.setOutletApproval(project.id, id, approved ? "approved" : "rejected");
    if (res.ok && res.state) setPlacements(res.state);
    setBusy(false);
  }
  async function setWapApproval(id: string, approved: boolean) {
    setBusy(true);
    const res = await placementClient.setWapApproval(project.id, id, approved ? "approved" : "rejected");
    if (res.ok && res.state) setPlacements(res.state);
    setBusy(false);
  }

  function toggleLayer(key: LayerKey, value: boolean) {
    setLayers(prev => ({ ...prev, [key]: value }));
  }

  // Resolve the single-selection target for the Properties panel.
  // If multi-selected, the panel shows a bulk summary.
  const propsSelection = useMemo(() => {
    if (selection.size === 0) return null;
    if (selection.size === 1) {
      const [first] = selection;
      const [kind, id] = first.split(":");
      return { kind, id } as { kind: "room" | "outlet" | "wap"; id: string };
    }
    return null; // multi-select; props panel will show count
  }, [selection]);

  const pendingOutlets = placements.outlets.filter(o => o.approval === "pending").length;
  const pendingWaps    = placements.waps.filter(w => w.approval === "pending").length;

  return (
    <div className="h-full flex flex-col">
      <FloorPlanToolbar
        tool={tool}
        onTool={setTool}
        onAutoOutlets={autoOutlets}
        onAutoWaps={autoWaps}
        onApproveAll={approveAll}
        onClearAi={clearAi}
        onDelete={selection.size ? deleteSelection : undefined}
        pendingCount={pendingOutlets + pendingWaps}
        outletCount={placements.outlets.length}
        wapCount={placements.waps.length}
        busy={busy}
      />

      <FloorTabs floors={floorList} active={floor} onChange={setFloor} />

      <div className="flex-1 min-h-0 flex">
        <FloorPlanCanvas
          rooms={roomsOnFloor}
          outlets={outletsOnFloor}
          waps={wapsOnFloor}
          tool={tool}
          selection={selection}
          layers={layers}
          projectNumber={project.number}
          floor={floor}
          onCanvasClick={handleCanvasClick}
          onSelect={handleSelect}
          onBoxSelect={handleBoxSelect}
        />
        <LayerPanel value={layers} onChange={toggleLayer} />
        <PropertiesPanel
          selection={propsSelection}
          multiCount={selection.size > 1 ? selection.size : 0}
          rooms={rooms}
          placements={placements}
          designParameters={designParameters}
          onOutletApproval={setOutletApproval}
          onWapApproval={setWapApproval}
          onDelete={deleteSelection}
        />
      </div>
    </div>
  );
}
