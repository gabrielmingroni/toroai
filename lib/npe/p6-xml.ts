// Primavera P6 XML emitter — emits an Oracle Primavera P6 v8 import file
// from a CPM activity list. Format is the APIBusinessObjects schema used
// by P6's File → Import → XML workflow.
//
// This is the no-API-cost path the TDD §6.5 calls out:
//   "Primavera P6 export: XML-formatted schedule file compatible with
//    direct import into Oracle Primavera P6 (no API cost)."

import type { CpmActivity, Milestone } from "./types";

function xmlEscape(s: string): string {
  return s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "\"": "&quot;", "'": "&apos;" }[c]!));
}

/** Add `days` calendar days to an ISO start date. Returns YYYY-MM-DD. */
function addDays(startIso: string, days: number): string {
  const d = new Date(startIso);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

export interface P6EmitOptions {
  projectId: string;
  projectName: string;
  /** Project day 0 — when the schedule starts (YYYY-MM-DD or ISO). */
  startDate: string;
}

export function emitPrimaveraP6Xml(
  activities: CpmActivity[],
  _milestones: Milestone[],
  opts: P6EmitOptions,
): string {
  const start = opts.startDate;
  const totalDays = activities.reduce((m, a) => Math.max(m, a.earlyFinish), 0);
  const finish = addDays(start, totalDays);

  const relationships: string[] = [];
  for (const a of activities) {
    for (const predId of a.predecessors) {
      relationships.push(
        `      <Relationship>
        <PredecessorActivityId>${xmlEscape(predId)}</PredecessorActivityId>
        <SuccessorActivityId>${xmlEscape(a.id)}</SuccessorActivityId>
        <Type>Finish to Start</Type>
        <Lag>0</Lag>
      </Relationship>`,
      );
    }
  }

  const activityXml = activities.map(a => `      <Activity>
        <Id>${xmlEscape(a.id)}</Id>
        <Name>${xmlEscape(a.name)}</Name>
        <Type>${a.kind === "milestone" ? "Start Milestone" : "Task Dependent"}</Type>
        <Status>Not Started</Status>
        <PlannedStartDate>${addDays(start, a.earlyStart)}T08:00:00</PlannedStartDate>
        <PlannedFinishDate>${addDays(start, a.earlyFinish)}T17:00:00</PlannedFinishDate>
        <PlannedDuration>${a.durationDays}</PlannedDuration>
        <TotalFloat>${a.totalFloat}</TotalFloat>
        <FreeFloat>${a.freeFloat}</FreeFloat>${a.resource ? `
        <PrimaryResourceId>${xmlEscape(a.resource)}</PrimaryResourceId>` : ""}
      </Activity>`).join("\n");

  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<APIBusinessObjects xmlns="http://xmlns.oracle.com/Primavera/P6/V8/API/BusinessObjects"
                    xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">
  <Project>
    <Id>${xmlEscape(opts.projectId)}</Id>
    <Name>${xmlEscape(opts.projectName)}</Name>
    <StartDate>${start}T08:00:00</StartDate>
    <FinishDate>${finish}T17:00:00</FinishDate>
    <PlannedStartDate>${start}T08:00:00</PlannedStartDate>
    <MustFinishByDate>${finish}T17:00:00</MustFinishByDate>
    <Activities>
${activityXml}
    </Activities>
    <Relationships>
${relationships.join("\n")}
    </Relationships>
  </Project>
</APIBusinessObjects>`;
}
