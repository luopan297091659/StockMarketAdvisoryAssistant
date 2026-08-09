from __future__ import annotations

from datetime import UTC, datetime, time
from decimal import Decimal
from typing import Any
from uuid import uuid4
from zoneinfo import ZoneInfo

from app.indicators import calculate_indicators
from app.models import BasicResearchRequest
from app.providers.base import MarketDataProvider


def _iso(value: datetime) -> str:
    return value.astimezone(UTC).isoformat().replace("+00:00", "Z")


def _decimal(value: Decimal) -> str:
    return format(value, "f")


def _phase(analysis_time: datetime, timezone: str, market: str) -> str:
    local = analysis_time.astimezone(ZoneInfo(timezone))
    if local.weekday() >= 5:
        return "CLOSED"
    current = local.time()
    if market == "JP":
        if time(9, 0) <= current < time(11, 30) or time(12, 30) <= current < time(15, 30):
            return "OPEN"
        if time(11, 30) <= current < time(12, 30):
            return "LUNCH_BREAK"
        return "PRE_MARKET" if current < time(9, 0) else "POST_MARKET"
    return "OPEN" if time(9, 30) <= current < time(16, 0) else ("PRE_MARKET" if current < time(9, 30) else "POST_MARKET")


def _provenance(value: float | None, provider: str, as_of: datetime, received_at: datetime, source_id: str, limitations: list[str] | None = None) -> dict[str, Any]:
    return {
        "value": round(value, 6) if value is not None else None,
        "unit": None,
        "currency": None,
        "provider": provider,
        "asOf": _iso(as_of),
        "receivedAt": _iso(received_at),
        "isDelayed": True,
        "quality": "LOW",
        "freshness": "UNKNOWN",
        "sourceIds": [source_id],
        "resolutionPolicy": "SYNTHETIC_DEMO_ONLY",
        "limitations": limitations or [],
    }


class BasicResearchService:
    def __init__(self, provider: MarketDataProvider) -> None:
        self.provider = provider

    def run(self, request: BasicResearchRequest) -> dict[str, Any]:
        analysis_time = (request.analysis_time or datetime.now(UTC)).astimezone(UTC)
        dataset = self.provider.historical_daily_bars(request.instrument, analysis_time, 260)
        complete_bars = [bar for bar in dataset.bars if bar.is_complete]
        if len(complete_bars) < 30:
            raise ValueError("At least 30 complete bars are required")
        closes = [float(bar.close) for bar in complete_bars]
        indicator_result = calculate_indicators(closes)
        source_id = f"src_{uuid4().hex}"
        snapshot_id = f"snap_{uuid4().hex}"
        report_id = f"rpt_{uuid4().hex}"
        last_bar = complete_bars[-1]
        limitations = [*dataset.limitations, *indicator_result.limitations]

        source = {
            "sourceId": source_id,
            "provider": dataset.provider,
            "sourceType": "BAR",
            "title": "Equity Atlas deterministic synthetic demo series",
            "url": None,
            "publishedAt": None,
            "asOf": _iso(last_bar.end_time),
            "receivedAt": _iso(dataset.received_at),
            "quality": "LOW",
            "contentHash": None,
            "licensePolicyId": "synthetic-demo-internal-v1",
        }
        bars = [
            {
                "startTime": _iso(bar.start_time),
                "endTime": _iso(bar.end_time),
                "interval": "1d",
                "open": _decimal(bar.open),
                "high": _decimal(bar.high),
                "low": _decimal(bar.low),
                "close": _decimal(bar.close),
                "volume": _decimal(bar.volume),
                "isComplete": bar.is_complete,
                "adjustment": "NONE",
                "sourceIds": [source_id],
            }
            for bar in dataset.bars
        ]
        indicators = {
            key: _provenance(value, dataset.provider, last_bar.end_time, dataset.received_at, source_id)
            for key, value in indicator_result.values.items()
        }
        instrument = request.instrument.model_dump(by_alias=True)
        market_phase = _phase(analysis_time, request.instrument.timezone, request.instrument.market)
        snapshot = {
            "schemaVersion": "1.0.0",
            "snapshotId": snapshot_id,
            "instrument": instrument,
            "analysisTime": _iso(analysis_time),
            "dataCutoff": _iso(analysis_time),
            "marketPhase": market_phase,
            "calendarVersion": "synthetic-weekdays-v1",
            "quote": {
                "last": {**_provenance(float(last_bar.close), dataset.provider, last_bar.end_time, dataset.received_at, source_id), "currency": request.instrument.currency},
                "open": {**_provenance(float(last_bar.open), dataset.provider, last_bar.end_time, dataset.received_at, source_id), "currency": request.instrument.currency},
                "high": {**_provenance(float(last_bar.high), dataset.provider, last_bar.end_time, dataset.received_at, source_id), "currency": request.instrument.currency},
                "low": {**_provenance(float(last_bar.low), dataset.provider, last_bar.end_time, dataset.received_at, source_id), "currency": request.instrument.currency},
                "previousClose": {**_provenance(float(complete_bars[-2].close), dataset.provider, complete_bars[-2].end_time, dataset.received_at, source_id), "currency": request.instrument.currency},
                "volume": _provenance(float(last_bar.volume), dataset.provider, last_bar.end_time, dataset.received_at, source_id),
                "currency": request.instrument.currency,
            },
            "historicalBars": bars,
            "technicalIndicators": indicators,
            "fundamentals": {"schemaVersion": "1.0.0", "fields": {}, "limitations": ["演示模式无基本面数据。"]},
            "financialStatements": {"schemaVersion": "1.0.0", "fields": {}, "limitations": ["演示模式无财务报表。"]},
            "news": [],
            "corporateEvents": [],
            "portfolioContext": None,
            "investmentThesis": None,
            "dataQuality": {"score": 25, "level": "LOW", "limitations": limitations},
            "sources": [source],
        }

        last = closes[-1]
        ma20 = indicator_result.values["ma20"]
        ma60 = indicator_result.values["ma60"]
        rsi = indicator_result.values["rsi14"]
        bullish_signals = sum([ma20 is not None and last > ma20, ma60 is not None and last > ma60, rsi is not None and 50 <= rsi < 70])
        bearish_signals = sum([ma20 is not None and last < ma20, ma60 is not None and last < ma60, rsi is not None and rsi < 45])
        trend = "BULLISH" if bullish_signals >= 2 else "BEARISH" if bearish_signals >= 2 else "MIXED"
        technical_score = max(0, min(100, 50 + (bullish_signals - bearish_signals) * 12))
        support = min(closes[-20:])
        resistance = max(closes[-20:])
        claims = [
            {"claimId": "clm_last", "text": f"合成序列最新价格为 {last:.2f} {request.instrument.currency}。", "claimType": "FACT", "timeSensitive": True, "sourceIds": [source_id], "asOf": _iso(last_bar.end_time)},
            {"claimId": "clm_trend", "text": f"基于确定性均线与 RSI 规则，演示趋势分类为 {trend}。", "claimType": "CALCULATION", "timeSensitive": True, "sourceIds": [source_id], "asOf": _iso(last_bar.end_time)},
            {"claimId": "clm_limit", "text": "当前仅使用合成数据，不能形成真实投资结论。", "claimType": "LIMITATION", "timeSensitive": False, "sourceIds": [], "asOf": None},
        ]
        report = {
            "schemaVersion": "1.0.0",
            "reportId": report_id,
            "snapshotId": snapshot_id,
            "instrumentId": request.instrument.instrument_id,
            "symbol": request.instrument.display_symbol,
            "market": request.instrument.market,
            "analysisTime": _iso(analysis_time),
            "dataCutoff": _iso(analysis_time),
            "marketPhase": market_phase,
            "rating": "NEUTRAL",
            "confidence": 0.2,
            "scores": {"fundamental": None, "technical": technical_score, "news": None, "risk": 20, "overall": None},
            "trend": trend,
            "thesisStatus": "NOT_PROVIDED",
            "summary": {"text": "基础研究流程已完成，但当前为合成数据演示，只用于验证产品功能。", "claimIds": ["clm_trend", "clm_limit"]},
            "bullCase": [{"text": "合成技术序列中存在的正向信号仅用于界面演示。", "claimIds": ["clm_trend"]}] if bullish_signals else [],
            "bearCase": [{"text": "合成技术序列中存在的负向信号仅用于界面演示。", "claimIds": ["clm_trend"]}] if bearish_signals else [],
            "keyRisks": [{"text": "没有真实行情、基本面、新闻或公告，禁止据此作出投资决定。", "claimIds": ["clm_limit"]}],
            "catalysts": [],
            "supportLevels": [{"value": f"{support:.2f}", "currency": request.instrument.currency, "basis": "合成序列最近 20 个完整 bar 的最低值", "claimIds": ["clm_trend"]}],
            "resistanceLevels": [{"value": f"{resistance:.2f}", "currency": request.instrument.currency, "basis": "合成序列最近 20 个完整 bar 的最高值", "claimIds": ["clm_trend"]}],
            "agentDisagreements": [],
            "nextVerificationItems": [{"text": "接入获许可的数据供应商后重新创建研究任务。", "claimIds": ["clm_limit"]}],
            "dataQuality": {"score": 25, "level": "LOW", "limitations": limitations},
            "claims": claims,
            "sources": [{"sourceId": source_id, "title": source["title"], "provider": dataset.provider, "url": None, "asOf": source["asOf"]}],
            "disclaimer": "本报告使用合成演示数据，仅用于验证软件功能，不构成投资建议，不保证收益。",
        }
        return {"dataMode": "SYNTHETIC_DEMO", "snapshot": snapshot, "report": report}
