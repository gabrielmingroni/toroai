import Link from "next/link";
import { notFound } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/session";
import { projectStore } from "@/lib/projects/mock-store";
import { pipelineStore } from "@/lib/pipeline/mock-store";
import { STAGE_DEFS, type PipelineRun } from "@/lib/pipeline/types";
import { TopBar } from "@/components/shell/TopBar";
import { StatCard } from "@/components/ui/StatCard";
import {
  STATUS_LABEL, TYPE_LABEL, SECTOR_LABEL, BUILDING_TYPE_LABEL,
  CABLE_SPEC_LABEL, CONNECTOR_SPEC_LABEL, FEDERAL_AGENCY_LABEL,
  type Project, type ProjectStatus, type ProjectExhibit,
} from "@/lib/projects/types";

/** What's the pipeline actually doing right now? */
type RunPhase = "none" | "pre_gate" | "at_gate" | "post_gate" | "complete";
function phaseOf(run: PipelineRun | null): RunPhase {
  if (!run) return "none";
  if (run.completedAt) return "complete";
  if (run.currentStage === "rcdd_review_gate" && !run.gateReleasedAt) return "at_gate";
  if (run.gateReleasedAt) return "post_gate";
  return "pre_gate";
}

const STATUS_TONE: Record<ProjectStatus, "pass" | "warn" | "info" | "fail" | "neutral"> = {
  draft:           "neutral",
  intake:          "info",
  in_progress:     "info",
  pending_review:  "warn",
  ready_to_stamp:  "warn",
  complete:        "pass",
  archived:        "neutral",
};
const TONE_CLASS = {
  pass:    "text-pass bg-pass/10 border-pass/30",
  warn:    "text-warn bg-warn/10 border-warn/30",
  info:    "text-info bg-info/10 border-info/30",
  fail:    "text-fail bg-fail/10 border-fail/30",
  neutral: "text-text3 bg-chrome-dark border-chrome-lighter",
} as const;

function nextStep(p: Project, phase: RunPhase, run: PipelineRun | null): { label: string; href: string; sub: string } {
  if (p.status === "draft" && !p.hasUpload) {
    return {
      label: "Upload architectural backgrounds",
      href: `/projects/${p.id}/upload`,
      sub: "Drag in PDFs or DWGs. Ingestion runs RoomAssembler → RoomClassifier → TRScorer.",
    };
  }
  if (p.status === "intake") {
    return { label: "Resume document intake", href: `/projects/${p.id}/upload`, sub: "Finish reviewing rooms and confirming telecom rooms." };
  }
  if (p.status === "in_progress") {
    // in_progress now spans three substates depending on the live run.
    if (phase === "pre_gate") {
      const stage = STAGE_DEFS.find(d => d.id === run?.currentStage)?.label ?? "Initializing";
      return {
        label: "Watch pipeline progress",
        href: `/projects/${p.id}/pipeline`,
        sub: `Pipeline running — current stage: ${stage}. Will pause at the RCDD review gate.`,
      };
    }
    if (phase === "post_gate") {
      return {
        label: "Watch drawings generation",
        href: `/projects/${p.id}/pipeline`,
        sub: "Gate released. Construction drawings, PDF export, and S3 upload are running.",
      };
    }
    // No run yet (phase === "none") — first run from this status
    return {
      label: "Run pipeline",
      href: `/projects/${p.id}/pipeline`,
      sub: "Run the 10-stage backend pipeline. Pauses at the RCDD review gate.",
    };
  }
  if (p.status === "pending_review") {
    // Route the RCDD straight to the review queue — that's where they actually
    // do the work. The pipeline page is fine too but it's one click further
    // from the placement/advisory list they need to clear.
    return { label: "Open RCDD review queue", href: `/projects/${p.id}/review`, sub: "Pipeline paused at the RCDD review gate. Approve placements + acknowledge advisories to continue." };
  }
  if (p.status === "ready_to_stamp") {
    return { label: "Open Results & apply stamp", href: `/projects/${p.id}/results`, sub: "Sign and stamp the construction document set." };
  }
  if (p.status === "complete") {
    return { label: "Open submittal", href: `/projects/${p.id}/results`, sub: "View the stamped submittal package." };
  }
  return { label: "Open project", href: `/projects/${p.id}/results`, sub: "Project is archived." };
}

export default function ProjectDetailPage({ params }: { params: { id: string } }) {
  const user = getCurrentUser()!;
  const project = projectStore.get(params.id, user.id);
  if (!project) notFound();

  const pipelineRun = pipelineStore.get(project.id) ?? null;
  const phase = phaseOf(pipelineRun);

  const step = nextStep(project, phase, pipelineRun);
  const totalComplianceChecks =
    project.complianceScore.pass + project.complianceScore.advisory + project.complianceScore.fail;
  const bomDollars = project.bomTotalCents > 0
    ? "$" + Math.round(project.bomTotalCents / 100).toLocaleString()
    : "—";

  // Inline progress strip is rendered when the pipeline is moving (pre/post-gate).
  const runProgressPct = Math.round((pipelineRun?.overallProgress ?? 0) * 100);
  const showProgressStrip = phase === "pre_gate" || phase === "post_gate";

  return (
    <>
      <TopBar breadcrumb={[
        { label: "Workspace" },
        { label: "Projects" },
        { label: project.name },
      ]} />
      <div className="flex-1 overflow-y-auto">
        <div className="px-6 py-5 max-w-[1100px]">

          {/* Header */}
          <header className="mb-5 flex items-start justify-between gap-6">
            <div className="min-w-0">
              <div className="flex items-center gap-3 mb-1">
                <h1 className="text-[20px] font-semibold truncate">{project.name}</h1>
                <span className={
                  "inline-flex items-center px-2 py-0.5 text-[10.5px] font-medium rounded-[2px] font-mono uppercase tracking-[0.04em] border " +
                  TONE_CLASS[STATUS_TONE[project.status]]
                }>
                  {STATUS_LABEL[project.status]}
                </span>
              </div>
              <div className="text-[11.5px] text-text3 font-mono">
                {project.number} · {project.owner} · {project.city}, {project.state}
              </div>
            </div>
            <div className="flex items-center gap-2 flex-shrink-0">
              <Link href={`/projects/${project.id}/floor-plan`} className="btn btn-ghost text-[11.5px]">Open canvas</Link>
              <Link href={step.href} className="btn btn-primary text-[12px] px-3 py-2">
                {step.label} →
              </Link>
            </div>
          </header>

          {/* Project scope card — shown on federal / Davis-Bacon jobs. */}
          {project.exhibit && <ExhibitCard exhibit={project.exhibit} />}

          {/* Next step card */}
          <div className={
            "card mb-5 border-l-2 " +
            (phase === "pre_gate" || phase === "post_gate" ? "border-l-info" : "border-l-accent")
          }>
            <div className="card-body flex items-start gap-4">
              <div className="flex-1 min-w-0">
                <div className={
                  "text-[10px] uppercase tracking-[0.06em] font-mono mb-1 " +
                  (phase === "pre_gate" || phase === "post_gate" ? "text-info" : "text-accent")
                }>
                  {phase === "pre_gate"  ? "Pipeline running"
                   : phase === "post_gate" ? "Pipeline running · drawings"
                   : "Next step"}
                </div>
                <div className="text-[14px] text-text font-medium mb-1">{step.label}</div>
                <div className="text-[11.5px] text-text3">{step.sub}</div>
                {showProgressStrip && (
                  <div className="mt-3">
                    <div className="flex items-baseline justify-between gap-3 mb-1.5">
                      <span className="text-[10px] uppercase tracking-[0.06em] text-text4 font-mono">Overall progress</span>
                      <span className="text-[10.5px] font-mono text-info tabular-nums">{runProgressPct}%</span>
                    </div>
                    <div className="h-1 bg-chrome-darkest rounded-full overflow-hidden">
                      <div
                        className={"h-full transition-all duration-300 " + (phase === "post_gate" ? "bg-accent" : "bg-info")}
                        style={{ width: runProgressPct + "%" }}
                      />
                    </div>
                  </div>
                )}
              </div>
              <Link href={step.href} className="btn btn-primary text-[12px] flex-shrink-0">Go →</Link>
            </div>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-2.5 mb-5">
            <StatCard label="Rooms confirmed" value={project.roomsConfirmed} sub={`${project.floors} floor${project.floors !== 1 ? "s" : ""}`} />
            <StatCard label="Outlets" value={project.outlets} sub={`${project.waps} WAPs`} />
            <StatCard label="BOM total" value={bomDollars} sub={project.bomTotalCents > 0 ? "incl. NECA MLU labor" : undefined} color={project.bomTotalCents > 0 ? "accent" : "neutral"} />
            <StatCard
              label="Compliance"
              value={totalComplianceChecks > 0 ? `${project.complianceScore.pass}/${totalComplianceChecks}` : "—"}
              sub={totalComplianceChecks > 0 ? `${project.complianceScore.advisory} advisory · ${project.complianceScore.fail} fail` : undefined}
              color={project.complianceScore.fail > 0 ? "fail" : project.complianceScore.advisory > 0 ? "warn" : totalComplianceChecks > 0 ? "pass" : "neutral"}
            />
          </div>

          {/* Two columns: building facts | sub-view tiles */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">

            <div className="card">
              <div className="card-header"><div className="card-title">Building</div></div>
              <div className="card-body">
                <Fact label="Building type" value={BUILDING_TYPE_LABEL[project.buildingType]} />
                <Fact label="Sector" value={SECTOR_LABEL[project.sector]} />
                <Fact label="Design type" value={TYPE_LABEL[project.type]} />
                <Fact label="Total SF" value={project.totalSf.toLocaleString()} mono />
                <Fact label="Floors" value={project.floors} mono />
                <Fact label="Target occupancy" value={project.occupancyDate ? new Date(project.occupancyDate).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" }) : "—"} />
                <Fact label="AHJ" value={project.ahj} />
                <Fact label="Address" value={`${project.addressLine1}, ${project.city}, ${project.state} ${project.zip}`} />
              </div>
            </div>

            <div className="card">
              <div className="card-header"><div className="card-title">Workflow</div></div>
              <div className="card-body p-0">
                <SubviewLink href={`/projects/${project.id}/upload`}     label="Upload"           hint="Architectural backgrounds + ingestion (mocked)" />
                <SubviewLink href={`/projects/${project.id}/intake-extract`} label="PDF Extraction" hint="REAL · Layer 2 PDF text extraction · feeds NPE Reasoning" />
                <SubviewLink href={`/projects/${project.id}/floor-plan`} label="Floor Plan"       hint="Room editor + TR confirmation" />
                <SubviewLink href={`/projects/${project.id}/pre-design`} label="RCDD Pre-Design" hint="Design parameters + BICSI calcs" />
                <SubviewLink href={`/projects/${project.id}/pathway`}    label="Pathway"          hint="Cable tray + conduit · 90 m TIA-568 validation" />
                <SubviewLink href={`/projects/${project.id}/pipeline`}   label="Pipeline"         hint="Document intake → design, BOM, labor, permits, schedule — generated in parallel" />
                <SubviewLink href={`/projects/${project.id}/npe`}        label="Design Reasoning"  hint="Two-call AI · BOM + labor SOV → CPM + Primavera P6 XML" />
                <SubviewLink href={`/projects/${project.id}/enforcement`} label="Enforcement"      hint="Davis-Bacon wage override · LC/UPC connector spec · production-rate envelope · permit triggers" />
                <SubviewLink href={`/projects/${project.id}/regulatory`} label="Regulatory"        hint="Readiness report · jurisdictions · AHJs · permit timelines" />
                <SubviewLink href={`/projects/${project.id}/compliance`} label="Compliance"        hint="20-rule standards corpus · BICSI TDMM · TIA · NEC · UFC" />
                <SubviewLink href={`/projects/${project.id}/bom`}        label="Bill of Materials" hint="CSI Division 27 itemized BOM · catalog SKUs · CSV + Markdown export" />
                <SubviewLink href={`/projects/${project.id}/design-gen`} label="Design Generation" hint="TR location suggester · cable run from-to schedule · 90 m TIA-568 horizontal" />
                <SubviewLink href={`/projects/${project.id}/spec`}       label="CSI 27 Specification" hint="AI-generated Division 27 spec text · 5 sections × 3 parts · Markdown export" />
                <SubviewLink href={`/projects/${project.id}/drawings`}   label="Drawing Set"           hint="D-size construction documents · T-001 cover · T-100 floor plan · T-200 riser · T-400 schedule" />
                <SubviewLink href={`/projects/${project.id}/submittal`}  label="Submittal Package" hint="Real production PDF · cover + BOM + compliance + regulatory + schedule" />
                <SubviewLink href={`/projects/${project.id}/review`}     label="RCDD Review"      hint="Per-element approval gate" />
                <SubviewLink href={`/projects/${project.id}/results`}    label="Results"           hint="BOM · Compliance · Permits · Drawings" last />
              </div>
            </div>

          </div>

          <footer className="mt-6 text-[10.5px] text-text4 font-mono">
            Created {new Date(project.createdAt).toLocaleString()} · Last updated {new Date(project.updatedAt).toLocaleString()}
          </footer>

        </div>
      </div>
    </>
  );
}

function Fact({ label, value, mono = false }: { label: string; value: string | number; mono?: boolean }) {
  return (
    <div className="flex justify-between py-1.5 text-[11.5px] border-b border-chrome-dark last:border-b-0">
      <span className="text-text3">{label}</span>
      <span className={mono ? "text-text2 mono tabular-nums" : "text-text2"}>{value}</span>
    </div>
  );
}

function SubviewLink({ href, label, hint, last = false }: { href: string; label: string; hint: string; last?: boolean }) {
  return (
    <Link
      href={href}
      className={
        "flex items-center justify-between px-4 py-3 text-text2 hover:bg-chrome-light transition-colors group" +
        (last ? "" : " border-b border-chrome-dark")
      }
    >
      <div>
        <div className="text-[12.5px] text-text group-hover:text-accent transition-colors">{label}</div>
        <div className="text-[10.5px] text-text3 mt-0.5">{hint}</div>
      </div>
      <span className="text-text4 group-hover:text-accent transition-colors text-[14px]">→</span>
    </Link>
  );
}

// ── Project scope card ─────────────────────────────────────────────────
// Rendered on federal / Davis-Bacon projects to surface the cable scope and
// permit-bearing facts the RCDD needs to see at a glance.

function ExhibitCard({ exhibit }: { exhibit: ProjectExhibit }) {
  const bomDollars = "$" + (exhibit.bomMaterialsSubtotalCents / 100).toLocaleString(undefined, {
    minimumFractionDigits: 2, maximumFractionDigits: 2,
  });
  const fed = exhibit.federalAgency ? FEDERAL_AGENCY_LABEL[exhibit.federalAgency] : null;
  return (
    <div className="card mb-5 border-l-2 border-l-warn bg-warn/[0.03]">
      <div className="card-body">
        <div className="flex items-baseline justify-between mb-2">
          <div className="text-[10px] uppercase tracking-[0.06em] text-warn font-mono">
            Federal project · scope summary
          </div>
        </div>
        <div className="text-[11px] text-text3 mb-3">
          {fed && <>Owner: <span className="text-text2">{fed}</span> · </>}
          {exhibit.davisBaconApplies && <span className="text-warn">Davis-Bacon prevailing wage applies</span>}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Cable scope */}
          <div>
            <div className="text-[10px] uppercase tracking-[0.06em] text-text4 font-mono mb-1.5">Cable scope</div>
            <ExhibitFact label="Cable" value={`${exhibit.cable.strandCount}-strand ${CABLE_SPEC_LABEL[exhibit.cable.type]}`} />
            <ExhibitFact label="Length" value={`${exhibit.cable.totalLf.toLocaleString()} LF`} mono />
            <ExhibitFact label="From" value={exhibit.cable.startLocation} />
            <ExhibitFact label="To" value={exhibit.cable.endLocation} />
            <ExhibitFact label="Connector" value={CONNECTOR_SPEC_LABEL[exhibit.cable.connectorSpec]} mono />
            <ExhibitFact label="Materials subtotal" value={bomDollars} mono />
          </div>

          {/* Permit flags */}
          <div>
            <div className="text-[10px] uppercase tracking-[0.06em] text-text4 font-mono mb-1.5">Permit flags</div>
            <ul className="space-y-1">
              {exhibit.permitFlags.map(flag => (
                <li key={flag} className="flex items-center gap-2 text-[11.5px] text-text2">
                  <span className="text-warn text-[11px]">▸</span>
                  <span className="font-mono">{flag}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}

function ExhibitFact({ label, value, mono = false }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="flex justify-between py-1 text-[11.5px] border-b border-chrome-dark last:border-b-0">
      <span className="text-text3">{label}</span>
      <span className={mono ? "text-text2 font-mono tabular-nums" : "text-text2"}>{value}</span>
    </div>
  );
}
