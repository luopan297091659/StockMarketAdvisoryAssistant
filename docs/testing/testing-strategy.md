# 测试策略

状态：提议稿  
版本：0.1  
最后更新：2026-08-09

## 1. 目标

测试优先保护金融数据正确性、租户隔离、可复现性、任务幂等和失败可解释性。覆盖率是辅助指标，关键不变量必须由明确的正向和负向测试证明。

## 2. 测试层次

| 层次 | 范围 | 运行频率 |
| --- | --- | --- |
| 静态检查 | format、lint、TypeScript/Python typecheck、schema lint、secret/license scan | 每次提交/PR |
| 单元测试 | 标识规则、指标、质量评分、状态机、授权 policy、validator | 本地与每次 PR |
| 属性测试 | 标识 normalization、时间边界、decimal、幂等状态迁移 | 每次 PR，受控样本数 |
| 契约测试 | JSON Schema、OpenAPI、队列信封、provider adapter | 每次 PR |
| 数据库集成 | Prisma + 原生 SQL、RLS、约束、outbox、并发 | 每次 PR，真实 PostgreSQL |
| 服务集成 | API、Redis/BullMQ、research worker、fake provider/model | 每次 PR |
| 端到端 | 浏览器关键旅程 | 主分支/发布候选 |
| 非功能 | 负载、恢复、故障注入、安全、可访问性 | 定期与发布候选 |

禁止用 SQLite 代替 PostgreSQL 验证 RLS、numeric、约束、锁和并发行为。

## 3. 测试数据原则

- 使用合成数据或明确许可的 fixtures，不复制生产/商业数据集；
- fixture 包含来源、as-of、received-at、timezone、currency、quality 和 license policy；
- 固定时钟、随机种子、locale、calendar version 和 model response；
- 金融 decimal 用字符串/Decimal 比较，禁止脆弱二进制浮点精确相等；
- golden 文件小而可读，变更必须人工评审，不能无条件批量更新；
- secrets、真实用户邮箱、持仓和 provider key 不进入 fixtures/snapshots。

## 4. 核心测试矩阵

### 标的规范化

- `600519`、`600519.SS`、`000858`、`000858.SZ`；
- `hk00700`、`0700.HK` 补零与相同 stable ID；
- `NVDA`、`MU`、`AAPL` 大小写和符号白名单；
- `7203.T`、`9984.T` 对应 XTKS/JPY/Asia-Tokyo；
- `^N225`、TOPIX 支持标识、`SPY/QQQ/VOO/510300`；
- 空白、Unicode 同形字符、超长输入、未知后缀、跨市场同代码和歧义候选；
- normalize(normalize(x)) 的幂等属性（在输出可重新输入的范围内）。

### 市场时间与 K 线

- DST 前后美国市场、无 DST 的东京市场；
- 日本午休、周末、法定/临时休市、半日市（适用市场）；
- cutoff 恰等于/早于/晚于 source as-of 的边界；
- 未完成 bar 不进入收盘指标；重复、乱序、缺口和非法 OHLC 被处理；
- adjusted/unadjusted 不混合；拆股和分红 fixture 有明确期望。

### 确定性指标

- MA 窗口不足返回 null + limitation；
- RSI/MACD 初始化、常数序列、零成交量、极端 decimal；
- 相同输入和 algorithm version 输出 hash 相同；
- 与独立可信实现/手算小样本交叉验证，误差容差固定；
- 指标输出引用完整输入 source IDs。

### Provider 可靠性

- success、not found、429、timeout、5xx、schema drift、stale 和 license restricted；
- 只对瞬时失败重试，backoff 有上限和 jitter；
- 熔断打开、半开、恢复；总 deadline 不被每次 attempt 重置；
- primary/fallback 矛盾值保留并应用显式 resolution；
- cache hit 仍保留原 as-of/provider，不伪造新鲜时间；
- 全失败返回 partial/明确错误，不用 0 或空字符串填补。

### 快照和报告

- snapshot canonicalization 跨语言产生相同 hash；
- snapshot insert 后 UPDATE/DELETE 被数据库拒绝；
- 所有 agent run 使用 task 唯一 snapshot；
- schema unknown field、缺字段、范围外 score/confidence 被拒绝；
- time-sensitive FACT 无 source、未知 source、future source 被拒绝；
- 数字与 deterministic output 不一致被拒绝；
- 数据限制、agent disagreement 和免责声明必须保留；
- 收益保证、交易指令、JP 报告中的 A 股专属概念被 policy test 拒绝。

### 任务和用量

- 相同 tenant/key/hash 返回原任务；不同 hash 返回 409；不同 tenant 可复用 key；
- 重复队列投递、两个 worker 竞争、worker 在每阶段崩溃后恢复；
- 非法状态迁移和过期 version CAS 失败；
- 取消 queued 与 cooperative running cancellation；
- 模型调用完成但结算失败可由 usage event 重放且不重复计费；
- retry 复用 snapshot 与固定版本，不悄然换模型。

### 租户与授权

对每个 tenant-scoped endpoint 生成矩阵：owner/admin/member/viewer、同租户/异租户、存在/不存在资源、单个/列表/批量、直接 ID/关联 ID。验证 HTTP 结果、数据库 RLS、缓存、导出、队列和日志查询都不泄漏。

## 5. LLM 测试

- 单元和集成测试默认使用 deterministic fake model，不调用计费网络服务；
- golden set 覆盖四市场、好/坏/缺失/矛盾数据、不同质量级别和论点状态；
- adversarial set 包含来源内 prompt injection、秘密索取、交易指令、保证收益、伪造来源、长文本和 Unicode；
- 生产模型评估与 CI 分离，固定 model/prompt/workflow，记录费用、延迟和非确定性容差；
- 模型升级必须做新旧对比：schema pass、claim support、数值一致、policy violation、质量校准；
- 不以精确文案匹配评估合理的语言变化，重点验证结构和证据。

## 6. 数据库和迁移测试

- 空数据库向最新版本迁移；从每个受支持发布版本逐步升级；
- migration 在代表性数据量上测锁时长和 expand/contract 兼容；
- 复合 FK、check、unique、partial index、append-only、RLS 和角色 grant 有负向测试；
- outbox `SKIP LOCKED` 并发领取不重复；
- backup 创建、异地/空环境恢复、校验关键行数与 hash；
- destructive contract migration 只有在旧应用停止使用字段后执行。

## 7. 端到端场景

1. 注册、登录、创建个人租户、退出并 refresh reuse 检测；
2. 搜索四个市场标的、选择歧义候选、加入观察列表；
3. 查看 quote/chart 的 provider、as-of、delay 和 limitation；
4. 发起 BASIC 任务、查看进度、刷新页面、读取报告和来源；
5. 主 provider 失败时完成回退并显示质量下降；
6. 创建手工组合和持仓，确认没有交易入口；
7. 第二租户尝试直接访问第一租户资源并失败；
8. 重启 worker 后任务恢复且无重复报告/用量。

## 8. 非功能测试

- 负载：同步 API p95、任务入队吞吐、队列延迟、数据库连接和缓存热点；
- soak：持续运行检查内存、连接、token/cost drift 和队列积压；
- chaos：provider/Redis/DB/model 短时不可用、慢响应、worker kill；
- security：SAST/SCA/secret/container scan、DAST、授权专项和依赖审计；
- privacy：日志/trace/snapshot/prompt 抽样扫描敏感字段；
- accessibility：axe 自动检查 + 键盘/读屏/主题人工检查；
- localization：长中文/日文名称、窄屏、时区、货币和数字格式。

## 9. CI 门禁建议

PR 必须通过 format check、lint、typecheck、unit、contract、数据库 integration、license/secret scan 和 diff check。主分支追加服务集成与核心 E2E。发布候选追加完整 E2E、性能基线、安全扫描、容器 smoke、迁移/恢复演练及生产配置校验。

失败测试不得通过重跑掩盖。flaky test 需登记 owner、原因、隔离期限；关键安全/金融正确性测试不得隔离。

## 10. 覆盖与证据

建议业务核心行/分支覆盖不低于 85%，但状态机、授权、snapshot/report validator、指标和 provider policy 要求关键分支 100% 场景覆盖。CI 保存测试报告、覆盖率、OpenAPI/schema diff、SBOM、扫描结果和构建 revision，便于发布审计。
