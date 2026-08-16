import { defineStore } from "pinia";

export const apiBase = import.meta.env.VITE_API_BASE_URL ?? "/api/v1";

interface AuthResponse {
  accessToken: string;
  refreshToken?: string;
  expiresIn: number;
  user: { id: string; tenantId: string; email: string; displayName: string };
}

export class ApiError extends Error {
  constructor(readonly status: number, readonly code: string, message: string) { super(message); }
}

function storedUser(): AuthResponse["user"] | null {
  try { return JSON.parse(sessionStorage.getItem("equity-atlas-user") ?? "null") as AuthResponse["user"] | null; }
  catch { return null; }
}

export const useSessionStore = defineStore("session", {
  state: () => ({
    accessToken: sessionStorage.getItem("equity-atlas-access") ?? "",
    user: storedUser(),
  }),
  getters: { isAuthenticated: (state) => Boolean(state.accessToken) },
  actions: {
    persist() {
      sessionStorage.setItem("equity-atlas-access", this.accessToken);
      sessionStorage.setItem("equity-atlas-user", JSON.stringify(this.user));
    },
    clear() {
      this.accessToken = ""; this.user = null;
      sessionStorage.removeItem("equity-atlas-access"); sessionStorage.removeItem("equity-atlas-user");
      localStorage.removeItem("equity-atlas-access"); localStorage.removeItem("equity-atlas-refresh"); localStorage.removeItem("equity-atlas-user");
    },
    async logout() {
      try { await fetch(`${apiBase}/auth/logout`, { method: "POST", credentials: "include" }); } finally { this.clear(); }
    },
    async authenticate(mode: "login" | "register", body: Record<string, string>) {
      const response = await fetch(`${apiBase}/auth/${mode}`, { method: "POST", credentials: "include", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
      const payload = await response.json();
      if (!response.ok) throw new ApiError(response.status, payload.code ?? "AUTH_ERROR", payload.message ?? "认证失败");
      const auth = payload as AuthResponse;
      this.accessToken = auth.accessToken; this.user = auth.user; this.persist();
    },
    async refresh(): Promise<boolean> {
      const response = await fetch(`${apiBase}/auth/refresh`, { method: "POST", credentials: "include", headers: { "content-type": "application/json" }, body: "{}" });
      if (!response.ok) { this.clear(); return false; }
      const payload = await response.json();
      this.accessToken = payload.accessToken; this.persist(); return true;
    },
    async resume(): Promise<boolean> {
      if (this.accessToken && this.user) return true;
      if (!await this.refresh()) return false;
      try {
        const payload = await this.api<{ user: AuthResponse["user"] }>("/me", {}, false);
        this.user = payload.user; this.persist(); return true;
      } catch { this.clear(); return false; }
    },
    async api<T>(path: string, init: RequestInit = {}, retry = true): Promise<T> {
      const headers = new Headers(init.headers);
      headers.set("authorization", `Bearer ${this.accessToken}`);
      if (init.body && !headers.has("content-type")) headers.set("content-type", "application/json");
      const response = await fetch(`${apiBase}${path}`, { ...init, credentials: "include", headers });
      if (response.status === 401 && retry && await this.refresh()) return this.api<T>(path, init, false);
      if (response.status === 204) return undefined as T;
      const payload = await response.json();
      if (!response.ok) throw new ApiError(response.status, payload.code ?? "API_ERROR", payload.message ?? "请求失败");
      return payload as T;
    },
  },
});
