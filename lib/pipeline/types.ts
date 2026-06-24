// Pipeline run domain — mirrors the Neural Parsal Engine architecture
// described in the ToroAI Technical Disclosure Document (TDD §5, §6).
//
// Structure:
//   1. Four sequential NPE preprocessing layers
//      L1 Input validation + file routing
//      L2 OCR + CAD parsing
//      L3 NLP entity classification
//      L4 Two-call Claude reasoning
//   2. Five SIMULTANEOUS output lanes (kicked off in parallel once L4 done)
//      Lane 1 Design generation
//      Lane 2 BOM
//      Lane 3 Labor / SOV
//      Lane 4 Permitting intelligence (Regulatory Output Engine)
//      Lane 5 Critical path schedule
//   3. Four PARALLEL post-processing enforcement modules
//      Davis-Bacon · LC/UPC · Production rate · Permit triggers
//   4. RCDD review gate (manual)
//   5. Final delivery (sequential): construction drawings, PDF export, S3 upload
//
// The novelty anchor of the TDD is "simultaneous parallel generation of five
// output lanes from a single upload." This domain model reflects that — the
// runner promotes all five lanes to "running" at the same tick.

export type StageId =
  // NPE preprocessing — sequential
  | "npe_l1_intake"
  | "npe_l2_extract"
  | "npe_l3_nlp"
  | "npe_l4_claude"
  // Five parallel output lanes
  | "lane_design"
  | "lane_bom"
  | "lane_labor_sov"
  | "lane_permitting"
  | "lane_schedule"
  // Post-processing enforcement modules — parallel
  | "enforce_davis_bacon"
  | "enforce_lc_upc"
  | "enforce_production_rate"
  | "enforce_permit_triggers"
  // Gate
  | "rcdd_review_gate"
  // Final delivery — sequential
  | "construction_drawing"
  | "pdf_export"
  | "upload_outputs";

export type StageStatus = "queued" | "running" | "done" | "paused" | "failed";

/** Which architectural band a stage belongs to. Drives UI grouping. */
export type StagePhase = "npe" | "lane" | "enforce" | "gate" | "delivery";

export interface StageDef {
  id: StageId;
  label: string;
  subtitle: string;
  durationMs: number;     // simulated duration (ignored for the gate)
  phase: StagePhase;
  /** Higher-precision callout — e.g., "Lane 2" or "Layer 3". */
  band?: string;
  /** Within its phase, does it run sequentially or simultaneously with siblings? */
  parallelism: "sequential" | "parallel";
  isGate?: boolean;
}

export const STAGE_DEFS: StageDef[] = [
  // ── NPE preprocessing layers (sequential) ───────────────────────────
  { id: "npe_l1_intake", phase: "npe", band: "Layer 1",
    label: "Input validation + file routing",
    subtitle: "Routes PDF / DWG / DXF / DOCX / PNG / TIFF to the matching extractor",
    durationMs: 800, parallelism: "sequential" },
  { id: "npe_l2_extract", phase: "npe", band: "Layer 2",
    label: "OCR + CAD parsing",
    subtitle: "PyMuPDF text · Tesseract OCR · ezdxf geometric entity extraction",
    durationMs: 1500, parallelism: "sequential" },
  { id: "npe_l3_nlp", phase: "npe", band: "Layer 3",
    label: "NLP entity classification",
    subtitle: "10-category telecom regex + spaCy NER over the extracted full text",
    durationMs: 1000, parallelism: "sequential" },
  { id: "npe_l4_claude", phase: "npe", band: "Layer 4",
    label: "Two-call Claude reasoning",
    subtitle: "Call 1: BOM + Labor (13 engineering rules) · Call 2: Schedule + P6",
    durationMs: 2500, parallelism: "sequential" },

  // ── Five SIMULTANEOUS output lanes ──────────────────────────────────
  { id: "lane_design", phase: "lane", band: "Lane 1",
    label: "Design generation",
    subtitle: "ISP/OSP layout · E-Dijkstra routing · clearance avoidance · code compliance",
    durationMs: 2200, parallelism: "parallel" },
  { id: "lane_bom", phase: "lane", band: "Lane 2",
    label: "Bill of Materials",
    subtitle: "Line items · LC/UPC connector spec · RSMeans pricing · reel quantities",
    durationMs: 1800, parallelism: "parallel" },
  { id: "lane_labor_sov", phase: "lane", band: "Lane 3",
    label: "Labor / Schedule of Values",
    subtitle: "NECA MLU task units · Davis-Bacon wages · 5-man crew · AIA G703",
    durationMs: 2000, parallelism: "parallel" },
  { id: "lane_permitting", phase: "lane", band: "Lane 4",
    label: "Permitting intelligence",
    subtitle: "Regulatory Output Engine — jurisdiction · AHJ · permit taxonomy · RRR",
    durationMs: 2400, parallelism: "parallel" },
  { id: "lane_schedule", phase: "lane", band: "Lane 5",
    label: "Critical path schedule",
    subtitle: "CPM with float · milestones · permit-window integration · Primavera P6 XML",
    durationMs: 2100, parallelism: "parallel" },

  // ── Post-processing enforcement (parallel within band) ──────────────
  { id: "enforce_davis_bacon", phase: "enforce", band: "Enforcement",
    label: "Davis-Bacon wage override",
    subtitle: "Federal / VA / DoD projects — corrects any AI-generated labor rate",
    durationMs: 500, parallelism: "parallel" },
  { id: "enforce_lc_upc", phase: "enforce", band: "Enforcement",
    label: "LC/UPC connector enforcement",
    subtitle: "Any LC/APC specification is overridden to LC/UPC",
    durationMs: 400, parallelism: "parallel" },
  { id: "enforce_production_rate", phase: "enforce", band: "Enforcement",
    label: "Production rate validation",
    subtitle: "Pull durations clamped to 3,500–5,280 LF/day envelope (5-man OSP crew)",
    durationMs: 450, parallelism: "parallel" },
  { id: "enforce_permit_triggers", phase: "enforce", band: "Enforcement",
    label: "Permit trigger extraction",
    subtitle: "permit_triggers.json split out of design_summary.json",
    durationMs: 400, parallelism: "parallel" },

  // ── Gate ────────────────────────────────────────────────────────────
  { id: "rcdd_review_gate", phase: "gate", band: "Gate",
    label: "RCDD review gate",
    subtitle: "Paused — RCDD must release the gate to generate construction documents",
    durationMs: 0, parallelism: "sequential", isGate: true },

  // ── Final delivery (sequential) ─────────────────────────────────────
  { id: "construction_drawing", phase: "delivery", band: "Delivery",
    label: "Construction drawing",
    subtitle: "10-layer SVG + AutoCAD R2018 DXF · D-size title block · sequential outlet labels",
    durationMs: 1700, parallelism: "sequential" },
  { id: "pdf_export", phase: "delivery", band: "Delivery",
    label: "PDF export",
    subtitle: "D-size (36\" × 24\") sheet set · WeasyPrint render with RCDD stamp",
    durationMs: 1500, parallelism: "sequential" },
  { id: "upload_outputs", phase: "delivery", band: "Delivery",
    label: "Upload outputs",
    subtitle: "Secure S3 upload · SVG · PDF · DXF · BOM · SOV · GIS GeoJSON",
    durationMs: 900, parallelism: "sequential" },
];

/** Lookup helper — convenience for the runner / UI. */
export function stagesInPhase(phase: StagePhase): StageDef[] {
  return STAGE_DEFS.filter(s => s.phase === phase);
}

export interface StageState {
  id: StageId;
  status: StageStatus;
  startedAt: string | null;
  completedAt: string | null;
  progress: number; // 0..1 for the active stage
}

export interface PipelineRun {
  id: string;
  projectId: string;
  startedAt: string;
  completedAt: string | null;
  gateReleasedAt: string | null;
  stages: StageState[];
  /** Most-advanced active stage for backwards-compatible single-stage callers. */
  currentStage: StageId | null;
  /** Overall progress 0..1 weighted across the parallel architecture. */
  overallProgress: number;
}

export interface PipelineResponse {
  ok: boolean;
  run?: PipelineRun | null;
  error?: { code: string; message: string };
}
