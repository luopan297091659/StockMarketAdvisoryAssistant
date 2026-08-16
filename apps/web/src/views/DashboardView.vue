<script setup lang="ts">
import { computed, onMounted, ref } from "vue";
import { useRouter } from "vue-router";
import PriceChart from "../components/PriceChart.vue";
import { useLocaleStore, type Locale } from "../stores/locale";
import { apiBase, ApiError, useSessionStore } from "../stores/session";
import type { Instrument, ReportRecord, ResearchTask, Watchlist } from "../types";

const session = useSessionStore(); const locale = useLocaleStore(); const router = useRouter();
const query = ref(""); const results = ref<Instrument[]>([]); const lists = ref<Watchlist[]>([]); const tasks = ref<ResearchTask[]>([]); const reports = ref<Array<Omit<ReportRecord, "snapshot">>>([]);
const currentReport = ref<ReportRecord | null>(null); const loading = ref(false); const message = ref(""); const error = ref("");
const productDataMode = ref<"SYNTHETIC_DEMO" | "REAL_MARKET_DATA">("SYNTHETIC_DEMO");
const defaultList = computed(() => lists.value[0]);

async function load() {
  try {
    const [watchlists, taskResult, reportResult] = await Promise.all([
      session.api<{ items: Watchlist[] }>("/watchlists"), session.api<{ items: ResearchTask[] }>("/research-tasks"), session.api<{ items: Array<Omit<ReportRecord, "snapshot">> }>("/reports"),
    ]);
    lists.value = watchlists.items; tasks.value = taskResult.items; reports.value = reportResult.items;
    try { productDataMode.value = (await (await fetch(`${apiBase}/config`)).json()).dataMode; } catch { /* authenticated data already loaded */ }
  } catch (reason) { handleError(reason); }
}
function handleError(reason: unknown) { error.value = reason instanceof ApiError ? reason.message : "无法连接服务"; }
async function search() { error.value = ""; if (!query.value.trim()) return; loading.value = true; try { results.value = (await session.api<{ items: Instrument[] }>(`/instruments/search?q=${encodeURIComponent(query.value)}`)).items; } catch (reason) { handleError(reason); } finally { loading.value = false; } }
async function add(instrument: Instrument) {
  if (!defaultList.value) return; error.value = "";
  try { await session.api(`/watchlists/${defaultList.value.id}/items`, { method: "POST", body: JSON.stringify({ instrument }) }); message.value = `${instrument.displaySymbol} 已加入观察列表`; results.value = []; await load(); } catch (reason) { handleError(reason); }
}
async function runResearch(instrument: Instrument) {
  error.value = ""; message.value = "研究任务已提交…";
  try {
    const task = await session.api<ResearchTask>("/research-tasks", { method: "POST", headers: { "idempotency-key": crypto.randomUUID() }, body: JSON.stringify({ instrumentId: instrument.instrumentId, mode: "BASIC" }) });
    for (let attempt = 0; attempt < 30; attempt += 1) {
      await new Promise((resolve) => setTimeout(resolve, 700));
      const updated = await session.api<ResearchTask>(`/research-tasks/${task.id}`);
      message.value = updated.status === "ANALYZING" ? "正在构建快照并执行确定性分析…" : `任务状态：${updated.status}`;
      if (updated.status === "SUCCEEDED" && updated.reportId) { await openReport(updated.reportId); message.value = "研究报告已完成"; await load(); return; }
      if (updated.status === "FAILED_FINAL") throw new Error(updated.errorDetail ?? "研究任务失败");
    }
    throw new Error("任务仍在运行，请稍后从报告历史查看");
  } catch (reason) { handleError(reason); }
}
async function openReport(id: string) { try { currentReport.value = await session.api<ReportRecord>(`/reports/${id}`); } catch (reason) { handleError(reason); } }
async function signOut() { await session.logout(); await router.push("/login"); }
onMounted(load);
</script>

<template>
  <div class="app-shell">
    <header class="topbar">
      <div class="brand-inline"><img class="brand-mark small" src="/brand/equity-atlas-icon.png" alt="" /><div><strong>{{ locale.text.title }}</strong><small>Equity Atlas</small></div></div>
      <div class="top-actions"><span v-if="productDataMode === 'SYNTHETIC_DEMO'" class="demo-pill">{{ locale.text.demo }}</span><select :value="locale.locale" aria-label="语言" @change="locale.setLocale(($event.target as HTMLSelectElement).value as Locale)"><option value="zh">中文</option><option value="ja">日本語</option><option value="en">English</option></select><button class="text-button" @click="signOut">{{ locale.text.logout }}</button></div>
    </header>
    <main class="dashboard">
      <section class="hero-row">
        <div><p class="eyebrow">MULTI-MARKET RESEARCH</p><h1>你好，{{ session.user?.displayName }}</h1><p>搜索标的，加入观察列表，然后生成可追溯的基础研究报告。</p></div>
        <div class="quality-guard"><strong>数据与风险提示</strong><span>{{ productDataMode === 'REAL_MARKET_DATA' ? '报告使用供应商行情；数据可能延迟，且仅覆盖价格技术面。' : '当前仅提供合成数据。所有演示报告保持低置信度和中性评级。' }}</span></div>
      </section>

      <section class="panel search-panel">
        <form class="search-form" @submit.prevent="search"><input v-model="query" :placeholder="locale.text.search" aria-label="搜索标的" /><button class="primary" :disabled="loading">{{ loading ? "…" : "搜索" }}</button></form>
        <div v-if="results.length" class="search-results">
          <article v-for="instrument in results" :key="instrument.instrumentId">
            <div><strong>{{ instrument.displaySymbol }}</strong><span>{{ instrument.names['zh-CN'] ?? instrument.names['ja-JP'] ?? instrument.names['en-US'] }}</span><small>{{ instrument.market }} · {{ instrument.mic }} · {{ instrument.currency }}</small></div>
            <button @click="add(instrument)">加入观察</button>
          </article>
        </div>
      </section>

      <p v-if="message" class="message" role="status">{{ message }}</p><p v-if="error" class="error" role="alert">{{ error }}</p>

      <div class="content-grid">
        <section class="panel"><div class="panel-heading"><div><p class="eyebrow">WATCHLIST</p><h2>{{ defaultList?.name ?? locale.text.watchlist }}</h2></div><span>{{ defaultList?.items.length ?? 0 }} 个标的</span></div>
          <div v-if="defaultList?.items.length" class="instrument-list"><article v-for="item in defaultList.items" :key="item.id"><div class="symbol-avatar">{{ item.instrument.market }}</div><div class="instrument-name"><strong>{{ item.instrument.displaySymbol }}</strong><span>{{ item.instrument.names['zh-CN'] ?? item.instrument.names['ja-JP'] ?? item.instrument.names['en-US'] }}</span></div><div class="instrument-meta"><span>{{ item.instrument.currency }}</span><small>{{ item.instrument.timezone }}</small></div><button class="primary compact" @click="runResearch(item.instrument)">{{ locale.text.research }}</button></article></div>
          <div v-else class="empty-state">先搜索并添加一个标的，例如 <code>7203.T</code>、<code>NVDA</code> 或 <code>600519</code>。</div>
        </section>
        <aside class="panel history"><div class="panel-heading"><div><p class="eyebrow">HISTORY</p><h2>{{ locale.text.reports }}</h2></div></div><button v-for="item in reports" :key="item.id" class="report-link" @click="openReport(item.id)"><strong>{{ item.report.symbol }}</strong><span>{{ item.report.rating }} · {{ new Date(item.createdAt).toLocaleString() }}</span></button><div v-if="!reports.length" class="empty-state small">暂无报告</div></aside>
      </div>

      <section v-if="currentReport" class="panel report-panel">
        <div class="report-title"><div><p class="eyebrow">STRUCTURED REPORT · {{ currentReport.dataMode }}</p><h2>{{ currentReport.report.symbol }} 基础研究</h2><span>{{ new Date(currentReport.report.analysisTime).toLocaleString() }} · Snapshot {{ currentReport.snapshot.snapshotId.slice(0, 16) }}…</span></div><div class="rating"><small>评级</small><strong>{{ currentReport.report.rating }}</strong><span>置信度 {{ Math.round(currentReport.report.confidence * 100) }}%</span></div></div>
        <div class="report-grid"><div class="chart-card"><h3>{{ currentReport.dataMode === 'REAL_MARKET_DATA' ? '历史价格（日线）' : '合成历史价格' }}</h3><PriceChart :bars="currentReport.snapshot.historicalBars" /></div><div class="score-card"><h3>研究概况</h3><p>{{ currentReport.report.summary.text }}</p><dl><template v-for="(score, key) in currentReport.report.scores" :key="key"><dt>{{ key }}</dt><dd>{{ score ?? 'N/A' }}</dd></template></dl></div></div>
        <div class="insight-grid"><article><h3>关键风险</h3><ul><li v-for="risk in currentReport.report.keyRisks" :key="risk.text">{{ risk.text }}</li></ul></article><article><h3>支撑 / 阻力</h3><p v-for="level in currentReport.report.supportLevels" :key="level.value">支撑：{{ level.value }} {{ level.currency }}</p><p v-for="level in currentReport.report.resistanceLevels" :key="level.value">阻力：{{ level.value }} {{ level.currency }}</p></article><article><h3>数据限制</h3><ul><li v-for="item in currentReport.report.dataQuality.limitations" :key="item">{{ item }}</li></ul></article></div>
        <footer class="disclaimer">{{ currentReport.report.disclaimer }}</footer>
      </section>
    </main>
  </div>
</template>
