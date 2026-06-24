// Claude-vision OCR fallback for scanned PDFs.
//
// When pdfjs-dist can't extract enough text from a PDF (scanned/image-only),
// the client renders each page to PNG and sends them here. Claude with
// vision reads the image and transcribes the text, preserving layout where
// possible. We concatenate per-page output into a single fullText that
// downstream views (Layer 3 NER, NPE Two-Call Reasoning, spec generator,
// regulatory engine) consume identically to pdfjs's text output.

import { callAnthropic } from "@/lib/anthropic/client";

const OCR_SYSTEM_PROMPT = `You are an OCR specialist for architectural and engineering drawings.

Your task is to transcribe ALL visible text from the provided image. The image is one page of a construction project document — drawings, specifications, RFPs, or similar.

Output rules:
  • Output the transcribed text ONLY. No commentary, no analysis, no JSON.
  • Preserve the document's reading order top-to-bottom, left-to-right.
  • Preserve numbered lists, bullet structures, and section headers.
  • When you see a table, transcribe row-by-row with cells separated by " | ".
  • Title-block text (drawing number, scale, sheet number, project number, revision, date) should be transcribed clearly at the end with the prefix "[TITLE BLOCK]" on its own line.
  • Skip purely decorative elements (north arrows, scale bars, drawing line work without text).
  • Preserve standard engineering abbreviations (EMT, MDF, IDF, LF, NEC, TIA, etc.) as-is.
  • If text is unreadable or partially cut off, mark with [illegible] but keep going.
  • For dimensions and measurements, include units (LF, ft, m, in, etc.).

Output the transcribed text directly. No preamble.`;

export interface OcrPageResult {
  pageIndex: number;
  text: string;
  tokens: { input: number; output: number };
}

export async function ocrPageImage(
  imageBase64: string,
  pageIndex: number,
  mediaType: "image/png" | "image/jpeg" = "image/png",
): Promise<OcrPageResult> {
  const res = await callAnthropic({
    system: OCR_SYSTEM_PROMPT,
    content: [
      {
        type: "image",
        source: { type: "base64", media_type: mediaType, data: imageBase64 },
      },
      {
        type: "text",
        text: `Transcribe page ${pageIndex} of this document, following the rules in your system prompt.`,
      },
    ],
    maxTokens: 4000,
    temperature: 0.0,
  });

  if (!res.ok) {
    throw new Error(`OCR for page ${pageIndex} failed: ${res.error.kind} — ${res.error.message}`);
  }

  return {
    pageIndex,
    text: res.response.text.trim(),
    tokens: { input: res.response.usage.inputTokens, output: res.response.usage.outputTokens },
  };
}

/** Concatenate per-page OCR output into a single fullText with page markers. */
export function joinOcrPages(pages: OcrPageResult[]): string {
  return pages
    .sort((a, b) => a.pageIndex - b.pageIndex)
    .map(p => `## Page ${p.pageIndex}\n\n${p.text}`)
    .join("\n\n");
}
