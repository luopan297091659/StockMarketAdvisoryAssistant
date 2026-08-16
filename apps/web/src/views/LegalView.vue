<script setup lang="ts">
import { computed } from "vue";
import { useRoute } from "vue-router";

const route = useRoute();
const privacy = computed(() => route.path.endsWith("privacy"));
</script>

<template>
  <main class="legal-shell">
    <RouterLink to="/login">← 返回</RouterLink>
    <article class="panel legal-copy" v-if="privacy">
      <p class="eyebrow">PRIVACY</p><h1>隐私说明</h1><small>生效日期：2026-08-16</small>
      <h2>我们处理的信息</h2><p>为提供账户和研究服务，我们处理邮箱、显示名称、加密密码摘要、会话信息、观察列表、研究请求及安全审计记录。我们不收集券商密码或交易凭据。</p>
      <h2>使用目的与保存</h2><p>信息仅用于身份认证、客户服务、研究报告生成、安全防护和合规审计。访问 IP 仅以截断哈希写入审计日志。具体保存期限和删除流程由部署方在客户合同中确认。</p>
      <h2>第三方与数据位置</h2><p>市场数据请求会发送标的代码给已配置的数据供应商，不发送客户邮箱或密码。部署方应在上线前披露供应商、托管区域和跨境处理安排。</p>
      <h2>客户权利</h2><p>客户可联系服务提供方申请访问、更正或删除账户信息。法律或安全审计要求保留的记录可能延迟删除。</p>
    </article>
    <article class="panel legal-copy" v-else>
      <p class="eyebrow">TERMS</p><h1>使用条款与风险提示</h1><small>生效日期：2026-08-16</small>
      <h2>服务边界</h2><p>本产品提供延迟日线价格的技术研究信息，不提供证券交易执行、资产管理、个性化投资顾问服务或收益保证。</p>
      <h2>数据限制</h2><p>行情可能延迟、缺失或被供应商修订。报告目前不覆盖完整基本面、财报、新闻和公司公告。客户应通过交易所公告、监管披露和持牌机构独立核验。</p>
      <h2>禁止行为</h2><p>禁止共享账户、绕过访问控制、批量抓取或向第三方再分发受许可限制的数据，也不得将本产品用于违法交易或市场操纵。</p>
      <h2>风险承担</h2><p>证券投资可能损失全部本金。任何评级、趋势、支撑位或阻力位都不是买卖指令，客户应结合自身情况独立决策。</p>
    </article>
  </main>
</template>
