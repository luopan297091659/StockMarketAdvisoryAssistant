import { describe, expect, it } from "vitest";
import { buildApp } from "./app.js";
import { MemoryStore } from "./store.js";
import type { ResearchRunner } from "./research-client.js";
import type { AuditEvent } from "./store.js";

const runner: ResearchRunner = async (_taskId, instrument) => ({
  dataMode: "SYNTHETIC_DEMO",
  snapshot: { snapshotId: "snap-test", instrument, historicalBars: [] },
  report: { reportId: "report-test", snapshotId: "snap-test", instrumentId: instrument.instrumentId },
});

class RecordingStore extends MemoryStore {
  events: AuditEvent[] = [];
  async appendAudit(event: AuditEvent) { this.events.push(event); }
}

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

  it("keeps refresh tokens in an HttpOnly cookie for web deployments", async () => {
    const app = await buildApp({ store: new MemoryStore(), researchRunner: runner, jwtSecret: "test-secret-with-at-least-thirty-two-chars", webOrigin: "http://localhost", refreshCookieMode: true, secureCookies: true, logger: false });
    const registered = await app.inject({ method: "POST", url: "/api/v1/auth/register", payload: { email: "cookie@example.com", password: "correct-horse-cookie", displayName: "Cookie" } });
    expect(registered.statusCode).toBe(201);
    expect(registered.json().refreshToken).toBeUndefined();
    const setCookie = registered.headers["set-cookie"] as string;
    expect(setCookie).toContain("HttpOnly");
    expect(setCookie).toContain("Secure");
    const refreshed = await app.inject({ method: "POST", url: "/api/v1/auth/refresh", headers: { cookie: setCookie.split(";", 1)[0]! }, payload: {} });
    expect(refreshed.statusCode).toBe(200);
    expect(refreshed.json().refreshToken).toBeUndefined();
    await app.close();
  });

  it("returns and revokes refresh tokens for native apps in cookie deployments", async () => {
    const app = await buildApp({ store: new MemoryStore(), researchRunner: runner, jwtSecret: "test-secret-with-at-least-thirty-two-chars", webOrigin: "http://localhost", refreshCookieMode: true, secureCookies: true, logger: false });
    const nativeHeaders = { "x-client-platform": "mobile" };
    const registered = await app.inject({ method: "POST", url: "/api/v1/auth/register", headers: nativeHeaders, payload: { email: "mobile@example.com", password: "correct-horse-mobile", displayName: "Mobile" } });
    expect(registered.statusCode).toBe(201);
    const refreshToken = registered.json().refreshToken as string;
    expect(refreshToken.length).toBeGreaterThan(40);
    expect(registered.headers["set-cookie"]).toBeUndefined();

    const refreshed = await app.inject({ method: "POST", url: "/api/v1/auth/refresh", headers: nativeHeaders, payload: { refreshToken } });
    expect(refreshed.statusCode).toBe(200);
    const rotatedToken = refreshed.json().refreshToken as string;
    expect(rotatedToken).not.toBe(refreshToken);

    expect((await app.inject({ method: "POST", url: "/api/v1/auth/logout", headers: nativeHeaders, payload: { refreshToken: rotatedToken } })).statusCode).toBe(204);
    expect((await app.inject({ method: "POST", url: "/api/v1/auth/refresh", headers: nativeHeaders, payload: { refreshToken: rotatedToken } })).statusCode).toBe(401);
    await app.close();
  });

  it("requires the configured invitation code", async () => {
    const app = await buildApp({ store: new MemoryStore(), researchRunner: runner, jwtSecret: "test-secret-with-at-least-thirty-two-chars", webOrigin: "http://localhost", registrationMode: "invite", registrationInviteCode: "customer-invite-secret", logger: false });
    const rejected = await app.inject({ method: "POST", url: "/api/v1/auth/register", payload: { email: "invite@example.com", password: "correct-horse-invite", displayName: "Invite" } });
    expect(rejected.statusCode).toBe(403);
    const accepted = await app.inject({ method: "POST", url: "/api/v1/auth/register", payload: { email: "invite@example.com", password: "correct-horse-invite", displayName: "Invite", inviteCode: "customer-invite-secret" } });
    expect(accepted.statusCode).toBe(201);
    await app.close();
  });

  it("records successful and denied authentication events without raw IP addresses", async () => {
    const store = new RecordingStore();
    const app = await buildApp({ store, researchRunner: runner, jwtSecret: "test-secret-with-at-least-thirty-two-chars", webOrigin: "http://localhost", logger: false });
    await app.inject({ method: "POST", url: "/api/v1/auth/register", payload: { email: "audit@example.com", password: "correct-horse-audit", displayName: "Audit" } });
    await app.inject({ method: "POST", url: "/api/v1/auth/login", payload: { email: "audit@example.com", password: "wrong" } });
    expect(store.events.map((event) => [event.action, event.outcome])).toContainEqual(["AUTH_REGISTER", "SUCCESS"]);
    expect(store.events.map((event) => [event.action, event.outcome])).toContainEqual(["AUTH_LOGIN", "DENIED"]);
    expect(store.events.every((event) => event.ipHash?.includes("127.0.0.1") === false)).toBe(true);
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

    const search = await app.inject({ method: "GET", url: "/api/v1/instruments/search?q=AAPL", headers: firstHeaders });
    const instrument = search.json().items[0];
    const added = await app.inject({ method: "POST", url: `/api/v1/watchlists/${firstLists[0].id}/items`, headers: firstHeaders, payload: { instrument } });
    const crossTenantAdd = await app.inject({ method: "POST", url: `/api/v1/watchlists/${firstLists[0].id}/items`, headers: secondHeaders, payload: { instrument } });
    expect(crossTenantAdd.statusCode).toBe(404);
    const crossTenantDelete = await app.inject({ method: "DELETE", url: `/api/v1/watchlists/${firstLists[0].id}/items/${added.json().id}`, headers: secondHeaders });
    expect(crossTenantDelete.statusCode).toBe(404);

    const task = await app.inject({ method: "POST", url: "/api/v1/research-tasks", headers: { ...firstHeaders, "idempotency-key": "isolated-task" }, payload: { instrumentId: instrument.instrumentId, mode: "BASIC" } });
    await new Promise((resolve) => setTimeout(resolve, 25));
    const taskResult = await app.inject({ method: "GET", url: `/api/v1/research-tasks/${task.json().id}`, headers: firstHeaders });
    const hiddenTask = await app.inject({ method: "GET", url: `/api/v1/research-tasks/${task.json().id}`, headers: secondHeaders });
    const hiddenReport = await app.inject({ method: "GET", url: `/api/v1/reports/${taskResult.json().reportId}`, headers: secondHeaders });
    expect(hiddenTask.statusCode).toBe(404);
    expect(hiddenReport.statusCode).toBe(404);
    await app.close();
  });
});
