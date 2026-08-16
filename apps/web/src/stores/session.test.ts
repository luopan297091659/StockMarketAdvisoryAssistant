import { createPinia, setActivePinia } from "pinia";
import { beforeEach, describe, expect, it, vi } from "vitest";

class MemoryStorage implements Storage {
  private values = new Map<string, string>();
  get length() { return this.values.size; }
  clear() { this.values.clear(); }
  getItem(key: string) { return this.values.get(key) ?? null; }
  key(index: number) { return [...this.values.keys()][index] ?? null; }
  removeItem(key: string) { this.values.delete(key); }
  setItem(key: string, value: string) { this.values.set(key, value); }
}

describe("web session storage", () => {
  beforeEach(() => {
    vi.stubGlobal("sessionStorage", new MemoryStorage());
    vi.stubGlobal("localStorage", new MemoryStorage());
    setActivePinia(createPinia());
  });

  it("never persists a refresh token in browser storage", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(JSON.stringify({ accessToken: "access", expiresIn: 900, user: { id: "u", tenantId: "t", email: "u@example.com", displayName: "User" } }), { status: 200, headers: { "content-type": "application/json" } })));
    const { useSessionStore } = await import("./session");
    const session = useSessionStore();
    await session.authenticate("login", { email: "u@example.com", password: "password" });
    expect(sessionStorage.getItem("equity-atlas-access")).toBe("access");
    expect(sessionStorage.getItem("equity-atlas-refresh")).toBeNull();
    expect(localStorage.getItem("equity-atlas-refresh")).toBeNull();
  });

  it("restores a browser session through the HttpOnly refresh cookie", async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({ accessToken: "restored", expiresIn: 900 }), { status: 200, headers: { "content-type": "application/json" } }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ user: { id: "u", tenantId: "t", email: "u@example.com", displayName: "User" } }), { status: 200, headers: { "content-type": "application/json" } }));
    vi.stubGlobal("fetch", fetchMock);
    const { useSessionStore } = await import("./session");
    const session = useSessionStore();
    expect(await session.resume()).toBe(true);
    expect(session.user?.email).toBe("u@example.com");
    expect(fetchMock.mock.calls[0]?.[1]).toMatchObject({ credentials: "include" });
  });
});
