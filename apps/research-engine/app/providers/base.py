from __future__ import annotations

from abc import ABC, abstractmethod
from dataclasses import dataclass
from datetime import datetime
from decimal import Decimal

from app.models import Instrument


@dataclass(frozen=True)
class PriceBar:
    start_time: datetime
    end_time: datetime
    open: Decimal
    high: Decimal
    low: Decimal
    close: Decimal
    volume: Decimal
    is_complete: bool


@dataclass(frozen=True)
class MarketDataset:
    provider: str
    received_at: datetime
    bars: tuple[PriceBar, ...]
    limitations: tuple[str, ...]
    data_mode: str = "REAL_MARKET_DATA"
    quality: str = "MEDIUM"
    freshness: str = "DELAYED"
    is_delayed: bool = True
    license_policy_id: str = "provider-contract-required"
    source_title: str = "Licensed market data provider"
    calendar_version: str = "provider-calendar"


class MarketDataProvider(ABC):
    name: str

    @abstractmethod
    def historical_daily_bars(self, instrument: Instrument, cutoff: datetime, limit: int) -> MarketDataset:
        raise NotImplementedError
