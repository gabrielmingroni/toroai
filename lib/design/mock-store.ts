// In-memory design-parameters store. One DesignParameters object per project.
// First read for a project initializes from sector defaults.

import { projectStore } from "@/lib/projects/mock-store";
import type { Sector } from "@/lib/projects/types";
import {
  DesignParameters, SECTOR_DEFAULTS,
} from "./types";

const byProject = new Map<string, DesignParameters>();

function defaultsFor(projectId: string, sector: Sector): DesignParameters {
  const s = SECTOR_DEFAULTS[sector] ?? SECTOR_DEFAULTS.commercial_office;
  return {
    projectId,
    workareaDensity:     s.workareaDensity,
    growthFactor:        s.growthFactor,
    horizontalMedia:     "cat6a",
    backboneMedia:       sector === "data_center" ? "os2" : "om4",
    portsPerOutlet:      s.portsPerOutlet,
    outletType:          sector === "industrial_warehouse" ? "4port_surface" : "2port_flush",
    wapStandard:         "802_11ax",
    wapCoverageRadiusFt: s.wapCoverageRadiusFt,
    targetPortSpeed:     "10g",
    redundancy:          s.redundancy,
    lifecycleYears:      20,
    trayFillTarget:      0.40,
    standards: {
      bicsi:   "TDMM 15",
      tia568:  "TIA-568.1-D",
      tia569:  "TIA-569-D",
      tia607:  "TIA-607-C",
      nec:     "2023",
      poePlus: "802.3bt",
    },
    updatedAt: new Date().toISOString(),
  };
}

export const designStore = {
  get(projectId: string, userId: string): DesignParameters | undefined {
    const project = projectStore.get(projectId, userId);
    if (!project) return undefined;
    let p = byProject.get(projectId);
    if (!p) {
      p = defaultsFor(projectId, project.sector);
      byProject.set(projectId, p);
    }
    return p;
  },
  update(projectId: string, userId: string, patch: Partial<DesignParameters>): DesignParameters | undefined {
    const current = this.get(projectId, userId);
    if (!current) return undefined;
    Object.assign(current, patch, { updatedAt: new Date().toISOString() });
    return current;
  },
  reset(projectId: string, userId: string): DesignParameters | undefined {
    const project = projectStore.get(projectId, userId);
    if (!project) return undefined;
    const fresh = defaultsFor(projectId, project.sector);
    byProject.set(projectId, fresh);
    return fresh;
  },
};
