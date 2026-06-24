import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/session";
import { projectStore } from "@/lib/projects/mock-store";
import { intakeStore } from "@/lib/intake/mock-store";
import { ocrPageImage, joinOcrPages, type OcrPageResult } from "@/lib/intake/ocr-vision";
import { classifyEntities } from "@/lib/intake/nlp-classify";

const MAX_PAGES = 10;
const MAX_BYTES_PER_PAGE = 8 * 1024 * 1024;

interface PageInput {
  pageIndex: number;
  imageBase64: string;
  mediaType?: "image/png" | "image/jpeg";
}

export async function POST(req: Request, { params }: { params: { id: string } }) {
  const user = getCurrentUser();
  if (!user) return NextResponse.json({ ok: false }, { status: 401 });
  const project = projectStore.get(params.id, user.id);
  if (!project) {
    return NextResponse.json({ ok: false, error: { code: "not_found", message: "Project not found." } }, { status: 404 });
  }

  let body: { pages?: PageInput[]; sourceFilename?: string };
  try { body = await req.json(); }
  catch {
    return NextResponse.json({ ok: false, error: { code: "bad_json", message: "Request body must be JSON with pages[]." } }, { status: 400 });
  }
  if (!Array.isArray(body.pages) || body.pages.length === 0) {
    return NextResponse.json({ ok: false, error: { code: "no_pages", message: "pages must be a non-empty array." } }, { status: 400 });
  }
  if (body.pages.length > MAX_PAGES) {
    return NextResponse.json({
      ok: false,
      error: { code: "too_many_pages", message: `OCR is limited to ${MAX_PAGES} pages per call to control cost.` },
    }, { status: 413 });
  }
  for (const p of body.pages) {
    if (!p.imageBase64 || typeof p.imageBase64 !== "string") {
      return NextResponse.json({ ok: false, error: { code: "missing_image", message: "Each page must have imageBase64." } }, { status: 400 });
    }
    if (p.imageBase64.length > (MAX_BYTES_PER_PAGE * 4) / 3) {
      return NextResponse.json({ ok: false, error: { code: "page_too_large", message: `Page ${p.pageIndex} exceeds ${MAX_BYTES_PER_PAGE} bytes.` } }, { status: 413 });
    }
  }

  // OCR each page (sequentially — keeps API rate-limit pressure low).
  const results: OcrPageResult[] = [];
  let totalIn = 0; let totalOut = 0;
  try {
    for (const p of body.pages) {
      const r = await ocrPageImage(
        p.imageBase64,
        typeof p.pageIndex === "number" ? p.pageIndex : results.length + 1,
        p.mediaType === "image/jpeg" ? "image/jpeg" : "image/png",
      );
      results.push(r);
      totalIn += r.tokens.input;
      totalOut += r.tokens.output;
    }
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({
      ok: false,
      error: { code: "ocr_failed", message: msg },
      partial: results,
    }, { status: 502 });
  }

  const fullText = joinOcrPages(results);
  const charCount = fullText.length;
  const entities = classifyEntities(fullText);
  const extractedAt = new Date().toISOString();

  // Persist as the project's extracted document so downstream views see it.
  intakeStore.setExtractedDocument(project.id, {
    fullText,
    pageCount: results.length,
    pages: results.map(r => ({ index: r.pageIndex, text: r.text, charCount: r.text.length })),
    sourceBytes: body.pages.reduce((s, p) => s + Math.ceil((p.imageBase64.length * 3) / 4), 0),
    extractedAt,
    sourceFilename: body.sourceFilename ?? "ocr-input.pdf",
    entities,
    metadata: { creator: "ToroAI · Claude vision OCR" },
  });

  return NextResponse.json({
    ok: true,
    pageCount: results.length,
    charCount,
    tokens: { input: totalIn, output: totalOut },
    extractedAt,
    preview: fullText.slice(0, 800),
    entityStats: {
      totalEntities: Object.values(entities).flat().length,
      byCategory: Object.fromEntries(Object.entries(entities).map(([k, v]) => [k, v.length])),
      averageConfidence: 0,
    },
  });
}
