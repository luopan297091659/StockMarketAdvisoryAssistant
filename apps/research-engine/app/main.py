from __future__ import annotations

from fastapi import FastAPI, HTTPException

from app.models import BasicResearchRequest, BasicResearchResponse
from app.providers.synthetic import SyntheticMarketDataProvider
from app.service import BasicResearchService


app = FastAPI(
    title="Equity Atlas Research Engine",
    version="0.1.0",
    description="Deterministic research engine. The default provider uses synthetic demo data only.",
)
service = BasicResearchService(SyntheticMarketDataProvider())


@app.get("/health/live")
def live() -> dict[str, str]:
    return {"status": "ok"}


@app.get("/health/ready")
def ready() -> dict[str, str]:
    return {"status": "ready", "provider": "synthetic_demo_v1"}


@app.post("/v1/research/basic", response_model=BasicResearchResponse, response_model_by_alias=True)
def basic_research(request: BasicResearchRequest) -> dict:
    try:
        return service.run(request)
    except ValueError as error:
        raise HTTPException(status_code=422, detail=str(error)) from error

