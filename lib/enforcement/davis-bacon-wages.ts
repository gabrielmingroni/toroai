// Davis-Bacon prevailing wage table — Harris County, TX (Houston metro)
// Wage determination ID format follows the U.S. Department of Labor SCA
// pattern: WD-{YYYY-NNNN}.
//
// These values are illustrative for the patent-defending demo. In production
// the table would be sourced live from https://sam.gov / wage determinations
// and refreshed per project. The enforcement logic that consumes the table
// is what's patent-bearing per TDD §5.5; the values themselves are public
// record from the U.S. Department of Labor.

import type { PrevailingWage } from "./types";

/** Harris County, TX — wage determination WD-2026-2741 (illustrative). */
export const HARRIS_COUNTY_TX_WAGES: PrevailingWage[] = [
  {
    classification: "Telecom Worker",
    baseRateUsdHr: 42.50, fringeUsdHr: 13.40,
    wageDecisionId: "WD-2026-2741", jurisdiction: "Harris County, TX",
  },
  {
    classification: "Electrician (Communication)",
    baseRateUsdHr: 48.20, fringeUsdHr: 15.80,
    wageDecisionId: "WD-2026-2741", jurisdiction: "Harris County, TX",
  },
  {
    classification: "Splicer Technician",
    baseRateUsdHr: 46.00, fringeUsdHr: 14.50,
    wageDecisionId: "WD-2026-2741", jurisdiction: "Harris County, TX",
  },
  {
    classification: "Fiber Technician",
    baseRateUsdHr: 41.50, fringeUsdHr: 12.90,
    wageDecisionId: "WD-2026-2741", jurisdiction: "Harris County, TX",
  },
  {
    classification: "Journeyman Electrician",
    baseRateUsdHr: 44.80, fringeUsdHr: 14.10,
    wageDecisionId: "WD-2026-2741", jurisdiction: "Harris County, TX",
  },
  {
    classification: "Supervisor",
    baseRateUsdHr: 56.00, fringeUsdHr: 18.50,
    wageDecisionId: "WD-2026-2741", jurisdiction: "Harris County, TX",
  },
  {
    classification: "Laborer",
    baseRateUsdHr: 26.50, fringeUsdHr: 9.20,
    wageDecisionId: "WD-2026-2741", jurisdiction: "Harris County, TX",
  },
];

/** Lookup helper — returns total prevailing rate (base + fringe). */
export function prevailingRateFor(
  classification: string,
  table: PrevailingWage[] = HARRIS_COUNTY_TX_WAGES,
): PrevailingWage | undefined {
  return table.find(w => w.classification.toLowerCase() === classification.toLowerCase());
}
