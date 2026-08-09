import { describe, expect, it } from "vitest";
import { normalizeInstrument, searchInstruments } from "./index.js";

describe("normalizeInstrument", () => {
  it.each([
    ["600519", "cn_xshg_600519", "XSHG", "CNY"],
    ["600519.SS", "cn_xshg_600519", "XSHG", "CNY"],
    ["000858.SZ", "cn_xshe_000858", "XSHE", "CNY"],
    ["hk00700", "hk_xhkg_00700", "XHKG", "HKD"],
    ["0700.HK", "hk_xhkg_00700", "XHKG", "HKD"],
    ["NVDA", "us_xnas_nvda", "XNAS", "USD"],
    ["7203.T", "jp_xtks_7203", "XTKS", "JPY"],
    ["^N225", "jp_xjpx_n225", "XJPX", "JPY"],
    ["510300", "cn_xshg_510300", "XSHG", "CNY"],
  ])("normalizes %s", (input, id, mic, currency) => {
    const result = normalizeInstrument(input);
    expect(result.instrumentId).toBe(id);
    expect(result.mic).toBe(mic);
    expect(result.currency).toBe(currency);
  });

  it("uses an explicit market hint for bare Japanese codes", () => {
    expect(normalizeInstrument("7203", "JP").displaySymbol).toBe("7203.T");
  });

  it("does not apply China concepts to Japan", () => {
    const result = normalizeInstrument("9984.T");
    expect(result.timezone).toBe("Asia/Tokyo");
    expect(result.mic).toBe("XTKS");
  });

  it("searches localized company names", () => {
    expect(searchInstruments("丰田")[0]?.instrumentId).toBe("jp_xtks_7203");
  });

  it("rejects unsupported content", () => {
    expect(() => normalizeInstrument("../../etc/passwd")).toThrow(/Unsupported/);
  });
});
