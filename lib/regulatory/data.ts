// Static data tables for the Regulatory Output Engine.
//
// These mappings are illustrative for the patent-defending demo — the
// production system would source them from a maintained registry (e.g.,
// the USDOT NHTSA / FMCSA contact directory, state DOT portals, local
// permit-office GIS). The taxonomic *structure* and the resolver logic
// are what's patent-bearing per TDD §6.4; the table contents themselves
// are public record.

import type {
  Jurisdiction, StateDot, Authority, PermitDefinition,
} from "./types";

// ── DOT variant lookup ──────────────────────────────────────────────────

export const STATE_DOT_BY_CODE: Record<string, StateDot> = {
  TX: { stateCode: "TX", acronym: "TxDOT", name: "Texas Department of Transportation",      contactPortal: "https://www.txdot.gov/business/permits.html" },
  FL: { stateCode: "FL", acronym: "FDOT",  name: "Florida Department of Transportation",    contactPortal: "https://www.fdot.gov/permits" },
  NC: { stateCode: "NC", acronym: "NCDOT", name: "North Carolina Department of Transportation", contactPortal: "https://www.ncdot.gov/business/permits" },
  CA: { stateCode: "CA", acronym: "Caltrans", name: "California Department of Transportation", contactPortal: "https://dot.ca.gov/programs/traffic-operations/ep" },
  GA: { stateCode: "GA", acronym: "GDOT",  name: "Georgia Department of Transportation",    contactPortal: "https://www.dot.ga.gov/PartnerSmart/permits" },
  NY: { stateCode: "NY", acronym: "NYSDOT", name: "New York State Department of Transportation", contactPortal: "https://www.dot.ny.gov/permits" },
};

// ── Federal jurisdictions ───────────────────────────────────────────────

export const FEDERAL_JURISDICTION: Jurisdiction = {
  level: "federal",
  name: "United States Federal Government",
  stateCode: "US",
};

// ── City + county lookups ───────────────────────────────────────────────
// Seeded only for the DeBakey demo location (Houston, TX). Additional rows
// land as additional projects come online.

interface CityRow {
  city: string;
  stateCode: string;
  county: string;
  zips: string[];
}

const CITY_TABLE: CityRow[] = [
  { city: "Houston",  stateCode: "TX", county: "Harris County",   zips: ["77030", "77002", "77004", "77006", "77019", "77024", "77027"] },
  { city: "Dallas",   stateCode: "TX", county: "Dallas County",   zips: ["75201", "75202", "75204"] },
  { city: "Pearland", stateCode: "TX", county: "Brazoria County", zips: ["77584", "77581"] },
];

export function resolveCityCounty(city: string, stateCode: string): { city: Jurisdiction; county: Jurisdiction } {
  const row = CITY_TABLE.find(r => r.city.toLowerCase() === city.toLowerCase() && r.stateCode === stateCode);
  if (row) {
    return {
      city:   { level: "city",   name: "City of " + row.city, stateCode: row.stateCode, zips: row.zips },
      county: { level: "county", name: row.county,             stateCode: row.stateCode },
    };
  }
  // Fallback for unseeded jurisdictions.
  return {
    city:   { level: "city",   name: "City of " + city,            stateCode },
    county: { level: "county", name: "[county not yet resolved]",  stateCode },
  };
}

export function resolveState(stateCode: string): Jurisdiction {
  const STATE_NAMES: Record<string, string> = {
    TX: "Texas", FL: "Florida", NC: "North Carolina", CA: "California",
    GA: "Georgia", NY: "New York",
  };
  return { level: "state", name: "State of " + (STATE_NAMES[stateCode] ?? stateCode), stateCode };
}

// ── AHJ contact database ────────────────────────────────────────────────

export interface AuthorityRow {
  /** Match key — combination of city/state/level so we can resolve. */
  key: string;
  authority: Authority;
}

const AHJ_TABLE: AuthorityRow[] = [
  // Houston / Harris County / Texas
  { key: "houston-tx-row",
    authority: {
      name: "Houston Permitting Center", unit: "Public Works — ROW Section",
      contactPortal: "https://www.houstonpermittingcenter.org",
      contactPhone: "(832) 394-9000", level: "city",
    },
  },
  { key: "houston-tx-excavation",
    authority: {
      name: "Houston Permitting Center", unit: "Public Works — Excavation",
      contactPortal: "https://www.houstonpermittingcenter.org/get-permit/excavation",
      level: "city",
    },
  },
  { key: "houston-tx-building",
    authority: {
      name: "Houston Permitting Center", unit: "Building Code Enforcement",
      contactPortal: "https://www.houstonpermittingcenter.org/get-permit/building",
      level: "city",
    },
  },
  { key: "houston-tx-pole",
    authority: {
      name: "City of Houston — Pole Attachment Coordinator",
      contactPortal: "https://www.houstonpublicworks.org",
      level: "city",
    },
  },
  { key: "tx-directional-bore",
    authority: {
      name: "Texas Department of Transportation",
      unit: "Maintenance Division — Utility Permits",
      contactPortal: "https://www.txdot.gov/business/permits/utility-permits.html",
      level: "state",
    },
  },
  { key: "tx-low-voltage",
    authority: {
      name: "Texas Department of Licensing and Regulation",
      unit: "Electricians Program",
      contactPortal: "https://www.tdlr.texas.gov/electricians",
      level: "state",
    },
  },
  { key: "us-confined-space",
    authority: {
      name: "Occupational Safety and Health Administration",
      unit: "Region VI — Houston Area Office",
      contactPortal: "https://www.osha.gov/contactus/byoffice/houston-south",
      contactPhone: "(281) 286-0583", level: "federal",
    },
  },
  { key: "us-va-federal",
    authority: {
      name: "U.S. Department of Veterans Affairs",
      unit: "Office of Construction and Facilities Management",
      contactPortal: "https://www.cfm.va.gov",
      level: "federal",
    },
  },
  { key: "us-davis-bacon",
    authority: {
      name: "U.S. Department of Labor",
      unit: "Wage and Hour Division — Houston District",
      contactPortal: "https://www.dol.gov/agencies/whd",
      contactPhone: "(713) 339-5500", level: "federal",
    },
  },
];

/** Look up the most-specific authority for a given trigger key. */
export function authorityFor(key: string): Authority | undefined {
  const row = AHJ_TABLE.find(r => r.key === key);
  return row?.authority;
}

// ── Permit-type taxonomy (Claim 3 step 3) ───────────────────────────────

export const PERMIT_DEFINITIONS: PermitDefinition[] = [
  {
    type: "row_encroachment", label: "Right-of-Way Encroachment",
    description: "Required when any portion of the work — overhead or underground — crosses public right-of-way. Issued by the AHJ for the highest-class roadway crossed.",
    leadTimeDays: 30, estimatedFeeCents: 35000,
    applicabilityRationale: "Project crosses or occupies public right-of-way.",
  },
  {
    type: "excavation_trench", label: "Excavation / Trench Permit",
    description: "Required for any open-cut trench within the public ROW or city-controlled property. Includes traffic-control plan submittal and 811 utility location verification.",
    leadTimeDays: 14, estimatedFeeCents: 25000,
    applicabilityRationale: "Open trench portion of OSP fiber installation.",
  },
  {
    type: "directional_bore", label: "Directional Bore Permit",
    description: "Required for trenchless installation via horizontal directional drilling (HDD). Includes bore plan submittal, mud-disposal plan, and depth-of-cover verification.",
    leadTimeDays: 21, estimatedFeeCents: 50000,
    applicabilityRationale: "HDD crossing under roadway or hard surface.",
  },
  {
    type: "aerial_attachment", label: "Aerial Pole Attachment",
    description: "Required when fiber will attach to existing utility poles. Joint-use agreement with pole owner + clearance survey.",
    leadTimeDays: 45, estimatedFeeCents: 75000,
    applicabilityRationale: "Aerial portion of installation, if any, on existing pole infrastructure.",
  },
  {
    type: "building", label: "Building Permit",
    description: "Required when work modifies the building envelope or includes structural penetrations, new equipment supports, or new electrical work.",
    leadTimeDays: 21, estimatedFeeCents: 40000,
    applicabilityRationale: "Wall penetrations, cable tray supports, equipment racks tied to building structure.",
  },
  {
    type: "low_voltage_contractor", label: "Low-Voltage Contractor License Verification",
    description: "State-level verification that the installing contractor holds an active low-voltage / limited-energy electrician license.",
    leadTimeDays: 7, estimatedFeeCents: 0,
    applicabilityRationale: "Required for all low-voltage installation work in Texas.",
  },
  {
    type: "confined_space", label: "Confined Space Entry Plan",
    description: "OSHA 1910.146 compliance plan for any work inside utility tunnels, manholes, vaults, or other permit-required confined spaces. Includes atmospheric monitoring and rescue plan.",
    leadTimeDays: 3, estimatedFeeCents: 0,
    applicabilityRationale: "Service tunnel entries and manhole penetrations.",
  },
  {
    type: "federal_project", label: "Federal Project Approval",
    description: "Required for projects on federally-owned property — design review, security clearance verification, badging, and contractor pre-qualification with the federal agency owner.",
    leadTimeDays: 30, estimatedFeeCents: 0,
    applicabilityRationale: "Project located on federally-owned VA Medical Center property.",
  },
  {
    type: "davis_bacon", label: "Davis-Bacon Wage Determination",
    description: "DOL Wage and Hour Division verification of the active SCA wage decision for the project jurisdiction and contract type. Required on all federal projects > $2,000 in contract value.",
    leadTimeDays: 7, estimatedFeeCents: 0,
    applicabilityRationale: "Federal contract > $2,000 — Davis-Bacon applies under 40 USC §3142.",
  },
];

export function permitDefinitionFor(type: import("@/lib/enforcement/types").PermitType): PermitDefinition | undefined {
  return PERMIT_DEFINITIONS.find(p => p.type === type);
}

// ── Authority resolution for each permit type ───────────────────────────

/** Returns the canonical authority for a permit type in a given state. */
export function resolveAuthority(
  permitType: import("@/lib/enforcement/types").PermitType,
  stateCode: string,
  city: string,
): Authority {
  const cityKey = city.toLowerCase() + "-" + stateCode.toLowerCase();
  switch (permitType) {
    case "row_encroachment":       return authorityFor(`${cityKey}-row`)         ?? GENERIC_CITY(city);
    case "excavation_trench":      return authorityFor(`${cityKey}-excavation`)  ?? GENERIC_CITY(city);
    case "building":               return authorityFor(`${cityKey}-building`)    ?? GENERIC_CITY(city);
    case "aerial_attachment":      return authorityFor(`${cityKey}-pole`)        ?? GENERIC_CITY(city);
    case "directional_bore":       return authorityFor(`${stateCode.toLowerCase()}-directional-bore`) ?? GENERIC_STATE(stateCode);
    case "low_voltage_contractor": return authorityFor(`${stateCode.toLowerCase()}-low-voltage`)      ?? GENERIC_STATE(stateCode);
    case "confined_space":         return authorityFor("us-confined-space")   ?? GENERIC_FED;
    case "federal_project":        return authorityFor("us-va-federal")       ?? GENERIC_FED;
    case "davis_bacon":            return authorityFor("us-davis-bacon")      ?? GENERIC_FED;
  }
}

const GENERIC_CITY  = (city: string): Authority => ({ name: city + " Permit Office", level: "city" });
const GENERIC_STATE = (state: string): Authority => ({ name: state + " State Permit Office", level: "state" });
const GENERIC_FED:    Authority      = { name: "Federal Agency",                 level: "federal" };
