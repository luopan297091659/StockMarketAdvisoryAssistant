<script setup lang="ts">
import { computed, onMounted, ref } from "vue";
import { useRouter } from "vue-router";
import { apiBase, ApiError, useSessionStore } from "../stores/session";

const mode = ref<"login" | "register">("register");
const email = ref(""); const password = ref(""); const displayName = ref("");
const inviteCode = ref(""); const registrationMode = ref<"open" | "invite" | "disabled">("open");
const loading = ref(false); const error = ref("");
const dataMode = ref<"SYNTHETIC_DEMO" | "REAL_MARKET_DATA">("SYNTHETIC_DEMO");
const session = useSessionStore(); const router = useRouter();
const heading = computed(() => mode.value === "register" ? "创建研究账户" : "登录 Equity Atlas");

async function submit() {
  loading.value = true; error.value = "";
  try {
    const body: Record<string, string> = { email: email.value, password: password.value };
    if (mode.value === "register") { body.displayName = displayName.value; if (registrationMode.value === "invite") body.inviteCode = inviteCode.value; }
    await session.authenticate(mode.value, body);
    await router.push("/");
  } catch (reason) { error.value = reason instanceof ApiError ? reason.message : "无法连接产品 API，请确认服务已启动。"; }
  finally { loading.value = false; }
}
onMounted(async () => {
  try { const config = await (await fetch(`${apiBase}/config`)).json(); dataMode.value = config.dataMode; registrationMode.value = config.registrationMode; if (config.registrationMode === "disabled") mode.value = "login"; } catch { /* login remains available */ }
});
</script>

<template>
  <main class="auth-shell">
    <section class="brand-panel">
      <img class="brand-mark" src="/brand/equity-atlas-icon.png" alt="Equity Atlas" />
      <p class="eyebrow">EQUITY ATLAS</p>
      <h1>跨市场研究，<br />先看证据，再看观点。</h1>
      <p>统一研究 A 股、港股、美股和日股。每份报告保留快照、来源、时间与数据限制。</p>
      <div class="demo-notice"><strong>{{ dataMode === 'REAL_MARKET_DATA' ? '数据说明' : '开发演示' }}</strong><span>{{ dataMode === 'REAL_MARKET_DATA' ? '行情来自已配置供应商，可能延迟；研究信息不构成投资建议。' : '当前行情为合成数据，不构成投资建议。' }}</span></div>
    </section>
    <section class="auth-card">
      <p class="eyebrow">WELCOME</p><h2>{{ heading }}</h2>
      <form @submit.prevent="submit">
        <label v-if="mode === 'register'">显示名称<input v-model="displayName" maxlength="120" required autocomplete="name" /></label>
        <label v-if="mode === 'register' && registrationMode === 'invite'">客户邀请码<input v-model="inviteCode" minlength="8" maxlength="200" required autocomplete="one-time-code" /></label>
        <label>邮箱<input v-model="email" type="email" required autocomplete="email" /></label>
        <label>密码<input v-model="password" type="password" minlength="10" maxlength="200" required :autocomplete="mode === 'register' ? 'new-password' : 'current-password'" /></label>
        <p v-if="error" class="error" role="alert">{{ error }}</p>
        <button class="primary" :disabled="loading">{{ loading ? "处理中…" : mode === "register" ? "创建账户" : "登录" }}</button>
      </form>
      <button v-if="registrationMode !== 'disabled'" class="text-button" @click="mode = mode === 'register' ? 'login' : 'register'">{{ mode === "register" ? "已有账户？登录" : "使用邀请码注册" }}</button>
      <p class="legal-links">继续使用即表示已阅读 <RouterLink to="/legal/terms">使用条款</RouterLink> 与 <RouterLink to="/legal/privacy">隐私说明</RouterLink>。</p>
    </section>
  </main>
</template>
