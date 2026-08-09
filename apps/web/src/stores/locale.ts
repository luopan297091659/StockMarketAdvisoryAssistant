import { defineStore } from "pinia";

export type Locale = "zh" | "ja" | "en";
const translations = {
  zh: { title: "跨市研析", demo: "合成数据演示", search: "搜索股票代码或公司名称", watchlist: "观察列表", research: "生成基础研究", reports: "研究报告", logout: "退出" },
  ja: { title: "クロスマーケット分析", demo: "合成データデモ", search: "銘柄コードまたは会社名を検索", watchlist: "ウォッチリスト", research: "基本分析を生成", reports: "リサーチレポート", logout: "ログアウト" },
  en: { title: "Cross-market Research", demo: "Synthetic data demo", search: "Search symbol or company", watchlist: "Watchlist", research: "Run basic research", reports: "Research reports", logout: "Sign out" },
} as const;

export const useLocaleStore = defineStore("locale", {
  state: () => ({ locale: (localStorage.getItem("equity-atlas-locale") ?? "zh") as Locale }),
  getters: { text: (state) => translations[state.locale] },
  actions: { setLocale(value: Locale) { this.locale = value; localStorage.setItem("equity-atlas-locale", value); document.documentElement.lang = value; } },
});

