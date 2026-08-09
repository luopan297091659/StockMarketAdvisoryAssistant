import { defineStore } from "pinia";

const apiBase = import.meta.env.VITE_API_BASE_URL ?? "http://127.0.0.1:8000/api/v1";

interface AuthResponse {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
  user: { id: string; tenantId: string; email: string; displayName: string };
}

export class ApiError extends Error {
  constructor(readonly status: number, readonly code: string, message: string) { super(message); }
}

export const useSessionStore = defineStore("session", {
  state: () => ({
    accessToken: localStorage.getItem("equity-atlas-access") ?? "",
    refreshToken: localStorage.getItem("equity-atlas-refresh") ?? "",
    user: JSON.parse(localStorage.getItem("equity-atlas-user") ?? "null") as AuthResponse["user"] | null,
  }),
  getters: { isAuthenticated: (state) => Boolean(state.accessToken) },
  actions: {
    persist() {
      localStorage.setItem("equity-atlas-access", this.accessToken);
      localStorage.setItem("equity-atlas-refresh", this.refreshToken);
      localStorage.setItem("equity-atlas-user", JSON.stringify(this.user));
    },
    clear() {
      this.accessToken = ""; this.refreshToken = ""; this.user = null;
      localStorage.removeItem("equity-atlas-access"); localStorage.removeItem("equity-atlas-refresh"); localStorage.removeItem("equity-atlas-user");
    },
    async authenticate(mode: "login" | "register", body: Record<string, string>) {
      const response = await fetch(`${apiBase}/auth/${mode}`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
      const payload = await response.json();
      if (!response.ok) throw new ApiError(response.status, payload.code ?? "AUTH_ERROR", payload.message ?? "认证失败");
      const auth = payload as AuthResponse;
      this.accessToken = auth.accessToken; this.refreshToken = auth.refreshToken; this.user = auth.user; this.persist();
    },
    async refresh(): Promise<boolean> {
      if (!this.refreshToken) return false;
      const response = await fetch(`${apiBase}/auth/refresh`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ refreshToken: this.refreshToken }) });
      if (!response.ok) { this.clear(); return false; }
      const payload = await response.json();
      this.accessToken = payload.accessToken; this.refreshToken = payload.refreshToken; this.persist(); return true;
    },
    async api<T>(path: string, init: RequestInit = {}, retry = true): Promise<T> {
      const headers = new Headers(init.headers);
      headers.set("authorization", `Bearer ${this.accessToken}`);
      if (init.body && !headers.has("content-type")) headers.set("content-type", "application/json");
      const response = await fetch(`${apiBase}${path}`, { ...init, headers });
      if (response.status === 401 && retry && await this.refresh()) return this.api<T>(path, init, false);
      if (response.status === 204) return undefined as T;
      const payload = await response.json();
      if (!response.ok) throw new ApiError(response.status, payload.code ?? "API_ERROR", payload.message ?? "请求失败");
      return payload as T;
    },
  },
});

