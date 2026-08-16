import { buildApp } from "./app.js";
import { PrismaStore } from "./prisma-store.js";
import { createResearchClient } from "./research-client.js";
import { JsonFileStore, type DataStore } from "./store.js";

const host = process.env.API_HOST ?? "127.0.0.1";
const port = Number(process.env.API_PORT ?? 8000);
const jwtSecret = process.env.JWT_SECRET ?? "development-only-change-this-secret-32chars";
if (process.env.NODE_ENV === "production" && (jwtSecret.length < 32 || jwtSecret.includes("development-only") || jwtSecret.includes("replace-with"))) {
  throw new Error("JWT_SECRET must be a non-placeholder value of at least 32 characters in production");
}
const refreshCookieMode = process.env.REFRESH_COOKIE_MODE === "true";
const registrationMode = process.env.REGISTRATION_MODE === "disabled" ? "disabled" : process.env.REGISTRATION_MODE === "invite" ? "invite" : "open";
if (process.env.NODE_ENV === "production" && process.env.PUBLIC_CUSTOMER_DEPLOYMENT === "true") {
  if (!refreshCookieMode) throw new Error("REFRESH_COOKIE_MODE=true is required for public customer deployments");
  if (process.env.COOKIE_SECURE !== "true") throw new Error("COOKIE_SECURE=true is required for public customer deployments");
  if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL is required for public customer deployments");
  if (!process.env.WEB_ORIGIN?.startsWith("https://")) throw new Error("WEB_ORIGIN must be an HTTPS origin for public customer deployments");
  if (process.env.MARKET_DATA_MODE !== "REAL_MARKET_DATA") throw new Error("MARKET_DATA_MODE=REAL_MARKET_DATA is required for public customer deployments");
  if (registrationMode === "open") throw new Error("Public registration requires email verification; use REGISTRATION_MODE=invite or disabled");
  if (registrationMode === "invite" && (process.env.REGISTRATION_INVITE_CODE?.length ?? 0) < 16) throw new Error("REGISTRATION_INVITE_CODE must contain at least 16 characters");
}

const store: DataStore = process.env.DATABASE_URL ? new PrismaStore() : new JsonFileStore(process.env.DATA_STORE_PATH ?? ".data/demo-store.json");
const app = await buildApp({
  store,
  researchRunner: createResearchClient(process.env.RESEARCH_ENGINE_URL ?? "http://127.0.0.1:8001", Number(process.env.RESEARCH_ENGINE_TIMEOUT_MS ?? 15_000)),
  jwtSecret,
  webOrigin: process.env.WEB_ORIGIN ?? "http://127.0.0.1:5173",
  refreshCookieMode,
  secureCookies: process.env.COOKIE_SECURE === "true",
  marketDataMode: process.env.MARKET_DATA_MODE === "REAL_MARKET_DATA" ? "REAL_MARKET_DATA" : "SYNTHETIC_DEMO",
  trustProxy: process.env.TRUST_PROXY === "true",
  registrationMode,
  registrationInviteCode: process.env.REGISTRATION_INVITE_CODE,
  persistenceMode: process.env.DATABASE_URL ? "postgresql" : "json-demo",
  jwtIssuer: process.env.JWT_ISSUER ?? "equity-atlas-product-api",
  jwtAudience: process.env.JWT_AUDIENCE ?? "equity-atlas-clients",
  logger: true,
});

const shutdown = async (signal: string) => {
  app.log.info({ signal }, "shutting down");
  await app.close();
  await store.close?.();
  process.exit(0);
};
process.on("SIGINT", () => { void shutdown("SIGINT"); });
process.on("SIGTERM", () => { void shutdown("SIGTERM"); });

await app.listen({ host, port });
