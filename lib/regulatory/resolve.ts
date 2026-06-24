// Regulatory Output Engine — main resolver.
//
// Implements the six steps from Claim 3 (TDD §8.3):
//   1. Receive project site location.
//   2. Resolve city/county/state/federal jurisdictions + DOT variant.
//   3. Classify required permit types from the taxonomy.
//   4. Map each permit to its authority + contact info.
//   5. Generate the Regulatory Readiness Report.
//   6. Integrate permit timelines as CPM predecessors (this step is realised in
//      lib/npe/mock-call2.ts where each permit trigger becomes an A09xx
//      predecessor activity).

import type { Project } from "@/lib/projects/types";
import type { PermitType } from "@/lib/enforcement/types";
import { call1OutputFor } from "@/lib/enforcement/fixtures";
import { enforcePermitTriggers } from "@/lib/enforcement/permit-triggers";
import type {
  JurisdictionStack, PermitRequirement, EnvironmentalFlag,
  RegulatoryReadinessReport, EnvironmentalFlagKind,
} from "./types";
import {
  STATE_DOT_BY_CODE, FEDERAL_JURISDICTION,
  resolveCityCounty, resolveState,
  permitDefinitionFor, resolveAuthority, authorityFor,
} from "./data";

/** Step 2 — resolve full jurisdictional stack from project address. */
export function resolveJurisdictionStack(project: Project): JurisdictionStack {
  const { city, county } = resolveCityCounty(project.city, project.state);
  const state = resolveState(project.state);
  const dot = STATE_DOT_BY_CODE[project.state] ?? {
    stateCode: project.state, acronym: project.state + "DOT",
    name: project.state + " Department of Transportation",
  };
  return { city, county, state, federal: FEDERAL_JURISDICTION, dot };
}

/** Step 3 — classify required permit types for this project. */
export function classifyRequiredPermits(project: Project): PermitType[] {
  // We re-use the enforcement permit-trigger module's predicate library:
  // run it against the project's Call-1 permit candidates (the same input
  // the enforcement module sees) to get a deterministic typed list.
  const call1 = call1OutputFor(project.id);
  if (!call1) return [];
  const triggers = enforcePermitTriggers(call1, project);
  // De-duplicate by permit type.
  const seen = new Set<PermitType>();
  const out: PermitType[] = [];
  for (const t of triggers.triggers) {
    if (!seen.has(t.type)) { seen.add(t.type); out.push(t.type); }
  }
  return out;
}

/** Steps 3 + 4 — build permit requirements with authority + lead times. */
export function buildPermitRequirements(project: Project): PermitRequirement[] {
  const types = classifyRequiredPermits(project);
  const reqs: PermitRequirement[] = [];
  for (const type of types) {
    const def = permitDefinitionFor(type);
    if (!def) continue;
    reqs.push({
      type,
      definition: def,
      authority: resolveAuthority(type, project.state, project.city),
      leadTimeDays: def.leadTimeDays,
      estimatedFeeCents: def.estimatedFeeCents,
    });
  }
  return reqs;
}

/** Step 5 — generate environmental compliance flags. */
export function generateEnvironmentalFlags(project: Project): EnvironmentalFlag[] {
  const out: EnvironmentalFlag[] = [];
  const exhibit = project.exhibit;
  const permitFlags = exhibit?.permitFlags ?? [];

  function flag(kind: EnvironmentalFlagKind, rationale: string, blocks: boolean, authKey?: string) {
    out.push({
      kind, rationale, blocksConstruction: blocks,
      authority: authKey ? authorityFor(authKey) : undefined,
    });
  }

  // Federal agency project → VA federal + Davis-Bacon
  if (exhibit?.federalAgency) {
    flag("va_federal",
      `Project owned by ${exhibit.federalAgency}. Federal pre-construction approval required.`,
      true, "us-va-federal");
  }
  if (exhibit?.davisBaconApplies) {
    flag("davis_bacon",
      "Federal contract > $2,000 — Davis-Bacon prevailing wage applies under 40 USC §3142.",
      false, "us-davis-bacon");
  }

  // Confined space — flagged on the project or detected from permit flags
  if (permitFlags.some(f => /confined space/i.test(f))) {
    flag("confined_space",
      "Project scope includes work in utility tunnels and/or manholes requiring OSHA 1910.146 plan.",
      false, "us-confined-space");
  }

  // NEPA — fires when project is federal AND outside an existing facility envelope.
  // For the DeBakey demo the scope is contained within existing buildings, so we
  // do not flag NEPA. Predicate left intact for future projects.
  if (exhibit?.federalAgency && /new construction|greenfield|ground[- ]?up/i.test(project.buildingType)) {
    flag("nepa_review",
      "Federal greenfield project — NEPA environmental review required per 42 USC §4321.",
      true);
  }

  // Asbestos — fires on renovations of buildings older than 1980.
  // Without a build-year field on Project we leave this commented out for now.
  // if (project.buildingType === "renovation" && project.builtYear && project.builtYear < 1980) {
  //   flag("asbestos_screening", "Pre-1980 renovation — asbestos containing material screening required.", false);
  // }

  return out;
}

/** Build the executive-summary string that opens the Readiness Report. */
function buildExecutiveSummary(
  project: Project, reqs: PermitRequirement[], flags: EnvironmentalFlag[],
  stack: JurisdictionStack,
): string {
  const longestLead = reqs.length === 0 ? 0 : Math.max(...reqs.map(r => r.leadTimeDays));
  const blockingFlags = flags.filter(f => f.blocksConstruction);
  const summary = [
    `This Regulatory Readiness Report identifies ${reqs.length} required permit${reqs.length === 1 ? "" : "s"} and ${flags.length} environmental flag${flags.length === 1 ? "" : "s"} for the ${project.name} project at ${project.addressLine1}, ${project.city}, ${project.state} ${project.zip}.`,
    `Jurisdiction stack: ${stack.city.name} → ${stack.county.name} → ${stack.state.name} → ${stack.federal.name}. DOT variant: ${stack.dot.acronym}.`,
    longestLead > 0
      ? `Longest permit lead time on the critical path is ${longestLead} calendar days. The Neural Parsal Engine Call 2 (CPM Schedule) treats this as a predecessor constraint to the Mobilization activity.`
      : "No permit lead times affect the critical path.",
    blockingFlags.length > 0
      ? `${blockingFlags.length} environmental flag${blockingFlags.length === 1 ? "" : "s"} block construction start until cleared: ${blockingFlags.map(f => f.kind.replace(/_/g, " ")).join(", ")}.`
      : "No construction-blocking environmental flags identified.",
  ].join(" ");
  return summary;
}

/** Steps 1-5 combined — produce the full Readiness Report for a project. */
export function resolveRegulatoryReadiness(project: Project): RegulatoryReadinessReport {
  const stack = resolveJurisdictionStack(project);
  const permitRequirements = buildPermitRequirements(project);
  const environmentalFlags = generateEnvironmentalFlags(project);
  const longestPermitLeadDays = permitRequirements.length === 0 ? 0
    : Math.max(...permitRequirements.map(r => r.leadTimeDays));
  const totalEstimatedFeesCents = permitRequirements.reduce((s, r) => s + r.estimatedFeeCents, 0);
  return {
    project: {
      id: project.id, number: project.number, name: project.name,
      addressLine1: project.addressLine1,
      city: project.city, state: project.state, zip: project.zip,
    },
    generatedAt: new Date().toISOString(),
    jurisdictionStack: stack,
    permitRequirements,
    environmentalFlags,
    longestPermitLeadDays,
    totalEstimatedFeesCents,
    executiveSummary: buildExecutiveSummary(project, permitRequirements, environmentalFlags, stack),
  };
}
