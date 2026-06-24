// Deterministic NPE input fixtures for the DeBakey VAMC project (TDD §7).
// These represent what Layer 2 (OCR + CAD extraction) and Layer 3 (NLP
// entity classification) would produce as input to the two-call reasoning
// architecture. Stable values so the patent demo is reproducible.

import type { EntityDict } from "./types";

export const DEBAKEY_FULL_TEXT = `
MICHAEL E. DEBAKEY VA MEDICAL CENTER — BUILDING B-100 → B-108 OSP FIBER
INSTALLATION · PROJECT NUMBER VAMC-2026-001 · 2002 HOLCOMBE BLVD, HOUSTON, TX 77030

SCOPE OF WORK. Provide and install one (1) 12-strand single-mode (SM OS2)
armored OSP fiber optic cable from Building B-100, 6th Floor IT Closet to
Building B-108 IT Closet, total approximate length 2,300 LF. All
terminations LC/UPC. Provide 12-port splice trays at each end. Install in
1.25" plenum-rated innerduct through existing service tunnel.

CABLE COUNT. 12-strand SM OS2 fiber, total 2300 LF, plus 24 ea LC/UPC fiber
pigtails for splice tray terminations. Provide 2 ea 24-port LC duplex patch
panels in MDF and IDF locations.

CODE REFERENCES. NEC Article 770 (Optical Fiber Cables), NEC Article 800
(Communications Circuits), TIA-568.2-D (Balanced Twisted-Pair Telecom
Cabling), TIA-758-B (Customer-Owned Outside Plant Telecommunications
Infrastructure), BICSI TDMM 15 (Telecommunications Distribution Methods
Manual), UFC 3-580-01 (Telecommunications Building Cabling Systems Planning
and Design).

JURISDICTION. City of Houston, Harris County, Texas. AHJ contact: Houston
Permit Office. Project is federally owned (U.S. Department of Veterans
Affairs); Davis-Bacon prevailing wage applies per 40 USC §3142.

PERMIT KEYWORDS. ROW encroachment permit (Holcombe Blvd crossing), excavation
permit, directional bore permit (under service road), aerial pole attachment
not applicable. Confined space entry required for utility tunnel
penetrations.

EQUIPMENT REFERENCES. MDF (B-100 6F), IDF-A (B-108 IT Closet), handhole
HH-A1, handhole HH-A2, manhole MH-1. Two (2) splice closures, 12-strand,
LC/UPC connectors.

SPLICE REFERENCES. Fusion splicing required at both terminations. OTDR
bidirectional testing per TIA-568. Loss budget calculation per IEEE 802.3
1000BASE-LX limits.

POWER REFERENCES. UPS capacity at MDF: 4 kVA. PDU at IDF-A: 1.5 kVA. Telecom
grounding bus bar (TGB) at both ends per TIA-607.

DISTANCE REFERENCES. 2,300 LF total cable run. Building separation
approximately 280 m. Service tunnel: 220 m. Vertical riser at B-100: 18 ft
(6 floors @ 3 ft per floor).
`.trim();

/** Telecom-domain entity dictionary — what Layer 3 (regex + spaCy) emits. */
export const DEBAKEY_ENTITY_DICT: EntityDict = {
  fiber_type: [
    { category: "fiber_type", text: "SM OS2 armored",         confidence: 0.98, source: "scope §1" },
    { category: "fiber_type", text: "12-strand single-mode",  confidence: 0.96, source: "scope §1" },
  ],
  conduit_ref: [
    { category: "conduit_ref", text: '1.25" plenum innerduct', confidence: 0.94, source: "scope §1" },
  ],
  cable_count: [
    { category: "cable_count", text: "12-strand",  confidence: 0.99 },
    { category: "cable_count", text: "24-port LC", confidence: 0.95 },
  ],
  distance_ref: [
    { category: "distance_ref", text: "2,300 LF total run", confidence: 0.99 },
    { category: "distance_ref", text: "280 m building separation", confidence: 0.92 },
    { category: "distance_ref", text: "220 m service tunnel", confidence: 0.93 },
    { category: "distance_ref", text: "18 ft vertical riser", confidence: 0.91 },
  ],
  code_reference: [
    { category: "code_reference", text: "NEC Article 770",   confidence: 0.99 },
    { category: "code_reference", text: "NEC Article 800",   confidence: 0.99 },
    { category: "code_reference", text: "TIA-568.2-D",       confidence: 0.99 },
    { category: "code_reference", text: "TIA-758-B",         confidence: 0.97 },
    { category: "code_reference", text: "BICSI TDMM 15",     confidence: 0.98 },
    { category: "code_reference", text: "UFC 3-580-01",      confidence: 0.96 },
  ],
  jurisdiction: [
    { category: "jurisdiction", text: "City of Houston",                  confidence: 0.99 },
    { category: "jurisdiction", text: "Harris County, Texas",             confidence: 0.99 },
    { category: "jurisdiction", text: "U.S. Department of Veterans Affairs (Federal)", confidence: 0.98 },
  ],
  permit_keywords: [
    { category: "permit_keywords", text: "ROW encroachment permit",  confidence: 0.96 },
    { category: "permit_keywords", text: "excavation permit",        confidence: 0.97 },
    { category: "permit_keywords", text: "directional bore permit",  confidence: 0.95 },
    { category: "permit_keywords", text: "confined space entry",     confidence: 0.97 },
    { category: "permit_keywords", text: "Davis-Bacon",              confidence: 0.99 },
  ],
  equipment_ref: [
    { category: "equipment_ref", text: "MDF (B-100 6F)",    confidence: 0.98 },
    { category: "equipment_ref", text: "IDF-A (B-108)",     confidence: 0.98 },
    { category: "equipment_ref", text: "handhole HH-A1",    confidence: 0.92 },
    { category: "equipment_ref", text: "handhole HH-A2",    confidence: 0.92 },
    { category: "equipment_ref", text: "manhole MH-1",      confidence: 0.93 },
    { category: "equipment_ref", text: "splice closures × 2", confidence: 0.94 },
  ],
  splice_ref: [
    { category: "splice_ref", text: "fusion splicing both terminations", confidence: 0.97 },
    { category: "splice_ref", text: "OTDR bidirectional testing",        confidence: 0.96 },
    { category: "splice_ref", text: "loss budget per IEEE 802.3 1000BASE-LX", confidence: 0.93 },
  ],
  power_ref: [
    { category: "power_ref", text: "UPS 4 kVA at MDF",         confidence: 0.94 },
    { category: "power_ref", text: "PDU 1.5 kVA at IDF-A",     confidence: 0.93 },
    { category: "power_ref", text: "TGB per TIA-607",          confidence: 0.96 },
  ],
};
