import { createHash, randomBytes, randomUUID } from "node:crypto";
import cors from "@fastify/cors";
import helmet from "@fastify/helmet";
import jwt from "@fastify/jwt";
import rateLimit from "@fastify/rate-limit";
import { Algorithm, hash as hashPassword, verify as verifyPassword } from "@node-rs/argon2";
import Fastify, { type FastifyInstance, type FastifyReply, type FastifyRequest } from "fastify";
import { z } from "zod";
import { InstrumentNormalizationError, searchInstruments, type Market } from "@equity-atlas/market-identifiers";
import type { ResearchRunner } from "./research-client.js";
import type { DataStore } from "./store.js";
import type { AuthClaims, ReportRecord, ResearchTaskRecord, SessionRecord, UserRecord, WatchlistRecord } from "./types.js";

interface AppOptions {
  store: DataStore;
  researchRunner: ResearchRunner;
  jwtSecret: string;
  webOrigin: string;
  logger?: boolean;
}

const registerSchema = z.object({
  email: z.email().max(254),
  password: z.string().min(10).max(200),
  displayName: z.string().trim().min(1).max(120),
}).strict();
const loginSchema = z.object({ email: z.email().max(254), password: z.string().min(1).max(200) }).strict();
const refreshSchema = z.object({ refreshToken: z.string().min(40).max(500) }).strict();
const watchlistSchema = z.object({ name: z.string().trim().min(1).max(120), description: z.string().trim().max(500).nullable().optional() }).strict();
const researchSchema = z.object({ instrumentId: z.string().min(1).max(96), mode: z.literal("BASIC").default("BASIC") }).strict();

class HttpProblem extends Error {
  constructor(readonly statusCode: number, readonly code: string, message: string) {
    super(message);
  }
}

const now = () => new Date().toISOString();
const sha256 = (value: string) => createHash("sha256").update(value).digest("hex");
const normalizedEmail = (value: string) => value.trim().toLocaleLowerCase("en-US");

function claims(request: FastifyRequest): AuthClaims {
  return request.user as AuthClaims;
}

export async function buildApp(options: AppOptions): Promise<FastifyInstance> {
  const app = Fastify({ logger: options.logger ?? false, trustProxy: false, bodyLimit: 128 * 1024 });
  await app.register(helmet, { contentSecurityPolicy: false });
  await app.register(cors, { origin: options.webOrigin, credentials: false });
  await app.register(rateLimit, { max: 120, timeWindow: "1 minute" });
  await app.register(jwt, { secret: options.jwtSecret });

  const authenticate = async (request: FastifyRequest): Promise<void> => {
    try {
      await request.jwtVerify<AuthClaims>();
    } catch {
      throw new HttpProblem(401, "UNAUTHENTICATED", "请先登录或重新登录");
    }
    const token = claims(request);
    const state = await options.store.read();
    const session = state.sessions.find((item) => item.id === token.sessionId && item.userId === token.sub && item.tenantId === token.tenantId);
    if (!session || session.revokedAt || new Date(session.expiresAt) <= new Date()) {
      throw new HttpProblem(401, "SESSION_INVALID", "会话已失效");
    }
  };

  const publicUser = (user: UserRecord) => ({ id: user.id, tenantId: user.tenantId, email: user.email, displayName: user.displayName, createdAt: user.createdAt });

  const issueSession = async (user: UserRecord): Promise<{ accessToken: string; refreshToken: string; expiresIn: number }> => {
    const refreshToken = randomBytes(48).toString("base64url");
    const session: SessionRecord = {
      id: randomUUID(), userId: user.id, tenantId: user.tenantId, refreshTokenHash: sha256(refreshToken), previousTokenHashes: [],
      expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(), revokedAt: null, createdAt: now(),
    };
    await options.store.transaction((state) => { state.sessions.push(session); });
    return { accessToken: app.jwt.sign({ tenantId: user.tenantId, sessionId: session.id }, { sub: user.id, expiresIn: "15m" }), refreshToken, expiresIn: 900 };
  };

  const processTask = async (taskId: string): Promise<void> => {
    let instrument: Record<string, unknown> | undefined;
    await options.store.transaction((state) => {
      const task = state.researchTasks.find((item) => item.id === taskId);
      if (!task || task.status !== "QUEUED") return;
      task.status = "ANALYZING";
      task.updatedAt = now();
      instrument = structuredClone(task.instrument);
    });
    if (!instrument) return;
    try {
      const result = await options.researchRunner(taskId, instrument);
      await options.store.transaction((state) => {
        const task = state.researchTasks.find((item) => item.id === taskId);
        if (!task || task.status !== "ANALYZING") return;
        const reportPayloadId = String(result.report.reportId ?? randomUUID());
        const report: ReportRecord = {
          id: reportPayloadId, tenantId: task.tenantId, taskId: task.id, instrumentId: String(task.instrument.instrumentId),
          dataMode: result.dataMode, snapshot: result.snapshot, report: result.report, createdAt: now(),
        };
        state.reports.push(report);
        task.reportId = report.id;
        task.status = "SUCCEEDED";
        task.updatedAt = now();
      });
    } catch (error) {
      app.log.error({ err: error, taskId }, "research task failed");
      await options.store.transaction((state) => {
        const task = state.researchTasks.find((item) => item.id === taskId);
        if (!task) return;
        task.status = "FAILED_FINAL";
        task.errorCode = "RESEARCH_ENGINE_ERROR";
        task.errorDetail = "研究引擎暂时不可用，请确认服务已启动后重试。";
        task.updatedAt = now();
      });
    }
  };

  app.setErrorHandler((error, request, reply) => {
    if (error instanceof HttpProblem) {
      return reply.code(error.statusCode).send({ code: error.code, message: error.message, requestId: request.id });
    }
    if (error instanceof z.ZodError) {
      return reply.code(422).send({ code: "VALIDATION_ERROR", message: "请求字段无效", errors: error.issues.map((issue) => ({ path: issue.path.join("."), message: issue.message })), requestId: request.id });
    }
    if ((error as { statusCode?: number }).statusCode === 429) {
      return reply.code(429).send({ code: "RATE_LIMITED", message: "请求过于频繁", requestId: request.id });
    }
    request.log.error({ err: error }, "unhandled request error");
    return reply.code(500).send({ code: "INTERNAL_ERROR", message: "服务发生内部错误", requestId: request.id });
  });

  app.get("/health/live", async () => ({ status: "ok" }));
  app.get("/health/ready", async () => { await options.store.read(); return { status: "ready", persistence: "local-demo" }; });

  app.post("/api/v1/auth/register", { config: { rateLimit: { max: 10, timeWindow: "1 minute" } } }, async (request, reply) => {
    const body = registerSchema.parse(request.body);
    const email = normalizedEmail(body.email);
    const created = now();
    const user: UserRecord = {
      id: randomUUID(), tenantId: randomUUID(), email, displayName: body.displayName,
      passwordHash: await hashPassword(body.password, { algorithm: Algorithm.Argon2id, memoryCost: 19_456, timeCost: 2, parallelism: 1 }), createdAt: created,
    };
    await options.store.transaction((state) => {
      if (state.users.some((item) => item.email === email)) throw new HttpProblem(409, "EMAIL_EXISTS", "该邮箱已注册");
      state.users.push(user);
      const watchlist: WatchlistRecord = { id: randomUUID(), tenantId: user.tenantId, name: "默认观察列表", description: null, items: [], createdAt: created, updatedAt: created };
      state.watchlists.push(watchlist);
    });
    const tokens = await issueSession(user);
    return reply.code(201).send({ user: publicUser(user), ...tokens });
  });

  app.post("/api/v1/auth/login", { config: { rateLimit: { max: 20, timeWindow: "1 minute" } } }, async (request, reply) => {
    const body = loginSchema.parse(request.body);
    const state = await options.store.read();
    const user = state.users.find((item) => item.email === normalizedEmail(body.email));
    if (!user || !(await verifyPassword(user.passwordHash, body.password))) throw new HttpProblem(401, "INVALID_CREDENTIALS", "邮箱或密码错误");
    return reply.send({ user: publicUser(user), ...(await issueSession(user)) });
  });

  app.post("/api/v1/auth/refresh", async (request, reply) => {
    const body = refreshSchema.parse(request.body);
    const tokenHash = sha256(body.refreshToken);
    const state = await options.store.read();
    const reused = state.sessions.find((item) => item.previousTokenHashes.includes(tokenHash));
    if (reused) {
      await options.store.transaction((draft) => { const session = draft.sessions.find((item) => item.id === reused.id); if (session) session.revokedAt = now(); });
      throw new HttpProblem(401, "REFRESH_TOKEN_REUSED", "检测到已轮换令牌被重复使用，会话已撤销");
    }
    const session = state.sessions.find((item) => item.refreshTokenHash === tokenHash && !item.revokedAt);
    if (!session || new Date(session.expiresAt) <= new Date()) throw new HttpProblem(401, "INVALID_REFRESH_TOKEN", "刷新令牌无效");
    const user = state.users.find((item) => item.id === session.userId);
    if (!user) throw new HttpProblem(401, "INVALID_REFRESH_TOKEN", "刷新令牌无效");
    const nextRefreshToken = randomBytes(48).toString("base64url");
    await options.store.transaction((draft) => {
      const current = draft.sessions.find((item) => item.id === session.id);
      if (!current || current.refreshTokenHash !== tokenHash || current.revokedAt) throw new HttpProblem(409, "SESSION_CHANGED", "会话已发生变化");
      current.previousTokenHashes.push(current.refreshTokenHash);
      current.previousTokenHashes = current.previousTokenHashes.slice(-5);
      current.refreshTokenHash = sha256(nextRefreshToken);
    });
    return reply.send({ accessToken: app.jwt.sign({ tenantId: user.tenantId, sessionId: session.id }, { sub: user.id, expiresIn: "15m" }), refreshToken: nextRefreshToken, expiresIn: 900 });
  });

  app.get("/api/v1/me", { preHandler: authenticate }, async (request) => {
    const state = await options.store.read();
    const user = state.users.find((item) => item.id === claims(request).sub);
    if (!user) throw new HttpProblem(404, "USER_NOT_FOUND", "用户不存在");
    return { user: publicUser(user), capabilities: ["WATCHLIST_WRITE", "BASIC_RESEARCH"] };
  });

  app.get("/api/v1/instruments/search", { preHandler: authenticate }, async (request) => {
    const query = z.object({ q: z.string().trim().min(1).max(80), market: z.enum(["CN", "HK", "US", "JP", "GLOBAL"]).optional() }).parse(request.query);
    try {
      return { items: searchInstruments(query.q, query.market as Market | undefined), dataMode: "REFERENCE_CATALOG" };
    } catch (error) {
      if (error instanceof InstrumentNormalizationError) return { items: [], dataMode: "REFERENCE_CATALOG" };
      throw error;
    }
  });

  app.get("/api/v1/watchlists", { preHandler: authenticate }, async (request) => {
    const state = await options.store.read();
    return { items: state.watchlists.filter((item) => item.tenantId === claims(request).tenantId) };
  });

  app.post("/api/v1/watchlists", { preHandler: authenticate }, async (request, reply) => {
    const body = watchlistSchema.parse(request.body);
    const timestamp = now();
    const record: WatchlistRecord = { id: randomUUID(), tenantId: claims(request).tenantId, name: body.name, description: body.description ?? null, items: [], createdAt: timestamp, updatedAt: timestamp };
    await options.store.transaction((state) => { state.watchlists.push(record); });
    return reply.code(201).send(record);
  });

  app.post("/api/v1/watchlists/:id/items", { preHandler: authenticate }, async (request) => {
    const params = z.object({ id: z.string().uuid() }).parse(request.params);
    const body = z.object({ instrument: z.record(z.string(), z.unknown()) }).strict().parse(request.body);
    const instrumentId = String(body.instrument.instrumentId ?? "");
    if (!instrumentId) throw new HttpProblem(422, "INVALID_INSTRUMENT", "缺少 instrumentId");
    return options.store.transaction((state) => {
      const watchlist = state.watchlists.find((item) => item.id === params.id && item.tenantId === claims(request).tenantId);
      if (!watchlist) throw new HttpProblem(404, "WATCHLIST_NOT_FOUND", "观察列表不存在");
      const existing = watchlist.items.find((item) => item.instrument.instrumentId === instrumentId);
      if (existing) return existing;
      const item = { id: randomUUID(), instrument: body.instrument, createdAt: now() };
      watchlist.items.push(item);
      watchlist.updatedAt = now();
      return item;
    });
  });

  app.delete("/api/v1/watchlists/:id/items/:itemId", { preHandler: authenticate }, async (request, reply) => {
    const params = z.object({ id: z.string().uuid(), itemId: z.string().uuid() }).parse(request.params);
    await options.store.transaction((state) => {
      const watchlist = state.watchlists.find((item) => item.id === params.id && item.tenantId === claims(request).tenantId);
      if (!watchlist) throw new HttpProblem(404, "WATCHLIST_NOT_FOUND", "观察列表不存在");
      watchlist.items = watchlist.items.filter((item) => item.id !== params.itemId);
      watchlist.updatedAt = now();
    });
    return reply.code(204).send();
  });

  app.post("/api/v1/research-tasks", { preHandler: authenticate, config: { rateLimit: { max: 20, timeWindow: "1 minute" } } }, async (request, reply) => {
    const body = researchSchema.parse(request.body);
    const idempotencyKey = z.string().min(1).max(128).parse(request.headers["idempotency-key"]);
    const state = await options.store.read();
    const instrument = state.watchlists.flatMap((item) => item.tenantId === claims(request).tenantId ? item.items : []).find((item) => item.instrument.instrumentId === body.instrumentId)?.instrument;
    if (!instrument) throw new HttpProblem(404, "INSTRUMENT_NOT_IN_WATCHLIST", "请先将标的加入观察列表");
    const requestHash = sha256(JSON.stringify({ instrumentId: body.instrumentId, mode: body.mode }));
    const existing = state.researchTasks.find((item) => item.tenantId === claims(request).tenantId && item.idempotencyKey === idempotencyKey);
    if (existing) {
      if (existing.requestHash !== requestHash) throw new HttpProblem(409, "IDEMPOTENCY_KEY_REUSED", "幂等键已用于不同请求");
      return reply.code(200).send(existing);
    }
    const timestamp = now();
    const task: ResearchTaskRecord = { id: randomUUID(), tenantId: claims(request).tenantId, requestedBy: claims(request).sub, idempotencyKey, requestHash, instrument, mode: "BASIC", status: "QUEUED", reportId: null, errorCode: null, errorDetail: null, createdAt: timestamp, updatedAt: timestamp };
    await options.store.transaction((draft) => {
      if (draft.researchTasks.some((item) => item.tenantId === task.tenantId && item.idempotencyKey === idempotencyKey)) throw new HttpProblem(409, "IDEMPOTENCY_RACE", "相同任务正在创建");
      draft.researchTasks.push(task);
    });
    setImmediate(() => { void processTask(task.id); });
    return reply.code(202).send(task);
  });

  app.get("/api/v1/research-tasks", { preHandler: authenticate }, async (request) => {
    const state = await options.store.read();
    return { items: state.researchTasks.filter((item) => item.tenantId === claims(request).tenantId).sort((a, b) => b.createdAt.localeCompare(a.createdAt)) };
  });

  app.get("/api/v1/research-tasks/:id", { preHandler: authenticate }, async (request) => {
    const params = z.object({ id: z.string().uuid() }).parse(request.params);
    const state = await options.store.read();
    const task = state.researchTasks.find((item) => item.id === params.id && item.tenantId === claims(request).tenantId);
    if (!task) throw new HttpProblem(404, "TASK_NOT_FOUND", "研究任务不存在");
    return task;
  });

  app.get("/api/v1/reports", { preHandler: authenticate }, async (request) => {
    const state = await options.store.read();
    return { items: state.reports.filter((item) => item.tenantId === claims(request).tenantId).map(({ snapshot: _snapshot, ...item }) => item).sort((a, b) => b.createdAt.localeCompare(a.createdAt)) };
  });

  app.get("/api/v1/reports/:id", { preHandler: authenticate }, async (request) => {
    const params = z.object({ id: z.string().min(1).max(128) }).parse(request.params);
    const state = await options.store.read();
    const report = state.reports.find((item) => item.id === params.id && item.tenantId === claims(request).tenantId);
    if (!report) throw new HttpProblem(404, "REPORT_NOT_FOUND", "研究报告不存在");
    return report;
  });

  return app;
}

