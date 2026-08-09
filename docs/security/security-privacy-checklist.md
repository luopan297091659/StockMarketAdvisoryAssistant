# 安全与隐私检查清单

状态：基线  
版本：0.1  
最后更新：2026-08-09

标记：`[ ]` 未完成、`[x]` 已由设计满足、`[N/A]` 不适用。设计勾选不等于实现验证；进入生产前所有适用项必须有代码、测试或运行证据。

## 1. 威胁模型与治理

- [ ] 为身份、租户、研究任务、供应商和 LLM 数据流完成威胁模型；
- [ ] 指定安全负责人、事件响应联系人和漏洞披露渠道；
- [ ] 维护数据流图、资产清单、数据分类和子处理方清单；
- [ ] 每个发布版本执行安全评审，重大边界变化重新威胁建模；
- [x] 设计明确禁止券商密码、交易凭据和交易执行；
- [ ] 法务复核投资研究免责声明和目标地区要求。

## 2. 身份与会话

- [ ] 密码使用经基准校准的 Argon2id，参数和算法版本随 hash 保存；
- [ ] 注册、登录、refresh、找回和验证码按 IP/账户组合限流；
- [ ] 错误消息和耗时避免用户枚举；
- [ ] access token 短期有效并验证 issuer、audience、signature、expiry、session；
- [ ] refresh token 仅存 hash、每次轮换、reuse 时撤销 token family；
- [ ] 角色/租户变化使相关会话及时失效；
- [ ] 管理员支持 MFA 后再开放高风险管理操作；
- [ ] Cookie 模式启用 HttpOnly、Secure、SameSite 与 CSRF token。

## 3. 授权和租户隔离

- [ ] controller、service、repository 三层测试授权策略；
- [ ] 每个 tenant-scoped 查询在数据库前绑定 tenant，而非查询后过滤；
- [ ] 生产 PostgreSQL 强制 RLS，应用角色不能 bypass RLS 或使用 owner；
- [ ] 连接池 tenant context 使用 transaction-local 设置并验证不串租户；
- [ ] 队列只携带 task ID，worker 从可信记录读取 tenant；
- [ ] 缓存 key、对象存储路径、日志查询和 trace 查询均隔离 tenant；
- [ ] 防 IDOR：其他租户资源统一不可见，批量接口逐项授权；
- [ ] 导出、删除、管理和 impersonation 操作需要更高 capability 和审计。

## 4. 输入、输出与 Web 防护

- [ ] DTO 采用 allowlist、长度/范围/枚举校验，拒绝未知危险字段；
- [ ] ORM 查询参数化；动态排序/字段名只允许白名单；
- [ ] 输出编码；富文本使用成熟 sanitizer；禁止任意 HTML；
- [ ] 设置 CSP、HSTS、Referrer-Policy、Permissions-Policy、nosniff 和 frame-ancestors；
- [ ] CORS 只允许显式生产 origin，不与 credential 通配；
- [ ] 错误响应不含堆栈、SQL、环境变量、provider payload 或内部路径；
- [ ] URL 抓取若后续启用，防 SSRF、DNS rebinding、内网地址和超大响应；
- [ ] 上传默认关闭；启用时隔离对象存储、限制大小/MIME、重命名并恶意软件扫描。

## 5. API、队列与滥用防护

- [ ] 全局、租户、用户、IP 和高成本端点分层限流；
- [ ] 研究请求必须使用 idempotency key 和 request hash；
- [ ] 任务设置 deadline、最大 attempt、最大模型 token 和成本预算；
- [ ] 消费者状态 CAS 与 inbox 去重，防重复执行/计费；
- [ ] 队列消息签名或运行在受控私网，且不信任消息用户字段；
- [ ] 批量范围、日期跨度、分页 limit 和响应大小有硬上限；
- [ ] 管理 API 与健康端点不泄露 secrets、依赖版本细节或 tenant 数据。

## 6. 秘密、加密与供应链

- [ ] secrets 由环境注入或 secret manager 提供，不提交仓库、不写日志；
- [ ] 不以可逆应用配置“加密”API key；生产使用 KMS envelope encryption；
- [ ] TLS 覆盖外部和内部敏感链路，数据库/Redis 验证证书；
- [ ] 备份加密、访问受限并定期执行恢复测试；
- [ ] 日志 redaction 覆盖 Authorization、Cookie、API key、token、密码和敏感持仓字段；
- [ ] lockfile 固定依赖，CI 执行 SCA、secret、容器和 IaC 扫描；
- [ ] 基础镜像固定 digest、使用非 root 用户、最小能力和只读文件系统（可行时）；
- [ ] 生成 SBOM 并维护第三方 NOTICE/许可证。

## 7. LLM 与 Agent 安全

- [ ] 来源文本按不可信内容处理，测试 prompt injection 和数据外泄；
- [x] Agent 设计上没有实时数据、任意网络、数据库或交易工具；
- [ ] 发送模型前裁剪并脱敏 portfolio、用户和租户信息；
- [ ] 按模型供应商记录地区、保留、训练使用和子处理方政策；
- [ ] 模型输出经过 schema、证据、数值、政策和秘密扫描；
- [ ] 不存储/展示 chain-of-thought，仅保留结构化证据和简短解释；
- [ ] fallback model 只能来自批准名单并遵守相同数据政策；
- [ ] 设定单任务/租户成本上限和异常用量告警。

## 8. 金融数据完整性

- [ ] 每个时效事实有 source 和 as-of，验证不晚于 data cutoff；
- [ ] snapshot/report/prompt/workflow 使用 canonical hash 且 append-only；
- [ ] 冲突值保留候选与 resolution policy，不静默覆盖；
- [ ] 历史运行拒绝未来数据，固定 calendar、adjustment 和算法版本；
- [ ] 未完成 bar、时区、午休、币种和 FX 明确建模；
- [ ] 报告扫描收益保证、伪确定性和不适用市场概念；
- [ ] 数据质量不足时限制 confidence/rating 或拒绝报告。

## 9. 隐私生命周期

- [ ] 为字段定义 PUBLIC、INTERNAL、CONFIDENTIAL、RESTRICTED 分类；
- [ ] 收集前说明目的、法律基础、保留期和子处理方；
- [ ] 默认最小收集；产品分析使用匿名/聚合标识；
- [ ] 支持用户数据访问、结构化导出、更正和可审计删除；
- [ ] 账户关闭后异步擦除缓存、对象、主库和到期备份；
- [ ] 法定/安全保留与删除请求冲突时记录范围和依据；
- [ ] 测试/开发禁止复制未经脱敏的生产用户和持仓数据；
- [ ] 通知目标、IP、UA 和持仓细节按明确周期保留。

## 10. 日志、监控与事件响应

- [ ] 审计日志 append-only，记录认证、权限、导出、删除、管理和保留变更；
- [ ] 告警覆盖暴力登录、跨租户拒绝、异常导出、成本激增、供应商认证失败；
- [ ] trace/log 中 tenant 标识最小化且受访问控制；
- [ ] 建立事件分级、遏制、取证、通知、恢复和复盘流程；
- [ ] 时钟同步并验证日志时间完整性；
- [ ] 定期演练 token 泄漏、供应商 key 泄漏、越权和数据篡改场景。

## 11. 发布阻断项

以下任一未满足不得生产发布：租户隔离/RLS 测试失败；秘密扫描高危未处理；高危依赖漏洞无书面接受；备份从未恢复验证；供应商许可未确认；模型数据处理条款未确认；报告证据校验可绕过；存在交易执行入口；免责声明和隐私文本未获批准。
