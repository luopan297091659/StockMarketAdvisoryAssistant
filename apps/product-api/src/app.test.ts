import { describe, expect, it } from "vitest";
import { buildApp } from "./app.js";
import { MemoryStore } from "./store.js";
import type { ResearchRunner } from "./research-client.js";

const runner: ResearchRunner = async (_taskId, instrument) => ({
  dataMode: "SYNTHETIC_DEMO",
  snapshot: { snapshotId: "snap-test", instrument, historicalBars: [] },
  report: { reportId: "report-test", snapshotId: "snap-test", instrumentId: instrument.instrumentId },
});

async function setup() {
  const app = await buildApp({ store: new MemoryStore(), researchRunner: runner, jwtSecret: "test-secret-with-at-least-thirty-two-chars", webOrigin: "http://localhost", logger: false });
  const registered = await app.inject({ method: "POST", url: "/api/v1/auth/register", payload: { email: "user@example.com", password: "correct-horse-battery", displayName: "研究者" } });
  expect(registered.statusCode).toBe(201);
  const auth = registered.json() as { accessToken: string; refreshToken: string };
  return { app, auth, headers: { authorization: `Bearer ${auth.accessToken}` } };
}

describe("product API", () => {
  it("registers, authenticates and rotates refresh tokens", async () => {
    const { app, auth, headers } = await setup();
    expect((await app.inject({ method: "GET", url: "/api/v1/me", headers })).statusCode).toBe(200);
    const refreshed = await app.inject({ method: "POST", url: "/api/v1/auth/refresh", payload: { refreshToken: auth.refreshToken } });
    expect(refreshed.statusCode).toBe(200);
    const reuse = await app.inject({ method: "POST", url: "/api/v1/auth/refresh", payload: { refreshToken: auth.refreshToken } });
    expect(reuse.statusCode).toBe(401);
    expect(reuse.json().code).toBe("REFRESH_TOKEN_REUSED");
    await app.close();
  });

  it("completes search, watchlist and research flow", async () => {
    const { app, headers } = await setup();
    const search = await app.inject({ method: "GET", url: "/api/v1/instruments/search?q=7203.T", headers });
    expect(search.statusCode).toBe(200);
    const instrument = search.json().items[0];
    const lists = await app.inject({ method: "GET", url: "/api/v1/watchlists", headers });
    const listId = lists.json().items[0].id;
    const added = await app.inject({ method: "POST", url: `/api/v1/watchlists/${listId}/items`, headers, payload: { instrument } });
    expect(added.statusCode).toBe(200);
    const task = await app.inject({ method: "POST", url: "/api/v1/research-tasks", headers: { ...headers, "idempotency-key": "task-7203" }, payload: { instrumentId: instrument.instrumentId, mode: "BASIC" } });
    expect(task.statusCode).toBe(202);
    await new Promise((resolve) => setTimeout(resolve, 25));
    const taskResult = await app.inject({ method: "GET", url: `/api/v1/research-tasks/${task.json().id}`, headers });
    expect(taskResult.json().status).toBe("SUCCEEDED");
    const report = await app.inject({ method: "GET", url: `/api/v1/reports/${taskResult.json().reportId}`, headers });
    expect(report.statusCode).toBe(200);
    expect(report.json().snapshot.snapshotId).toBe(report.json().report.snapshotId);
    await app.close();
  });

  it("isolates tenant data", async () => {
    const store = new MemoryStore();
    const app = await buildApp({ store, researchRunner: runner, jwtSecret: "test-secret-with-at-least-thirty-two-chars", webOrigin: "http://localhost", logger: false });
    const first = await app.inject({ method: "POST", url: "/api/v1/auth/register", payload: { email: "one@example.com", password: "correct-horse-one", displayName: "One" } });
    const second = await app.inject({ method: "POST", url: "/api/v1/auth/register", payload: { email: "two@example.com", password: "correct-horse-two", displayName: "Two" } });
    const firstHeaders = { authorization: `Bearer ${first.json().accessToken}` };
    const secondHeaders = { authorization: `Bearer ${second.json().accessToken}` };
    const firstLists = (await app.inject({ method: "GET", url: "/api/v1/watchlists", headers: firstHeaders })).json().items;
    const secondLists = (await app.inject({ method: "GET", url: "/api/v1/watchlists", headers: secondHeaders })).json().items;
    expect(firstLists).toHaveLength(1);
    expect(secondLists).toHaveLength(1);
    expect(firstLists[0].id).not.toBe(secondLists[0].id);
    await app.close();
  });
});
