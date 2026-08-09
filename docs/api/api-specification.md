# API 规格

状态：提议稿  
版本：v1  
最后更新：2026-08-09

## 1. 通用约定

- Base path：`/api/v1`；HTTPS only（本地开发除外）。
- 请求和响应使用 UTF-8 JSON；时间使用 RFC 3339 UTC，展示时区另传字段。
- 资源 ID 为不透明字符串；客户端不得解析 UUID 或 instrument ID 结构。
- access token 使用 `Authorization: Bearer <token>`；服务从 token 与路由解析 tenant context。
- 写请求接收 `X-Request-ID`；研究任务必须接收 `Idempotency-Key`。
- 列表采用 cursor pagination：`?limit=20&cursor=...`，limit 默认 20、最大 100。
- 对外字段使用 camelCase；金额与高精度数值使用十进制字符串。
- PATCH 采用显式字段 DTO；不接受任意 JSON merge 到 ORM 实体。

## 2. 标准响应

成功响应直接返回资源或资源集合：

```json
{
  "items": [],
  "page": { "nextCursor": null, "hasMore": false }
}
```

错误遵循 Problem Details 风格，不泄露堆栈或供应商秘密：

```json
{
  "type": "https://equity-atlas.local/problems/validation-error",
  "title": "请求参数无效",
  "status": 422,
  "code": "VALIDATION_ERROR",
  "detail": "一个或多个字段无效",
  "instance": "/api/v1/research-tasks",
  "requestId": "req_...",
  "errors": [{ "path": "instrumentId", "code": "REQUIRED" }]
}
```

通用状态：400 语义错误、401 未认证、403 无权限、404 在当前租户不可见、409 冲突、422 字段校验、429 限流、503 暂时不可用。对越权资源优先返回 404，减少资源枚举。

## 3. 认证与会话

| 方法和路径 | 说明 | 权限/约束 |
| --- | --- | --- |
| `POST /auth/register` | 注册并创建个人租户 | 严格 IP/email 限流 |
| `POST /auth/login` | 登录并创建 token family | 防用户名枚举 |
| `POST /auth/refresh` | 轮换 refresh token | 检测 token reuse |
| `POST /auth/logout` | 撤销当前会话 | 已认证 |
| `GET /auth/sessions` | 查看自己的会话 | 已认证 |
| `DELETE /auth/sessions/{sessionId}` | 撤销指定会话 | 只能操作本人 |
| `GET /me` | 当前用户、租户和能力 | 已认证 |

登录响应包含短期 access token、一次性返回的 refresh token、过期时间和默认 tenant；refresh token 后续可迁移为 HttpOnly Cookie，但必须同时启用 CSRF 防护。

## 4. 标的目录与行情

### `GET /instruments/search`

参数：`q`（1..80）、可选 `market`、`type`、`locale`、`limit`。返回候选及 match type、score、验证来源和时间。score 只用于排序，不作为投资评分。

### `GET /instruments/{instrumentId}`

返回 canonical/display symbol、MIC、market、type、currency、timezone、localized names、状态和 provider verification time。

### `GET /instruments/{instrumentId}/quote`

返回 provenance quote。若无新鲜数据，可以返回 200 + `quality=INSUFFICIENT` 和 limitations；完全不可用且无缓存时返回 503。不得用 0 填补缺失价格。

### `GET /instruments/{instrumentId}/bars`

参数：`interval=1d`（MVP）、`from`、`to`、`adjustment=split_dividend|none`，最大范围由套餐限制。每条 bar 包含 completion、provider、asOf；响应包含 exchange timezone 和 adjustment policy。

## 5. 观察列表

| 方法和路径 | 说明 |
| --- | --- |
| `GET /watchlists` | 当前租户列表 |
| `POST /watchlists` | 创建，body `{name, description?}` |
| `GET /watchlists/{id}` | 列表和条目 |
| `PATCH /watchlists/{id}` | 修改名称、描述、排序 |
| `DELETE /watchlists/{id}` | 可恢复软删除 |
| `POST /watchlists/{id}/items` | 添加 `{instrumentId}`，重复返回 200 或 409 的策略需固定为幂等 200 |
| `PATCH /watchlists/{id}/items/{itemId}` | 修改备注或排序 |
| `DELETE /watchlists/{id}/items/{itemId}` | 移除条目 |

所有查询将 tenant condition 注入仓储；不得先按裸 ID 查询再在应用层判断租户。

## 6. 组合与持仓

| 方法和路径 | 说明 |
| --- | --- |
| `GET/POST /portfolios` | 列出或创建手工组合 |
| `GET/PATCH/DELETE /portfolios/{id}` | 读取、修改或归档 |
| `GET /portfolios/{id}/positions` | 当前持仓 |
| `PUT /portfolios/{id}/positions/{instrumentId}` | 幂等设置数量、成本、币种、asOf |
| `DELETE /portfolios/{id}/positions/{instrumentId}` | 关闭/删除当前持仓并写事件 |

quantity、averageCost 为十进制字符串。接口不包含 broker、order、execution、credential 字段。

## 7. 投资论点

| 方法和路径 | 说明 |
| --- | --- |
| `GET/POST /investment-theses` | 查询或创建论点 |
| `GET /investment-theses/{id}` | 当前版本和历史摘要 |
| `POST /investment-theses/{id}/versions` | 创建新版本，不覆盖旧文本 |
| `GET /investment-theses/{id}/assessments` | 报告产生的论点评估 |
| `POST /investment-theses/{id}/archive` | 归档 |

创建版本需提供 thesis、expectedHoldingMonths、maximumAcceptableLossPercent 和 invalidConditions；所有长度和数值范围在 DTO 与数据库双重校验。

## 8. 研究任务

### `POST /research-tasks`

Header：`Idempotency-Key` 必填，1..128。Body：

```json
{
  "instrumentId": "jp_xtks_7203",
  "mode": "BASIC",
  "investmentThesisVersionId": null,
  "portfolioId": null,
  "analysisTime": null
}
```

普通在线研究不允许自定义过去 analysisTime；历史模式未来使用独立权限和端点。响应 `202`：

```json
{
  "id": "rt_...",
  "status": "QUEUED",
  "mode": "BASIC",
  "instrumentId": "jp_xtks_7203",
  "createdAt": "2026-08-09T07:00:00Z",
  "links": { "self": "/api/v1/research-tasks/rt_..." }
}
```

同 tenant、同 key、同 request hash 返回原任务；同 key 不同 hash 返回 409 `IDEMPOTENCY_KEY_REUSED`。超配额返回 429，不创建任务。

| 方法和路径 | 说明 |
| --- | --- |
| `GET /research-tasks` | 按 instrument、mode、status、时间筛选 |
| `GET /research-tasks/{id}` | 状态、阶段、限制和报告链接 |
| `POST /research-tasks/{id}/cancel` | 协作取消；终态幂等 |
| `POST /research-tasks/{id}/retry` | 对可重试终态创建一个引用原任务的新任务；需要新的 `Idempotency-Key`，原任务和快照保持不变 |

客户端轮询遵守 `Retry-After`；Phase 2 可增加 SSE，但数据库仍是最终状态。

## 9. 报告与快照

| 方法和路径 | 说明 |
| --- | --- |
| `GET /reports` | 当前租户报告历史 |
| `GET /reports/{id}` | 结构化报告、质量和版本元数据 |
| `GET /reports/{id}/sources` | 去重来源及字段/claim 引用 |
| `GET /reports/{id}/snapshot-summary` | 经授权、经许可过滤的快照摘要 |

默认不返回供应商原始 payload、内部 prompt、模型 chain-of-thought、密钥或敏感 portfolio 内容。报告响应包含 `schemaVersion`、`snapshotId`、`workflowVersion`、`analysisTime` 和 `dataCutoff`。

## 10. 健康、运营与管理

- `GET /health/live`：进程存活，不调用远程依赖；
- `GET /health/ready`：短超时检查数据库和必要队列连接；
- `GET /version`：构建 revision、契约版本，不泄露环境秘密；
- 管理接口置于 `/admin`，必须 ADMIN/OWNER + 细粒度 capability + 审计；
- provider 健康、模型成本和审计导出不得对普通租户开放。

## 11. 并发、缓存和条件请求

- 可变资源返回 `ETag` 或 `version`；PATCH 使用 `If-Match`，过期版本返回 412；
- quote/bars 返回 `Cache-Control`、`Age` 和 freshness 元数据；tenant 私有响应使用 `private`；
- 不缓存认证错误或跨租户 404；缓存 key 必须包含 tenant（私有数据）、locale、market 和 schema version；
- 删除、取消和添加观察条目设计为安全重试的幂等操作。

## 12. 契约治理

OpenAPI 由产品 API 构建生成并在 CI 与本规格进行 breaking-change 检查。跨服务 snapshot/report schema 以 `docs/contracts` 中的 JSON Schema 为初始权威源，发布后复制到 `packages/shared-contracts` 并生成 TypeScript/Python 类型；禁止两端手写漂移的重复 DTO。
