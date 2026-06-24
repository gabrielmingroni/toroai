"use client";

// PDF extraction tool — uploads a PDF, runs Layer 2 text extraction +
// Layer 3 entity classification, and optionally runs Claude with vision
// to detect labeled rooms from page 1. All results feed downstream into
// NPE Reasoning + Floor Plan + Design Generation.

import { useEffect, useState } from "react";
import Link from "next/link";

interface EntityStats {
  totalEntities: number;
  byCategory: Record<string, number>;
  averageConfidence: number;
}

interface ExtractedDocSummary {
  pageCount: number;
  charCount: number;
  sourceBytes: number;
  sourceFilename?: string;
  metadata?: { title?: string; author?: string; creator?: string };
  extractedAt: string;
  preview: string;
  entityStats?: EntityStats | null;
  entities?: Record<string, Array<{ text: string; confidence: number }>>;
}

interface DetectedRoom {
  name: string;
  type: string;
  bbox: [number, number, number, number];
  confidence: number;
}

interface DetectionResult {
  detected: DetectedRoom[];
  /** Same rooms mapped to ExtractedRoom — sent to /import-rooms unmodified. */
  rooms: Array<Record<string, unknown>>;
  tokens: { input: number; output: number };
  /** data: URL of the rendered page used for overlay preview. */
  imageDataUrl: string;
}

export function PdfExtractPanel({ projectId }: { projectId: string }) {
  const [doc, setDoc] = useState<ExtractedDocSummary | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  /** When the extract endpoint returns a code, we use it to decide whether
   *  to offer the OCR fallback. Only "scanned_pdf" enables OCR. */
  const [errorCode, setErrorCode] = useState<string | null>(null);
  const [dragging, setDragging] = useState(false);

  /** Cached ArrayBuffer of the last uploaded PDF — kept so we can re-render
   *  page 1 for vision detection without re-uploading. */
  const [lastFileBuffer, setLastFileBuffer] = useState<ArrayBuffer | null>(null);
  const [lastFileName, setLastFileName] = useState<string | null>(null);

  const [detection, setDetection] = useState<DetectionResult | null>(null);
  const [detecting, setDetecting] = useState(false);

  /** OCR progress — null when idle. */
  const [ocrProgress, setOcrProgress] = useState<{ pageNo: number; total: number } | null>(null);

  // Load any existing extracted document so the user sees it after a reload.
  useEffect(() => {
    let cancel = false;
    fetch(`/api/projects/${projectId}/intake/extract`)
      .then(r => r.json())
      .then(j => { if (!cancel && j.ok && j.document) setDoc(j.document); })
      .catch(() => {});
    return () => { cancel = true; };
  }, [projectId]);

  async function upload(file: File) {
    setError(null); setErrorCode(null); setDetection(null);
    if (!/\.pdf$/i.test(file.name)) {
      setError("Only PDF files are supported in this build.");
      return;
    }
    setBusy(true);
    const form = new FormData();
    form.append("file", file);
    try {
      const buf = await file.arrayBuffer();
      setLastFileBuffer(buf);
      setLastFileName(file.name);
      const res = await fetch(`/api/projects/${projectId}/intake/extract`, {
        method: "POST", body: form,
      });
      const j = await res.json();
      if (!j.ok) {
        setError(j.error?.message ?? "Extraction failed.");
        setErrorCode(j.error?.code ?? null);
        setBusy(false);
        return;
      }
      setDoc(j.document);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Network error.");
    }
    setBusy(false);
  }

  async function runOcrFallback() {
    if (!lastFileBuffer) {
      setError("Re-upload the PDF to enable OCR.");
      return;
    }
    setError(null); setErrorCode(null);
    try {
      // Discover page count and cap at 10 for cost control.
      // @ts-expect-error — dynamic optional dependency
      const pdfjs: any = await import("pdfjs-dist/legacy/build/pdf.mjs");
      try { pdfjs.GlobalWorkerOptions.workerSrc = ""; } catch {}
      const pdfDoc = await pdfjs.getDocument({ data: new Uint8Array(lastFileBuffer) }).promise;
      const totalPages = Math.min(10, pdfDoc.numPages);
      setOcrProgress({ pageNo: 0, total: totalPages });

      // Render each page client-side to PNG.
      const pages: Array<{ pageIndex: number; imageBase64: string; mediaType: "image/png" }> = [];
      for (let i = 1; i <= totalPages; i++) {
        setOcrProgress({ pageNo: i, total: totalPages });
        const dataUrl = await renderPdfPageToPngFromDoc(pdfDoc, i);
        pages.push({
          pageIndex: i,
          imageBase64: dataUrl.split(",")[1],
          mediaType: "image/png",
        });
      }

      // POST to OCR endpoint — server OCRs each page via Claude vision sequentially.
      const res = await fetch(`/api/projects/${projectId}/intake/ocr`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ pages, sourceFilename: lastFileName }),
      });
      const j = await res.json();
      if (!j.ok) {
        setError(j.error?.message ?? "OCR failed.");
      } else {
        // Construct an ExtractedDocSummary from the OCR response.
        setDoc({
          pageCount: j.pageCount,
          charCount: j.charCount,
          sourceBytes: 0,
          sourceFilename: lastFileName ?? "ocr.pdf",
          metadata: { creator: "ToroAI · Claude vision OCR" },
          extractedAt: j.extractedAt,
          preview: j.preview,
          entityStats: j.entityStats,
        });
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "OCR network error.");
    }
    setOcrProgress(null);
  }

  async function clear() {
    if (!confirm("Clear the extracted document?")) return;
    setBusy(true);
    await fetch(`/api/projects/${projectId}/intake/extract`, { method: "DELETE" });
    setDoc(null); setDetection(null); setLastFileBuffer(null); setLastFileName(null);
    setBusy(false);
  }

  async function detectRooms() {
    if (!lastFileBuffer) {
      setError("Re-upload the PDF to enable room detection.");
      return;
    }
    setError(null); setDetecting(true);
    try {
      const dataUrl = await renderPdfPageToPng(lastFileBuffer, 1);
      const base64 = dataUrl.split(",")[1];
      const res = await fetch(`/api/projects/${projectId}/intake/detect-rooms`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ imageBase64: base64, mediaType: "image/png", floor: 1 }),
      });
      const j = await res.json();
      if (!j.ok) {
        setError(j.error?.message ?? "Room detection failed. (Requires ANTHROPIC_API_KEY.)");
      } else {
        setDetection({
          detected: j.detected, rooms: j.rooms, tokens: j.tokens,
          imageDataUrl: dataUrl,
        });
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Detection error.");
    }
    setDetecting(false);
  }

  return (
    <div className="space-y-3">

      <div className="card">
        <div className="card-header">
          <div className="card-title">PDF text extraction</div>
          <span className="text-[9.5px] text-text4 font-mono uppercase tracking-[0.06em]">
            pdfjs · 10-category NER classifier
          </span>
        </div>
        <div className="card-body">
          {!doc ? (
            <>
              <p className="text-[11.5px] text-text2 mb-3">
                Upload a project PDF (specifications, RFP, drawings cover sheet).
                Extracted text feeds into the design reasoning layer + the
                10-category NER classifier. Scanned/image-only PDFs aren't
                supported yet (OCR fallback is on the roadmap).
              </p>
              <label
                className={
                  "flex flex-col items-center justify-center w-full h-40 border-2 border-dashed rounded-[2px] cursor-pointer transition-colors " +
                  (dragging
                    ? "border-accent bg-accent/5"
                    : "border-chrome-lighter hover:border-chrome-light hover:bg-chrome-dark/40")
                }
                onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
                onDragLeave={() => setDragging(false)}
                onDrop={(e) => {
                  e.preventDefault(); setDragging(false);
                  const file = e.dataTransfer.files?.[0];
                  if (file) void upload(file);
                }}
              >
                <input type="file" accept="application/pdf,.pdf"
                       className="hidden" disabled={busy}
                       onChange={(e) => { const f = e.target.files?.[0]; if (f) void upload(f); }} />
                <i className="ti ti-cloud-upload" style={{ fontSize: 28, color: "#f6a623" }} aria-hidden="true" />
                <div className="text-[12px] text-text2 mt-2">
                  {busy ? "Extracting…" : "Drop a PDF here or click to choose"}
                </div>
                <div className="text-[10px] text-text4 mt-1 font-mono">Max 50 MB · text-based PDFs only</div>
              </label>
            </>
          ) : (
            <ExtractedSummary doc={doc} onClear={clear} projectId={projectId}
                              onDetectRooms={detectRooms} detecting={detecting}
                              canDetect={!!lastFileBuffer} />
          )}

          {error && (
            <div className="mt-3 px-3 py-2 border border-fail/40 bg-fail/10 text-[11px] text-fail font-mono rounded-[2px]">
              {error}
            </div>
          )}

          {/* OCR fallback — shown when the upload failed with scanned_pdf */}
          {errorCode === "scanned_pdf" && lastFileBuffer && (
            <div className="mt-3 px-3 py-3 border border-warn/40 border-l-2 border-l-warn bg-warn/10 rounded-[2px]">
              <div className="text-[11px] text-warn font-medium mb-1">
                <i className="ti ti-photo-scan" style={{ fontSize: 12, verticalAlign: "-2px", marginRight: 4 }} aria-hidden="true" />
                Looks like a scanned PDF
              </div>
              <p className="text-[11px] text-text2 mb-2 leading-snug">
                pdfjs couldn't extract enough text — this PDF is likely image-only.
                Try OCR with Claude vision: each page renders to PNG and Claude transcribes
                the visible text. Capped at 10 pages for cost control.
              </p>
              <div className="flex items-center gap-3">
                <button onClick={runOcrFallback} disabled={!!ocrProgress}
                        className="btn btn-primary text-[11px] px-3 py-1.5 disabled:opacity-50">
                  {ocrProgress
                    ? `OCR'ing page ${ocrProgress.pageNo}/${ocrProgress.total}…`
                    : "Try OCR with Claude vision"}
                </button>
                <span className="text-[10px] text-text4 font-mono">
                  Requires ANTHROPIC_API_KEY
                </span>
              </div>
              {ocrProgress && (
                <div className="mt-2 h-0.5 bg-chrome-darkest rounded-full overflow-hidden">
                  <div className="h-full bg-warn transition-all"
                       style={{ width: `${(ocrProgress.pageNo / ocrProgress.total) * 100}%` }} />
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {detection && (
        <DetectionPanel
          detection={detection}
          fileName={lastFileName}
          projectId={projectId}
        />
      )}
    </div>
  );
}

function ExtractedSummary({
  doc, onClear, projectId, onDetectRooms, detecting, canDetect,
}: {
  doc: ExtractedDocSummary; onClear: () => void; projectId: string;
  onDetectRooms: () => void; detecting: boolean; canDetect: boolean;
}) {
  return (
    <div>
      <div className="flex items-baseline justify-between mb-3 gap-3">
        <div>
          <div className="text-[12px] text-text font-medium">{doc.sourceFilename ?? "Extracted PDF"}</div>
          <div className="text-[10px] text-text4 font-mono mt-0.5">
            Extracted {new Date(doc.extractedAt).toLocaleString()}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={onDetectRooms} disabled={!canDetect || detecting}
                  className="btn btn-ghost text-[11px] px-3 py-1.5 disabled:opacity-50">
            <i className="ti ti-photo-scan" style={{ fontSize: 12, verticalAlign: "-1px", marginRight: 4 }} aria-hidden="true" />
            {detecting ? "Detecting…" : "Detect rooms (Claude vision)"}
          </button>
          <Link href={`/projects/${projectId}/npe`} className="btn btn-primary text-[11px] px-3 py-1.5">
            Run NPE Reasoning →
          </Link>
          <button onClick={onClear}
                  className="text-[10.5px] text-text4 hover:text-fail font-mono">Clear</button>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-2 mb-3 text-[11.5px]">
        <Field label="Pages"      value={doc.pageCount.toLocaleString()} mono />
        <Field label="Characters" value={doc.charCount.toLocaleString()} mono />
        <Field label="Bytes"      value={(doc.sourceBytes / 1024).toFixed(1) + " KB"} mono />
      </div>

      {doc.metadata && (doc.metadata.title || doc.metadata.author || doc.metadata.creator) && (
        <div className="grid grid-cols-3 gap-2 mb-3 text-[10.5px]">
          {doc.metadata.title  && <Field label="Title"   value={doc.metadata.title} />}
          {doc.metadata.author && <Field label="Author"  value={doc.metadata.author} />}
          {doc.metadata.creator && <Field label="Creator" value={doc.metadata.creator} />}
        </div>
      )}

      {doc.entityStats && doc.entityStats.totalEntities > 0 && (
        <div className="mb-3">
          <div className="text-[9.5px] uppercase tracking-[0.06em] text-text4 font-mono mb-1">
            Layer 3 entity classification — {doc.entityStats.totalEntities} entities ·
            avg confidence {(doc.entityStats.averageConfidence * 100).toFixed(0)}%
          </div>
          <div className="grid grid-cols-5 gap-1.5 text-[10px]">
            {Object.entries(doc.entityStats.byCategory).map(([cat, count]) => (
              <div key={cat}
                   className={"border border-chrome-dark rounded-[2px] p-1.5 bg-chrome-darkest text-center " +
                     (count > 0 ? "" : "opacity-50")}>
                <div className="text-text font-mono tabular-nums">{count}</div>
                <div className="text-text4 font-mono text-[9px] uppercase tracking-[0.05em] mt-0.5">
                  {cat.replace(/_/g, " ")}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="text-[9.5px] uppercase tracking-[0.06em] text-text4 font-mono mb-1">
        First 800 characters
      </div>
      <pre className="text-[10.5px] text-text2 font-mono leading-snug bg-chrome-darkest border border-chrome-dark rounded-[2px] p-3 overflow-x-auto max-h-[220px] overflow-y-auto whitespace-pre-wrap">
        {doc.preview}
      </pre>
    </div>
  );
}

// ── Vision detection panel ──────────────────────────────────────────────

function DetectionPanel({
  detection, fileName, projectId,
}: { detection: DetectionResult; fileName: string | null; projectId: string }) {
  const [importing, setImporting] = useState(false);
  const [imported, setImported] = useState<null | { count: number; outlets: number; waps: number }>(null);
  const [importError, setImportError] = useState<string | null>(null);

  async function importRooms() {
    setImporting(true); setImportError(null);
    try {
      const res = await fetch(`/api/projects/${projectId}/intake/import-rooms`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ rooms: detection.rooms }),
      });
      const j = await res.json();
      if (!j.ok) {
        setImportError(j.error?.message ?? "Import failed.");
      } else {
        setImported({
          count: j.imported,
          outlets: j.project.outlets,
          waps: j.project.waps,
        });
      }
    } catch (e) {
      setImportError(e instanceof Error ? e.message : "Network error.");
    }
    setImporting(false);
  }

  // Render an SVG overlay over the page image showing detected bboxes.
  const TYPE_COLOR: Record<string, string> = {
    mdf: "#f6a623", idf: "#f6a623",
    open_office: "#4a90d6", private_office: "#4a90d6",
    conference: "#9b6dc7", classroom: "#9b6dc7",
    storage: "#888b91", corridor: "#888b91",
    electrical: "#c9931f", mechanical: "#c9931f",
    restroom: "#7e7e7e", kitchen: "#c44a4a",
    patient_room: "#3fae5d", exam_room: "#3fae5d",
    lab: "#9b6dc7", reception: "#4a90d6",
    stairwell: "#666", elevator: "#666",
    unknown: "#999",
  };
  return (
    <div className="card">
      <div className="card-header">
        <div className="card-title">Claude Vision · Room Detection</div>
        <span className="text-[9.5px] text-text4 font-mono uppercase tracking-[0.06em]">
          {detection.detected.length} room{detection.detected.length === 1 ? "" : "s"} ·
          {detection.tokens.input.toLocaleString()} in / {detection.tokens.output.toLocaleString()} out tokens
        </span>
      </div>

      {/* Import bar */}
      {!imported ? (
        <div className="px-4 py-2 border-b border-chrome-dark flex items-center gap-3 bg-chrome-darkest/40">
          <i className="ti ti-database-import" style={{ fontSize: 13, color: "#f6a623" }} aria-hidden="true" />
          <span className="text-[11px] text-text2">
            Import these {detection.detected.length} rooms into the project so they flow into Floor Plan, Pathway, and Design Generation.
          </span>
          <button onClick={importRooms} disabled={importing || detection.detected.length === 0}
                  className="btn btn-primary text-[11px] px-3 py-1.5 ml-auto disabled:opacity-50">
            {importing ? "Importing…" : "Import these rooms →"}
          </button>
        </div>
      ) : (
        <div className="px-4 py-2 border-b border-chrome-dark bg-pass/10 text-[11px] flex items-center gap-3 flex-wrap">
          <i className="ti ti-check" style={{ fontSize: 13, color: "#3fae5d" }} aria-hidden="true" />
          <span className="text-pass">
            Imported {imported.count} room{imported.count === 1 ? "" : "s"} ·
            {imported.outlets} outlets (est.) · {imported.waps} WAPs (est.)
          </span>
          <Link href={`/projects/${projectId}/floor-plan`} className="text-info hover:text-accent text-[11px] ml-auto">
            Open Floor Plan →
          </Link>
          <Link href={`/projects/${projectId}/design-gen`} className="text-info hover:text-accent text-[11px]">
            Design Generation →
          </Link>
          <Link href={`/projects/${projectId}/pathway`} className="text-info hover:text-accent text-[11px]">
            Pathway →
          </Link>
        </div>
      )}
      {importError && (
        <div className="px-4 py-1.5 border-b border-chrome-dark text-[11px] text-fail font-mono bg-fail/10">
          {importError}
        </div>
      )}

      <div className="card-body">
        <div className="grid grid-cols-1 lg:grid-cols-[2fr_1fr] gap-3">

          {/* Overlay preview */}
          <div className="relative bg-canvas-bg border border-chrome-dark rounded-[2px] overflow-hidden">
            <img src={detection.imageDataUrl} alt="Floor plan page 1"
                 className="w-full h-auto block" />
            <svg className="absolute inset-0 w-full h-full" viewBox="0 0 1 1" preserveAspectRatio="none">
              {detection.detected.map((r, i) => {
                const [x1, y1, x2, y2] = r.bbox;
                const color = TYPE_COLOR[r.type] ?? "#999";
                return (
                  <g key={i}>
                    <rect x={x1} y={y1} width={x2 - x1} height={y2 - y1}
                          fill={color} fillOpacity={0.18} stroke={color} strokeWidth={0.003} />
                    <text x={x1 + 0.004} y={y1 + 0.018} fill={color}
                          style={{ fontSize: 0.013, fontFamily: "monospace", fontWeight: 600 }}>
                      {r.name}
                    </text>
                  </g>
                );
              })}
            </svg>
          </div>

          {/* Room list */}
          <div className="flex flex-col">
            <div className="text-[9.5px] uppercase tracking-[0.06em] text-text4 font-mono mb-2">
              Detected · {fileName ?? "page 1"}
            </div>
            <div className="space-y-1 overflow-y-auto max-h-[420px]">
              {detection.detected.length === 0 && (
                <div className="text-[11px] text-text3">No rooms identified — try a clearer floor plan or higher-resolution scan.</div>
              )}
              {detection.detected.map((r, i) => (
                <div key={i} className="px-2 py-1.5 border border-chrome-dark rounded-[2px] bg-chrome-darkest">
                  <div className="flex items-baseline justify-between">
                    <span className="text-[11px] text-text font-medium truncate">{r.name}</span>
                    <span className="text-[10px] text-text4 font-mono">{(r.confidence * 100).toFixed(0)}%</span>
                  </div>
                  <div className="text-[9.5px] text-text4 font-mono uppercase tracking-[0.05em] mt-0.5">
                    {r.type.replace(/_/g, " ")}
                  </div>
                </div>
              ))}
            </div>
            <div className="text-[10px] text-text4 font-mono mt-3 leading-snug">
              Mapped to 145 × 82 grid. Imports into downstream views (Floor Plan, Pathway, Design Generation) is the next iteration.
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}

// ── PDF → PNG rendering (client-side, pdfjs-dist) ───────────────────────

async function renderPdfPageToPng(buf: ArrayBuffer, pageNumber: number): Promise<string> {
  // Dynamic import — pdfjs is heavy; load only when the user asks to detect.
  // @ts-expect-error — dynamic optional dependency
  const pdfjs: any = await import("pdfjs-dist/legacy/build/pdf.mjs");
  try { pdfjs.GlobalWorkerOptions.workerSrc = ""; } catch {}
  const doc = await pdfjs.getDocument({ data: new Uint8Array(buf) }).promise;
  return renderPdfPageToPngFromDoc(doc, pageNumber);
}

/** Same as renderPdfPageToPng but reuses an already-loaded pdfjs document.
 *  Lets the OCR fallback amortize doc-loading across many pages. */
async function renderPdfPageToPngFromDoc(doc: any, pageNumber: number): Promise<string> {
  const page = await doc.getPage(pageNumber);
  const baseViewport = page.getViewport({ scale: 1 });
  const targetWidth = Math.min(2400, baseViewport.width * 2);
  const scale = targetWidth / baseViewport.width;
  const viewport = page.getViewport({ scale });
  const canvas = document.createElement("canvas");
  canvas.width = Math.ceil(viewport.width);
  canvas.height = Math.ceil(viewport.height);
  const context = canvas.getContext("2d")!;
  await page.render({ canvasContext: context, viewport }).promise;
  return canvas.toDataURL("image/png");
}

// ── Small atoms ─────────────────────────────────────────────────────────

function Field({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="flex flex-col">
      <span className="text-[9.5px] text-text4 font-mono uppercase tracking-[0.06em]">{label}</span>
      <span className={mono ? "text-text2 font-mono tabular-nums" : "text-text2"}>{value}</span>
    </div>
  );
}
