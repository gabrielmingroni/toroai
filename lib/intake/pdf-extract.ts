// PDF text extraction — server-side.
//
// Uses pdfjs-dist (Mozilla's PDF.js). Dynamic import so the module fails
// gracefully with a clear error message if pdfjs-dist hasn't been
// installed yet. Run `npm install` in frontend/ after this lands.
//
// Real production would add Tesseract OCR fallback for scanned PDFs (TDD
// §5.2) and ezdxf parsing for DWG/DXF inputs. For now we handle text PDFs.

export interface ExtractedPage {
  /** 1-based page number. */
  index: number;
  text: string;
  /** Character count for the page. */
  charCount: number;
}

export interface ExtractedDocument {
  /** Concatenated text from all pages, separated by blank lines. */
  fullText: string;
  pageCount: number;
  pages: ExtractedPage[];
  metadata?: {
    title?: string;
    author?: string;
    creator?: string;
  };
  /** Bytes of the source PDF (for the intake history). */
  sourceBytes: number;
  /** When extraction ran. */
  extractedAt: string;
  /** Source filename (informational). */
  sourceFilename?: string;
  /** Layer 3 entity dictionary, populated by the NER classifier. Optional —
   *  older extractions may not have it; freshly-extracted docs always do. */
  entities?: import("@/lib/npe/types").EntityDict;
}

export interface ExtractionError {
  kind: "library_missing" | "parse_failed" | "scanned_pdf" | "empty_pdf";
  message: string;
  detail?: unknown;
}

/** Extract text from a PDF buffer. */
export async function extractPdfText(
  buffer: ArrayBuffer,
  opts?: { filename?: string },
): Promise<
  | { ok: true; document: ExtractedDocument }
  | { ok: false; error: ExtractionError }
> {
  // Dynamic import — pdfjs-dist is optional. If it's not installed, surface
  // a clear error rather than a webpack/runtime ImportError.
  let pdfjs: any;
  try {
    // @ts-expect-error — dynamic optional dependency
    pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");
  } catch {
    return {
      ok: false,
      error: {
        kind: "library_missing",
        message: "pdfjs-dist is not installed. Run `npm install` in frontend/ to enable PDF extraction.",
      },
    };
  }

  // Disable the worker for server-side execution. PDF.js will fall back to
  // a synchronous parser, which is slower but works without a worker URL.
  try { pdfjs.GlobalWorkerOptions.workerSrc = ""; } catch {}

  let doc: any;
  try {
    const loadingTask = pdfjs.getDocument({
      data: new Uint8Array(buffer),
      useSystemFonts: true,
      disableFontFace: true,
    });
    doc = await loadingTask.promise;
  } catch (e) {
    return {
      ok: false,
      error: {
        kind: "parse_failed",
        message: "Failed to parse the PDF. The file may be corrupt or password-protected.",
        detail: e instanceof Error ? e.message : String(e),
      },
    };
  }

  const pageCount: number = doc.numPages ?? 0;
  if (pageCount === 0) {
    return { ok: false, error: { kind: "empty_pdf", message: "PDF has zero pages." } };
  }

  const pages: ExtractedPage[] = [];
  for (let i = 1; i <= pageCount; i++) {
    try {
      const page = await doc.getPage(i);
      const content = await page.getTextContent();
      const items = content.items as Array<{ str?: string }>;
      const text = items
        .filter(it => typeof it.str === "string")
        .map(it => it.str)
        .join(" ")
        .replace(/\s+/g, " ")
        .trim();
      pages.push({ index: i, text, charCount: text.length });
    } catch {
      // Skip pages that fail individually rather than aborting the whole doc.
      pages.push({ index: i, text: "", charCount: 0 });
    }
  }

  const fullText = pages.map(p => p.text).filter(t => t.length > 0).join("\n\n");
  if (fullText.length < 50) {
    return {
      ok: false,
      error: {
        kind: "scanned_pdf",
        message: "Extracted text is suspiciously short — the PDF may be scanned/image-only. OCR fallback (Tesseract) is not yet wired.",
      },
    };
  }

  // Best-effort metadata
  let metadata: ExtractedDocument["metadata"] | undefined;
  try {
    const meta = await doc.getMetadata();
    const info = meta?.info ?? {};
    metadata = {
      title: info.Title || undefined,
      author: info.Author || undefined,
      creator: info.Creator || undefined,
    };
  } catch {}

  return {
    ok: true,
    document: {
      fullText,
      pageCount,
      pages,
      metadata,
      sourceBytes: buffer.byteLength,
      extractedAt: new Date().toISOString(),
      sourceFilename: opts?.filename,
    },
  };
}
