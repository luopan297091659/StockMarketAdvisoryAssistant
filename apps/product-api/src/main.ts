import { buildApp } from "./app.js";
import { PrismaStore } from "./prisma-store.js";
import { createResearchClient } from "./research-client.js";
import { JsonFileStore } from "./store.js";

const host = process.env.API_HOST ?? "127.0.0.1";
const port = Number(process.env.API_PORT ?? 8000);
const jwtSecret = process.env.JWT_SECRET ?? "development-only-change-this-secret-32chars";
if (process.env.NODE_ENV === "production" && jwtSecret.includes("development-only")) {
  throw new Error("JWT_SECRET must be configured in production");
}

const store = process.env.DATABASE_URL ? new PrismaStore() : new JsonFileStore(process.env.DATA_STORE_PATH ?? ".data/demo-store.json");
const app = await buildApp({
  store,
  researchRunner: createResearchClient(process.env.RESEARCH_ENGINE_URL ?? "http://127.0.0.1:8001", Number(process.env.RESEARCH_ENGINE_TIMEOUT_MS ?? 15_000)),
  jwtSecret,
  webOrigin: process.env.WEB_ORIGIN ?? "http://127.0.0.1:5173",
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
