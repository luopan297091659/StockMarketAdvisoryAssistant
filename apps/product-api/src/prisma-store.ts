import { Prisma, PrismaClient } from "@prisma/client";
import type { DataStore } from "./store.js";
import type { StoreState } from "./types.js";

const initialState = (): StoreState => ({ schemaVersion: 1, users: [], sessions: [], watchlists: [], researchTasks: [], reports: [] });

function parseState(value: Prisma.JsonValue): StoreState {
  const state = value as unknown as StoreState;
  if (state.schemaVersion !== 1 || !Array.isArray(state.users) || !Array.isArray(state.reports)) throw new Error("Unsupported PostgreSQL store schema");
  return structuredClone(state);
}

export class PrismaStore implements DataStore {
  readonly client: PrismaClient;
  #initialized = false;

  constructor(client = new PrismaClient()) { this.client = client; }

  async initialize(): Promise<void> {
    if (this.#initialized) return;
    await this.client.appState.upsert({ where: { id: 1 }, update: {}, create: { id: 1, payload: initialState() as unknown as Prisma.InputJsonValue } });
    this.#initialized = true;
  }

  async read(): Promise<StoreState> {
    await this.initialize();
    const row = await this.client.appState.findUniqueOrThrow({ where: { id: 1 } });
    return parseState(row.payload);
  }

  async transaction<T>(mutator: (draft: StoreState) => T | Promise<T>): Promise<T> {
    await this.initialize();
    return this.client.$transaction(async (transaction) => {
      const rows = await transaction.$queryRaw<Array<{ payload: Prisma.JsonValue }>>`SELECT payload FROM app_state WHERE id = 1 FOR UPDATE`;
      const row = rows[0];
      if (!row) throw new Error("Application state row is missing");
      const draft = parseState(row.payload);
      const result = await mutator(draft);
      await transaction.appState.update({ where: { id: 1 }, data: { payload: draft as unknown as Prisma.InputJsonValue, version: { increment: 1 } } });
      return result;
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable, maxWait: 5_000, timeout: 15_000 });
  }

  async close(): Promise<void> { await this.client.$disconnect(); }
}

