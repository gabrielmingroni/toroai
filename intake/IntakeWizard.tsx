"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import type { Project } from "@/lib/projects/types";
import type { IntakeJob } from "@/lib/intake/types";
import { intakeClient } from "@/lib/intake/client";
import { StageStepper } from "./StageStepper";
import { UploadStep } from "./UploadStep";
import { IngestionStep } from "./IngestionStep";
import { RoomReviewStep } from "./RoomReviewStep";
import { TrReviewStep } from "./TrReviewStep";
import { ConfirmStep } from "./ConfirmStep";

type SubStep = "upload" | "ingest" | "rooms" | "trs" | "confirm";

function subStepFromJob(job: IntakeJob | null): SubStep {
  if (!job) return "upload";
  if (job.stage === "queued") return "ingest";
  if (job.stage === "extracting_text" || job.stage === "assembling_rooms" ||
      job.stage === "classifying"     || job.stage === "scoring_trs") return "ingest";
  // ready_for_review or confirmed → wizard substeps:
  return "rooms";
}

export function IntakeWizard({ project, initialJob }: { project: Project; initialJob: IntakeJob | null }) {
  const router = useRouter();
  const [job, setJob] = useState<IntakeJob | null>(initialJob);
  const [substep, setSubstep] = useState<SubStep>(subStepFromJob(initialJob));

  // Poll while ingestion is running
  useEffect(() => {
    if (!job) return;
    const inFlight = ["extracting_text", "assembling_rooms", "classifying", "scoring_trs"].includes(job.stage);
    if (!inFlight) return;
    const tick = setInterval(async () => {
      const res = await intakeClient.status(project.id);
      if (res.job) {
        setJob(res.job);
        if (res.job.stage === "ready_for_review") {
          setSubstep("rooms");
          clearInterval(tick);
        }
      }
    }, 700);
    return () => clearInterval(tick);
  }, [project.id, job]);

  // When user advances past rooms / trs manually
  function next() {
    if (substep === "rooms") setSubstep("trs");
    else if (substep === "trs") setSubstep("confirm");
  }
  function back() {
    if (substep === "trs") setSubstep("rooms");
    else if (substep === "confirm") setSubstep("trs");
  }

  async function startIngestion(files: { name: string; sizeBytes: number; kind: "pdf" | "dwg" | "dxf" | "ifc" | "other" }[]) {
    const res = await intakeClient.start(project.id, { files });
    if (res.ok && res.job) {
      setJob(res.job);
      setSubstep("ingest");
    }
  }
  async function resetIntake() {
    await intakeClient.reset(project.id);
    setJob(null);
    setSubstep("upload");
    router.refresh();
  }

  return (
    <div className="h-full flex flex-col">
      <StageStepper substep={substep} job={job} onJump={(s) => {
        // Only allow jumping backward (or to current stage)
        const order: SubStep[] = ["upload", "ingest", "rooms", "trs", "confirm"];
        if (order.indexOf(s) <= order.indexOf(substep)) setSubstep(s);
      }} />

      <div className="flex-1 overflow-y-auto">
        <div className="px-6 py-5 max-w-[1100px]">
          {substep === "upload" && (
            <UploadStep project={project} onStart={startIngestion} />
          )}
          {substep === "ingest" && job && (
            <IngestionStep project={project} job={job} onReset={resetIntake} />
          )}
          {substep === "rooms" && job && (
            <RoomReviewStep
              project={project}
              job={job}
              onJobUpdate={setJob}
              onNext={next}
            />
          )}
          {substep === "trs" && job && (
            <TrReviewStep
              project={project}
              job={job}
              onJobUpdate={setJob}
              onNext={next}
              onBack={back}
            />
          )}
          {substep === "confirm" && job && (
            <ConfirmStep
              project={project}
              job={job}
              onConfirmed={() => router.push(`/projects/${project.id}`)}
              onBack={back}
            />
          )}
        </div>
      </div>
    </div>
  );
}
