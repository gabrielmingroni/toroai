// Two-call architecture orchestrator — TDD §5.5.
//
// Sequences Call 1 (BOM + Labor SOV) → enforcement → Call 2 (CPM Schedule).
// Both calls always execute; the structural requirement of Claim 2 is that
// Call 2's input is Call 1's output. Enforcement runs between the two calls
// per TDD §5.5 so the CPM uses the corrected labor rates and the clamped
// production rates.
//
// Strategy selection:
//   • ANTHROPIC_API_KEY set + TOROAI_NPE_STRATEGY ≠ "deterministic_mock"
//       → live_anthropic_api (calls Claude with the real prompts)
//   • otherwise
//       → deterministic_mock (returns the seeded DeBakey fixture)
//   If a live call throws, we fall back to the mock and record the error
//   on the bundle so the UI can surface it.

import type { Project } from "@/lib/projects/types";
import type {
  Call1Input, Call1Output, Call2Input, Call2Output, TwoCallBundle,
} from "./types";
import { DEBAKEY_FULL_TEXT, DEBAKEY_ENTITY_DICT } from "./fixtures";
import { mockCall1 } from "./mock-call1";
import { mockCall2 } from "./mock-call2";
import { liveCall1 } from "./live-call1";
import { liveCall2 } from "./live-call2";
import { liveCallsEnabled } from "@/lib/anthropic/client";
import { runAllEnforcement } from "@/lib/enforcement";
import { intakeStore } from "@/lib/intake/mock-store";

export interface TwoCallBundleWithDiagnostics extends TwoCallBundle {
  /** Non-fatal warnings/errors collected during the run. */
  warnings?: string[];
  /** Informational notes (e.g., "Using uploaded PDF text"). */
  notes?: string[];
}

export async function runTwoCallArchitecture(project: Project): Promise<TwoCallBundleWithDiagnostics> {
  const t0 = Date.now();
  const warnings: string[] = [];
  const notes: string[] = [];

  // ── Resolve Layer 2 output ────────────────────────────────────────
  //
  // Priority: real extracted PDF text (uploaded by the user) overrides any
  // fixture. If neither exists, fall back to the DeBakey fixture only for
  // P1, otherwise empty. Claude can still produce useful output from an
  // empty fullText if it has the entity dictionary + project context, but
  // with much lower fidelity.
  const extractedDoc = intakeStore.getExtractedDocument(project.id);
  const seedFixture = project.id === "P1";
  const fullText = extractedDoc?.fullText
    ?? (seedFixture ? DEBAKEY_FULL_TEXT : "");
  // Priority: classified entities from uploaded PDF > DeBakey fixture > empty.
  const entityDict = extractedDoc?.entities
    ?? (seedFixture && !extractedDoc ? DEBAKEY_ENTITY_DICT : emptyEntityDict());

  const call1Input: Call1Input = {
    fullText, entityDict,
    project: {
      id: project.id, number: project.number, name: project.name,
      city: project.city, state: project.state, sector: project.sector,
      exhibit: project.exhibit,
    },
  };
  if (extractedDoc) {
    const entityCount = extractedDoc.entities
      ? Object.values(extractedDoc.entities).flat().length
      : 0;
    notes.push(
      `Using uploaded PDF text (${extractedDoc.pageCount} pages · ${extractedDoc.fullText.length.toLocaleString()} chars) ` +
      `with Layer 3 classification (${entityCount} telecom-domain entities across 10 categories).`,
    );
  } else if (seedFixture) {
    notes.push("Using DeBakey VAMC fixture (TDD §7 reduction-to-practice exhibit).");
  } else {
    notes.push("No extracted text — Claude will operate on project context only. Upload a PDF to improve fidelity.");
  }

  // ── Resolve strategy ──────────────────────────────────────────────
  const wantLive = liveCallsEnabled();
  let strategy: "deterministic_mock" | "live_anthropic_api" = wantLive ? "live_anthropic_api" : "deterministic_mock";

  // ── Call 1 ────────────────────────────────────────────────────────
  let call1Output: Call1Output;
  if (strategy === "live_anthropic_api") {
    try {
      const live = await liveCall1(call1Input);
      call1Output = live.output;
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      warnings.push(`Live Call 1 failed — fell back to mock. (${msg})`);
      strategy = "deterministic_mock";
      call1Output = mockCall1(call1Input);
    }
  } else {
    call1Output = mockCall1(call1Input);
  }

  // ── Enforcement runs between the calls ────────────────────────────
  const enforcement = runAllEnforcement(call1Output, project);

  // ── Call 2 ────────────────────────────────────────────────────────
  const call2Input: Call2Input = {
    bomLineItems: call1Output.bomLineItems,
    laborTasks:   call1Output.laborTasks,
    enforcement,
    project: {
      id: project.id, number: project.number, name: project.name,
      occupancyDate: project.occupancyDate, exhibit: project.exhibit,
    },
  };

  let call2Output: Call2Output;
  if (strategy === "live_anthropic_api") {
    try {
      const live = await liveCall2(call2Input);
      call2Output = live.output;
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      warnings.push(`Live Call 2 failed — fell back to mock for the schedule. (${msg})`);
      // Don't downgrade the strategy of the bundle as a whole — Call 1
      // succeeded live; only Call 2 fell back.
      call2Output = mockCall2(call2Input);
    }
  } else {
    call2Output = mockCall2(call2Input);
  }

  return {
    projectId: project.id,
    ranAt: new Date().toISOString(),
    call1Input, call1Output, call2Input, call2Output,
    elapsedMs: Date.now() - t0,
    strategy,
    warnings: warnings.length > 0 ? warnings : undefined,
    notes:    notes.length    > 0 ? notes    : undefined,
  };
}

function emptyEntityDict() {
  return {
    fiber_type: [], conduit_ref: [], cable_count: [], distance_ref: [],
    code_reference: [], jurisdiction: [], permit_keywords: [],
    equipment_ref: [], splice_ref: [], power_ref: [],
  };
}
