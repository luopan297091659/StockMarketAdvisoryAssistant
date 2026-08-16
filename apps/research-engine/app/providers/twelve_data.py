from __future__ import annotations

import json
import time as clock
from datetime import UTC, datetime, time
from decimal import Decimal, InvalidOperation
from urllib.error import HTTPError, URLError
from urllib.parse import urlencode
from urllib.request import Request, urlopen
from zoneinfo import ZoneInfo

from app.models import Instrument
from app.providers.base import MarketDataProvider, MarketDataset, PriceBar


class ProviderError(RuntimeError):
    pass


class TwelveDataMarketDataProvider(MarketDataProvider):
    """Twelve Data daily-bar adapter. Commercial display still requires an approved contract."""

    name = "twelve_data"

    def __init__(self, api_key: str, *, base_url: str = "https://api.twelvedata.com", timeout_seconds: float = 10.0) -> None:
        if not api_key.strip():
            raise ValueError("TWELVE_DATA_API_KEY is required")
        self.api_key = api_key
        self.base_url = base_url.rstrip("/")
        self.timeout_seconds = timeout_seconds
        self._cache: dict[str, tuple[float, MarketDataset]] = {}

    def historical_daily_bars(self, instrument: Instrument, cutoff: datetime, limit: int = 260) -> MarketDataset:
        if not 30 <= limit <= 1000:
            raise ValueError("limit must be between 30 and 1000")
        cache_key = f"{instrument.instrument_id}:{cutoff.date().isoformat()}:{limit}"
        cached = self._cache.get(cache_key)
        if cached and cached[0] > clock.monotonic():
            return cached[1]
        query = urlencode({
            "symbol": instrument.canonical_symbol,
            "mic_code": instrument.mic,
            "interval": "1day",
            "outputsize": limit,
            "end_date": cutoff.astimezone(ZoneInfo(instrument.timezone)).strftime("%Y-%m-%d"),
            "order": "asc",
            "adjust": "all",
        })
        request = Request(
            f"{self.base_url}/time_series?{query}",
            headers={"Authorization": f"apikey {self.api_key}", "Accept": "application/json", "User-Agent": "EquityAtlas/0.2"},
        )
        payload = None
        for attempt in range(3):
            try:
                with urlopen(request, timeout=self.timeout_seconds) as response:
                    payload = json.loads(response.read().decode("utf-8"))
                break
            except HTTPError as error:
                if error.code != 429 and error.code < 500:
                    raise ProviderError(f"Twelve Data HTTP error: {error.code}") from error
                if attempt == 2:
                    raise ProviderError(f"Twelve Data HTTP error after retries: {error.code}") from error
            except (URLError, TimeoutError, json.JSONDecodeError) as error:
                if attempt == 2:
                    raise ProviderError("Twelve Data request failed after retries") from error
            clock.sleep(0.25 * (2 ** attempt))

        if not isinstance(payload, dict):
            raise ProviderError("Twelve Data returned an invalid response")

        if payload.get("status") == "error" or not isinstance(payload.get("values"), list):
            code = str(payload.get("code", "UNKNOWN"))
            message = str(payload.get("message", "market data unavailable"))[:240]
            raise ProviderError(f"Twelve Data error {code}: {message}")

        timezone = ZoneInfo(instrument.timezone)
        cutoff_utc = cutoff.astimezone(UTC)
        bars: list[PriceBar] = []
        for item in payload["values"]:
            try:
                day = datetime.strptime(str(item["datetime"])[:10], "%Y-%m-%d").date()
                start = datetime.combine(day, time.min, timezone).astimezone(UTC)
                end = datetime.combine(day, time.max, timezone).astimezone(UTC)
                open_price = Decimal(str(item["open"]))
                high = Decimal(str(item["high"]))
                low = Decimal(str(item["low"]))
                close = Decimal(str(item["close"]))
                volume = Decimal(str(item.get("volume") or "0"))
                if low <= 0 or not low <= open_price <= high or not low <= close <= high or volume < 0:
                    raise ValueError("invalid OHLCV relationship")
                bars.append(PriceBar(
                    start_time=start,
                    end_time=end,
                    open=open_price,
                    high=high,
                    low=low,
                    close=close,
                    volume=volume,
                    is_complete=end <= cutoff_utc,
                ))
            except (KeyError, ValueError, InvalidOperation, TypeError) as error:
                raise ProviderError("Twelve Data returned a malformed price bar") from error

        if len(bars) < 30:
            raise ProviderError("Twelve Data returned fewer than 30 usable daily bars")
        bars.sort(key=lambda bar: bar.start_time)
        dataset = MarketDataset(
            provider=self.name,
            received_at=datetime.now(UTC),
            bars=tuple(bars),
            limitations=("行情可能延迟；延迟时长和展示权以已签署的数据合同及交易所规则为准。",),
            data_mode="REAL_MARKET_DATA",
            quality="MEDIUM",
            freshness="DELAYED",
            is_delayed=True,
            license_policy_id="twelve-data-commercial-contract",
            source_title="Twelve Data adjusted daily time series",
            calendar_version="provider-trading-days",
        )
        self._cache[cache_key] = (clock.monotonic() + 300, dataset)
        return dataset
