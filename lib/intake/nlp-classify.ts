// Layer 3 — telecom-domain Named Entity Recognition.
//
// Implements TDD §5.4's "10-category regex predicate library." Walks the
// full extracted text from Layer 2 and emits a typed entity dictionary
// (EntityDict) the NPE Two-Call Reasoning layer consumes. This is the
// patent-bearing component that turns raw OCR'd text into a structured
// representation Claude can reason about.
//
// Production swaps this for the Python NPE backend's spaCy + custom NER,
// but the regex predicate set is what TDD §5.4 names explicitly.

import type {
  EntityDict, TelecomEntity, TelecomEntityCategory,
} from "@/lib/npe/types";

// ── Pattern library — one entry per category ─────────────────────────────

interface Pattern {
  /** Regex pattern (case-insensitive, global). */
  rx: RegExp;
  /** Base confidence when this pattern matches. */
  confidence: number;
  /** Optional normalizer — returns the canonical form of the matched text. */
  normalize?: (match: string) => string;
}

const PATTERNS: Record<TelecomEntityCategory, Pattern[]> = {
  fiber_type: [
    { rx: /\b(SM\s*OS2|single[-\s]*mode\s+OS2)\b/gi,              confidence: 0.99, normalize: () => "SM OS2" },
    { rx: /\b(SM\s*OS1|single[-\s]*mode\s+OS1)\b/gi,              confidence: 0.97, normalize: () => "SM OS1" },
    { rx: /\b(MM\s*OM[34]|multi[-\s]*mode\s+OM[34])\b/gi,         confidence: 0.97 },
    { rx: /\b(OM[3-5])\s*(?:fiber|cable)?/gi,                     confidence: 0.92 },
    { rx: /\b(armored|jacketed|riser[-\s]*rated|plenum[-\s]*rated|LSZH|direct[-\s]*burial)\b/gi,
                                                                  confidence: 0.85 },
    { rx: /\b(loose[-\s]*tube|tight[-\s]*buffered|ribbon)\s*(?:fiber|cable)?\b/gi,
                                                                  confidence: 0.88 },
  ],
  conduit_ref: [
    { rx: /\b(EMT|IMC|RMC|RNC)\s*conduit\b/gi,                    confidence: 0.97 },
    { rx: /\b(EMT|IMC|RMC|RNC)\b/g,                               confidence: 0.85 },
    { rx: /\b\d+(?:[-./]\d+)?[\s"]*(?:in(?:ch)?\.?)?\s*(?:PVC|HDPE|innerduct|interduct|conduit)\b/gi,
                                                                  confidence: 0.92 },
    { rx: /\b(Duraline\s+microduct|Maxcell(?:\s+fabric)?\s+innerduct?)\b/gi,
                                                                  confidence: 0.99 },
    { rx: /\b(?:plenum|riser)[\s-]*rated\s+innerduct\b/gi,         confidence: 0.94 },
  ],
  cable_count: [
    { rx: /\b(\d{1,3})[-\s]*strand\b/gi,                          confidence: 0.99 },
    { rx: /\b(\d{1,3})[-\s]*count\b/gi,                           confidence: 0.92 },
    { rx: /\b(\d{1,3})[-\s]*fiber\b/gi,                           confidence: 0.95 },
    { rx: /\b(\d{1,3})[Ff](?:\s+(?:fiber|cable))?\b/g,            confidence: 0.78 },
    { rx: /\b(\d{1,3})[-\s]*port(?:\s+(?:panel|patch|outlet))?\b/gi,
                                                                  confidence: 0.86 },
  ],
  distance_ref: [
    { rx: /\b\d{1,5}(?:,\d{3})*(?:\.\d+)?\s*(?:LF|linear\s+feet|feet|ft)\b/gi,
                                                                  confidence: 0.97 },
    { rx: /\b\d+(?:\.\d+)?\s*(?:m|meters?|meter)\b/g,             confidence: 0.92 },
    { rx: /\b\d+(?:\.\d+)?\s*(?:km|kilometers?)\b/gi,             confidence: 0.95 },
    { rx: /\b\d+(?:\.\d+)?\s*(?:miles?|mi\.?)\b/gi,                confidence: 0.92 },
  ],
  code_reference: [
    { rx: /\bNEC\s*Article\s*\d{3,4}\b/gi,                        confidence: 0.99 },
    { rx: /\bNEC\s*\d{3,4}(?:\.\d+)?(?:\([A-Z]\))?\b/g,           confidence: 0.95 },
    { rx: /\bTIA[-\s]*568\.?[12]?[-\s]*[A-D]?\b/gi,               confidence: 0.99 },
    { rx: /\bTIA[-\s]*758[-\s]*[A-Z]?\b/gi,                       confidence: 0.97 },
    { rx: /\bTIA[-\s]*569\b/gi,                                   confidence: 0.97 },
    { rx: /\bTIA[-\s]*607\b/gi,                                   confidence: 0.97 },
    { rx: /\bTIA[-\s]*606[-\s]*[A-C]?\b/gi,                       confidence: 0.97 },
    { rx: /\bBICSI\s*TDMM(?:\s*\d+)?\b/gi,                        confidence: 0.97 },
    { rx: /\bUFC\s*3[-\s]*580[-\s]*01\b/gi,                        confidence: 0.99 },
    { rx: /\bIEEE\s*802\.3\b/g,                                   confidence: 0.95 },
    { rx: /\bANSI\/?TIA[-\s]*\d{3,4}\b/gi,                        confidence: 0.93 },
  ],
  jurisdiction: [
    { rx: /\bCity\s+of\s+[A-Z][a-zA-Z]+(?:\s+[A-Z][a-zA-Z]+)?\b/g, confidence: 0.94 },
    { rx: /\bCounty\s+of\s+[A-Z][a-zA-Z]+(?:\s+[A-Z][a-zA-Z]+)?\b/g, confidence: 0.94 },
    { rx: /\b[A-Z][a-zA-Z]+\s+County\b/g,                         confidence: 0.93 },
    { rx: /\b(TxDOT|FDOT|NCDOT|Caltrans|GDOT|NYSDOT|PennDOT|VDOT|ARDOT)\b/g,
                                                                  confidence: 0.99 },
    { rx: /\bU\.?S\.?\s+(?:Department|Dept\.?)\s+of\s+(?:Veterans\s+Affairs|Defense|Labor|Energy|Transportation)\b/gi,
                                                                  confidence: 0.99 },
    { rx: /\b(?:VA|DoD|GSA|FAA|USACE|DOE)\s+(?:Federal|Project|Building|Facility)\b/g,
                                                                  confidence: 0.96 },
    { rx: /\b(?:Federal|State|Local|Municipal)\s+(?:project|jurisdiction)\b/gi,
                                                                  confidence: 0.85 },
  ],
  permit_keywords: [
    { rx: /\bROW\b|\bright[-\s]of[-\s]way\b/gi,                   confidence: 0.94 },
    { rx: /\bencroachment\s+permit\b/gi,                          confidence: 0.97 },
    { rx: /\bexcavation\s+permit\b/gi,                            confidence: 0.97 },
    { rx: /\btrench(?:ing)?\s+permit\b/gi,                        confidence: 0.97 },
    { rx: /\bdirectional[-\s]*bore(?:\s+permit)?\b/gi,            confidence: 0.95 },
    { rx: /\baerial\s+(?:attachment|pole)\b/gi,                   confidence: 0.94 },
    { rx: /\bbuilding\s+permit\b/gi,                              confidence: 0.96 },
    { rx: /\bAHJ\b|\bauthority\s+having\s+jurisdiction\b/gi,      confidence: 0.95 },
    { rx: /\beasement\b/gi,                                       confidence: 0.85 },
    { rx: /\bconfined\s+space(?:\s+entry)?\b/gi,                  confidence: 0.97 },
    { rx: /\bDavis[-\s]*Bacon\b/gi,                               confidence: 0.99 },
    { rx: /\bprevailing\s+wage\b/gi,                              confidence: 0.93 },
  ],
  equipment_ref: [
    { rx: /\bMDF\b/g,                                             confidence: 0.95 },
    { rx: /\bIDF(?:[-\s]*[A-Z])?\b/g,                             confidence: 0.95 },
    { rx: /\bTR(?:[-\s]*[A-Z0-9]+)?\b/g,                          confidence: 0.78 },
    { rx: /\b(?:patch|fiber)\s+panel\b/gi,                        confidence: 0.95 },
    { rx: /\bsplice\s+(?:closure|tray|enclosure)\b/gi,            confidence: 0.97 },
    { rx: /\bhandhole\b|\bmanhole\b/gi,                           confidence: 0.93 },
    { rx: /\bduct\s+bank\b/gi,                                    confidence: 0.95 },
    { rx: /\b(?:server|equipment)\s+rack\b/gi,                    confidence: 0.92 },
    { rx: /\b\d+U\s+rack\b/gi,                                    confidence: 0.94 },
    { rx: /\b(?:wireless\s+access\s+point|WAP|access\s+point)\b/gi,
                                                                  confidence: 0.92 },
  ],
  splice_ref: [
    { rx: /\bfusion\s+splic(?:e|ing)\b/gi,                        confidence: 0.99 },
    { rx: /\bmechanical\s+splic(?:e|ing)\b/gi,                    confidence: 0.95 },
    { rx: /\bOTDR\b/g,                                            confidence: 0.99 },
    { rx: /\bOLTS\b/g,                                            confidence: 0.97 },
    { rx: /\bloss\s+budget\b/gi,                                  confidence: 0.93 },
    { rx: /\b\d+(?:\.\d+)?\s*dB\b/g,                              confidence: 0.92 },
    { rx: /\battenuation\b/gi,                                    confidence: 0.85 },
    { rx: /\b(?:return\s+loss|insertion\s+loss)\b/gi,             confidence: 0.92 },
  ],
  power_ref: [
    { rx: /\bUPS\b(?:\s+\d+\s*(?:kVA|VA|W))?/g,                   confidence: 0.92 },
    { rx: /\bPDU\b/g,                                              confidence: 0.92 },
    { rx: /\bcircuit\s+breaker\b/gi,                              confidence: 0.92 },
    { rx: /\bpanel\s*board\b/gi,                                  confidence: 0.92 },
    { rx: /\b\d+\s*(?:kVA|VA|W|kW)\b/g,                           confidence: 0.92 },
    { rx: /\b\d+\s*(?:V|VAC|VDC|volt)\b/g,                        confidence: 0.85 },
    { rx: /\b\d+\s*(?:A|amp)\b/g,                                 confidence: 0.78 },
    { rx: /\bPoE(?:\+\+|\+)?\b/g,                                 confidence: 0.95 },
    { rx: /\bTGB\b|\bTMGB\b/g,                                    confidence: 0.97 },
  ],
};

// ── Classifier ──────────────────────────────────────────────────────────

/**
 * Walk full_text through the 10-category regex library and emit a typed
 * entity dictionary. De-duplicates by normalized form per category.
 */
export function classifyEntities(fullText: string): EntityDict {
  const dict = emptyEntityDict();
  if (!fullText) return dict;

  for (const cat of Object.keys(PATTERNS) as TelecomEntityCategory[]) {
    const patterns = PATTERNS[cat];
    const seen = new Map<string, TelecomEntity>();   // normalized text → entity

    for (const pattern of patterns) {
      let match: RegExpExecArray | null;
      // Reset regex state — important when reusing a regex across loops
      pattern.rx.lastIndex = 0;
      while ((match = pattern.rx.exec(fullText)) !== null) {
        const raw = match[0].trim();
        if (!raw) continue;
        const normalized = pattern.normalize ? pattern.normalize(raw) : raw;
        const key = normalized.toLowerCase();
        const existing = seen.get(key);
        const newConf = pattern.confidence;
        const sourceSnippet = excerpt(fullText, match.index, 60);
        if (existing) {
          // Boost confidence on second match — patterns reinforce each other
          existing.confidence = Math.min(0.999, Math.max(existing.confidence, newConf) + 0.02);
        } else {
          seen.set(key, {
            category: cat,
            text: normalized,
            confidence: Math.round(newConf * 100) / 100,
            source: sourceSnippet,
          });
        }
        // Defensive — non-global patterns can loop forever on zero-length match
        if (match.index === pattern.rx.lastIndex) pattern.rx.lastIndex++;
      }
    }
    dict[cat] = [...seen.values()].sort((a, b) => b.confidence - a.confidence);
  }
  return dict;
}

/** Single-pass character count + category coverage stats. */
export function classifierStats(dict: EntityDict): {
  totalEntities: number;
  byCategory: Record<TelecomEntityCategory, number>;
  averageConfidence: number;
} {
  const byCategory = {} as Record<TelecomEntityCategory, number>;
  let total = 0; let confSum = 0;
  for (const cat of Object.keys(dict) as TelecomEntityCategory[]) {
    const n = dict[cat].length;
    byCategory[cat] = n; total += n;
    for (const e of dict[cat]) confSum += e.confidence;
  }
  return {
    totalEntities: total,
    byCategory,
    averageConfidence: total === 0 ? 0 : Math.round((confSum / total) * 100) / 100,
  };
}

// ── Helpers ─────────────────────────────────────────────────────────────

function emptyEntityDict(): EntityDict {
  return {
    fiber_type: [], conduit_ref: [], cable_count: [], distance_ref: [],
    code_reference: [], jurisdiction: [], permit_keywords: [],
    equipment_ref: [], splice_ref: [], power_ref: [],
  };
}

function excerpt(text: string, idx: number, len: number): string {
  const start = Math.max(0, idx - 10);
  const end = Math.min(text.length, idx + len);
  return text.slice(start, end).replace(/\s+/g, " ").trim();
}
