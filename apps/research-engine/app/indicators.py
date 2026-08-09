from __future__ import annotations

import math
from dataclasses import dataclass
from statistics import fmean, pstdev


@dataclass(frozen=True)
class IndicatorResult:
    values: dict[str, float | None]
    limitations: tuple[str, ...]


def _ema(values: list[float], period: int) -> list[float]:
    if len(values) < period:
        return []
    seed = fmean(values[:period])
    result = [seed]
    multiplier = 2 / (period + 1)
    for value in values[period:]:
        result.append((value - result[-1]) * multiplier + result[-1])
    return result


def _rsi(values: list[float], period: int = 14) -> float | None:
    if len(values) <= period:
        return None
    changes = [current - previous for previous, current in zip(values, values[1:], strict=True)]
    gains = [max(change, 0.0) for change in changes]
    losses = [max(-change, 0.0) for change in changes]
    average_gain = fmean(gains[:period])
    average_loss = fmean(losses[:period])
    for gain, loss in zip(gains[period:], losses[period:], strict=True):
        average_gain = ((period - 1) * average_gain + gain) / period
        average_loss = ((period - 1) * average_loss + loss) / period
    if average_loss == 0:
        return 100.0 if average_gain > 0 else 50.0
    return 100 - 100 / (1 + average_gain / average_loss)


def calculate_indicators(closes: list[float]) -> IndicatorResult:
    if not closes or any(not math.isfinite(value) or value <= 0 for value in closes):
        raise ValueError("Closing prices must be finite positive numbers")

    limitations: list[str] = []
    values: dict[str, float | None] = {}
    for period in (5, 20, 60, 200):
        key = f"ma{period}"
        if len(closes) < period:
            values[key] = None
            limitations.append(f"MA{period} requires {period} complete bars")
        else:
            values[key] = fmean(closes[-period:])

    values["rsi14"] = _rsi(closes)
    if values["rsi14"] is None:
        limitations.append("RSI14 requires at least 15 complete bars")

    ema12 = _ema(closes, 12)
    ema26 = _ema(closes, 26)
    if not ema12 or not ema26:
        values.update({"macd": None, "macdSignal": None, "macdHistogram": None})
        limitations.append("MACD requires at least 26 complete bars")
    else:
        aligned_ema12 = ema12[-len(ema26) :]
        macd_series = [fast - slow for fast, slow in zip(aligned_ema12, ema26, strict=True)]
        signal = _ema(macd_series, 9)
        values["macd"] = macd_series[-1]
        values["macdSignal"] = signal[-1] if signal else None
        values["macdHistogram"] = macd_series[-1] - signal[-1] if signal else None
        if not signal:
            limitations.append("MACD signal requires additional complete bars")

    if len(closes) < 21:
        values["volatility20Annualized"] = None
        limitations.append("20-day volatility requires at least 21 complete bars")
    else:
        returns = [math.log(current / previous) for previous, current in zip(closes[-21:], closes[-20:], strict=True)]
        values["volatility20Annualized"] = pstdev(returns) * math.sqrt(252) * 100

    return IndicatorResult(values=values, limitations=tuple(limitations))

