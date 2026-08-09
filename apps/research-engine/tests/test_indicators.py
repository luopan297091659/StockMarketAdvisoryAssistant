from __future__ import annotations

import math

from app.indicators import calculate_indicators


def test_indicators_are_deterministic_and_complete() -> None:
    closes = [100 + index * 0.5 for index in range(260)]
    first = calculate_indicators(closes)
    second = calculate_indicators(closes)
    assert first == second
    assert first.values["ma200"] == 179.75
    assert first.values["rsi14"] == 100.0
    assert first.values["macd"] is not None
    assert math.isfinite(first.values["volatility20Annualized"] or math.nan)


def test_short_history_reports_limitations() -> None:
    result = calculate_indicators([100 + index for index in range(20)])
    assert result.values["ma60"] is None
    assert result.values["volatility20Annualized"] is None
    assert result.limitations


def test_invalid_prices_are_rejected() -> None:
    try:
        calculate_indicators([100, 0, 101])
    except ValueError as error:
        assert "positive" in str(error)
    else:
        raise AssertionError("Expected invalid prices to be rejected")

