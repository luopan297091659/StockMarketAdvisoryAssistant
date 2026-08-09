<script setup lang="ts">
import { computed, ref } from "vue";
import { useRouter } from "vue-router";
import { ApiError, useSessionStore } from "../stores/session";

const mode = ref<"login" | "register">("register");
const email = ref(""); const password = ref(""); const displayName = ref("");
const loading = ref(false); const error = ref("");
const session = useSessionStore(); const router = useRouter();
const heading = computed(() => mode.value === "register" ? "创建研究账户" : "登录 Equity Atlas");

async function submit() {
  loading.value = true; error.value = "";
  try {
    const body: Record<string, string> = { email: email.value, password: password.value };
    if (mode.value === "register") body.displayName = displayName.value;
    await session.authenticate(mode.value, body);
    await router.push("/");
  } catch (reason) { error.value = reason instanceof ApiError ? reason.message : "无法连接产品 API，请确认服务已启动。"; }
  finally { loading.value = false; }
}
</script>

<template>
  <main class="auth-shell">
    <section class="brand-panel">
      <img class="brand-mark" src="/brand/equity-atlas-icon.png" alt="Equity Atlas" />
      <p class="eyebrow">EQUITY ATLAS</p>
      <h1>跨市场研究，<br />先看证据，再看观点。</h1>
      <p>统一研究 A 股、港股、美股和日股。每份报告保留快照、来源、时间与数据限制。</p>
      <div class="demo-notice"><strong>开发演示</strong><span>当前行情为合成数据，不构成投资建议。</span></div>
    </section>
    <section class="auth-card">
      <p class="eyebrow">WELCOME</p><h2>{{ heading }}</h2>
      <form @submit.prevent="submit">
        <label v-if="mode === 'register'">显示名称<input v-model="displayName" maxlength="120" required autocomplete="name" /></label>
        <label>邮箱<input v-model="email" type="email" required autocomplete="email" /></label>
        <label>密码<input v-model="password" type="password" minlength="10" maxlength="200" required :autocomplete="mode === 'register' ? 'new-password' : 'current-password'" /></label>
        <p v-if="error" class="error" role="alert">{{ error }}</p>
        <button class="primary" :disabled="loading">{{ loading ? "处理中…" : mode === "register" ? "创建账户" : "登录" }}</button>
      </form>
      <button class="text-button" @click="mode = mode === 'register' ? 'login' : 'register'">{{ mode === "register" ? "已有账户？登录" : "没有账户？注册" }}</button>
    </section>
  </main>
</template>
