export type Market = "CN" | "HK" | "US" | "JP" | "GLOBAL";
export type InstrumentType = "EQUITY" | "ETF" | "INDEX";

export interface InstrumentIdentity {
  instrumentId: string;
  canonicalSymbol: string;
  displaySymbol: string;
  mic: string;
  market: Market;
  instrumentType: InstrumentType;
  currency: string;
  timezone: string;
  names: Record<string, string>;
}

export interface InstrumentCandidate extends InstrumentIdentity {
  matchType: "EXACT" | "ALIAS" | "DERIVED";
  score: number;
}

export class InstrumentNormalizationError extends Error {
  readonly code: "EMPTY_QUERY" | "UNSUPPORTED_SYMBOL" | "AMBIGUOUS_SYMBOL";

  constructor(
    code: "EMPTY_QUERY" | "UNSUPPORTED_SYMBOL" | "AMBIGUOUS_SYMBOL",
    message: string,
  ) {
    super(message);
    this.name = "InstrumentNormalizationError";
    this.code = code;
  }
}

const catalog: Record<string, Partial<InstrumentIdentity> & { names: Record<string, string> }> = {
  "CN:XSHG:600519": { instrumentType: "EQUITY", names: { "zh-CN": "贵州茅台", "en-US": "Kweichow Moutai" } },
  "CN:XSHE:000858": { instrumentType: "EQUITY", names: { "zh-CN": "五粮液", "en-US": "Wuliangye Yibin" } },
  "CN:XSHG:510300": { instrumentType: "ETF", names: { "zh-CN": "沪深300ETF", "en-US": "CSI 300 ETF" } },
  "HK:XHKG:00700": { instrumentType: "EQUITY", names: { "zh-CN": "腾讯控股", "en-US": "Tencent Holdings" } },
  "US:XNAS:AAPL": { instrumentType: "EQUITY", names: { "zh-CN": "苹果", "en-US": "Apple Inc." } },
  "US:XNAS:NVDA": { instrumentType: "EQUITY", names: { "zh-CN": "英伟达", "en-US": "NVIDIA Corporation" } },
  "US:XNAS:MU": { instrumentType: "EQUITY", names: { "zh-CN": "美光科技", "en-US": "Micron Technology" } },
  "US:ARCX:SPY": { instrumentType: "ETF", names: { "zh-CN": "标普500 ETF", "en-US": "SPDR S&P 500 ETF Trust" } },
  "US:XNAS:QQQ": { instrumentType: "ETF", names: { "zh-CN": "纳斯达克100 ETF", "en-US": "Invesco QQQ Trust" } },
  "US:ARCX:VOO": { instrumentType: "ETF", names: { "zh-CN": "先锋标普500 ETF", "en-US": "Vanguard S&P 500 ETF" } },
  "JP:XTKS:7203": { instrumentType: "EQUITY", names: { "zh-CN": "丰田汽车", "ja-JP": "トヨタ自動車", "en-US": "Toyota Motor Corporation" } },
  "JP:XTKS:9984": { instrumentType: "EQUITY", names: { "zh-CN": "软银集团", "ja-JP": "ソフトバンクグループ", "en-US": "SoftBank Group" } },
  "JP:XJPX:N225": { instrumentType: "INDEX", names: { "zh-CN": "日经225", "ja-JP": "日経平均株価", "en-US": "Nikkei 225" } },
  "JP:XJPX:TOPIX": { instrumentType: "INDEX", names: { "zh-CN": "东证股价指数", "ja-JP": "東証株価指数", "en-US": "TOPIX" } }
};

const currencyByMarket: Record<Market, string> = { CN: "CNY", HK: "HKD", US: "USD", JP: "JPY", GLOBAL: "USD" };
const timezoneByMarket: Record<Market, string> = { CN: "Asia/Shanghai", HK: "Asia/Hong_Kong", US: "America/New_York", JP: "Asia/Tokyo", GLOBAL: "UTC" };

function enrich(identity: Omit<InstrumentIdentity, "instrumentType" | "names">): InstrumentIdentity {
  const key = `${identity.market}:${identity.mic}:${identity.canonicalSymbol}`;
  const known = catalog[key];
  return {
    ...identity,
    instrumentType: known?.instrumentType ?? "EQUITY",
    names: known?.names ?? { "en-US": identity.displaySymbol },
  };
}

function identity(market: Market, mic: string, canonical: string, display: string): InstrumentIdentity {
  return enrich({
    instrumentId: `${market.toLowerCase()}_${mic.toLowerCase()}_${canonical.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`,
    canonicalSymbol: canonical,
    displaySymbol: display,
    mic,
    market,
    currency: currencyByMarket[market],
    timezone: timezoneByMarket[market],
  });
}

export function normalizeInstrument(rawQuery: string, marketHint?: Market): InstrumentIdentity {
  const query = rawQuery.trim().toUpperCase();
  if (!query) throw new InstrumentNormalizationError("EMPTY_QUERY", "Instrument query must not be empty");
  if (query.length > 80 || /[\u0000-\u001F\u007F]/.test(query)) {
    throw new InstrumentNormalizationError("UNSUPPORTED_SYMBOL", "Instrument query contains unsupported characters");
  }

  if (query === "^N225" || query === "N225" || query === "NIKKEI225") return identity("JP", "XJPX", "N225", "^N225");
  if (query === "TOPIX" || query === "^TOPX") return identity("JP", "XJPX", "TOPIX", "TOPIX");

  const hk = query.match(/^(?:HK)?(\d{1,5})(?:\.HK)?$/);
  if ((marketHint === "HK" || query.startsWith("HK") || query.endsWith(".HK")) && hk) {
    const canonical = hk[1]!.padStart(5, "0");
    const short = canonical.replace(/^0+(?=\d{4}$)/, "");
    return identity("HK", "XHKG", canonical, `${short}.HK`);
  }

  const jp = query.match(/^(\d{4})(?:\.T)$/);
  if (jp) return identity("JP", "XTKS", jp[1]!, `${jp[1]}.T`);
  if (marketHint === "JP" && /^\d{4}$/.test(query)) return identity("JP", "XTKS", query, `${query}.T`);

  const cn = query.match(/^(\d{6})(?:\.(SS|SH|SZ))?$/);
  if (cn && (marketHint === "CN" || cn[2] || !marketHint)) {
    const symbol = cn[1]!;
    const suffix = cn[2];
    const isShanghai = suffix === "SS" || suffix === "SH" || (!suffix && /^[569]/.test(symbol));
    const isShenzhen = suffix === "SZ" || (!suffix && /^[0123]/.test(symbol));
    if (!isShanghai && !isShenzhen) {
      throw new InstrumentNormalizationError("AMBIGUOUS_SYMBOL", "A market hint or exchange suffix is required");
    }
    return identity("CN", isShanghai ? "XSHG" : "XSHE", symbol, `${symbol}.${isShanghai ? "SS" : "SZ"}`);
  }

  if ((!marketHint || marketHint === "US") && /^[A-Z][A-Z0-9.-]{0,9}$/.test(query)) {
    const catalogEntry = Object.entries(catalog).find(([key]) => key.startsWith("US:") && key.endsWith(`:${query}`));
    const mic = catalogEntry?.[0].split(":")[1] ?? "XNAS";
    return identity("US", mic!, query, query);
  }

  throw new InstrumentNormalizationError("UNSUPPORTED_SYMBOL", `Unsupported instrument symbol: ${rawQuery}`);
}

export function searchInstruments(rawQuery: string, marketHint?: Market): InstrumentCandidate[] {
  const query = rawQuery.trim();
  if (!query) return [];

  try {
    return [{ ...normalizeInstrument(query, marketHint), matchType: "EXACT", score: 1 }];
  } catch (error) {
    if (!(error instanceof InstrumentNormalizationError) || error.code === "EMPTY_QUERY") return [];
  }

  const normalized = query.toLocaleLowerCase();
  return Object.entries(catalog)
    .filter(([key, value]) => {
      if (marketHint && !key.startsWith(`${marketHint}:`)) return false;
      return Object.values(value.names).some((name) => name.toLocaleLowerCase().includes(normalized));
    })
    .slice(0, 20)
    .map(([key]) => {
      const [market, mic, symbol] = key.split(":") as [Market, string, string];
      const display = market === "JP" && mic === "XTKS" ? `${symbol}.T` : market === "HK" ? `${symbol.replace(/^0/, "")}.HK` : symbol === "N225" ? "^N225" : symbol;
      return { ...identity(market, mic, symbol, display), matchType: "ALIAS" as const, score: 0.8 };
    });
}

