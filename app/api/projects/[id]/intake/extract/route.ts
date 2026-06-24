import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/session";
import { projectStore } from "@/lib/projects/mock-store";
import { intakeStore } from "@/lib/intake/mock-store";
import { extractPdfText } from "@/lib/intake/pdf-extract";
import { classifyEntities, classifierStats } from "@/lib/intake/nlp-classify";

// Maximum upload size (bytes). PDFs over this rejected outright.
const MAX_BYTES = 50 * 1024 * 1024; // 50 MB

export async function POST(req: Request, { params }: { params: { id: string } }) {
  const user = getCurrentUser();
  if (!user) return NextResponse.json({ ok: false }, { status: 401 });
  const project = projectStore.get(params.id, user.id);
  if (!project) {
    return NextResponse.json({ ok: false, error: { code: "not_found", message: "Project not found." } }, { status: 404 });
  }

  // ── Parse multipart form-data ─────────────────────────────────────────
  let form: FormData;
  try {
    form = await req.formData();
  } catch (e) {
    return NextResponse.json({
      ok: false,
      error: { code: "bad_form", message: "Could not parse the upload as multipart/form-data." },
    }, { status: 400 });
  }
  const file = form.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json({
      ok: false,
      error: { code: "no_file", message: "No file uploaded. Send a PDF in the `file` field." },
    }, { status: 400 });
  }

  if (file.size > MAX_BYTES) {
    return NextResponse.json({
      ok: false,
      error: { code: "too_large", message: `File exceeds ${MAX_BYTES} bytes.` },
    }, { status: 413 });
  }

  // ── Extract ───────────────────────────────────────────────────────────
  const buf = await file.arrayBuffer();
  const result = await extractPdfText(buf, { filename: file.name });

  if (!result.ok) {
    return NextResponse.json({
      ok: false,
      error: {
        code: result.error.kind,
        message: result.error.message,
        detail: result.error.detail,
      },
    }, { status: 400 });
  }

  // ── Run Layer 3 NER classifier on the extracted text ─────────────────
  const entities = classifyEntities(result.document.fullText);
  const stats = classifierStats(entities);

  // Attach to the document and persist.
  const docWithEntities = { ...result.document, entities };
  intakeStore.setExtractedDocument(project.id, docWithEntities);

  return NextResponse.json({
    ok: true,
    document: {
      pageCount: result.document.pageCount,
      charCount: result.document.fullText.length,
      sourceBytes: result.document.sourceBytes,
      sourceFilename: result.document.sourceFilename,
      metadata: result.document.metadata,
      extractedAt: result.document.extractedAt,
      preview: result.document.fullText.slice(0, 800),
      entityStats: stats,
      entities,
    },
  });
}

export async function GET(_req: Request, { params }: { params: { id: string } }) {
  const user = getCurrentUser();
  if (!user) return NextResponse.json({ ok: false }, { status: 401 });
  if (!projectStore.get(params.id, user.id)) {
    return NextResponse.json({ ok: false, error: { code: "not_found", message: "Project not found." } }, { status: 404 });
  }
  const doc = intakeStore.getExtractedDocument(params.id);
  if (!doc) {
    return NextResponse.json({ ok: true, document: null });
  }
  const stats = doc.entities ? classifierStats(doc.entities) : null;
  return NextResponse.json({
    ok: true,
    document: {
      pageCount: doc.pageCount,
      charCount: doc.fullText.length,
      sourceBytes: doc.sourceBytes,
      sourceFilename: doc.sourceFilename,
      metadata: doc.metadata,
      extractedAt: doc.extractedAt,
      preview: doc.fullText.slice(0, 800),
      entityStats: stats,
      entities: doc.entities,
    },
  });
}

export async function DELETE(_req: Request, { params }: { params: { id: string } }) {
  const user = getCurrentUser();
  if (!user) return NextResponse.json({ ok: false }, { status: 401 });
  if (!projectStore.get(params.id, user.id)) {
    return NextResponse.json({ ok: false, error: { code: "not_found", message: "Project not found." } }, { status: 404 });
  }
  intakeStore.clearExtractedDocument(params.id);
  return NextResponse.json({ ok: true });
}
