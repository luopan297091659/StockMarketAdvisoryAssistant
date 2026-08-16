from __future__ import annotations

import os
from datetime import UTC, datetime
from fastapi import FastAPI, HTTPException

from app.models import BasicResearchRequest, BasicResearchResponse, Instrument
from app.providers.synthetic import SyntheticMarketDataProvider
from app.providers.twelve_data import TwelveDataMarketDataProvider
from app.service import BasicResearchService


def build_provider():
    provider_name = os.getenv("MARKET_DATA_PROVIDER", "synthetic").strip().lower()
    deployment_mode = os.getenv("DEPLOYMENT_MODE", "development").strip().lower()
    if deployment_mode == "production" and provider_name == "synthetic":
        raise RuntimeError("Synthetic market data is forbidden when DEPLOYMENT_MODE=production")
    if provider_name == "synthetic":
        return SyntheticMarketDataProvider()
    if provider_name == "twelve_data":
        if deployment_mode == "production" and os.getenv("MARKET_DATA_LICENSE_APPROVED") != "true":
            raise RuntimeError("MARKET_DATA_LICENSE_APPROVED=true is required for production market-data display")
        return TwelveDataMarketDataProvider(
            os.getenv("TWELVE_DATA_API_KEY", ""),
            base_url=os.getenv("TWELVE_DATA_BASE_URL", "https://api.twelvedata.com"),
            timeout_seconds=float(os.getenv("MARKET_DATA_TIMEOUT_SECONDS", "10")),
        )
    raise RuntimeError(f"Unsupported MARKET_DATA_PROVIDER: {provider_name}")


app = FastAPI(
    title="Equity Atlas Research Engine",
    version="0.1.0",
    description="Research engine with explicit synthetic-demo and licensed-provider modes.",
)
provider = build_provider()
service = BasicResearchService(provider)
deployment_mode = os.getenv("DEPLOYMENT_MODE", "development").strip().lower()
provider_verified = False


@app.get("/health/live")
def live() -> dict[str, str]:
    return {"status": "ok"}


@app.get("/health/ready")
def ready() -> dict[str, str]:
    global provider_verified
    if deployment_mode == "production" and not provider_verified:
        probe = Instrument.model_validate({"instrumentId": "us_xnas_aapl", "canonicalSymbol": "AAPL", "displaySymbol": "AAPL", "mic": "XNAS", "market": "US", "instrumentType": "EQUITY", "currency": "USD", "timezone": "America/New_York", "names": {"en-US": "Apple Inc."}})
        try:
            provider.historical_daily_bars(probe, datetime.now(UTC), 30)
            provider_verified = True
        except Exception as error:
            raise HTTPException(status_code=503, detail="market data provider is not ready") from error
    return {"status": "ready", "provider": provider.name}


@app.post("/v1/research/basic", response_model=BasicResearchResponse, response_model_by_alias=True)
def basic_research(request: BasicResearchRequest) -> dict:
    try:
        return service.run(request)
    except ValueError as error:
        raise HTTPException(status_code=422, detail=str(error)) from error
