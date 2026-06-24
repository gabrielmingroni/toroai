// Production rate validation — TDD §5.5 + §6.5.
//
// Hard-coded envelope per TDD §6.5: 3,500–5,280 LF/day for a five-person
// OSP pull crew (1 Supervisor + 2 Journeymen + 2 Fiber Techs). Dependent
// claim 5 (TDD §8.4) names the envelope explicitly:
//   "the production rate validation step enforces an OSP fiber pull rate
//    envelope of 3,500 to 5,280 linear feet per day for a five-person crew
//    comprising one supervisor, two journeymen, and two fiber technicians."
//
// Tasks with a proposedLfPerDay outside the envelope are clamped — at the
// upper bound for over-aggressive estimates, at the lower bound for
// suspiciously low ones (typically AI hallucinations).

import type { NpeCall1Output, ProductionRateResult, ProductionRateViolation } from "./types";

const ENVELOPE = { minLfPerDay: 3500 as const, maxLfPerDay: 5280 as const };

export function enforceProductionRate(call1: NpeCall1Output): ProductionRateResult {
  const violations: ProductionRateViolation[] = [];

  for (const task of call1.laborTasks) {
    const lfd = task.proposedLfPerDay;
    if (!lfd) continue;                       // Not a pulling task — skip
    if (lfd >= ENVELOPE.minLfPerDay && lfd <= ENVELOPE.maxLfPerDay) continue;

    const direction = lfd > ENVELOPE.maxLfPerDay ? "above_envelope" : "below_envelope";
    const clamped = direction === "above_envelope" ? ENVELOPE.maxLfPerDay : ENVELOPE.minLfPerDay;
    violations.push({
      taskId: task.id,
      taskDescription: task.description,
      crewSize: task.crewSize,
      proposedLfPerDay: lfd,
      clampedLfPerDay: clamped,
      envelope: ENVELOPE,
      direction,
    });
  }

  return {
    envelope: ENVELOPE,
    crewComposition: "1 Supervisor + 2 Journeymen + 2 Fiber Techs",
    violations,
  };
}
