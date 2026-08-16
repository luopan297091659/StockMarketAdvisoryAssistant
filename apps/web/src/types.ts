export interface Instrument {
  instrumentId: string;
  canonicalSymbol: string;
  displaySymbol: string;
  mic: string;
  market: string;
  instrumentType: string;
  currency: string;
  timezone: string;
  names: Record<string, string>;
}

export interface WatchlistItem { id: string; instrument: Instrument; createdAt: string }
export interface Watchlist { id: string; name: string; description: string | null; items: WatchlistItem[] }
export interface ResearchTask { id: string; status: "QUEUED" | "ANALYZING" | "SUCCEEDED" | "FAILED_FINAL"; reportId: string | null; errorDetail: string | null; instrument: Instrument; createdAt: string }

export interface ReportRecord {
  id: string;
  dataMode: "SYNTHETIC_DEMO" | "REAL_MARKET_DATA";
  snapshot: {
    snapshotId: string;
    historicalBars: Array<{ endTime: string; close: string }>;
    dataQuality: { score: number; level: string; limitations: string[] };
  };
  report: {
    reportId: string;
    symbol: string;
    market: string;
    rating: string;
    confidence: number;
    trend: string;
    summary: { text: string };
    scores: Record<string, number | null>;
    keyRisks: Array<{ text: string }>;
    bullCase: Array<{ text: string }>;
    bearCase: Array<{ text: string }>;
    supportLevels: Array<{ value: string; currency: string; basis: string }>;
    resistanceLevels: Array<{ value: string; currency: string; basis: string }>;
    dataQuality: { score: number; level: string; limitations: string[] };
    disclaimer: string;
    analysisTime: string;
  };
  createdAt: string;
}
