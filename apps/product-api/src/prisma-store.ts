import { Prisma, PrismaClient } from "@prisma/client";
import type { AuditEvent, DataStore } from "./store.js";
import type { ReportRecord, ResearchStatus, StoreState, WatchlistRecord } from "./types.js";

const asJson = (value: unknown) => value as Prisma.InputJsonValue;
const iso = (value: Date | null) => value?.toISOString() ?? null;

function parseLegacy(value: Prisma.JsonValue): StoreState {
  const state = value as unknown as StoreState;
  if (state.schemaVersion !== 1 || !Array.isArray(state.users) || !Array.isArray(state.reports)) throw new Error("Unsupported PostgreSQL store schema");
  return structuredClone(state);
}

async function readState(db: Prisma.TransactionClient | PrismaClient): Promise<StoreState> {
  const [users, sessions, watchlists, items, tasks, reports] = await Promise.all([
    db.user.findMany(), db.session.findMany(), db.watchlist.findMany(), db.watchlistItem.findMany(), db.researchTask.findMany(), db.report.findMany(),
  ]);
  const itemsByWatchlist = new Map<string, WatchlistRecord["items"]>();
  for (const item of items) {
    const list = itemsByWatchlist.get(item.watchlistId) ?? [];
    list.push({ id: item.id, instrument: item.instrument as Record<string, unknown>, createdAt: item.createdAt.toISOString() });
    itemsByWatchlist.set(item.watchlistId, list);
  }
  return {
    schemaVersion: 1,
    users: users.map((item) => ({ id: item.id, tenantId: item.tenantId, email: item.email, displayName: item.displayName, passwordHash: item.passwordHash, createdAt: item.createdAt.toISOString() })),
    sessions: sessions.map((item) => ({ id: item.id, userId: item.userId, tenantId: item.tenantId, refreshTokenHash: item.refreshTokenHash, previousTokenHashes: item.previousTokenHashes as string[], expiresAt: item.expiresAt.toISOString(), revokedAt: iso(item.revokedAt), createdAt: item.createdAt.toISOString() })),
    watchlists: watchlists.map((item) => ({ id: item.id, tenantId: item.tenantId, name: item.name, description: item.description, items: itemsByWatchlist.get(item.id) ?? [], createdAt: item.createdAt.toISOString(), updatedAt: item.updatedAt.toISOString() })),
    researchTasks: tasks.map((item) => ({ id: item.id, tenantId: item.tenantId, requestedBy: item.requestedBy, idempotencyKey: item.idempotencyKey, requestHash: item.requestHash, instrument: item.instrument as Record<string, unknown>, mode: item.mode as "BASIC", status: item.status as ResearchStatus, reportId: item.reportId, errorCode: item.errorCode, errorDetail: item.errorDetail, createdAt: item.createdAt.toISOString(), updatedAt: item.updatedAt.toISOString() })),
    reports: reports.map((item) => ({ id: item.id, tenantId: item.tenantId, taskId: item.taskId, instrumentId: item.instrumentId, dataMode: item.dataMode as ReportRecord["dataMode"], snapshot: item.snapshot as Record<string, unknown>, report: item.report as Record<string, unknown>, createdAt: item.createdAt.toISOString() })),
  };
}

async function syncState(db: Prisma.TransactionClient, state: StoreState): Promise<void> {
  for (const user of state.users) await db.user.upsert({ where: { id: user.id }, create: { ...user, createdAt: new Date(user.createdAt) }, update: { tenantId: user.tenantId, email: user.email, displayName: user.displayName, passwordHash: user.passwordHash } });
  for (const session of state.sessions) await db.session.upsert({ where: { id: session.id }, create: { ...session, previousTokenHashes: asJson(session.previousTokenHashes), expiresAt: new Date(session.expiresAt), revokedAt: session.revokedAt ? new Date(session.revokedAt) : null, createdAt: new Date(session.createdAt) }, update: { refreshTokenHash: session.refreshTokenHash, previousTokenHashes: asJson(session.previousTokenHashes), expiresAt: new Date(session.expiresAt), revokedAt: session.revokedAt ? new Date(session.revokedAt) : null } });
  for (const watchlist of state.watchlists) await db.watchlist.upsert({ where: { id: watchlist.id }, create: { id: watchlist.id, tenantId: watchlist.tenantId, name: watchlist.name, description: watchlist.description, createdAt: new Date(watchlist.createdAt), updatedAt: new Date(watchlist.updatedAt) }, update: { name: watchlist.name, description: watchlist.description, updatedAt: new Date(watchlist.updatedAt) } });
  for (const watchlist of state.watchlists) for (const item of watchlist.items) await db.watchlistItem.upsert({ where: { id: item.id }, create: { id: item.id, watchlistId: watchlist.id, tenantId: watchlist.tenantId, instrumentId: String(item.instrument.instrumentId), instrument: asJson(item.instrument), createdAt: new Date(item.createdAt) }, update: { instrument: asJson(item.instrument) } });
  for (const task of state.researchTasks) await db.researchTask.upsert({ where: { id: task.id }, create: { ...task, instrument: asJson(task.instrument), createdAt: new Date(task.createdAt), updatedAt: new Date(task.updatedAt) }, update: { status: task.status, reportId: task.reportId, errorCode: task.errorCode, errorDetail: task.errorDetail, updatedAt: new Date(task.updatedAt) } });
  for (const report of state.reports) await db.report.upsert({ where: { id: report.id }, create: { ...report, snapshot: asJson(report.snapshot), report: asJson(report.report), createdAt: new Date(report.createdAt) }, update: { snapshot: asJson(report.snapshot), report: asJson(report.report), dataMode: report.dataMode } });

  await db.report.deleteMany({ where: { id: { notIn: state.reports.map((item) => item.id) } } });
  await db.researchTask.deleteMany({ where: { id: { notIn: state.researchTasks.map((item) => item.id) } } });
  await db.watchlistItem.deleteMany({ where: { id: { notIn: state.watchlists.flatMap((item) => item.items.map((entry) => entry.id)) } } });
  await db.watchlist.deleteMany({ where: { id: { notIn: state.watchlists.map((item) => item.id) } } });
  await db.session.deleteMany({ where: { id: { notIn: state.sessions.map((item) => item.id) } } });
  await db.user.deleteMany({ where: { id: { notIn: state.users.map((item) => item.id) } } });
}

export class PrismaStore implements DataStore {
  readonly client: PrismaClient;
  #initialized = false;

  constructor(client = new PrismaClient()) { this.client = client; }

  async initialize(): Promise<void> {
    if (this.#initialized) return;
    if (await this.client.user.count() === 0) {
      const legacy = await this.client.appState.findUnique({ where: { id: 1 } });
      if (legacy) {
        const state = parseLegacy(legacy.payload);
        if (state.users.length > 0) await this.client.$transaction(async (transaction) => { await transaction.$executeRaw`SELECT pg_advisory_xact_lock(8675309)`; await syncState(transaction, state); });
      }
    }
    this.#initialized = true;
  }

  async read(): Promise<StoreState> { await this.initialize(); return readState(this.client); }

  async transaction<T>(mutator: (draft: StoreState) => T | Promise<T>): Promise<T> {
    await this.initialize();
    return this.client.$transaction(async (transaction) => {
      await transaction.$executeRaw`SELECT pg_advisory_xact_lock(8675309)`;
      const draft = await readState(transaction);
      const result = await mutator(draft);
      await syncState(transaction, draft);
      return result;
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable, maxWait: 5_000, timeout: 30_000 });
  }

  async close(): Promise<void> { await this.client.$disconnect(); }

  async appendAudit(event: AuditEvent): Promise<void> {
    await this.client.auditLog.create({ data: { ...event, createdAt: new Date(event.createdAt) } });
  }
}
