// Post-processing enforcement orchestrator.
//
// Runs all four modules (TDD §5.5) against a Call-1 output, with the project
// context available to modules that need it (Davis-Bacon needs federalAgency
// + jurisdiction; permit triggers need AHJ).
//
// All four modules are run unconditionally; whether they apply is decided
// inside each module (e.g., Davis-Bacon short-circuits if federalAgency is
// unset). This matches the patent claim — the architecture always invokes
// the enforcement layer.

import type { NpeCall1Output, EnforcementBundle } from "./types";
import type { Project } from "@/lib/projects/types";
import { enforceDavisBacon } from "./davis-bacon";
import { enforceLcUpc } from "./lc-upc";
import { enforceProductionRate } from "./production-rate";
import { enforcePermitTriggers } from "./permit-triggers";

export function runAllEnforcement(call1: NpeCall1Output, project: Project): EnforcementBundle {
  return {
    projectId: project.id,
    ranAt: new Date().toISOString(),
    davisBacon:     enforceDavisBacon(call1, project),
    lcUpc:          enforceLcUpc(call1),
    productionRate: enforceProductionRate(call1),
    permitTriggers: enforcePermitTriggers(call1, project),
  };
}

export * from "./types";
export { call1OutputFor, DEBAKEY_CALL1_OUTPUT } from "./fixtures";
export { HARRIS_COUNTY_TX_WAGES, prevailingRateFor } from "./davis-bacon-wages";
