import type { ResultsBundle } from "./types";

export interface ResultsResponse {
  ok: boolean;
  results?: ResultsBundle;
  error?: { code: string; message: string };
}

export const resultsClient = {
  get: async (projectId: string): Promise<ResultsResponse> => {
    const res = await fetch(`/api/projects/${projectId}/results`, { credentials: "include" });
    return res.json();
  },
};
