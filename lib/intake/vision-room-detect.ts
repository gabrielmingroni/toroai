// Vision-based room detection.
//
// Renders a PDF page → PNG client-side (in PdfExtractPanel), POSTs the
// base64 image here, and Claude with vision identifies labeled rooms with
// approximate bounding boxes + types. Output maps to the existing
// ExtractedRoom shape so downstream views (Floor Plan, Pathway, Design
// Generation) consume rooms without caring whether they came from the
// mock intake pipeline or vision detection.

import { callAnthropic, extractJsonObject } from "@/lib/anthropic/client";
import type { ExtractedRoom, RoomType } from "./types";
import { CANVAS_W, CANVAS_H } from "./types";

// ── Prompt — patent-grade specificity ───────────────────────────────────

const SYSTEM_PROMPT = `You are an expert at reading architectural floor plans for telecommunications design.

Your task: identify each labeled room visible in the floor plan image and return its bounding box.

For each room, return:
  - name:       the visible text label on the floor plan (e.g., "OPEN OFFICE", "STORAGE 220", "CONFERENCE A")
                If no label is visible, omit the room.
  - type:       one of [mdf, idf, open_office, private_office, conference, reception, corridor, storage,
                electrical, mechanical, restroom, kitchen, stairwell, elevator, lab, patient_room,
                exam_room, classroom, unknown]
                Choose the closest match. Default to "unknown" if you cannot tell.
  - bbox:       [x1, y1, x2, y2] as 0..1 normalized to the image dimensions
                (x going right, y going down). x1 < x2, y1 < y2.
  - confidence: 0..1 — how confident you are that this is a room with the named label.

Skip non-room items: door swings, dimensions, callouts, north arrows, scale bars, title block text.
Skip site-plan content like trees, sidewalks, parking — only interior rooms.

Output ONLY a JSON object with this structure (no prose, no markdown fences):
{
  "rooms": [
    { "name": "...", "type": "...", "bbox": [0.1, 0.2, 0.3, 0.4], "confidence": 0.92 }
  ]
}`;

// ── Types ────────────────────────────────────────────────────────────────

export interface DetectedRoom {
  name: string;
  type: RoomType;
  /** Normalized [x1, y1, x2, y2] in 0..1 image space. */
  bbox: [number, number, number, number];
  confidence: number;
}

export interface DetectRoomsRequest {
  /** Base64-encoded image (no `data:` prefix). */
  imageBase64: string;
  /** Image MIME type. */
  mediaType?: "image/png" | "image/jpeg";
  /** Page/sheet label for the returned rooms. Defaults to "Page 1". */
  pageLabel?: string;
  /** Floor number to assign to all detected rooms. Defaults to 1. */
  floor?: number;
}

export interface DetectRoomsResult {
  /** Detected rooms in the original DetectedRoom shape. */
  detected: DetectedRoom[];
  /** Same rooms mapped to ExtractedRoom for downstream consumption. */
  rooms: ExtractedRoom[];
  /** Real Anthropic token usage. */
  tokens: { input: number; output: number };
  /** Raw Claude response — useful for debugging. */
  rawText: string;
}

// ── Detector ────────────────────────────────────────────────────────────

const VALID_ROOM_TYPES: ReadonlySet<RoomType> = new Set<RoomType>([
  "mdf", "idf", "open_office", "private_office", "conference", "reception",
  "corridor", "storage", "electrical", "mechanical", "restroom", "kitchen",
  "stairwell", "elevator", "lab", "patient_room", "exam_room", "classroom", "unknown",
]);

export async function detectRoomsFromImage(req: DetectRoomsRequest): Promise<DetectRoomsResult> {
  const res = await callAnthropic({
    system: SYSTEM_PROMPT,
    content: [
      {
        type: "image",
        source: {
          type: "base64",
          media_type: req.mediaType ?? "image/png",
          data: req.imageBase64,
        },
      },
      {
        type: "text",
        text: "Identify the rooms in this floor plan and return the JSON described in your system prompt.",
      },
    ],
    maxTokens: 4000,
    temperature: 0.1,
  });

  if (!res.ok) {
    throw new Error(`Vision room detection failed: ${res.error.kind} — ${res.error.message}`);
  }

  const parsed = extractJsonObject(res.response.text);
  if (!parsed || typeof parsed !== "object") {
    throw new Error("Vision room detection returned non-JSON content.");
  }
  const p = parsed as { rooms?: unknown };
  if (!Array.isArray(p.rooms)) {
    throw new Error("Vision response missing `rooms` array.");
  }

  const detected: DetectedRoom[] = [];
  for (const raw of p.rooms as unknown[]) {
    const item = raw as Record<string, unknown>;
    if (!item || typeof item !== "object") continue;
    const name = typeof item.name === "string" ? item.name.trim() : "";
    if (!name) continue;
    const type: RoomType = (typeof item.type === "string" && VALID_ROOM_TYPES.has(item.type as RoomType))
      ? (item.type as RoomType) : "unknown";
    const bbox = item.bbox;
    if (!Array.isArray(bbox) || bbox.length !== 4) continue;
    const [x1, y1, x2, y2] = bbox.map(n => Math.max(0, Math.min(1, Number(n))));
    if (!(x1 < x2 && y1 < y2)) continue;
    const confidence = Math.max(0, Math.min(1, Number(item.confidence ?? 0.6)));
    detected.push({ name, type, bbox: [x1, y1, x2, y2], confidence });
  }

  // Map to ExtractedRoom on the 145×82 canvas grid.
  const floor = req.floor ?? 1;
  const rooms: ExtractedRoom[] = detected.map((r, i) => {
    const [x1, y1, x2, y2] = r.bbox;
    const x = +(x1 * CANVAS_W).toFixed(1);
    const y = +(y1 * CANVAS_H).toFixed(1);
    const w = +((x2 - x1) * CANVAS_W).toFixed(1);
    const h = +((y2 - y1) * CANVAS_H).toFixed(1);
    const area = +(w * h).toFixed(0);
    return {
      id: "vroom_" + i.toString().padStart(3, "0"),
      name: r.name,
      type: r.type,
      confidence: r.confidence,
      area,
      floor,
      x, y, w, h,
      source: "CAD",
      overrideType: null,
      overrideName: null,
      excluded: false,
      reviewed: false,
    };
  });

  return {
    detected, rooms,
    tokens: { input: res.response.usage.inputTokens, output: res.response.usage.outputTokens },
    rawText: res.response.text,
  };
}
