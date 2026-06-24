// Document intake domain — types match the FastAPI IntakeJob model in shape.
// When real backend lands, openapi-typescript regenerates these.

export type IntakeStage =
  | "queued"
  | "extracting_text"
  | "assembling_rooms"
  | "classifying"
  | "scoring_trs"
  | "ready_for_review"   // intake complete; awaiting RCDD confirmation
  | "confirmed"          // RCDD has confirmed; project advanced
  | "failed";

export const STAGE_LABEL: Record<IntakeStage, string> = {
  queued:           "Queued",
  extracting_text:  "Extracting text",
  assembling_rooms: "Assembling rooms",
  classifying:      "Classifying rooms",
  scoring_trs:      "Scoring TR candidates",
  ready_for_review: "Ready for review",
  confirmed:        "Confirmed",
  failed:           "Failed",
};

export const PIPELINE_STAGES: IntakeStage[] = [
  "extracting_text", "assembling_rooms", "classifying", "scoring_trs",
];

export type RoomType =
  | "mdf" | "idf" | "open_office" | "private_office"
  | "conference" | "reception" | "corridor" | "storage"
  | "electrical" | "mechanical" | "restroom" | "kitchen"
  | "stairwell" | "elevator" | "lab" | "patient_room"
  | "exam_room" | "classroom" | "unknown";

export const ROOM_TYPE_LABEL: Record<RoomType, string> = {
  mdf: "MDF Telecom Room",
  idf: "IDF Telecom Room",
  open_office: "Open Office",
  private_office: "Private Office",
  conference: "Conference Room",
  reception: "Reception",
  corridor: "Corridor",
  storage: "Storage",
  electrical: "Electrical Room",
  mechanical: "Mechanical Room",
  restroom: "Restroom",
  kitchen: "Kitchen / Break Room",
  stairwell: "Stairwell",
  elevator: "Elevator Lobby",
  lab: "Laboratory",
  patient_room: "Patient Room",
  exam_room: "Exam Room",
  classroom: "Classroom",
  unknown: "Unclassified",
};

export type IntakeFileStatus = "registered" | "parsing" | "parsed" | "failed";

export interface IntakeFile {
  id: string;
  name: string;
  sizeBytes: number;
  kind: "pdf" | "dwg" | "dxf" | "ifc" | "other";
  pages: number | null;
  status: IntakeFileStatus;
  uploadedAt: string;
}

export interface ExtractedRoom {
  id: string;
  name: string;            // extracted text or generated label
  type: RoomType;          // classifier's best guess
  confidence: number;      // 0..1
  area: number;            // SF
  floor: number;
  // Geometry in canvas units (1 unit ≈ 1 ft on the 145×82 grid)
  x: number;
  y: number;
  w: number;
  h: number;
  source: "CAD" | "PDF" | "OCR" | "EST";
  // RCDD overrides applied on top of the classifier output
  overrideType: RoomType | null;
  overrideName: string | null;
  excluded: boolean;
  reviewed: boolean;       // RCDD has explicitly acknowledged this row
}

// Canvas grid is 145 wide × 82 tall units (matches v8 demo + drawing service)
export const CANVAS_W = 145;
export const CANVAS_H = 82;

export interface TrFactor {
  key: string;            // factor identifier
  label: string;          // human-readable
  weight: number;         // 0..1 (sums to 1.0)
  value: string;          // observed value (e.g. "Floor 1", "180 ft to farthest WA")
  score: number;          // 0..1 per-factor
  rationale: string;      // one-line explanation
}

export interface TrCandidate {
  roomId: string;         // ExtractedRoom.id
  score: number;          // 0..100 composite score (sum of weighted factors × 100)
  rank: number;           // 1 = highest
  recommended: boolean;   // top-K flagged for placement
  factors: TrFactor[];
  approved: boolean | null; // null = pending, true = RCDD confirmed, false = rejected
}

export interface IntakeJob {
  id: string;
  projectId: string;
  stage: IntakeStage;
  progress: number;       // 0..1 over the whole pipeline
  files: IntakeFile[];
  rooms: ExtractedRoom[];
  trCandidates: TrCandidate[];
  startedAt: string;
  stageStartedAt: string;
  completedAt: string | null;
  confirmedAt: string | null;
  // Per-stage diagnostics for the UI
  diagnostics: {
    pagesExtracted: number;
    roomsDetected: number;
    classifiedHigh: number;       // confidence ≥ 0.85
    classifiedLow: number;        // confidence < 0.65
    trsRecommended: number;
  };
}

export interface StartIntakeRequest {
  files: { name: string; sizeBytes: number; kind: IntakeFile["kind"] }[];
}

export interface IntakeResponse {
  ok: boolean;
  job?: IntakeJob;
  error?: { code: string; message: string };
}
