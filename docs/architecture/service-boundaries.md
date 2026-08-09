# 服务边界

状态：提议稿  
版本：0.1  
最后更新：2026-08-09

## 1. 边界原则

- 产品 API 是客户端唯一入口；研究引擎不直接暴露公网。
- 一个数据实体只有一个主要写入方，其他服务通过稳定契约读取或请求变更。
- TypeScript 与 Python 共享版本化 JSON Schema/OpenAPI 契约，不共享 ORM 模型。
- 跨边界调用携带 correlation ID、deadline、调用方身份和契约版本。
- 禁止直接导入另一服务内部代码或修改其私有表。

## 2. 产品 API 模块

产品 API 首期是一个部署单元，但内部模块具有明确依赖方向。

| 模块 | 主要职责 | 拥有的数据 | 不负责 |
| --- | --- | --- | --- |
| Identity | 注册、登录、token 轮换、会话撤销 | users、credentials、sessions | 订阅和研究 |
| Tenancy/RBAC | 租户、成员、角色、授权策略 | tenants、memberships、roles | 用户密码 |
| Instrument Catalog | 标的读取、搜索协调、别名展示 | 产品侧读取模型 | 实时行情抓取 |
| Watchlist | 观察列表及条目 | watchlists、watchlist_items | 持仓或交易 |
| Portfolio | 组合和手工持仓 | portfolios、positions | 券商连接与下单 |
| Thesis | 投资论点、失效条件和版本 | theses、thesis_versions | 自动修改用户原文 |
| Research Tasks | 任务创建、幂等、状态、配额预留 | research_tasks、outbox | agent 执行 |
| Reports | 授权后的报告目录和读取 | 报告 read model | 报告生成 |
| Entitlements | 套餐、配额、用量和成本归集 | plans、subscriptions、usage | 首期支付实现 |
| Notification | 通知偏好与投递状态 | notification_* | 研究结论生成 |
| Audit/Admin | 审计、治理、运营配置 | audit_logs、admin actions | 绕过租户授权 |

模块依赖领域接口。例如 Watchlist 依赖 InstrumentCatalog 查询标的，不直接查询研究引擎供应商适配器。

## 3. 研究引擎模块

| 模块 | 输入 | 输出 | 关键约束 |
| --- | --- | --- | --- |
| Identifier | 符号、市场提示、locale | 候选或 canonical instrument | 歧义显式返回 |
| Provider Registry | capability、market、policy | provider plan | 校验许可与健康状态 |
| Market Data | provider plan、deadline | provenance values | 保留冲突、允许 partial |
| Calendar | exchange、time | phase/session/calendar version | 支持午休和临时休市 |
| Snapshot Builder | task、instrument、cutoff | immutable snapshot | 完成后不可更新 |
| Indicator Engine | bars、规则版本 | 确定性指标 | 禁用未来数据和未完成 bar 误用 |
| LLM Gateway | model policy、prompt、evidence | 结构化模型响应 | 无市场数据工具权限 |
| Workflow | snapshot、mode、versions | agent runs | 所有 agent 共用 snapshot |
| Report Validator | draft、snapshot、schema | valid report 或错误 | 校验来源、禁用词和取值范围 |
| Backtest（后续） | historical snapshots | reproducible evaluation | 与在线研究数据路径隔离 |

## 4. 数据所有权矩阵

`R` 为读取，`W` 为唯一主要写入方。

| 数据 | 产品 API | 研究引擎 | Web |
| --- | --- | --- | --- |
| 用户、会话、成员关系 | W | 任务范围内 R | 经 API |
| 标的主数据和别名 | 审批/R | W | 经 API |
| 观察列表、组合、论点 | W | 任务范围内 R | 经 API |
| 研究任务 | W/状态协调 | 状态 CAS | 经 API |
| 快照、来源、供应商调用 | R | W | 经 API |
| agent 运行和报告 | 授权 R | W | 经 API |
| 订阅、用量、成本 | W | 追加明细 | 经 API |
| 审计日志 | 各域追加 | 各域追加 | 管理 API |

数据库用户按部署单元分离权限。即使 MVP 共用一个 PostgreSQL 实例，也不授予跨域任意写权限。

## 5. 服务契约

### 5.1 队列信封

产品 API 只发送最小信封：

```json
{
  "eventId": "evt_...",
  "contractVersion": 1,
  "taskId": "rt_...",
  "traceId": "...",
  "notBefore": "2026-08-09T07:00:00Z"
}
```

研究引擎必须按 `taskId` 从数据库读取受信上下文，校验状态和租户，不能相信消息携带的用户输入。

### 5.2 任务状态机

```text
QUEUED -> SNAPSHOTTING -> ANALYZING -> VALIDATING -> SUCCEEDED
   |            |              |            |
   +------------+--------------+------------+-> FAILED_RETRYABLE
                                               -> FAILED_FINAL
QUEUED -> CANCELLED
```

- 未开始任务可立即取消；运行中取消采用 cooperative cancellation。
- `FAILED_RETRYABLE` 只在次数和 deadline 内重新入队。
- 每次迁移记录原因、actor、时间与乐观锁版本。
- `SUCCEEDED` 必须同时存在已验证报告和 snapshot ID。

## 6. 版本与兼容策略

- 公共 REST API 使用 `/api/v1`；新增可选字段保持向后兼容。
- 队列信封包含整数 contract version；消费者至少支持当前和前一版本。
- snapshot/report schema 使用语义版本和内容哈希，不原地修改历史版本。
- 数据库迁移遵循 expand/migrate/contract，不要求服务同时升级。
- provider 原始 schema 不进入公共契约，必须先由 adapter 规范化。

## 7. 失败责任

| 失败 | 处理方 | 行为 |
| --- | --- | --- |
| 输入校验、无权限、超配额 | 产品 API | 同步拒绝，不投递任务 |
| provider 超时/限流 | 研究引擎 | deadline 内重试/回退，记录限制 |
| 数据互相矛盾 | 研究引擎 | 显式 resolution，降低质量分 |
| 模型输出不符合 schema | 研究引擎 | 有限修复重试，最终明确失败 |
| 队列重复投递 | 两端 | task 状态 CAS + inbox 去重 |
| 通知投递失败 | Notification | 不回滚成功研究，单独重试 |
| 成本入账暂时失败 | Entitlements | 由不可变 usage event 重放 |

## 8. 禁止的耦合

- Web 直接访问研究引擎、数据库、Redis 或供应商；
- agent 自行联网获取新行情或新闻；
- 使用 ticker 作为外键；
- 将 provider 专有字段暴露到通用报告；
- 用缓存任务状态覆盖数据库事实；
- 报告生成后回写修改原快照；
- 从研究报告产生交易指令或调用交易执行能力。
