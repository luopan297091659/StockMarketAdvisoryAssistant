# 客户发布验收清单

本清单定义“可邀请客户试用”的最低门槛，不替代法律、安全或数据供应商审批。

## 发布前阻断项

- [ ] 数据供应商商业展示合同已签署，并确认目标市场、交易所、用户类型、延迟标签、缓存与衍生指标权利；
- [ ] `MARKET_DATA_LICENSE_APPROVED=true` 由法务或数据 owner 批准，不由开发人员自行填写；
- [ ] 生产域名已配置 TLS，外部扫描确认只开放 HTTPS；
- [ ] `JWT_SECRET`、数据库密码和 provider key 来自秘密管理服务并完成轮换演练；
- [ ] 生成至少 16 字符的客户邀请码，通过独立安全渠道交付客户，完成首批注册后及时轮换；
- [ ] PostgreSQL 备份、恢复、监控、告警和容量阈值已验证；
- [ ] 隐私政策、用户协议、数据来源说明和投资研究免责声明已完成法务审阅；
- [ ] 已执行跨租户、IDOR、暴力登录、令牌泄漏和依赖漏洞专项测试；
- [ ] 已确认客服、事故响应、数据纠错和供应商故障联系人。

## 技术验收

1. 使用 `compose.yaml` 与 `compose.production.yaml` 构建生产环境；
2. `/health/ready` 均成功，研究引擎返回 provider `twelve_data`；
3. `/api/v1/config` 返回 `REAL_MARKET_DATA`；
4. 创建 A/H/美/日股样本报告，核对 symbol、MIC、币种、时区、最后交易日及供应商控制台请求；
5. 报告来源为 `twelve_data`，`dataMode` 为 `REAL_MARKET_DATA`，页面不出现“合成历史价格”；
6. 浏览器存储中不存在 refresh token，Cookie 具有 `HttpOnly`、`Secure` 与 `SameSite=Lax`；
7. 退出后旧 refresh token 无法换取新 access token；
8. 执行 `npm run verify`，所有类型检查、测试和构建通过。
9. 检查 `audit_logs` 已记录注册、登录拒绝、登录成功、注销和研究任务创建事件，且只保存 IP 哈希。
10. 执行 `flutter analyze` 与 `flutter test`，使用真实 HTTPS API 构建 Android App Bundle 和 iOS Archive；禁止 `ALLOW_INSECURE_API=true`。
11. Android 使用保存在秘密系统中的发布/上传证书签名，不得使用 debug key；iOS 使用 Distribution 签名、正式 Team 与唯一 Bundle ID。
12. 在 Android 与 iOS 真机完成邀请注册、登录、令牌刷新、退出撤销、真实数据标识、供应商、截至时间、延迟与质量字段验收。
13. 确认移动端安全存储不可被设备云备份迁移，卸载/重装后旧会话不可恢复。

## 当前产品边界

客户试用版只提供延迟日线技术研究，不提供实时盘口、基本面、新闻、公告、交易执行或收益保证。页面和合同材料必须保持这一表述，禁止营销为“实时投资建议”。
