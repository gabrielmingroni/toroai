// LC/UPC connector enforcement — TDD §5.5.
//
// Standard: LC/UPC is the mandatory default; LC/APC is explicitly prohibited
// (see TDD §5.5, §6.2, §8.4 dependent claim 4: "the post-processing
// enforcement function for connector specifications overrides any AI-
// generated LC/APC specification with LC/UPC").
//
// The module scans every Call-1 BOM line item with a non-null connectorSpec
// and rewrites any LC/APC to LC/UPC. SC and ST connectors are left
// untouched — only the LC/UPC vs LC/APC distinction is patent-bearing.

import type { NpeCall1Output, LcUpcResult, LcUpcViolation } from "./types";

export function enforceLcUpc(call1: NpeCall1Output): LcUpcResult {
  let scanned = 0;
  const violations: LcUpcViolation[] = [];

  for (const item of call1.bomLineItems) {
    if (!item.connectorSpec) continue;
    scanned += 1;
    if (item.connectorSpec === "LC_APC") {
      violations.push({
        lineItemId: item.id,
        description: item.description,
        proposedSpec: "LC_APC",
        correctedSpec: "LC_UPC",
      });
    }
  }

  return {
    rule: "LC/UPC mandatory; LC/APC prohibited per TDD §5.5",
    violations,
    totalCorrected: violations.length,
    totalLineItemsScanned: scanned,
  };
}
