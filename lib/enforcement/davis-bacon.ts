// Davis-Bacon prevailing wage enforcement — TDD §5.5.
//
// Applies whenever the project's federalAgency is set (VA, DOD, FAA, GSA,
// USACE, DOE) or when davisBaconApplies is forced true. Compares every
// Call-1 labor task's proposedRateUsdHr against the prevailing wage table
// (base + fringe) for the classification + jurisdiction. Any rate below
// prevailing is corrected upward; rates at or above prevailing are left
// alone. Total dollar correction is computed across the labor SOV.
//
// This is the inventive-concept module the TDD names by reference in
// Claim 1(d): "a Davis-Bacon prevailing wage enforcement module configured
// to validate and correct labor cost outputs for federal, VA, and DoD
// projects."

import type { NpeCall1Output, DavisBaconResult, DavisBaconViolation } from "./types";
import type { Project } from "@/lib/projects/types";
import { HARRIS_COUNTY_TX_WAGES, prevailingRateFor } from "./davis-bacon-wages";

export function enforceDavisBacon(
  call1: NpeCall1Output,
  project: Project,
): DavisBaconResult {
  const exhibit = project.exhibit;
  const federalAgency = exhibit?.federalAgency;
  const applies = !!(federalAgency || exhibit?.davisBaconApplies);

  // Original labor cost (before any correction).
  const originalCents = call1.laborTasks.reduce(
    (s, t) => s + Math.round(t.hours * t.proposedRateUsdHr * 100),
    0,
  );

  if (!applies) {
    return {
      applies: false,
      reason: "Davis-Bacon only applies to federal-agency projects or when explicitly flagged.",
      jurisdiction: project.city + ", " + project.state,
      wageTable: [],
      violations: [],
      totalCorrectionCents: 0,
      originalLaborCostCents: originalCents,
      correctedLaborCostCents: originalCents,
    };
  }

  const jurisdiction = `${project.city}, ${project.state}`;
  // For now we only ship one wage table. Future: select by jurisdiction.
  const table = HARRIS_COUNTY_TX_WAGES;

  const violations: DavisBaconViolation[] = [];
  for (const task of call1.laborTasks) {
    const wage = prevailingRateFor(task.classification, table);
    if (!wage) continue;                            // classification not in table — skip
    const prevailing = wage.baseRateUsdHr + wage.fringeUsdHr;
    if (task.proposedRateUsdHr >= prevailing) continue;

    const delta = prevailing - task.proposedRateUsdHr;
    violations.push({
      taskId: task.id,
      taskDescription: task.description,
      classification: task.classification,
      proposedRateUsdHr: task.proposedRateUsdHr,
      prevailingRateUsdHr: prevailing,
      deltaUsdHr: delta,
      correctionCents: Math.round(task.hours * delta * 100),
      wageDecisionId: wage.wageDecisionId,
    });
  }

  const correctionCents = violations.reduce((s, v) => s + v.correctionCents, 0);

  return {
    applies: true,
    reason: federalAgency
      ? `Federal agency project (${federalAgency}) — Davis-Bacon prevailing wage applies under 40 USC §3142.`
      : "Davis-Bacon explicitly flagged on this project.",
    jurisdiction,
    wageTable: table,
    violations,
    totalCorrectionCents: correctionCents,
    originalLaborCostCents: originalCents,
    correctedLaborCostCents: originalCents + correctionCents,
  };
}
