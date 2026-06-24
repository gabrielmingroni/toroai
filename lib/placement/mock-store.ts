import { randomBytes } from "crypto";
import { projectStore } from "@/lib/projects/mock-store";
import { intakeStore } from "@/lib/intake/mock-store";
import { designStore } from "@/lib/design/mock-store";
import type {
  PlacementState, OutletPlacement, WapPlacement, TrPlacement, ApprovalState,
} from "./types";
import type { ExtractedRoom } from "@/lib/intake/types";

const byProject = new Map<string, PlacementState>();

function id(prefix: string) {
  return `${prefix}_${randomBytes(4).toString("hex")}`;
}

function emptyState(projectId: string): PlacementState {
  return { projectId, outlets: [], waps: [], trs: [], updatedAt: new Date().toISOString() };
}

const WORKAREA_ROOM_TYPES = new Set([
  "open_office", "private_office", "conference", "classroom",
  "patient_room", "exam_room", "lab",
]);

function densityOutletsForRoom(room: ExtractedRoom, density: number): number {
  // BICSI §12.4.2: outlets needed = ceil(roomArea / density)
  return Math.max(1, Math.ceil(room.area / density));
}

function placeOutletsInRoom(room: ExtractedRoom, count: number): OutletPlacement[] {
  // Place outlets evenly along the perimeter (interior offset of 2 grid units)
  const inset = 2;
  const x0 = room.x + inset;
  const y0 = room.y + inset;
  const x1 = room.x + room.w - inset;
  const y1 = room.y + room.h - inset;
  const perim = 2 * (x1 - x0 + y1 - y0);
  const step = perim / count;
  const placements: OutletPlacement[] = [];
  for (let i = 0; i < count; i++) {
    const d = i * step + step / 2;
    let x: number, y: number;
    const top = x1 - x0;
    const right = top + (y1 - y0);
    const bottom = right + (x1 - x0);
    if (d < top) {
      x = x0 + d; y = y0;
    } else if (d < right) {
      x = x1; y = y0 + (d - top);
    } else if (d < bottom) {
      x = x1 - (d - right); y = y1;
    } else {
      x = x0; y = y1 - (d - bottom);
    }
    placements.push({
      id: id("o"),
      x: Math.round(x * 10) / 10, y: Math.round(y * 10) / 10,
      floor: room.floor,
      roomId: room.id,
      ports: 2,
      approval: "pending",
      source: "ai",
      labelOverride: null,
      createdAt: new Date().toISOString(),
    });
  }
  return placements;
}

function placeWapsInRoom(room: ExtractedRoom, coverageRadiusFt: number): WapPlacement[] {
  // Simple circle-packing per BICSI §12.3 — each WAP covers a circle of `coverageRadiusFt`
  const area = room.w * room.h;             // grid units²; rough proxy
  const cellWidth = coverageRadiusFt * 1.6;  // overlap factor
  const cols = Math.max(1, Math.floor(room.w / cellWidth));
  const rows = Math.max(1, Math.floor(room.h / cellWidth));
  const placements: WapPlacement[] = [];
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      placements.push({
        id: id("ap"),
        x: room.x + (c + 0.5) * (room.w / cols),
        y: room.y + (r + 0.5) * (room.h / rows),
        floor: room.floor,
        roomId: room.id,
        coverageRadiusFt,
        approval: "pending",
        source: "ai",
        labelOverride: null,
        createdAt: new Date().toISOString(),
      });
    }
  }
  return placements;
}

export const placementStore = {
  get(projectId: string, userId: string): PlacementState | undefined {
    if (!projectStore.get(projectId, userId)) return undefined;
    let s = byProject.get(projectId);
    if (!s) {
      s = emptyState(projectId);
      byProject.set(projectId, s);
    }
    return s;
  },

  addOutlet(projectId: string, userId: string, partial: Partial<OutletPlacement> & { x: number; y: number; floor: number }): OutletPlacement | undefined {
    const state = this.get(projectId, userId);
    if (!state) return undefined;
    const o: OutletPlacement = {
      id: id("o"),
      x: partial.x, y: partial.y, floor: partial.floor,
      roomId: partial.roomId ?? null,
      ports: partial.ports ?? 2,
      approval: partial.approval ?? "approved",   // manual placements default to approved
      source: partial.source ?? "rcdd",
      labelOverride: partial.labelOverride ?? null,
      createdAt: new Date().toISOString(),
    };
    state.outlets.push(o);
    state.updatedAt = new Date().toISOString();
    return o;
  },

  addWap(projectId: string, userId: string, partial: Partial<WapPlacement> & { x: number; y: number; floor: number }): WapPlacement | undefined {
    const state = this.get(projectId, userId);
    if (!state) return undefined;
    const w: WapPlacement = {
      id: id("ap"),
      x: partial.x, y: partial.y, floor: partial.floor,
      roomId: partial.roomId ?? null,
      coverageRadiusFt: partial.coverageRadiusFt ?? 50,
      approval: partial.approval ?? "approved",
      source: partial.source ?? "rcdd",
      labelOverride: partial.labelOverride ?? null,
      createdAt: new Date().toISOString(),
    };
    state.waps.push(w);
    state.updatedAt = new Date().toISOString();
    return w;
  },

  removeOutlet(projectId: string, userId: string, outletId: string): boolean {
    const state = this.get(projectId, userId);
    if (!state) return false;
    const before = state.outlets.length;
    state.outlets = state.outlets.filter(o => o.id !== outletId);
    if (state.outlets.length === before) return false;
    state.updatedAt = new Date().toISOString();
    return true;
  },

  removeWap(projectId: string, userId: string, wapId: string): boolean {
    const state = this.get(projectId, userId);
    if (!state) return false;
    const before = state.waps.length;
    state.waps = state.waps.filter(w => w.id !== wapId);
    if (state.waps.length === before) return false;
    state.updatedAt = new Date().toISOString();
    return true;
  },

  setOutletApproval(projectId: string, userId: string, outletId: string, approval: ApprovalState): OutletPlacement | undefined {
    const state = this.get(projectId, userId);
    if (!state) return undefined;
    const o = state.outlets.find(x => x.id === outletId);
    if (!o) return undefined;
    o.approval = approval;
    state.updatedAt = new Date().toISOString();
    return o;
  },

  setWapApproval(projectId: string, userId: string, wapId: string, approval: ApprovalState): WapPlacement | undefined {
    const state = this.get(projectId, userId);
    if (!state) return undefined;
    const w = state.waps.find(x => x.id === wapId);
    if (!w) return undefined;
    w.approval = approval;
    state.updatedAt = new Date().toISOString();
    return w;
  },

  // AI auto-place outlets — uses confirmed rooms + design density
  autoPlaceOutlets(projectId: string, userId: string): PlacementState | undefined {
    const state = this.get(projectId, userId);
    if (!state) return undefined;
    const intake = intakeStore.get(projectId);
    const design = designStore.get(projectId, userId);
    if (!intake || !design) return undefined;
    const rooms = intake.rooms.filter(r => !r.excluded && WORKAREA_ROOM_TYPES.has(r.overrideType ?? r.type));

    // Replace AI outlets only (preserve RCDD-placed)
    state.outlets = state.outlets.filter(o => o.source !== "ai");
    for (const r of rooms) {
      const count = densityOutletsForRoom(r, design.workareaDensity);
      state.outlets.push(...placeOutletsInRoom(r, count));
    }
    state.updatedAt = new Date().toISOString();
    return state;
  },

  autoPlaceWaps(projectId: string, userId: string): PlacementState | undefined {
    const state = this.get(projectId, userId);
    if (!state) return undefined;
    const intake = intakeStore.get(projectId);
    const design = designStore.get(projectId, userId);
    if (!intake || !design) return undefined;
    const rooms = intake.rooms.filter(r => !r.excluded && WORKAREA_ROOM_TYPES.has(r.overrideType ?? r.type));
    state.waps = state.waps.filter(w => w.source !== "ai");
    for (const r of rooms) {
      state.waps.push(...placeWapsInRoom(r, design.wapCoverageRadiusFt));
    }
    state.updatedAt = new Date().toISOString();
    return state;
  },

  clearAi(projectId: string, userId: string): PlacementState | undefined {
    const state = this.get(projectId, userId);
    if (!state) return undefined;
    state.outlets = state.outlets.filter(o => o.source !== "ai");
    state.waps    = state.waps.filter(w => w.source !== "ai");
    state.updatedAt = new Date().toISOString();
    return state;
  },

  approveAllPending(projectId: string, userId: string): PlacementState | undefined {
    const state = this.get(projectId, userId);
    if (!state) return undefined;
    let n = 0;
    state.outlets.forEach(o => { if (o.approval === "pending") { o.approval = "approved"; n++; } });
    state.waps   .forEach(w => { if (w.approval === "pending") { w.approval = "approved"; n++; } });
    if (n > 0) state.updatedAt = new Date().toISOString();
    return state;
  },
};
