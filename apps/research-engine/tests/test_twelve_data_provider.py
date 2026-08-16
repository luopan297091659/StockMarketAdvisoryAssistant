from __future__ import annotations

import json
from datetime import UTC, datetime, timedelta
from io import BytesIO

import pytest

from app.models import Instrument
from app.providers.twelve_data import TwelveDataMarketDataProvider


class FakeResponse(BytesIO):
    def __enter__(self):
        return self

    def __exit__(self, *_args):
        self.close()


def test_parses_real_provider_bars(monkeypatch: pytest.MonkeyPatch) -> None:
    start = datetime(2025, 1, 1)
    values = []
    for index in range(40):
        day = start + timedelta(days=index)
        values.append({"datetime": day.strftime("%Y-%m-%d"), "open": "100", "high": "102", "low": "99", "close": "101", "volume": "12345"})
    calls = 0
    def respond(*_args, **_kwargs):
        nonlocal calls
        calls += 1
        return FakeResponse(json.dumps({"status": "ok", "values": values}).encode())
    monkeypatch.setattr("app.providers.twelve_data.urlopen", respond)
    provider = TwelveDataMarketDataProvider("secret")
    instrument = Instrument.model_validate({"instrumentId": "us_xnas_aapl", "canonicalSymbol": "AAPL", "displaySymbol": "AAPL", "mic": "XNAS", "market": "US", "instrumentType": "EQUITY", "currency": "USD", "timezone": "America/New_York", "names": {"en-US": "Apple"}})
    result = provider.historical_daily_bars(instrument, datetime(2026, 1, 1, tzinfo=UTC), 40)
    assert result.data_mode == "REAL_MARKET_DATA"
    assert result.provider == "twelve_data"
    assert len(result.bars) == 40
    assert result.bars[-1].close == 101
    assert provider.historical_daily_bars(instrument, datetime(2026, 1, 1, tzinfo=UTC), 40) is result
    assert calls == 1
