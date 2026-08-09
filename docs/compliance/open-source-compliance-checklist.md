# 开源合规检查清单

状态：基线  
版本：0.1  
最后更新：2026-08-09

## 1. 独立实现

- [x] 采用原创产品名称、架构、文档和数据模型；
- [x] 参考项目仅用于理解公开功能和一般工作流；
- [ ] 所有实现 PR 检查是否复制参考项目源码、prompt、注释、测试、schema、结构或独特文案；
- [ ] 不复制 logo、图标、截图、UI、品牌和示例资产；
- [ ] 如有意复用代码，先完成来源、许可证、兼容性和 NOTICE 审批，不事后补录。

## 2. 依赖准入

- [ ] 每个直接依赖记录 package、version、source、license、用途和 owner；
- [ ] 仅从官方 registry/仓库获取，使用 lockfile 和 integrity 校验；
- [ ] 审查 runtime、dev、transitive、模型、字体、图标、数据集和容器镜像许可；
- [ ] 对 copyleft、source-available、non-commercial、field-of-use 和自定义许可人工复核；
- [ ] 检查许可证与计划 SaaS/分发方式兼容；
- [ ] 检查废弃、维护状态、已知漏洞和可替代性；
- [ ] 未识别许可证的组件默认拒绝。

## 3. 归属和通知

- [ ] `THIRD_PARTY_NOTICES.md` 记录 component、source、version/commit、license、affected files、modifications；
- [ ] 许可证全文按要求保存到 `LICENSES/`；
- [ ] 保留源文件 copyright/SPDX/NOTICE，不移除上游声明；
- [ ] 修改 Apache 2.0 等组件时按要求标注修改并传递 NOTICE；
- [ ] 前端 about/legal 页面或分发包包含必要的归属入口；
- [ ] 容器镜像和部署产物中的依赖同样进入 SBOM/NOTICE。

## 4. 自动化门禁

- [ ] CI 生成 SBOM（CycloneDX 或 SPDX）；
- [ ] CI 执行 license policy 和依赖漏洞扫描；
- [ ] lockfile 或镜像变化触发 NOTICE 差异检查；
- [ ] 禁止未知许可证和未经审批的高风险许可；
- [ ] 发布产物抽查实际包含的许可证与 SBOM 一致；
- [ ] 安全升级保留来源和版本记录。

## 5. AI 生成与素材

- [ ] 不要求模型复现特定仓库源码或独特 UI；
- [ ] 对生成的大段实现进行相似性和来源审查；
- [ ] 第三方金融文档、新闻、图片、字体和测试数据不因进入 prompt 而失去原许可约束；
- [ ] AI 生成资产记录生成方式和人工审查结果；
- [ ] 无法确认来源或权利的素材不进入产品。

## 6. 发布检查

- [ ] `THIRD_PARTY_NOTICES.md` 与实际依赖同步；
- [ ] `LICENSES/` 内容完整；
- [ ] SBOM 已生成和归档；
- [ ] 无未处理 license policy failure；
- [ ] 产品名称和说明不暗示参考项目或其作者背书；
- [ ] 法务要求的源代码提供或书面 offer（如适用）已落实。

## 7. 当前状态

当前仓库尚未引入第三方源码或运行依赖。未来脚手架引入的每个包仍需由 lockfile、SBOM 和自动化扫描确认，不能把常见框架视为无需合规记录。
