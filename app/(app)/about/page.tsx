import Link from "next/link";
import { TopBar } from "@/components/shell/TopBar";
import { CATALOG } from "@/lib/catalog/products";
import { RULES } from "@/lib/standards/rules";

// /about — the deep-dive an investor asks for after the demo. Frames the
// problem, the IP, the technology, and the validation exhibit.

export default function AboutPage() {
  return (
    <>
      <TopBar breadcrumb={[{ label: "Workspace" }, { label: "About ToroAI" }]} />
      <div className="flex-1 overflow-y-auto">
        <div className="max-w-[920px] mx-auto px-6 py-10">

          {/* ── Header ──────────────────────────────────────────────── */}
          <div className="mb-10">
            <div className="text-[10px] uppercase tracking-[0.1em] text-accent font-mono mb-2">
              ToroAI · Technical Disclosure Highlights
            </div>
            <h1 className="text-[32px] font-semibold leading-tight mb-3">
              The first AI design platform built for telecommunications infrastructure.
            </h1>
            <p className="text-[14px] text-text2 leading-relaxed max-w-[700px]">
              A single uploaded floor plan produces a stamp-ready submittal package —
              design layout, bill of materials, labor schedule of values, permit
              roadmap, and Primavera-compatible critical path schedule —
              all under one patent-pending Neural Parsal Engine.
            </p>
          </div>

          {/* ── Problem ─────────────────────────────────────────────── */}
          <Section title="The problem" tone="warn">
            <p>
              The telecom infrastructure industry — ISP, OSP, DAS, hyperscale data centers,
              federal/DoD facility networks — relies on a sequential workflow that adds
              <span className="text-text"> 8-22 days per project</span> across five
              specialists who don't coordinate:
            </p>
            <ul className="mt-3 space-y-1.5 text-[12.5px]">
              <li>· <span className="text-text2">RCDD</span> manually interprets construction plans (3–7 days)</li>
              <li>· <span className="text-text2">Estimator</span> produces line-item BOM with current pricing (1–3 days)</li>
              <li>· <span className="text-text2">Project manager</span> produces Davis-Bacon-compliant SOV (1–2 days)</li>
              <li>· <span className="text-text2">Permitting specialist</span> identifies jurisdictions + AHJs (1–5 days per jurisdiction)</li>
              <li>· <span className="text-text2">Scheduler</span> builds CPM + exports to Primavera P6 (2–5 days)</li>
            </ul>
            <p className="mt-3">
              No commercially available platform performs all five functions simultaneously
              from a single document. iBwave handles ISP drawings. IQGeo handles OSP GIS.
              PermitFlow handles permitting. CPM tools handle scheduling. None are
              telecom-domain-aware across the full project lifecycle.
            </p>
          </Section>

          {/* ── The IP ──────────────────────────────────────────────── */}
          <Section title="The intellectual property" tone="warn">
            <p className="mb-3">
              <span className="text-text font-medium">U.S. Provisional Patent Application</span> filed
              November 11, 2025. <span className="text-text2">Utility filing target: August 2026.</span>
              The provisional describes the Neural Parsal Engine and its associated output
              generation architecture, with three independent claims and six dependent claims.
              Three claims are below.
            </p>

            <ClaimBox n={1} title="Apparatus claim — Simultaneous parallel five-lane generation"
              text="A computer-implemented system for telecommunications infrastructure project delivery comprising: (a) a document intake interface configured to accept construction project files in PDF, DWG/DXF, DOCX, or image format; (b) a multi-layer document intelligence engine; (c) an AI reasoning module configured to generate, simultaneously and in parallel, five structured output streams comprising a design layout, a bill of materials, a labor schedule of values, a permitting requirements report, and a critical path schedule; (d) a Davis-Bacon prevailing wage enforcement module; and (e) a Primavera P6-compatible schedule export module." />

            <ClaimBox n={2} title="Method claim — Two-call AI reasoning architecture"
              text="Generating, from said classified entities and a domain-trained AI reasoning prompt, a bill of materials and labor schedule of values in a first AI reasoning call; generating a critical path schedule with Primavera P6 export in a second AI reasoning call using outputs of the first call; applying post-processing enforcement functions to validate connector specifications, labor wage compliance, and production rate parameters." />

            <ClaimBox n={3} title="Method claim — Regulatory Output Engine (strongest)"
              text="Receiving a project site location; resolving the applicable city, county, state, and federal jurisdictions and their corresponding permitting authorities; classifying required permit types from a defined taxonomy including ROW encroachment, trenching, directional boring, aerial pole attachment, and building permits; mapping each permit type to its responsible issuing authority and contact information; generating a Regulatory Readiness Report; and integrating said permit timelines as constraint activities within the critical path schedule." />

            <div className="mt-4 px-4 py-3 border border-warn/30 bg-warn/5 rounded-[2px]">
              <div className="text-[10px] uppercase tracking-[0.08em] text-warn font-mono mb-1">
                Alice Corp. v. CLS Bank — Step 2B inventive concept
              </div>
              <p className="text-[11.5px] text-text2 leading-relaxed">
                The patent's defensibility under Alice Step 2B rests on the combination of
                (1) telecom-domain-specific NER classification, (2) the two-call AI architecture,
                (3) four hardcoded post-processing enforcement modules (Davis-Bacon, LC/UPC connector spec,
                production-rate envelope, permit-trigger extraction), and (4) simultaneous five-lane parallel
                output generation. No prior art system combines these elements. Each of the four enforcement
                modules ships as real deterministic compute, not a placeholder.
              </p>
            </div>
          </Section>

          {/* ── Reduction to practice ───────────────────────────────── */}
          <Section title="Reduction to practice" tone="info">
            <p className="mb-3">
              <span className="text-text font-medium">Michael E. DeBakey VA Medical Center, Houston, TX.</span> A
              real OSP fiber installation between buildings B-100 and B-108 — single-mode 12-strand
              OS2 armored fiber, 2,300 LF, LC/UPC connectors, federal VA project with Davis-Bacon
              applying, confined-space-entry permit, $9,118 materials subtotal.
            </p>
            <p className="mb-3">
              The patent demo reproduces this verbatim — values match the TDD §7 disclosure exactly.
              Open the project to see the reduction-to-practice exhibit card and every downstream
              compute (BOM, compliance, regulatory, schedule) operate on the same fixture.
            </p>
            <Link href="/projects/P1"
                  className="btn btn-primary text-[12px] px-4 py-2 inline-flex items-center gap-2">
              <i className="ti ti-arrow-right" style={{ fontSize: 12 }} aria-hidden="true" />
              Open the DeBakey VAMC exhibit
            </Link>
          </Section>

          {/* ── Technology ──────────────────────────────────────────── */}
          <Section title="Technology stack" tone="accent">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-[11.5px]">
              <Tech label="Frontend" value="Next.js 14 · React 18 · Tailwind CSS · TypeScript" />
              <Tech label="AI reasoning" value="Anthropic Claude Sonnet 4.6 · two-call architecture · vision-capable" />
              <Tech label="PDF text extraction" value="pdfjs-dist · 50 MB upload · OCR fallback via Claude vision" />
              <Tech label="Vision room detection" value="Claude with vision · bbox + type per labeled room" />
              <Tech label="Layer 3 NER" value="50+ regex predicates · 10 telecom-domain categories" />
              <Tech label="Standards corpus" value={`${RULES.length} compliance rules · BICSI · TIA · NEC · UFC`} />
              <Tech label="Product catalog" value={`${CATALOG.length} SKUs · Belden · Panduit · Leviton · CPI · Crouse-Hinds`} />
              <Tech label="PDF generation" value="pdf-lib · cover + stamp + sections · pure JS, no native deps" />
              <Tech label="Schedule export" value="Primavera P6 v8 APIBusinessObjects XML — direct import" />
              <Tech label="Compliance compute" value="Real deterministic predicates across project state" />
              <Tech label="Production rate envelope" value="3,500–5,280 LF/day · 5-man OSP pull crew" />
              <Tech label="Davis-Bacon enforcement" value="Harris County WD-2026-2741 prevailing wage table" />
            </div>
          </Section>

          {/* ── Roadmap ─────────────────────────────────────────────── */}
          <Section title="What's next" tone="pass">
            <p className="mb-3">
              The current build ships the Neural Parsal Engine + enforcement + Regulatory Output
              Engine + BOM + spec text generator + submittal PDF. From here:
            </p>
            <ul className="space-y-1.5 text-[12px]">
              <li>· <span className="text-text2">D-size 24″×36″ sheet drawings</span> with title block + revision clouds</li>
              <li>· <span className="text-text2">Live distributor pricing</span> — Anixter · Graybar · CDW API integration</li>
              <li>· <span className="text-text2">Live Davis-Bacon SCA lookup</span> beyond Harris County</li>
              <li>· <span className="text-text2">AHJ portal submission</span> — Accela · Avolve ProjectDox</li>
              <li>· <span className="text-text2">DWG/DXF parsing</span> for CAD inputs</li>
              <li>· <span className="text-text2">Mobile field app</span> for as-builts and punch lists</li>
              <li>· <span className="text-text2">Multi-page floor plan vision</span> for large building sets</li>
              <li>· <span className="text-text2">CSI 27 spec library</span> firm-customizable boilerplate</li>
            </ul>
          </Section>

          {/* ── Inventor ────────────────────────────────────────────── */}
          <div className="mt-12 pt-6 border-t border-chrome-dark">
            <div className="text-[10px] uppercase tracking-[0.08em] text-text4 font-mono mb-1">
              Inventor &amp; assignee
            </div>
            <div className="text-[13px] text-text2">
              <span className="text-text font-medium">Joseph V. Torres, RCDD</span> · Founder &amp; CEO
            </div>
            <div className="text-[11px] text-text3 mt-1">
              Phoenix Infrastructure Services Group · Jacksonville, FL
            </div>
            <div className="text-[10px] text-text4 font-mono mt-3">
              Confidential — Attorney–Client Privileged Work Product · © 2025–2026
            </div>
          </div>

          <div className="mt-8 flex items-center gap-3">
            <Link href="/dashboard" className="btn btn-ghost text-[11.5px]">← Back to dashboard</Link>
            <Link href="/projects/P1" className="btn btn-primary text-[12px] px-4 py-2 inline-flex items-center gap-2">
              <i className="ti ti-player-play" style={{ fontSize: 12 }} aria-hidden="true" />
              Open the live demo
            </Link>
          </div>

        </div>
      </div>
    </>
  );
}

// ── Sub-components ───────────────────────────────────────────────────────

function Section({
  title, tone, children,
}: {
  title: string; tone: "info" | "warn" | "accent" | "pass";
  children: React.ReactNode;
}) {
  const cls =
    tone === "info"   ? "border-l-info text-info"
    : tone === "warn" ? "border-l-warn text-warn"
    : tone === "accent" ? "border-l-accent text-accent"
    : "border-l-pass text-pass";
  return (
    <section className="mb-8">
      <div className={"text-[10px] uppercase tracking-[0.08em] font-mono mb-2 border-l-2 pl-3 " + cls}>
        {title}
      </div>
      <div className="text-[12.5px] text-text3 leading-relaxed pl-3 ml-[2px]">
        {children}
      </div>
    </section>
  );
}

function ClaimBox({ n, title, text }: { n: number; title: string; text: string }) {
  return (
    <div className="mb-3 border border-chrome-dark rounded-[2px] bg-chrome-darkest p-4">
      <div className="flex items-baseline gap-2 mb-1.5">
        <span className="w-6 h-6 rounded-full bg-warn/20 text-warn text-[11px] font-mono font-medium flex items-center justify-center flex-shrink-0">
          {n}
        </span>
        <span className="text-[12px] text-text font-medium">{title}</span>
      </div>
      <p className="text-[11px] text-text3 leading-relaxed italic">"{text}"</p>
    </div>
  );
}

function Tech({ label, value }: { label: string; value: string }) {
  return (
    <div className="border border-chrome-dark rounded-[2px] bg-chrome-darkest px-3 py-2">
      <div className="text-[9.5px] uppercase tracking-[0.06em] text-text4 font-mono">{label}</div>
      <div className="text-[11.5px] text-text2 mt-0.5 leading-snug">{value}</div>
    </div>
  );
}
