export interface ResearchResult {
  dataMode: "SYNTHETIC_DEMO" | "REAL_MARKET_DATA";
  snapshot: Record<string, unknown>;
  report: Record<string, unknown>;
}

export type ResearchRunner = (taskId: string, instrument: Record<string, unknown>) => Promise<ResearchResult>;

export function createResearchClient(baseUrl: string, timeoutMs: number): ResearchRunner {
  return async (taskId, instrument) => {
    const response = await fetch(`${baseUrl.replace(/\/$/, "")}/v1/research/basic`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ taskId, instrument }),
      signal: AbortSignal.timeout(timeoutMs),
    });
    if (!response.ok) {
      const detail = (await response.text()).slice(0, 500);
      throw new Error(`Research engine returned ${response.status}: ${detail}`);
    }
    return (await response.json()) as ResearchResult;
  };
}
