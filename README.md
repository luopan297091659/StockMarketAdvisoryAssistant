# 跨市研析平台（开发代号：Equity Atlas）

面向中国大陆、香港、美国和日本市场的中文优先 AI 股票研究平台。

> 本项目仅提供研究信息，不构成投资建议，不提供交易执行、资产管理或收益保证。

项目按可评审的小步增量开发。当前先冻结系统边界与数据模型，再开始代码脚手架和 MVP 实现。

## 当前可用能力

当前版本已经可以在本地完成基础使用闭环：

- 邮箱注册、登录、JWT access/refresh 轮换；
- 个人租户隔离和默认观察列表；
- A 股、港股、美股、日股、指数与 ETF 代码规范化；
- 搜索并添加标的到观察列表；
- 创建幂等基础研究任务；
- 独立 FastAPI 研究引擎计算 MA、RSI、MACD 和波动率；
- 为任务生成单一不可变上下文快照和结构化报告；
- 浏览报告历史、数据质量、限制和合成价格图表；
- 本地 JSON 演示持久化，或通过 Docker 使用规范化 Prisma/PostgreSQL 表持久化；
- 中文优先界面及基础日文、英文切换。

> **重要限制：** 默认数据源是确定性合成数据，只用于验证软件功能。报告固定为低数据质量、低置信度和中性评级，不可用于真实投资决策。当前未接入商业行情、新闻、财务数据、真实 LLM、BullMQ 调度或交易功能。

## 本地运行（Windows）

环境要求：Node.js 22+、npm 10+、Python 3.12+。没有 Docker 也可使用以下演示模式。

```powershell
npm.cmd install --cache .npm-cache
python -m venv .venv
.venv\Scripts\python.exe -m pip install --cache-dir .pip-cache -r apps\research-engine\requirements-dev.txt
npm.cmd run dev
```

打开 <http://127.0.0.1:5173>。产品 API 位于 `http://127.0.0.1:8000`，研究引擎 OpenAPI 位于 `http://127.0.0.1:8001/docs`。

演示数据保存在 `.data/demo-store.json`。删除该文件会清空本地演示账户、观察列表和报告。Web 的刷新令牌使用 HttpOnly Cookie，短期 access token 仅保存在当前浏览器会话中。

## Flutter 移动端：GubaoAI（股宝AI）

仓库根目录同时也是面向 Android 与 iOS 的 Flutter 工程，已支持登录/注册、令牌安全存储与刷新、标的搜索、观察列表、研究任务及报告浏览。先启动产品 API 与研究引擎，然后直接在根目录运行：

```powershell
flutter pub get
# Android 模拟器默认访问 http://10.0.2.2:8000/api/v1
flutter run
```

使用 iOS 模拟器、真机或其他后端地址时，通过编译参数覆盖 API 地址：

```powershell
flutter run --dart-define=API_BASE_URL=http://127.0.0.1:8000/api/v1
```

App 会从 `/config` 读取真实/演示数据模式及邀请注册策略。原生刷新令牌由系统安全存储保管；退出登录时服务端会撤销该令牌。Android 的明文 HTTP 仅在 debug manifest 中开启，正式版代码也会拒绝非 HTTPS API。

客户 Android 包必须使用正式域名和发布证书。复制 `android/key.properties.example` 为不入库的 `android/key.properties`，填入上传密钥信息后执行：

```powershell
flutter analyze
flutter test
flutter build appbundle --release --dart-define=API_BASE_URL=https://api.example.com/api/v1
```

不得向客户交付未签名包、调试证书包或使用 `ALLOW_INSECURE_API=true` 的包。iOS 构建需在 macOS/Xcode 中选择正式 Team、Bundle ID 与 Distribution 签名，并传入同一个 HTTPS `API_BASE_URL`。

## Docker Compose

安装 Docker 后：

```powershell
Copy-Item .env.example .env
# 将 .env 中 JWT_SECRET 和 POSTGRES_PASSWORD 替换为随机值
docker compose up --build
```

打开 <http://127.0.0.1:8080>。Compose 使用 PostgreSQL 16、独立研究引擎、产品 API 和 Nginx Web。停止服务使用 `docker compose down`；只有明确需要清空数据库时才使用 `docker compose down --volumes`。

## 客户试用部署

仓库提供 Twelve Data 日线适配器作为真实数据接入实现。根据供应商官方说明，商业展示需要 Business 方案，并仍受具体交易所许可约束；配置 API key 不等于已经获得展示或再分发权。

完成合同和法务审批后，复制 `.env.production.example` 为 `.env`，再设置强随机密码、公开 HTTPS 域名和已授权的 API key：

```dotenv
JWT_SECRET=<至少32字符的随机值>
POSTGRES_PASSWORD=<随机数据库密码>
PUBLIC_WEB_ORIGIN=https://research.example.com
TWELVE_DATA_API_KEY=<服务端API key>
MARKET_DATA_LICENSE_APPROVED=true
REGISTRATION_INVITE_CODE=<至少16字符的随机客户邀请码>
```

然后使用生产覆盖配置：

```powershell
docker compose -f compose.yaml -f compose.production.yaml up --build -d
```

公开入口必须置于提供 TLS 的负载均衡器或反向代理之后。生产覆盖配置会强制真实数据模式、HTTPS origin、Secure/HttpOnly Cookie、PostgreSQL 和许可确认；任一缺失都会拒绝启动。上线前逐项完成 [客户发布验收清单](docs/operations/customer-release-checklist.md)。

## 验证

```powershell
npm.cmd run verify
npm.cmd run audit
```

`verify` 运行 TypeScript/Vue 类型检查、市场标识与产品 API 测试、Python 研究引擎测试及三端生产构建；`audit` 查询 Node 与 Python 生产依赖的已知漏洞。

## 当前设计文档

- [产品需求](docs/product/product-requirements.md)
- [系统架构](docs/architecture/system-architecture.md)
- [服务边界](docs/architecture/service-boundaries.md)
- [数据库实体模型](docs/data/database-entity-model.md)
- [API 规格](docs/api/api-specification.md)
- [研究快照 Schema](docs/contracts/research-snapshot.schema.json)
- [结构化报告 Schema](docs/contracts/structured-report.schema.json)
- [Agent 工作流](docs/research/agent-workflow.md)
- [安全与隐私检查清单](docs/security/security-privacy-checklist.md)
- [数据供应商许可检查清单](docs/compliance/data-provider-licensing-checklist.md)
- [开源合规检查清单](docs/compliance/open-source-compliance-checklist.md)
- [MVP 实施计划](docs/delivery/mvp-implementation-plan.md)
- [测试策略](docs/testing/testing-strategy.md)
- [第三方声明](THIRD_PARTY_NOTICES.md)

## 仓库结构

```text
android/             Flutter Android 工程
ios/                 Flutter iOS 工程
lib/                 Flutter 移动端源码
test/                Flutter 测试
apps/
  web/                Vue 3 前端
  product-api/        NestJS 产品 API
  research-engine/    FastAPI 研究引擎
packages/
  shared-contracts/   跨服务契约和生成代码
  market-identifiers/ 市场标识规范化
  ui-components/      共享 UI 组件
infrastructure/       容器、可观测性和部署配置
docs/                 产品、架构、数据和运维文档
```

## 下一增量

1. 将 JSON Schema 发布到 `packages/shared-contracts` 并生成 TypeScript/Python 类型。
2. 在多实例部署前引入 Redis/BullMQ durable worker、outbox/inbox；当前单实例会在启动时恢复未完成任务。
3. 扩展已接入的真实日线 provider，增加经许可的基本面、公告和新闻数据。
4. 接入 provider-independent LLM gateway、报告证据 validator 和用量账本。
