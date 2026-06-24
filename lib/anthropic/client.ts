// Thin fetch wrapper around the Anthropic Messages API.
//
// No SDK dependency — POSTs to https://api.anthropic.com/v1/messages with
// the documented headers. Used server-side only; the API key is read from
// the ANTHROPIC_API_KEY env var. If that's not set, callers should fall
// back to the deterministic_mock strategy instead of calling this.
//
// Docs: https://docs.anthropic.com/en/api/messages

export const ANTHROPIC_API_URL  = "https://api.anthropic.com/v1/messages";
export const ANTHROPIC_VERSION  = "2023-06-01";
export const DEFAULT_MODEL      = "claude-sonnet-4-6";

/** A single content block in the user message — text or image. */
export type AnthropicContentBlock =
  | { type: "text"; text: string }
  | { type: "image"; source: { type: "base64"; media_type: "image/png" | "image/jpeg" | "image/gif" | "image/webp"; data: string } };

export interface AnthropicMessageRequest {
  model?: string;
  system: string;
  /** User message — either plain text or multimodal content blocks. If both
   *  are provided, `content` wins. Use `content` for vision (image+text). */
  user?: string;
  content?: AnthropicContentBlock[];
  /** Optional assistant prefill — useful for forcing JSON outputs. */
  assistantPrefill?: string;
  maxTokens?: number;
  /** Temperature 0..1. Defaults to 0.2 for deterministic engineering output. */
  temperature?: number;
}

export interface AnthropicMessageResponse {
  /** Concatenated text from all `text` content blocks. */
  text: string;
  /** Actual token usage as reported by the API. */
  usage: { inputTokens: number; outputTokens: number };
  /** Model used (echoed from the API). */
  model: string;
  /** Stop reason — "end_turn" / "max_tokens" / "stop_sequence". */
  stopReason: string;
  /** Raw API response for debugging. */
  raw: unknown;
}

export interface AnthropicClientError {
  kind: "no_api_key" | "http_error" | "parse_error" | "network_error";
  status?: number;
  message: string;
  detail?: unknown;
}

/**
 * Call Claude.
 *
 * Returns `{ ok: true, response }` on success or `{ ok: false, error }` on
 * any failure — caller decides whether to fall back to a mock or surface
 * the error.
 */
export async function callAnthropic(req: AnthropicMessageRequest): Promise<
  | { ok: true; response: AnthropicMessageResponse }
  | { ok: false; error: AnthropicClientError }
> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return { ok: false, error: { kind: "no_api_key",
      message: "ANTHROPIC_API_KEY environment variable is not set. Live Claude calls are disabled." } };
  }

  const model = req.model ?? process.env.TOROAI_CLAUDE_MODEL ?? DEFAULT_MODEL;
  // Content blocks take precedence; fall back to plain text user message.
  const userContent: string | AnthropicContentBlock[] =
    req.content && req.content.length > 0
      ? req.content
      : (req.user ?? "");
  const messages: Array<{ role: "user" | "assistant"; content: string | AnthropicContentBlock[] }> = [
    { role: "user", content: userContent },
  ];
  if (req.assistantPrefill) {
    messages.push({ role: "assistant", content: req.assistantPrefill });
  }

  const body = {
    model,
    system: req.system,
    messages,
    max_tokens: req.maxTokens ?? 4096,
    temperature: req.temperature ?? 0.2,
  };

  let res: Response;
  try {
    res = await fetch(ANTHROPIC_API_URL, {
      method: "POST",
      headers: {
        "content-type":     "application/json",
        "x-api-key":        apiKey,
        "anthropic-version": ANTHROPIC_VERSION,
      },
      body: JSON.stringify(body),
    });
  } catch (e) {
    return { ok: false, error: { kind: "network_error",
      message: e instanceof Error ? e.message : String(e) } };
  }

  if (!res.ok) {
    let detail: unknown = null;
    try { detail = await res.json(); } catch { detail = await res.text().catch(() => null); }
    return { ok: false, error: { kind: "http_error", status: res.status,
      message: `Anthropic API returned ${res.status}.`, detail } };
  }

  let parsed: any;
  try {
    parsed = await res.json();
  } catch (e) {
    return { ok: false, error: { kind: "parse_error",
      message: "Anthropic response was not valid JSON.", detail: e } };
  }

  // The Messages API returns { content: [{ type: "text", text: "..." }, ...] }
  const content: Array<{ type: string; text?: string }> = parsed.content ?? [];
  const text = content
    .filter(c => c.type === "text")
    .map(c => c.text ?? "")
    .join("");

  return {
    ok: true,
    response: {
      text,
      usage: {
        inputTokens:  parsed.usage?.input_tokens  ?? 0,
        outputTokens: parsed.usage?.output_tokens ?? 0,
      },
      model: parsed.model ?? model,
      stopReason: parsed.stop_reason ?? "unknown",
      raw: parsed,
    },
  };
}

/**
 * Extract a JSON object from a Claude response. Claude often wraps JSON in
 * triple-backtick fences or prefaces it with prose. This is a forgiving
 * parser that finds the first balanced `{...}` block.
 */
export function extractJsonObject(text: string): unknown | null {
  // Try direct parse first
  try { return JSON.parse(text); } catch {}

  // Look for ```json ... ``` fence
  const fenceMatch = text.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
  if (fenceMatch) {
    try { return JSON.parse(fenceMatch[1]); } catch {}
  }

  // Find the first balanced JSON object
  const start = text.indexOf("{");
  if (start === -1) return null;
  let depth = 0;
  for (let i = start; i < text.length; i++) {
    const c = text[i];
    if (c === "{") depth++;
    else if (c === "}") {
      depth--;
      if (depth === 0) {
        const slice = text.slice(start, i + 1);
        try { return JSON.parse(slice); } catch { return null; }
      }
    }
  }
  return null;
}

/** Are live calls enabled in this environment? */
export function liveCallsEnabled(): boolean {
  if (!process.env.ANTHROPIC_API_KEY) return false;
  const override = process.env.TOROAI_NPE_STRATEGY;
  if (override === "deterministic_mock") return false;
  if (override === "live_anthropic_api") return true;
  // "auto" / unset → key presence decides
  return true;
}
