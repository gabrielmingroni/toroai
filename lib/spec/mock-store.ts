// In-memory spec document store. Persists across HMR via globalThis.

import type { SpecDocument } from "./types";

const g = globalThis as unknown as {
  __toroaiSpecs?: Map<string, SpecDocument>;
};
if (!g.__toroaiSpecs) g.__toroaiSpecs = new Map();
const docsByProject = g.__toroaiSpecs;

export const specStore = {
  get(projectId: string): SpecDocument | undefined {
    return docsByProject.get(projectId);
  },
  set(projectId: string, doc: SpecDocument): void {
    docsByProject.set(projectId, doc);
  },
  clear(projectId: string): void {
    docsByProject.delete(projectId);
  },
};
