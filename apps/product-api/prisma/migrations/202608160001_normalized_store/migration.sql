CREATE TABLE "users" (
  "id" UUID PRIMARY KEY,
  "tenant_id" UUID NOT NULL,
  "email" TEXT NOT NULL UNIQUE,
  "display_name" TEXT NOT NULL,
  "password_hash" TEXT NOT NULL,
  "created_at" TIMESTAMPTZ(6) NOT NULL
);
CREATE INDEX "users_tenant_id_idx" ON "users"("tenant_id");
ALTER TABLE "users" ADD CONSTRAINT "users_id_tenant_id_key" UNIQUE ("id", "tenant_id");

CREATE TABLE "sessions" (
  "id" UUID PRIMARY KEY,
  "user_id" UUID NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "tenant_id" UUID NOT NULL,
  "refresh_token_hash" TEXT NOT NULL UNIQUE,
  "previous_token_hashes" JSONB NOT NULL DEFAULT '[]'::jsonb,
  "expires_at" TIMESTAMPTZ(6) NOT NULL,
  "revoked_at" TIMESTAMPTZ(6),
  "created_at" TIMESTAMPTZ(6) NOT NULL
);
CREATE INDEX "sessions_user_id_tenant_id_idx" ON "sessions"("user_id", "tenant_id");
ALTER TABLE "sessions" DROP CONSTRAINT "sessions_user_id_fkey";
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_user_id_tenant_id_fkey" FOREIGN KEY ("user_id", "tenant_id") REFERENCES "users"("id", "tenant_id") ON DELETE CASCADE;

CREATE TABLE "watchlists" (
  "id" UUID PRIMARY KEY,
  "tenant_id" UUID NOT NULL,
  "name" TEXT NOT NULL,
  "description" TEXT,
  "created_at" TIMESTAMPTZ(6) NOT NULL,
  "updated_at" TIMESTAMPTZ(6) NOT NULL
);
CREATE INDEX "watchlists_tenant_id_idx" ON "watchlists"("tenant_id");
ALTER TABLE "watchlists" ADD CONSTRAINT "watchlists_id_tenant_id_key" UNIQUE ("id", "tenant_id");

CREATE TABLE "watchlist_items" (
  "id" UUID PRIMARY KEY,
  "watchlist_id" UUID NOT NULL REFERENCES "watchlists"("id") ON DELETE CASCADE,
  "tenant_id" UUID NOT NULL,
  "instrument_id" TEXT NOT NULL,
  "instrument" JSONB NOT NULL,
  "created_at" TIMESTAMPTZ(6) NOT NULL,
  CONSTRAINT "watchlist_items_watchlist_id_instrument_id_key" UNIQUE ("watchlist_id", "instrument_id")
);
CREATE INDEX "watchlist_items_tenant_id_idx" ON "watchlist_items"("tenant_id");
ALTER TABLE "watchlist_items" DROP CONSTRAINT "watchlist_items_watchlist_id_fkey";
ALTER TABLE "watchlist_items" ADD CONSTRAINT "watchlist_items_watchlist_id_tenant_id_fkey" FOREIGN KEY ("watchlist_id", "tenant_id") REFERENCES "watchlists"("id", "tenant_id") ON DELETE CASCADE;

CREATE TABLE "research_tasks" (
  "id" UUID PRIMARY KEY,
  "tenant_id" UUID NOT NULL,
  "requested_by" UUID NOT NULL REFERENCES "users"("id") ON DELETE RESTRICT,
  "idempotency_key" TEXT NOT NULL,
  "request_hash" TEXT NOT NULL,
  "instrument" JSONB NOT NULL,
  "mode" TEXT NOT NULL CHECK ("mode" = 'BASIC'),
  "status" TEXT NOT NULL CHECK ("status" IN ('QUEUED','ANALYZING','SUCCEEDED','FAILED_FINAL')),
  "report_id" TEXT,
  "error_code" TEXT,
  "error_detail" TEXT,
  "created_at" TIMESTAMPTZ(6) NOT NULL,
  "updated_at" TIMESTAMPTZ(6) NOT NULL,
  CONSTRAINT "research_tasks_tenant_id_idempotency_key_key" UNIQUE ("tenant_id", "idempotency_key")
);
CREATE INDEX "research_tasks_tenant_id_created_at_idx" ON "research_tasks"("tenant_id", "created_at");
ALTER TABLE "research_tasks" ADD CONSTRAINT "research_tasks_id_tenant_id_key" UNIQUE ("id", "tenant_id");
ALTER TABLE "research_tasks" DROP CONSTRAINT "research_tasks_requested_by_fkey";
ALTER TABLE "research_tasks" ADD CONSTRAINT "research_tasks_requested_by_tenant_id_fkey" FOREIGN KEY ("requested_by", "tenant_id") REFERENCES "users"("id", "tenant_id") ON DELETE RESTRICT;

CREATE TABLE "reports" (
  "id" TEXT PRIMARY KEY,
  "tenant_id" UUID NOT NULL,
  "task_id" UUID NOT NULL UNIQUE REFERENCES "research_tasks"("id") ON DELETE CASCADE,
  "instrument_id" TEXT NOT NULL,
  "data_mode" TEXT NOT NULL CHECK ("data_mode" IN ('SYNTHETIC_DEMO','REAL_MARKET_DATA')),
  "snapshot" JSONB NOT NULL,
  "report" JSONB NOT NULL,
  "created_at" TIMESTAMPTZ(6) NOT NULL
);
CREATE INDEX "reports_tenant_id_created_at_idx" ON "reports"("tenant_id", "created_at");
ALTER TABLE "reports" ADD CONSTRAINT "reports_task_id_tenant_id_key" UNIQUE ("task_id", "tenant_id");
ALTER TABLE "reports" DROP CONSTRAINT "reports_task_id_fkey";
ALTER TABLE "reports" ADD CONSTRAINT "reports_task_id_tenant_id_fkey" FOREIGN KEY ("task_id", "tenant_id") REFERENCES "research_tasks"("id", "tenant_id") ON DELETE CASCADE;

CREATE TABLE "audit_logs" (
  "id" UUID PRIMARY KEY,
  "tenant_id" UUID,
  "actor_id" UUID,
  "action" TEXT NOT NULL,
  "outcome" TEXT NOT NULL,
  "resource_type" TEXT,
  "resource_id" TEXT,
  "request_id" TEXT NOT NULL,
  "ip_hash" TEXT,
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX "audit_logs_tenant_id_created_at_idx" ON "audit_logs"("tenant_id", "created_at");
