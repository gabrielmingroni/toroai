// CSI 27 specification generator.
//
// Strategy:
//   live_anthropic_api — calls Claude with the CSI27_SPEC_SYSTEM_PROMPT and
//                        parses the structured JSON response.
//   deterministic_mock — returns realistic boilerplate scoped to the project
//                        when no API key is set or the live call fails.

import type { Project } from "@/lib/projects/types";
import type { BomDocument } from "@/lib/bom/types";
import type { StandardsComplianceResult } from "@/lib/standards/types";
import type { RegulatoryReadinessReport } from "@/lib/regulatory/types";
import { callAnthropic, extractJsonObject, liveCallsEnabled } from "@/lib/anthropic/client";
import { CSI27_SPEC_SYSTEM_PROMPT } from "./prompt";
import {
  type SpecDocument, type SpecSection, type SpecPart, type SpecArticle,
  type SpecPartId, DEFAULT_SECTIONS,
} from "./types";

const VALID_PART_IDS: ReadonlySet<SpecPartId> = new Set([
  "part1_general", "part2_products", "part3_execution",
]);

export async function generateSpec(input: {
  project: Project;
  bom: BomDocument;
  compliance: StandardsComplianceResult;
  regulatory: RegulatoryReadinessReport;
}): Promise<SpecDocument> {
  const warnings: string[] = [];
  const wantLive = liveCallsEnabled();

  if (wantLive) {
    try {
      return await liveGenerate(input);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      warnings.push(`Live spec generation failed — fell back to mock. (${msg})`);
    }
  }

  const doc = mockGenerate(input);
  return { ...doc, warnings: warnings.length > 0 ? warnings : undefined };
}

// ── Live (Claude) ────────────────────────────────────────────────────────

async function liveGenerate(input: {
  project: Project; bom: BomDocument;
  compliance: StandardsComplianceResult; regulatory: RegulatoryReadinessReport;
}): Promise<SpecDocument> {
  const user = buildUserContent(input);
  const res = await callAnthropic({
    system: CSI27_SPEC_SYSTEM_PROMPT,
    user,
    maxTokens: 12000,
    temperature: 0.25,
  });
  if (!res.ok) {
    throw new Error(`Spec generation failed: ${res.error.kind} — ${res.error.message}`);
  }
  const parsed = extractJsonObject(res.response.text);
  if (!parsed || typeof parsed !== "object") {
    throw new Error("Spec generation returned non-JSON content.");
  }
  const p = parsed as { sections?: unknown };
  if (!Array.isArray(p.sections)) {
    throw new Error("Spec JSON missing `sections` array.");
  }

  const sections: SpecSection[] = [];
  for (const raw of p.sections as unknown[]) {
    const sec = coerceSection(raw);
    if (sec) sections.push(sec);
  }
  if (sections.length === 0) {
    throw new Error("Spec generation produced zero valid sections.");
  }

  return {
    projectId: input.project.id,
    generatedAt: new Date().toISOString(),
    strategy: "live_anthropic_api",
    sections,
    tokens: { input: res.response.usage.inputTokens, output: res.response.usage.outputTokens },
  };
}

function buildUserContent(input: {
  project: Project; bom: BomDocument;
  compliance: StandardsComplianceResult; regulatory: RegulatoryReadinessReport;
}): string {
  const lines: string[] = [];
  const { project, bom, compliance, regulatory } = input;

  lines.push("## PROJECT CONTEXT");
  lines.push(`- Number: ${project.number}`);
  lines.push(`- Name: ${project.name}`);
  lines.push(`- Owner: ${project.owner}`);
  lines.push(`- Site: ${project.addressLine1}, ${project.city}, ${project.state} ${project.zip}`);
  lines.push(`- AHJ: ${project.ahj}`);
  lines.push(`- Sector: ${project.sector}`);
  lines.push(`- Total SF: ${project.totalSf.toLocaleString()} · Floors: ${project.floors}`);
  if (project.exhibit) {
    lines.push(`- Federal agency: ${project.exhibit.federalAgency ?? "—"}`);
    lines.push(`- Davis-Bacon: ${project.exhibit.davisBaconApplies ? "applies" : "n/a"}`);
    lines.push(`- Cable scope: ${project.exhibit.cable.strandCount}-strand ${project.exhibit.cable.type} · ${project.exhibit.cable.totalLf} LF`);
    lines.push(`- Connector: ${project.exhibit.cable.connectorSpec}`);
  }
  lines.push("");

  lines.push("## BILL OF MATERIALS (manufacturer SKUs — cite these in Part 2)");
  for (const sec of bom.sections) {
    lines.push(`### ${sec.section}`);
    const items = bom.lineItems.filter(l => l.csiSection === sec.section);
    for (const l of items) {
      lines.push(`- ${l.manufacturer} ${l.sku} — ${l.description} · ${l.quantity} ${l.unit}`);
    }
  }
  lines.push("");

  lines.push("## COMPLIANCE CHECK SUMMARY");
  lines.push(`- ${compliance.counts.pass} pass · ${compliance.counts.advisory} advisory · ${compliance.counts.fail} fail · ${compliance.counts.not_applicable} N/A`);
  for (const r of compliance.rules.filter(r => r.outcome.status === "fail" || r.outcome.status === "advisory")) {
    lines.push(`- [${r.outcome.status.toUpperCase()}] ${r.def.code}: ${r.def.title}`);
  }
  lines.push("");

  lines.push("## REGULATORY READINESS");
  lines.push(`- City: ${regulatory.jurisdictionStack.city.name}`);
  lines.push(`- County: ${regulatory.jurisdictionStack.county.name}`);
  lines.push(`- State: ${regulatory.jurisdictionStack.state.name}`);
  lines.push(`- DOT: ${regulatory.jurisdictionStack.dot.acronym}`);
  lines.push(`- Permits: ${regulatory.permitRequirements.map(p => p.definition.label).join(", ")}`);
  lines.push("");

  lines.push("## TASK");
  lines.push("Generate the full Division 27 specification with the five sections listed in your system prompt. Output ONLY the JSON object — no prose, no markdown fences. Cite the manufacturer SKUs above wherever applicable in Part 2 (Products).");
  return lines.join("\n");
}

// ── Coercion helpers ────────────────────────────────────────────────────

function coerceSection(raw: unknown): SpecSection | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;
  const number = typeof r.number === "string" ? r.number.trim() : "";
  const title  = typeof r.title  === "string" ? r.title.trim()  : "";
  if (!number || !title) return null;
  const partsRaw = Array.isArray(r.parts) ? r.parts as unknown[] : [];
  const parts: SpecPart[] = [];
  for (const p of partsRaw) {
    const part = coercePart(p);
    if (part) parts.push(part);
  }
  if (parts.length === 0) return null;
  // Default `section` to the most likely match by number prefix.
  const matched = DEFAULT_SECTIONS.find(s => s.number === number);
  return {
    section: (matched?.section ?? `${number} — ${title}`) as SpecSection["section"],
    number, title, parts,
  };
}

function coercePart(raw: unknown): SpecPart | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;
  const id = r.id;
  if (typeof id !== "string" || !VALID_PART_IDS.has(id as SpecPartId)) return null;
  const articlesRaw = Array.isArray(r.articles) ? r.articles as unknown[] : [];
  const articles: SpecArticle[] = [];
  for (const a of articlesRaw) {
    const art = coerceArticle(a);
    if (art) articles.push(art);
  }
  if (articles.length === 0) return null;
  return { id: id as SpecPartId, articles };
}

function coerceArticle(raw: unknown): SpecArticle | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;
  const number = typeof r.number === "string" ? r.number : "";
  const title  = typeof r.title  === "string" ? r.title  : "";
  const body   = typeof r.body   === "string" ? r.body   : "";
  if (!number || !title || !body) return null;
  return { number, title, body };
}

// ── Deterministic mock (no API key) ─────────────────────────────────────

function mockGenerate(input: { project: Project; bom: BomDocument }): SpecDocument {
  const { project, bom } = input;
  const exhibit = project.exhibit;
  const fiberSkus    = bom.lineItems.filter(l => l.category === "fiber_cable" || l.category === "fiber_pigtail" || l.category === "fiber_splice_tray");
  const copperSkus   = bom.lineItems.filter(l => l.category === "copper_horizontal_cable" || l.category === "copper_jack" || l.category === "faceplate");
  const rackSkus     = bom.lineItems.filter(l => l.category === "rack" || l.category === "patch_panel" || l.category === "vertical_manager");
  const groundingSkus= bom.lineItems.filter(l => l.category === "grounding");
  const paths        = bom.lineItems.filter(l => l.category === "cable_tray_section" || l.category === "cable_tray_fitting" || l.category === "conduit_emt" || l.category === "conduit_fitting" || l.category === "j_hook" || l.category === "innerduct");

  function skuList(items: typeof fiberSkus): string {
    if (items.length === 0) return "";
    return items.slice(0, 6).map(l => `      ${l.manufacturer} ${l.sku} — ${l.description}`).join("\n");
  }

  const sections: SpecSection[] = [
    {
      section: "27 05 26 — Grounding and Bonding for Communications",
      number: "27 05 26",
      title: "Grounding and Bonding for Communications",
      parts: [
        { id: "part1_general", articles: [
          { number: "1.01", title: "SECTION INCLUDES",
            body: "A. Work of this section includes telecommunications grounding and bonding for the Project, including the Telecommunications Main Grounding Busbar (TMGB), Telecommunications Grounding Busbars (TGB), bonding conductors, and equipment grounding per TIA-607." },
          { number: "1.02", title: "REFERENCES",
            body: "A. ANSI/TIA-607-D — Generic Telecommunications Bonding and Grounding (Earthing) for Customer Premises.\nB. NEC Article 250 — Grounding and Bonding.\nC. BICSI TDMM 15 — Chapter 8, Bonding and Grounding." },
          { number: "1.03", title: "SUBMITTALS",
            body: "A. Product data sheets for TMGB, TGB, and all bonding conductors.\nB. Shop drawings showing TMGB / TGB locations relative to MDF and IDFs, with all bonding paths.\nC. Continuity test reports per Section 3.04 of this specification." },
        ]},
        { id: "part2_products", articles: [
          { number: "2.01", title: "MANUFACTURERS",
            body: "A. Acceptable products as specified in the Project BOM:" + (groundingSkus.length ? "\n" + skuList(groundingSkus) : "\n      (See Project BOM Section 27 05 26)") },
          { number: "2.02", title: "MATERIALS",
            body: "A. TMGB: Copper, 1/4\" × 4\" × 20\" minimum, with insulators.\nB. TGB: Copper, 1/4\" × 2\" × 10\" minimum.\nC. Bonding conductor: 6 AWG green-insulated copper per TIA-607 §4.4." },
        ]},
        { id: "part3_execution", articles: [
          { number: "3.01", title: "INSTALLATION",
            body: "A. Install TMGB within 10 ft of MDF rack per TIA-607 §4.6.\nB. Provide one TGB per IDF, bonded to TMGB via 6 AWG conductor.\nC. Bond all racks, cable trays, and equipment shelves to nearest TGB/TMGB." },
          { number: "3.02", title: "FIELD QUALITY CONTROL",
            body: "A. Test continuity between TMGB and each TGB.\nB. Verify resistance to ground ≤ 5 ohms.\nC. Document results on TIA-607 verification form." },
        ]},
      ],
    },
    {
      section: "27 05 28 — Pathways for Communications",
      number: "27 05 28",
      title: "Pathways for Communications",
      parts: [
        { id: "part1_general", articles: [
          { number: "1.01", title: "SECTION INCLUDES",
            body: "A. Cable trays, conduits, innerduct, J-hooks, and supporting hardware for telecommunications cabling pathways throughout the Project." },
          { number: "1.02", title: "REFERENCES",
            body: "A. ANSI/TIA-569-E — Telecommunications Pathways and Spaces.\nB. NEC Article 392 — Cable Trays.\nC. NEC Article 800 — Communications Circuits.\nD. BICSI TDMM 15 — Chapter 7, Pathways." },
        ]},
        { id: "part2_products", articles: [
          { number: "2.01", title: "MANUFACTURERS",
            body: "A. Acceptable products as specified in the Project BOM:" + (paths.length ? "\n" + skuList(paths) : "\n      (See Project BOM Section 27 05 28 and 27 05 36)") },
          { number: "2.02", title: "MATERIALS",
            body: "A. Cable tray: Ladder rack, aluminum, sized per fill ratio in Section 3.\nB. Conduit: EMT for indoor exposed; IMC where physical damage protection required; PVC Schedule 40 for direct-buried OSP.\nC. Innerduct: 1-1/4\" plenum-rated HDPE for fiber backbone routes.\nD. J-hooks: Erico Caddy CAT64 series or equivalent, hammer-on flange." },
        ]},
        { id: "part3_execution", articles: [
          { number: "3.01", title: "INSTALLATION",
            body: "A. Maintain cable tray fill ratio ≤ 50% cross-section per NEC 392.22.\nB. Provide bend radius of not less than 10× cable OD at all turns.\nC. Support cable tray at maximum 5'-0\" intervals; J-hooks at 5'-0\" maximum spacing." },
          { number: "3.02", title: "FIELD QUALITY CONTROL",
            body: "A. Inspect fill ratio in random tray sections at completion.\nB. Verify all penetrations are firestopped per NEC 800.26." },
        ]},
      ],
    },
    {
      section: "27 11 16 — Communications Racks, Frames, and Enclosures",
      number: "27 11 16",
      title: "Communications Racks, Frames, and Enclosures",
      parts: [
        { id: "part1_general", articles: [
          { number: "1.01", title: "SECTION INCLUDES",
            body: "A. Equipment racks, patch panels, vertical and horizontal cable managers, and rack-mount accessories for the MDF and IDFs." },
          { number: "1.02", title: "REFERENCES",
            body: "A. EIA-310-E — Cabinets, Racks, Panels, and Associated Equipment.\nB. ANSI/TIA-569-E — Telecommunications Pathways and Spaces (TR sizing).\nC. BICSI TDMM 15 — Chapter 6, Equipment Rooms and Telecommunications Rooms." },
        ]},
        { id: "part2_products", articles: [
          { number: "2.01", title: "MANUFACTURERS",
            body: "A. Acceptable products as specified in the Project BOM:" + (rackSkus.length ? "\n" + skuList(rackSkus) : "\n      (See Project BOM Section 27 11 16)") },
          { number: "2.02", title: "PERFORMANCE REQUIREMENTS",
            body: "A. Racks: 4-post, 42U × 19\" EIA-310, aluminum, black, with cable management.\nB. Patch panels: 24-port Cat 6A shielded for copper; 24-port LC duplex for fiber.\nC. All panels provide rear cable management." },
        ]},
        { id: "part3_execution", articles: [
          { number: "3.01", title: "INSTALLATION",
            body: "A. Anchor each rack to floor per manufacturer's seismic instructions.\nB. Bond each rack to local TGB per Section 27 05 26.\nC. Label patch panel ports per TIA-606-C labeling scheme generated by ToroAI." },
        ]},
      ],
    },
    {
      section: "27 13 23 — Communications Optical Fiber Backbone Cabling",
      number: "27 13 23",
      title: "Communications Optical Fiber Backbone Cabling",
      parts: [
        { id: "part1_general", articles: [
          { number: "1.01", title: "SECTION INCLUDES",
            body: "A. Optical fiber backbone cabling between MDF and IDF(s), including cable, splice trays, fiber pigtails, patch panels, and patch cords." +
              (exhibit?.cable ? `\nB. Project scope: ${exhibit.cable.strandCount}-strand ${exhibit.cable.type === "SM_OS2" ? "single-mode OS2" : exhibit.cable.type}, total approximate length ${exhibit.cable.totalLf} LF.` : "") },
          { number: "1.02", title: "REFERENCES",
            body: "A. ANSI/TIA-568.1-D — Generic Telecommunications Cabling Standard, optical fiber components.\nB. ANSI/TIA-758-B — Customer-Owned Outside Plant Telecommunications Infrastructure.\nC. NEC Article 770 — Optical Fiber Cables.\nD. BICSI TDMM 15 — Chapter 13, Outside Plant." },
        ]},
        { id: "part2_products", articles: [
          { number: "2.01", title: "MANUFACTURERS",
            body: "A. Acceptable products as specified in the Project BOM:" + (fiberSkus.length ? "\n" + skuList(fiberSkus) : "\n      (See Project BOM Section 27 13 23)") },
          { number: "2.02", title: "MATERIALS",
            body: "A. Fiber cable: SM OS2 armored indoor/outdoor, plenum-rated jacket.\nB. Connectors: **LC/UPC is mandatory for all fiber terminations. LC/APC is explicitly prohibited.** Reference NEC 770.179 for plenum jacketing requirements.\nC. Splice trays: 12-port LC duplex minimum, OFNP enclosure.\nD. Patch cords: LC/UPC single-mode duplex, 3 m, yellow jacket per industry color code." },
          { number: "2.03", title: "PERFORMANCE REQUIREMENTS",
            body: "A. Channel loss budget per TIA-568.1-D §7.3:\n      • 0.3 dB per LC/UPC mated pair × 2 ends = 0.6 dB connector loss\n      • 0.1 dB per fusion splice × strand × 2 ends\n      • Cable attenuation per manufacturer data sheet\nB. Total channel loss to comply with applicable Ethernet standard (e.g., IEEE 802.3 1000BASE-LX, 10GBASE-LR)." },
        ]},
        { id: "part3_execution", articles: [
          { number: "3.01", title: "INSTALLATION",
            body: "A. Pull fiber per manufacturer's maximum pulling tension limits.\nB. Maintain minimum bend radius 10× cable OD under load, 20× installed.\nC. Provide 10 ft service-loop slack at each termination per BICSI TDMM 15." },
          { number: "3.02", title: "FIELD QUALITY CONTROL",
            body: "A. Test each fiber strand bidirectionally using OTDR and OLTS per TIA-568.\nB. Document loss for each strand on Fluke LinkWare or equivalent.\nC. Submit OTDR traces with as-built drawings." },
        ]},
      ],
    },
    {
      section: "27 15 13 — Communications Copper Horizontal Cabling",
      number: "27 15 13",
      title: "Communications Copper Horizontal Cabling",
      parts: [
        { id: "part1_general", articles: [
          { number: "1.01", title: "SECTION INCLUDES",
            body: "A. Cat 6A horizontal cabling from telecommunications room patch panels to work-area outlets, including faceplates, modular jacks, and patch cords." },
          { number: "1.02", title: "REFERENCES",
            body: "A. ANSI/TIA-568.2-D — Balanced Twisted-Pair Telecommunications Cabling and Components Standard.\nB. NEC Article 800 — Communications Circuits.\nC. BICSI TDMM 15 — Chapter 5, Outlets and Stations." },
        ]},
        { id: "part2_products", articles: [
          { number: "2.01", title: "MANUFACTURERS",
            body: "A. Acceptable products as specified in the Project BOM:" + (copperSkus.length ? "\n" + skuList(copperSkus) : "\n      (See Project BOM Section 27 15 13 and 27 15 43)") },
          { number: "2.02", title: "PERFORMANCE REQUIREMENTS",
            body: "A. Channel meets or exceeds Cat 6A per TIA-568.2-D Annex G.\nB. Permanent link ≤ 90 m per TIA-568.2-D §4.2.5.\nC. Channel (permanent link + patch cords) ≤ 100 m." },
        ]},
        { id: "part3_execution", articles: [
          { number: "3.01", title: "INSTALLATION",
            body: "A. Pull cable per manufacturer's pulling tension and bend radius limits.\nB. Maintain 2\" separation from EMI sources per NEC 800.\nC. Terminate to TIA-568 T568B pinout unless otherwise specified." },
          { number: "3.02", title: "FIELD QUALITY CONTROL",
            body: "A. Certify 100% of installed cables per TIA-568.2-D Annex G using a Level IV (Class II) tester.\nB. Submit certification results in Fluke LinkWare format with as-built drawings." },
        ]},
      ],
    },
  ];

  return {
    projectId: project.id,
    generatedAt: new Date().toISOString(),
    strategy: "deterministic_mock",
    sections,
  };
}
