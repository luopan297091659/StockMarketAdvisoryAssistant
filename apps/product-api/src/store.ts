import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import type { StoreState } from "./types.js";

const emptyState = (): StoreState => ({
  schemaVersion: 1,
  users: [],
  sessions: [],
  watchlists: [],
  researchTasks: [],
  reports: [],
});

export interface DataStore {
  read(): Promise<StoreState>;
  transaction<T>(mutator: (draft: StoreState) => T | Promise<T>): Promise<T>;
  appendAudit?(event: AuditEvent): Promise<void>;
  close?(): Promise<void>;
}

export interface AuditEvent {
  id: string;
  tenantId: string | null;
  actorId: string | null;
  action: string;
  outcome: "SUCCESS" | "DENIED" | "FAILURE";
  resourceType: string | null;
  resourceId: string | null;
  requestId: string;
  ipHash: string | null;
  createdAt: string;
}

export class JsonFileStore implements DataStore {
  readonly path: string;
  #state: StoreState = emptyState();
  #initialized = false;
  #queue: Promise<void> = Promise.resolve();

  constructor(path: string) {
    this.path = resolve(path);
  }

  async initialize(): Promise<void> {
    if (this.#initialized) return;
    await mkdir(dirname(this.path), { recursive: true });
    try {
      const parsed = JSON.parse(await readFile(this.path, "utf8")) as StoreState;
      if (parsed.schemaVersion !== 1 || !Array.isArray(parsed.users)) throw new Error("Unsupported data-store schema");
      this.#state = parsed;
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
      await this.#persist(emptyState());
    }
    this.#initialized = true;
  }

  async read(): Promise<StoreState> {
    await this.initialize();
    await this.#queue;
    return structuredClone(this.#state);
  }

  async transaction<T>(mutator: (draft: StoreState) => T | Promise<T>): Promise<T> {
    await this.initialize();
    let result!: T;
    let failure: unknown;
    this.#queue = this.#queue.then(async () => {
      const draft = structuredClone(this.#state);
      try {
        result = await mutator(draft);
        await this.#persist(draft);
        this.#state = draft;
      } catch (error) {
        failure = error;
      }
    });
    await this.#queue;
    if (failure) throw failure;
    return result;
  }

  async #persist(state: StoreState): Promise<void> {
    const temporary = `${this.path}.${process.pid}.tmp`;
    await writeFile(temporary, `${JSON.stringify(state, null, 2)}\n`, { encoding: "utf8", mode: 0o600 });
    await rename(temporary, this.path);
  }
}

export class MemoryStore implements DataStore {
  #state = emptyState();
  #queue: Promise<void> = Promise.resolve();

  async read(): Promise<StoreState> {
    await this.#queue;
    return structuredClone(this.#state);
  }

  async transaction<T>(mutator: (draft: StoreState) => T | Promise<T>): Promise<T> {
    let result!: T;
    let failure: unknown;
    this.#queue = this.#queue.then(async () => {
      const draft = structuredClone(this.#state);
      try {
        result = await mutator(draft);
        this.#state = draft;
      } catch (error) {
        failure = error;
      }
    });
    await this.#queue;
    if (failure) throw failure;
    return result;
  }
}
