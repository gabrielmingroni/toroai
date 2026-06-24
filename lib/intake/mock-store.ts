/**
 * Mock intake store. Simulates the FastAPI IntakeCoordinator pipeline:
 *
 *   extract text → assemble rooms → classify rooms → score TR candidates
 *
 * Real backend uses pdfplumber + pymupdf + OCR fallback for extraction,
 * geometric segmentation for assembly, Claude API for classification,
 * and a deterministic 13-factor algorithm for TR scoring. The mock here
 * produces shape-equivalent output on a synthetic timer.
 *
 * Each project gets a deterministic room set scaled by SF + floors + sector
 * so re-running intake on the Pearland ISD project always produces the
 * same rooms (good for UX testing).
 */

import { randomBytes } from "crypto";
import { projectStore } from "@/lib/projects/mock-store";
import type { Sector } from "@/lib/projects/types";
import type {
  IntakeJob, IntakeStage, IntakeFile, ExtractedRoom,
  TrCandidate, TrFactor, RoomType, StartIntakeRequest,
} from "./types";
import type { ExtractedDocument } from "./pdf-extract";
import { PIPELINE_STAGES, CANVAS_W, CANVAS_H } from "./types";

// One active intake job per project.
const jobsByProject = new Map<string, IntakeJob>();

// Persisted Layer 2 (OCR/CAD) output per project — survives HMR via globalThis.
const g = globalThis as unknown as {
  __toroaiIntakeDocs?: Map<string, ExtractedDocument>;
};
if (!g.__toroaiIntakeDocs) g.__toroaiIntakeDocs = new Map();
const extractedDocsByProject = g.__toroaiIntakeDocs;

// Stage durations in ms — feel real-ish without making the user wait forever.
// Only the four "active" stages are tracked here; queued / ready_for_review / confirmed / failed are instantaneous.
const STAGE_DURATIONS_MS = {
  extracting_text:   2500,
  assembling_rooms:  2200,
  classifying:       3000,
  scoring_trs:       1800,
} as const;
const TOTAL_DURATION_MS = Object.values(STAGE_DURATIONS_MS).reduce((s, n) => s + n, 0);

function id(prefix: string) {
  return `${prefix}_${randomBytes(4).toString("hex")}`;
}

// ────────────────────────────────────────────────────────────────────────────
// Deterministic synthetic room/TR generation per project
// ────────────────────────────────────────────────────────────────────────────

function seededRng(seed: string) {
  // xmur3 + sfc32. Cheap and good enough for fixture generation.
  let h = 1779033703 ^ seed.length;
  for (let i = 0; i < seed.length; i++) {
    h = Math.imul(h ^ seed.charCodeAt(i), 3432918353);
    h = (h << 13) | (h >>> 19);
  }
  let a = h, b = h >>> 1, c = h >>> 2, d = h >>> 3;
  return () => {
    a |= 0; b |= 0; c |= 0; d |= 0;
    const t = (a + b) | 0;
    a = b ^ (b >>> 9);
    b = (c + (c << 3)) | 0;
    c = (c << 21) | (c >>> 11);
    d = (d + 1) | 0;
    const r = (t + d) | 0;
    c = (c + r) | 0;
    return (r >>> 0) / 4294967296;
  };
}

const ROOM_MIX_BY_SECTOR: Record<Sector, [RoomType, number][]> = {
  healthcare: [
    ["patient_room", 0.32], ["exam_room", 0.18], ["corridor", 0.08], ["open_office", 0.06],
    ["conference", 0.04], ["reception", 0.03], ["restroom", 0.08], ["storage", 0.07],
    ["electrical", 0.04], ["mechanical", 0.04], ["mdf", 0.01], ["idf", 0.02], ["lab", 0.03],
  ],
  education_k12: [
    ["classroom", 0.42], ["corridor", 0.12], ["restroom", 0.08], ["storage", 0.06],
    ["conference", 0.04], ["open_office", 0.06], ["kitchen", 0.04], ["reception", 0.03],
    ["electrical", 0.04], ["mechanical", 0.04], ["mdf", 0.01], ["idf", 0.02], ["lab", 0.04],
  ],
  education_higher_ed: [
    ["classroom", 0.30], ["lab", 0.10], ["open_office", 0.14], ["corridor", 0.10],
    ["conference", 0.06], ["restroom", 0.08], ["storage", 0.06], ["kitchen", 0.03],
    ["electrical", 0.04], ["mechanical", 0.04], ["mdf", 0.01], ["idf", 0.02], ["reception", 0.02],
  ],
  government_federal: [
    ["open_office", 0.30], ["private_office", 0.16], ["conference", 0.10], ["corridor", 0.10],
    ["restroom", 0.07], ["reception", 0.03], ["storage", 0.06], ["kitchen", 0.04],
    ["electrical", 0.04], ["mechanical", 0.04], ["mdf", 0.01], ["idf", 0.02], ["lab", 0.03],
  ],
  government_state: [
    ["open_office", 0.30], ["private_office", 0.16], ["conference", 0.10], ["corridor", 0.10],
    ["restroom", 0.07], ["reception", 0.03], ["storage", 0.06], ["kitchen", 0.04],
    ["electrical", 0.04], ["mechanical", 0.04], ["mdf", 0.01], ["idf", 0.02], ["lab", 0.03],
  ],
  government_local: [
    ["open_office", 0.30], ["private_office", 0.16], ["conference", 0.10], ["corridor", 0.10],
    ["restroom", 0.07], ["reception", 0.03], ["storage", 0.06], ["kitchen", 0.04],
    ["electrical", 0.04], ["mechanical", 0.04], ["mdf", 0.01], ["idf", 0.02], ["lab", 0.03],
  ],
  commercial_office: [
    ["open_office", 0.34], ["private_office", 0.18], ["conference", 0.10], ["corridor", 0.10],
    ["restroom", 0.06], ["reception", 0.03], ["storage", 0.05], ["kitchen", 0.04],
    ["electrical", 0.04], ["mechanical", 0.04], ["mdf", 0.01], ["idf", 0.01],
  ],
  commercial_retail: [
    ["open_office", 0.10], ["corridor", 0.14], ["restroom", 0.08], ["storage", 0.20],
    ["kitchen", 0.06], ["electrical", 0.05], ["mechanical", 0.05], ["mdf", 0.01], ["idf", 0.02],
  ],
  commercial_hospitality: [
    ["private_office", 0.40], ["corridor", 0.14], ["restroom", 0.08], ["storage", 0.06],
    ["reception", 0.04], ["kitchen", 0.04], ["conference", 0.04], ["electrical", 0.04],
    ["mechanical", 0.04], ["mdf", 0.01], ["idf", 0.02],
  ],
  industrial_manufacturing: [
    ["open_office", 0.18], ["storage", 0.26], ["corridor", 0.10], ["restroom", 0.06],
    ["electrical", 0.06], ["mechanical", 0.06], ["kitchen", 0.03], ["mdf", 0.01], ["idf", 0.02],
  ],
  industrial_warehouse: [
    ["storage", 0.50], ["open_office", 0.10], ["corridor", 0.10], ["restroom", 0.06],
    ["electrical", 0.06], ["mechanical", 0.06], ["mdf", 0.01], ["idf", 0.02],
  ],
  mixed_use: [
    ["open_office", 0.18], ["private_office", 0.10], ["corridor", 0.12], ["restroom", 0.06],
    ["storage", 0.08], ["kitchen", 0.04], ["conference", 0.06], ["reception", 0.03],
    ["electrical", 0.04], ["mechanical", 0.04], ["mdf", 0.01], ["idf", 0.02], ["classroom", 0.04],
  ],
  residential_multifamily: [
    ["private_office", 0.46], ["corridor", 0.14], ["restroom", 0.10], ["storage", 0.06],
    ["kitchen", 0.04], ["electrical", 0.06], ["mechanical", 0.06], ["mdf", 0.01], ["idf", 0.02],
  ],
  data_center: [
    ["mechanical", 0.36], ["electrical", 0.16], ["corridor", 0.08], ["storage", 0.06],
    ["open_office", 0.06], ["restroom", 0.04], ["mdf", 0.06], ["idf", 0.10],
  ],
  transportation: [
    ["open_office", 0.18], ["corridor", 0.18], ["restroom", 0.10], ["storage", 0.10],
    ["reception", 0.06], ["electrical", 0.06], ["mechanical", 0.06], ["mdf", 0.01], ["idf", 0.02],
  ],
};

function pickRoomType(rng: () => number, sector: Sector): RoomType {
  const mix = ROOM_MIX_BY_SECTOR[sector] || ROOM_MIX_BY_SECTOR.commercial_office;
  const r = rng();
  let acc = 0;
  for (const [type, weight] of mix) {
    acc += weight;
    if (r <= acc) return type;
  }
  return mix[mix.length - 1][0];
}

function roomNameFor(type: RoomType, floor: number, n: number): string {
  const prefix = {
    mdf: "MDF", idf: "IDF", open_office: "Open Office",
    private_office: "Office", conference: "Conf Rm",
    reception: "Reception", corridor: "Corridor", storage: "Storage",
    electrical: "Elec Rm", mechanical: "Mech Rm",
    restroom: "Restroom", kitchen: "Break Rm",
    stairwell: "Stair", elevator: "Elev Lobby",
    lab: "Lab", patient_room: "Patient Rm",
    exam_room: "Exam Rm", classroom: "Classroom", unknown: "Room",
  }[type];
  const letter = String.fromCharCode(65 + ((n - 1) % 26));
  return `${prefix} ${floor}${String(n).padStart(2, "0")}${type === "open_office" ? " " + letter : ""}`.trim();
}

// Lay rooms out on the 145×82 canvas grid per floor.
// MDF/IDF in the top-left corner (Floor 1: ~14×13 ft), then a corridor band,
// then workarea rooms filled below the corridor. Simple and predictable.
function layoutRoomsOnGrid(rooms: ExtractedRoom[], floors: number): void {
  for (let f = 1; f <= floors; f++) {
    const onFloor = rooms.filter(r => r.floor === f);
    if (!onFloor.length) continue;
    const trRoom = onFloor.find(r => r.type === "mdf" || r.type === "idf");
    if (trRoom) {
      trRoom.x = 4; trRoom.y = 5; trRoom.w = 14; trRoom.h = 13;
    }

    // Corridor spans the canvas at y=20, height=8
    const corridor = onFloor.find(r => r.type === "corridor");
    if (corridor) {
      corridor.x = 4; corridor.y = 20; corridor.w = CANVAS_W - 8; corridor.h = 8;
    }

    // Remaining rooms — pack into two bands above/below the corridor
    const others = onFloor.filter(r => r !== trRoom && r !== corridor);
    // Two bands: above corridor (y=5..20, used by TR room only — pack others to the right of TR) and below (y=29..78)
    let xAbove = trRoom ? trRoom.x + trRoom.w + 2 : 4;
    const yAbove = 5;
    const hAbove = 13;
    let xBelow = 4;
    let yBelow = 29;
    const maxYBelow = CANVAS_H - 4;

    for (const r of others) {
      // Target dimensions from SF; aspect ratio biased to landscape
      const sqrtSf = Math.sqrt(r.area / 9); // scale: 9 SF ≈ 1×1 grid unit (1 unit ≈ 3 ft)
      let w = Math.max(6, Math.min(CANVAS_W - 8, Math.round(sqrtSf * 1.4)));
      let h = Math.max(6, Math.round(sqrtSf * 0.85));

      // Try fitting in the upper band first
      if (xAbove + w <= CANVAS_W - 4 && h <= hAbove) {
        r.x = xAbove; r.y = yAbove; r.w = w; r.h = hAbove;
        xAbove += w + 1;
        continue;
      }
      // Otherwise place in the lower band, wrapping rows
      if (xBelow + w > CANVAS_W - 4) {
        // wrap
        xBelow = 4;
        yBelow += h + 1;
      }
      if (yBelow + h > maxYBelow) {
        // Out of room — clamp size
        h = Math.max(4, maxYBelow - yBelow);
        if (h <= 0) {
          // Drop to the bottom of the canvas
          r.x = xBelow; r.y = maxYBelow - 4; r.w = Math.min(w, CANVAS_W - 4 - xBelow); r.h = 4;
          xBelow += r.w + 1;
          continue;
        }
      }
      r.x = xBelow; r.y = yBelow; r.w = w; r.h = h;
      xBelow += w + 1;
    }
  }
}

function generateRooms(projectId: string, totalSf: number, floors: number, sector: Sector): ExtractedRoom[] {
  const rng = seededRng(projectId);
  const sfPerFloor = totalSf / floors;
  const avgRoomSf = sector === "data_center" ? 280 : sector === "industrial_warehouse" ? 1200 : 320;
  const roomsPerFloor = Math.max(6, Math.round(sfPerFloor / avgRoomSf));
  const rooms: ExtractedRoom[] = [];

  for (let f = 1; f <= floors; f++) {
    // TR room
    rooms.push({
      id: id("rm"),
      name: f === 1 ? "MDF Telecom Room" : `IDF F${f} Telecom Room`,
      type: f === 1 ? "mdf" : "idf",
      confidence: 0.95 + rng() * 0.04,
      area: 90 + Math.round(rng() * 40),
      floor: f, source: "CAD",
      x: 0, y: 0, w: 0, h: 0, // filled by layoutRoomsOnGrid
      overrideType: null, overrideName: null, excluded: false, reviewed: false,
    });

    // Add one corridor per floor (most building plans have one)
    rooms.push({
      id: id("rm"),
      name: `Corridor F${f}`,
      type: "corridor",
      confidence: 0.96,
      area: 800 + Math.round(rng() * 400),
      floor: f, source: "CAD",
      x: 0, y: 0, w: 0, h: 0,
      overrideType: null, overrideName: null, excluded: false, reviewed: false,
    });

    for (let n = 1; n <= roomsPerFloor - 2; n++) {
      const type = pickRoomType(rng, sector);
      const area =
        type === "corridor" ? 280 + rng() * 320 :
        type === "open_office" ? 1800 + rng() * 1800 :
        type === "storage" ? 80 + rng() * 240 :
        type === "lab" ? 480 + rng() * 600 :
        type === "patient_room" ? 220 + rng() * 80 :
        140 + rng() * 220;

      const isUnambiguous = ["corridor", "restroom", "stairwell", "elevator", "open_office"].includes(type);
      const baseConf = isUnambiguous ? 0.88 : 0.74;
      const conf = Math.min(0.99, baseConf + (rng() - 0.5) * 0.25);

      const sRng = rng();
      const source: ExtractedRoom["source"] = sRng < 0.6 ? "CAD" : sRng < 0.85 ? "PDF" : sRng < 0.97 ? "OCR" : "EST";

      rooms.push({
        id: id("rm"),
        name: roomNameFor(type, f, n),
        type,
        confidence: source === "OCR" ? Math.max(0.45, conf - 0.18) : source === "EST" ? 0.5 : conf,
        area: Math.round(area),
        floor: f, source,
        x: 0, y: 0, w: 0, h: 0,
        overrideType: null, overrideName: null, excluded: false, reviewed: false,
      });
    }
  }
  layoutRoomsOnGrid(rooms, floors);
  return rooms;
}

// ────────────────────────────────────────────────────────────────────────────
// TR scoring — 13-factor deterministic
// ────────────────────────────────────────────────────────────────────────────

const TR_FACTOR_WEIGHTS: { key: string; label: string; weight: number; rationale: string }[] = [
  { key: "ground_floor",       label: "Ground floor preference (MDF)", weight: 0.12, rationale: "BICSI §11.2: MDF on entry floor." },
  { key: "ninetym_coverage",   label: "90 m horizontal reach",         weight: 0.18, rationale: "TIA-568.1-D §6.4: every WA within 90 m." },
  { key: "min_area_80sf",      label: "Min area ≥ 80 SF",              weight: 0.10, rationale: "BICSI Table 4.1: minimum 80 SF for ≤5,000 SF served." },
  { key: "vertical_alignment", label: "Vertical alignment across floors", weight: 0.10, rationale: "Stacked TRs reduce backbone length and conduit penetrations." },
  { key: "no_wet_walls",       label: "No shared wet walls",           weight: 0.05, rationale: "BICSI §11.4: no plumbing chases adjacent to TR." },
  { key: "not_below_grade",    label: "Not below grade",               weight: 0.04, rationale: "Avoids flood/moisture risk per BICSI §11.4." },
  { key: "hvac_access",        label: "HVAC access",                   weight: 0.05, rationale: "TR requires 24/7 cooling at design heat load." },
  { key: "no_emi_sources",     label: "Distance from EMI sources",     weight: 0.06, rationale: "BICSI §11.4: ≥ 3 m from motors, transformers." },
  { key: "rectangular",        label: "Rectangular geometry",          weight: 0.04, rationale: "Rack layout efficiency." },
  { key: "door_36in",          label: "Min 36\" door",                 weight: 0.03, rationale: "Equipment ingress." },
  { key: "no_thru_traffic",    label: "No through-traffic",            weight: 0.03, rationale: "Security and accidental disconnection risk." },
  { key: "wa_centroid",        label: "Near work-area centroid",       weight: 0.10, rationale: "Minimizes mean cable length." },
  { key: "no_window",          label: "No exterior windows",           weight: 0.10, rationale: "Physical security per BICSI §11.4." },
];

function scoreTrCandidate(room: ExtractedRoom, rng: () => number): TrCandidate {
  const factors: TrFactor[] = TR_FACTOR_WEIGHTS.map((f) => {
    // Bias the score by room type — MDF/IDF rooms score higher across all factors
    const typeBias = room.type === "mdf" ? 0.85 : room.type === "idf" ? 0.78 : 0.45;
    const noise = (rng() - 0.5) * 0.30;
    const raw = Math.max(0, Math.min(1, typeBias + noise));
    // Some factors are categorical — round to 0 or 1
    const categorical = ["ground_floor", "below_grade", "no_window", "no_thru_traffic", "door_36in", "rectangular"];
    const score = categorical.includes(f.key) ? (raw > 0.5 ? 1 : 0) : raw;

    let value: string;
    if (f.key === "ground_floor")       value = room.floor === 1 ? "Floor 1" : `Floor ${room.floor}`;
    else if (f.key === "min_area_80sf") value = `${room.area} SF`;
    else if (f.key === "ninetym_coverage") value = `${Math.round(40 + rng() * 50)} m max reach`;
    else if (f.key === "wa_centroid")     value = `${Math.round(rng() * 12)} m offset`;
    else if (f.key === "vertical_alignment") value = room.floor === 1 ? "MDF anchor" : "Aligned with MDF";
    else value = score > 0.7 ? "Pass" : score > 0.4 ? "Marginal" : "Fail";

    return { key: f.key, label: f.label, weight: f.weight, value, score, rationale: f.rationale };
  });
  const composite = Math.round(factors.reduce((s, f) => s + f.score * f.weight, 0) * 100);
  return {
    roomId: room.id,
    score: composite,
    rank: 0, // filled in later
    recommended: false,
    factors,
    approved: null,
  };
}

function scoreTrs(rooms: ExtractedRoom[]): TrCandidate[] {
  const rng = seededRng(rooms.map(r => r.id).join(""));
  const candidates: TrCandidate[] = [];
  // Score every MDF/IDF room + the top few non-TR rooms as alternatives
  rooms.filter(r => r.type === "mdf" || r.type === "idf").forEach(r => candidates.push(scoreTrCandidate(r, rng)));
  // A few "what if" alternative candidates from other room types — gives RCDD options
  rooms.filter(r => r.type === "storage" || r.type === "electrical").slice(0, 3).forEach(r => candidates.push(scoreTrCandidate(r, rng)));

  // Per-floor: rank and flag top candidate as recommended
  const byFloor = new Map<number, TrCandidate[]>();
  candidates.forEach(c => {
    const room = rooms.find(r => r.id === c.roomId)!;
    if (!byFloor.has(room.floor)) byFloor.set(room.floor, []);
    byFloor.get(room.floor)!.push(c);
  });
  byFloor.forEach(group => {
    group.sort((a, b) => b.score - a.score);
    group.forEach((c, i) => { c.rank = i + 1; c.recommended = i === 0; });
  });
  return candidates.sort((a, b) => {
    const ra = rooms.find(r => r.id === a.roomId)!.floor;
    const rb = rooms.find(r => r.id === b.roomId)!.floor;
    return ra - rb || a.rank - b.rank;
  });
}

// ────────────────────────────────────────────────────────────────────────────
// Public API
// ────────────────────────────────────────────────────────────────────────────

function pipelineProgress(stage: IntakeStage, stageStartedAt: string): number {
  if (stage === "queued") return 0;
  if (stage === "ready_for_review" || stage === "confirmed") return 1;
  if (stage === "failed") return 0;
  const stageIdx = PIPELINE_STAGES.indexOf(stage as any);
  if (stageIdx < 0) return 0;
  const elapsedInStage = Date.now() - new Date(stageStartedAt).getTime();
  const stageDur = STAGE_DURATIONS_MS[stage as keyof typeof STAGE_DURATIONS_MS];
  const before = PIPELINE_STAGES.slice(0, stageIdx).reduce((s, st) => s + STAGE_DURATIONS_MS[st as keyof typeof STAGE_DURATIONS_MS], 0);
  return Math.min(1, (before + Math.min(elapsedInStage, stageDur)) / TOTAL_DURATION_MS);
}

function nextStage(s: IntakeStage): IntakeStage {
  const flow: IntakeStage[] = ["queued", ...PIPELINE_STAGES, "ready_for_review"];
  const i = flow.indexOf(s);
  return i >= 0 && i < flow.length - 1 ? flow[i + 1] : s;
}

/** Step the job forward based on wall-clock time vs. stage durations. */
function tick(job: IntakeJob) {
  if (job.stage === "ready_for_review" || job.stage === "confirmed" || job.stage === "failed") return;
  const stageStarted = new Date(job.stageStartedAt).getTime();
  const stageDur = STAGE_DURATIONS_MS[job.stage as keyof typeof STAGE_DURATIONS_MS];
  if (job.stage === "queued" || Date.now() - stageStarted < stageDur) {
    job.progress = pipelineProgress(job.stage, job.stageStartedAt);
    return;
  }

  // Stage complete → advance
  const wasStage = job.stage;
  job.stage = nextStage(job.stage);
  job.stageStartedAt = new Date().toISOString();

  // Emit per-stage outputs as we transition into the next stage
  const project = projectStore["list"]; // typing workaround; we read directly below
  // Get project from store via internal lookup
  const proj = [...projectStore.list("u_001"), ...projectStore.list("u_002")].find(p => p.id === job.projectId)
    ?? projectStore.list("u_001").find(p => p.id === job.projectId);

  if (wasStage === "extracting_text") {
    job.diagnostics.pagesExtracted = job.files.reduce((s, f) => s + (f.pages ?? 12), 0);
    job.files.forEach(f => { f.status = "parsed"; if (!f.pages) f.pages = 8 + Math.floor(Math.random() * 24); });
  } else if (wasStage === "assembling_rooms" && proj) {
    job.rooms = generateRooms(proj.id, proj.totalSf, proj.floors, proj.sector);
    job.diagnostics.roomsDetected = job.rooms.length;
  } else if (wasStage === "classifying") {
    job.diagnostics.classifiedHigh = job.rooms.filter(r => r.confidence >= 0.85).length;
    job.diagnostics.classifiedLow  = job.rooms.filter(r => r.confidence < 0.65).length;
  } else if (wasStage === "scoring_trs") {
    job.trCandidates = scoreTrs(job.rooms);
    job.diagnostics.trsRecommended = job.trCandidates.filter(c => c.recommended).length;
    job.completedAt = new Date().toISOString();
  }
  job.progress = pipelineProgress(job.stage, job.stageStartedAt);
}

export const intakeStore = {
  get(projectId: string): IntakeJob | undefined {
    const job = jobsByProject.get(projectId);
    if (job) tick(job);
    return job;
  },

  start(projectId: string, req: StartIntakeRequest): IntakeJob {
    const now = new Date().toISOString();
    const files: IntakeFile[] = req.files.map(f => ({
      id: id("file"),
      name: f.name,
      sizeBytes: f.sizeBytes,
      kind: f.kind,
      pages: null,
      status: "registered",
      uploadedAt: now,
    }));
    const job: IntakeJob = {
      id: id("job"),
      projectId,
      stage: "extracting_text",
      progress: 0,
      files,
      rooms: [],
      trCandidates: [],
      startedAt: now,
      stageStartedAt: now,
      completedAt: null,
      confirmedAt: null,
      diagnostics: { pagesExtracted: 0, roomsDetected: 0, classifiedHigh: 0, classifiedLow: 0, trsRecommended: 0 },
    };
    jobsByProject.set(projectId, job);
    return job;
  },

  overrideRoom(projectId: string, roomId: string, patch: Partial<Pick<ExtractedRoom, "overrideType" | "overrideName" | "excluded" | "reviewed">>): IntakeJob | undefined {
    const job = this.get(projectId);
    if (!job) return undefined;
    const room = job.rooms.find(r => r.id === roomId);
    if (!room) return undefined;
    Object.assign(room, patch);
    return job;
  },

  setTrApproval(projectId: string, roomId: string, approved: boolean | null): IntakeJob | undefined {
    const job = this.get(projectId);
    if (!job) return undefined;
    const tr = job.trCandidates.find(c => c.roomId === roomId);
    if (!tr) return undefined;
    tr.approved = approved;
    return job;
  },

  bulkAcceptHighConfidence(projectId: string, threshold = 0.85): IntakeJob | undefined {
    const job = this.get(projectId);
    if (!job) return undefined;
    job.rooms.forEach(r => { if (r.confidence >= threshold) r.reviewed = true; });
    return job;
  },

  confirm(projectId: string): IntakeJob | undefined {
    const job = this.get(projectId);
    if (!job || job.stage !== "ready_for_review") return undefined;
    job.stage = "confirmed";
    job.confirmedAt = new Date().toISOString();

    // Advance the project — apply room counts, set hasUpload, transition status
    const proj = [...projectStore.list("u_001")].find(p => p.id === projectId)
      ?? projectStore.list("u_002").find(p => p.id === projectId);
    if (proj) {
      const confirmed = job.rooms.filter(r => !r.excluded);
      const wapsApprox = Math.max(2, Math.round(proj.totalSf / 6000));
      const outletsApprox = confirmed
        .filter(r => ["open_office", "private_office", "conference", "classroom", "patient_room", "exam_room"].includes(r.type))
        .reduce((s, r) => s + Math.max(2, Math.round(r.area / 80)), 0);
      projectStore.update(proj.id, proj.createdBy, {
        // status & counts via projectStore.update — accept new fields directly
        // hasUpload + room counts updated via internal store
      } as any);
      // Direct mutation (mock-store internals) — fine for the mock
      proj.hasUpload = true;
      proj.status = "in_progress";
      proj.roomsConfirmed = confirmed.length;
      proj.outlets = outletsApprox;
      proj.waps = wapsApprox;
      proj.updatedAt = new Date().toISOString();
    }
    return job;
  },

  reset(projectId: string): void {
    jobsByProject.delete(projectId);
  },

  // ── Vision-detected rooms — bypass the mock pipeline ────────────────────
  // Used by the Claude-vision room detector to inject real rooms extracted
  // from an uploaded PDF directly into the intake state. Skips the simulated
  // extracting → assembling → classifying → scoring pipeline.
  confirmRoomsFromVision(projectId: string, rooms: ExtractedRoom[], userId: string): IntakeJob | undefined {
    const project = projectStore.get(projectId, userId);
    if (!project) return undefined;
    const now = new Date().toISOString();
    // Replace any existing job (the user clicked "Detect rooms" again).
    const job: IntakeJob = {
      id: id("job"),
      projectId,
      stage: "confirmed",
      progress: 1,
      files: [],
      rooms,
      trCandidates: scoreTrs(rooms),
      startedAt: now,
      stageStartedAt: now,
      completedAt: now,
      confirmedAt: now,
      diagnostics: {
        pagesExtracted: 1,
        roomsDetected: rooms.length,
        classifiedHigh: rooms.filter(r => r.confidence >= 0.85).length,
        classifiedLow:  rooms.filter(r => r.confidence < 0.85).length,
        trsRecommended: 0,
      },
    };
    job.diagnostics.trsRecommended = job.trCandidates.filter(c => c.recommended).length;
    jobsByProject.set(projectId, job);

    // Update project fields to reflect the imported design state.
    const workareaTypes = ["open_office", "private_office", "conference", "classroom", "patient_room", "exam_room", "lab"];
    const outletsApprox = rooms
      .filter(r => !r.excluded && workareaTypes.includes(r.overrideType ?? r.type))
      .reduce((s, r) => s + Math.max(2, Math.round(r.area / 80)), 0);
    const wapsApprox = Math.max(2, Math.round((project.totalSf ?? 0) / 6000));
    // Direct mutation matches the existing confirm() pattern in this file.
    project.hasUpload = true;
    project.status = "in_progress";
    project.roomsConfirmed = rooms.filter(r => !r.excluded).length;
    project.outlets = outletsApprox;
    project.waps = wapsApprox;
    project.updatedAt = now;

    return job;
  },

  // ── Layer 2 — extracted document (raw PDF text) ─────────────────────────
  // Survives HMR via globalThis. Set when the user uploads a PDF that runs
  // through pdfjs-dist text extraction; consumed by the NPE orchestrator
  // when running live Claude calls so the model sees the real document.
  setExtractedDocument(projectId: string, doc: ExtractedDocument): void {
    extractedDocsByProject.set(projectId, doc);
  },
  getExtractedDocument(projectId: string): ExtractedDocument | undefined {
    return extractedDocsByProject.get(projectId);
  },
  clearExtractedDocument(projectId: string): void {
    extractedDocsByProject.delete(projectId);
  },
};
