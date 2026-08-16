from __future__ import annotations

from datetime import datetime
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field


Market = Literal["CN", "HK", "US", "JP", "GLOBAL"]
InstrumentType = Literal["EQUITY", "ETF", "INDEX"]


class Instrument(BaseModel):
    model_config = ConfigDict(extra="forbid")

    instrument_id: str = Field(alias="instrumentId", min_length=1, max_length=96)
    canonical_symbol: str = Field(alias="canonicalSymbol", min_length=1, max_length=48)
    display_symbol: str = Field(alias="displaySymbol", min_length=1, max_length=48)
    mic: str = Field(pattern=r"^[A-Z0-9]{4}$")
    market: Market
    instrument_type: InstrumentType = Field(alias="instrumentType")
    currency: str = Field(pattern=r"^[A-Z]{3}$")
    timezone: str
    names: dict[str, str]


class BasicResearchRequest(BaseModel):
    model_config = ConfigDict(extra="forbid", populate_by_name=True)

    task_id: str = Field(alias="taskId", min_length=1, max_length=128)
    instrument: Instrument
    analysis_time: datetime | None = Field(default=None, alias="analysisTime")


class BasicResearchResponse(BaseModel):
    model_config = ConfigDict(extra="forbid", populate_by_name=True)

    data_mode: Literal["SYNTHETIC_DEMO", "REAL_MARKET_DATA"] = Field(alias="dataMode")
    snapshot: dict
    report: dict
