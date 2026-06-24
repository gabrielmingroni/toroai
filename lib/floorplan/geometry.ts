// Geometry helpers for the floor plan canvas — wall derivation, door placement,
// wall-snap for outlet placement, and orientation maths.

import type { ExtractedRoom } from "@/lib/intake/types";

export type Side = "top" | "right" | "bottom" | "left";

export interface WallSegment {
  x1: number; y1: number; x2: number; y2: number;
  side: Side;
  roomId: string;
}

export interface Door {
  // door is a gap centered on (cx, cy), oriented along `side`
  cx: number; cy: number;
  side: Side;
  width: number;          // gap width in canvas units
  swingOut: boolean;      // arc direction
  roomId: string;
}

const DOOR_WIDTH = 4;
const NON_DOOR_TYPES = new Set(["corridor", "stairwell", "elevator"]);

/** Return all wall segments for the given rooms. (One stroke per room edge.) */
export function deriveWalls(rooms: ExtractedRoom[]): WallSegment[] {
  const out: WallSegment[] = [];
  for (const r of rooms) {
    out.push({ x1: r.x,       y1: r.y,       x2: r.x + r.w, y2: r.y,       side: "top",    roomId: r.id });
    out.push({ x1: r.x + r.w, y1: r.y,       x2: r.x + r.w, y2: r.y + r.h, side: "right",  roomId: r.id });
    out.push({ x1: r.x,       y1: r.y + r.h, x2: r.x + r.w, y2: r.y + r.h, side: "bottom", roomId: r.id });
    out.push({ x1: r.x,       y1: r.y,       x2: r.x,       y2: r.y + r.h, side: "left",   roomId: r.id });
  }
  return out;
}

/** Assign one door per non-corridor room, on the edge closest to a corridor (or to the room centroid if no corridor). */
export function deriveDoors(rooms: ExtractedRoom[]): Door[] {
  const doors: Door[] = [];
  const corridors = rooms.filter(r => (r.overrideType ?? r.type) === "corridor");

  for (const r of rooms) {
    const type = r.overrideType ?? r.type;
    if (NON_DOOR_TYPES.has(type)) continue;

    // Pick the room's edge closest to the nearest corridor centerline
    const cy = corridors.length
      ? closestCorridorCenter(r, corridors)
      : r.y + r.h / 2;
    const cx = r.x + r.w / 2;

    let side: Side;
    if (cy < r.y)               side = "top";
    else if (cy > r.y + r.h)    side = "bottom";
    else if (cx < r.x)          side = "left";
    else                        side = "right";

    // Sometimes the corridor is right above/below — bias door to that side
    if (corridors.length) {
      const corr = nearestCorridor(r, corridors);
      if (corr) {
        const above = corr.y + corr.h <= r.y;
        const below = corr.y >= r.y + r.h;
        if (above) side = "top";
        else if (below) side = "bottom";
      }
    }

    // Door centered along the chosen edge, but if room is small don't let it run past corners
    if (side === "top" || side === "bottom") {
      const centerX = Math.max(r.x + DOOR_WIDTH / 2 + 1, Math.min(r.x + r.w - DOOR_WIDTH / 2 - 1, r.x + r.w / 2));
      const y = side === "top" ? r.y : r.y + r.h;
      doors.push({ cx: centerX, cy: y, side, width: DOOR_WIDTH, swingOut: side === "top", roomId: r.id });
    } else {
      const centerY = Math.max(r.y + DOOR_WIDTH / 2 + 1, Math.min(r.y + r.h - DOOR_WIDTH / 2 - 1, r.y + r.h / 2));
      const x = side === "left" ? r.x : r.x + r.w;
      doors.push({ cx: x, cy: centerY, side, width: DOOR_WIDTH, swingOut: side === "left", roomId: r.id });
    }
  }
  return doors;
}

function nearestCorridor(r: ExtractedRoom, corridors: ExtractedRoom[]): ExtractedRoom | undefined {
  let best: ExtractedRoom | undefined; let bestD = Infinity;
  for (const c of corridors) {
    const d = Math.abs(((c.y + c.h / 2) - (r.y + r.h / 2)));
    if (d < bestD) { bestD = d; best = c; }
  }
  return best;
}
function closestCorridorCenter(r: ExtractedRoom, corridors: ExtractedRoom[]): number {
  const c = nearestCorridor(r, corridors);
  return c ? c.y + c.h / 2 : r.y + r.h / 2;
}

/** Compute the closest point on a wall segment to a click point, plus the inward-facing normal. */
export interface SnapResult {
  x: number; y: number;
  side: Side;
  /** Vector pointing into the room from the wall (length 1) */
  nx: number; ny: number;
  roomId: string;
  distance: number;
}

export function snapToWall(px: number, py: number, rooms: ExtractedRoom[]): SnapResult | null {
  // Pass 1: which room contains the click?
  let host: ExtractedRoom | undefined = rooms.find(r => px >= r.x && px <= r.x + r.w && py >= r.y && py <= r.y + r.h);
  // Fallback: if outside all rooms, pick the closest room by centroid
  if (!host) {
    let best: ExtractedRoom | undefined; let bestD = Infinity;
    for (const r of rooms) {
      const cx = r.x + r.w / 2, cy = r.y + r.h / 2;
      const d = Math.hypot(px - cx, py - cy);
      if (d < bestD) { bestD = d; best = r; }
    }
    host = best;
  }
  if (!host) return null;

  // Pass 2: distance to each of host's 4 walls
  const r = host;
  const dTop    = py - r.y;
  const dBottom = (r.y + r.h) - py;
  const dLeft   = px - r.x;
  const dRight  = (r.x + r.w) - px;

  const min = Math.min(dTop, dBottom, dLeft, dRight);
  let snap: SnapResult;
  // Pull the outlet slightly into the room so it doesn't sit ON the wall stroke
  const INSET = 1.2;
  if (min === dTop) {
    snap = { x: clamp(px, r.x + 2, r.x + r.w - 2), y: r.y + INSET, side: "top",    nx: 0,  ny:  1, roomId: r.id, distance: min };
  } else if (min === dBottom) {
    snap = { x: clamp(px, r.x + 2, r.x + r.w - 2), y: r.y + r.h - INSET, side: "bottom", nx: 0, ny: -1, roomId: r.id, distance: min };
  } else if (min === dLeft) {
    snap = { x: r.x + INSET, y: clamp(py, r.y + 2, r.y + r.h - 2), side: "left",   nx:  1, ny: 0, roomId: r.id, distance: min };
  } else {
    snap = { x: r.x + r.w - INSET, y: clamp(py, r.y + 2, r.y + r.h - 2), side: "right",  nx: -1, ny: 0, roomId: r.id, distance: min };
  }
  return snap;
}

function clamp(v: number, lo: number, hi: number) { return Math.max(lo, Math.min(hi, v)); }
