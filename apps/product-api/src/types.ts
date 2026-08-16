export interface UserRecord {
  id: string;
  tenantId: string;
  email: string;
  displayName: string;
  passwordHash: string;
  createdAt: string;
}

export interface SessionRecord {
  id: string;
  userId: string;
  tenantId: string;
  refreshTokenHash: string;
  previousTokenHashes: string[];
  expiresAt: string;
  revokedAt: string | null;
  createdAt: string;
}

export interface WatchlistItemRecord {
  id: string;
  instrument: Record<string, unknown>;
  createdAt: string;
}

export interface WatchlistRecord {
  id: string;
  tenantId: string;
  name: string;
  description: string | null;
  items: WatchlistItemRecord[];
  createdAt: string;
  updatedAt: string;
}

export type ResearchStatus = "QUEUED" | "ANALYZING" | "SUCCEEDED" | "FAILED_FINAL";

export interface ResearchTaskRecord {
  id: string;
  tenantId: string;
  requestedBy: string;
  idempotencyKey: string;
  requestHash: string;
  instrument: Record<string, unknown>;
  mode: "BASIC";
  status: ResearchStatus;
  reportId: string | null;
  errorCode: string | null;
  errorDetail: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface ReportRecord {
  id: string;
  tenantId: string;
  taskId: string;
  instrumentId: string;
  dataMode: "SYNTHETIC_DEMO" | "REAL_MARKET_DATA";
  snapshot: Record<string, unknown>;
  report: Record<string, unknown>;
  createdAt: string;
}

export interface StoreState {
  schemaVersion: 1;
  users: UserRecord[];
  sessions: SessionRecord[];
  watchlists: WatchlistRecord[];
  researchTasks: ResearchTaskRecord[];
  reports: ReportRecord[];
}

export interface AuthClaims {
  sub: string;
  tenantId: string;
  sessionId: string;
}
