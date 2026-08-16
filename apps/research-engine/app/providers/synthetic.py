from __future__ import annotations

import hashlib
import random
from datetime import UTC, datetime, time, timedelta
from decimal import Decimal
from zoneinfo import ZoneInfo

from app.models import Instrument
from app.providers.base import MarketDataProvider, MarketDataset, PriceBar


class SyntheticMarketDataProvider(MarketDataProvider):
    """Deterministic demo data. It must never be presented as real market data."""

    name = "synthetic_demo_v1"

    def historical_daily_bars(self, instrument: Instrument, cutoff: datetime, limit: int = 260) -> MarketDataset:
        if not 30 <= limit <= 1000:
            raise ValueError("limit must be between 30 and 1000")
        cutoff = cutoff.astimezone(UTC)
        seed_bytes = hashlib.sha256(instrument.instrument_id.encode("utf-8")).digest()[:8]
        randomizer = random.Random(int.from_bytes(seed_bytes, "big"))
        base = Decimal(str(30 + int.from_bytes(seed_bytes[:2], "big") % 2700))
        timezone = ZoneInfo(instrument.timezone)
        local_day = cutoff.astimezone(timezone).date()
        days: list = []
        cursor = local_day
        while len(days) < limit:
            if cursor.weekday() < 5:
                days.append(cursor)
            cursor -= timedelta(days=1)
        days.reverse()

        bars: list[PriceBar] = []
        previous = base
        for day in days:
            drift = Decimal(str(randomizer.uniform(-0.022, 0.023)))
            open_price = previous * (Decimal("1") + Decimal(str(randomizer.uniform(-0.006, 0.006))))
            close = max(Decimal("0.01"), previous * (Decimal("1") + drift))
            high = max(open_price, close) * (Decimal("1") + Decimal(str(randomizer.uniform(0.001, 0.014))))
            low = min(open_price, close) * (Decimal("1") - Decimal(str(randomizer.uniform(0.001, 0.014))))
            start = datetime.combine(day, time(0, 0), tzinfo=timezone).astimezone(UTC)
            end = datetime.combine(day, time(23, 59, 59), tzinfo=timezone).astimezone(UTC)
            bars.append(
                PriceBar(
                    start_time=start,
                    end_time=end,
                    open=open_price.quantize(Decimal("0.01")),
                    high=high.quantize(Decimal("0.01")),
                    low=low.quantize(Decimal("0.01")),
                    close=close.quantize(Decimal("0.01")),
                    volume=Decimal(randomizer.randint(100_000, 20_000_000)),
                    is_complete=end <= cutoff,
                )
            )
            previous = close

        return MarketDataset(
            provider=self.name,
            received_at=datetime.now(UTC),
            bars=tuple(bars),
            limitations=(
                "演示模式使用确定性合成数据，不代表真实行情，不可用于投资决策。",
                "合成交易日仅排除周末，未应用真实交易所节假日。",
                "基本面、新闻、公告和企业事件在演示模式中不可用。",
            ),
            data_mode="SYNTHETIC_DEMO",
            quality="LOW",
            freshness="UNKNOWN",
            is_delayed=True,
            license_policy_id="synthetic-demo-internal-v1",
            source_title="Equity Atlas deterministic synthetic demo series",
            calendar_version="synthetic-weekdays-v1",
        )
