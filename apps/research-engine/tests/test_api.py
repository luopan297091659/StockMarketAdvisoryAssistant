from __future__ import annotations

from fastapi.testclient import TestClient
import pytest

from app.main import app
from app.main import build_provider


client = TestClient(app)


def instrument() -> dict:
    return {
        "instrumentId": "jp_xtks_7203",
        "canonicalSymbol": "7203",
        "displaySymbol": "7203.T",
        "mic": "XTKS",
        "market": "JP",
        "instrumentType": "EQUITY",
        "currency": "JPY",
        "timezone": "Asia/Tokyo",
        "names": {"zh-CN": "丰田汽车", "ja-JP": "トヨタ自動車"},
    }


def test_health() -> None:
    assert client.get("/health/live").json() == {"status": "ok"}


def test_basic_research_uses_one_snapshot_and_explicit_demo_mode() -> None:
    response = client.post("/v1/research/basic", json={"taskId": "task-1", "instrument": instrument()})
    assert response.status_code == 200, response.text
    body = response.json()
    assert body["dataMode"] == "SYNTHETIC_DEMO"
    assert body["report"]["snapshotId"] == body["snapshot"]["snapshotId"]
    assert body["report"]["rating"] == "NEUTRAL"
    assert body["report"]["confidence"] <= 0.2
    assert body["snapshot"]["dataQuality"]["level"] == "LOW"
    assert len(body["snapshot"]["historicalBars"]) == 260
    assert "合成" in body["report"]["disclaimer"]


def test_unknown_fields_are_rejected() -> None:
    response = client.post("/v1/research/basic", json={"taskId": "task-1", "instrument": instrument(), "tradeNow": True})
    assert response.status_code == 422


def test_production_rejects_synthetic_provider(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("DEPLOYMENT_MODE", "production")
    monkeypatch.setenv("MARKET_DATA_PROVIDER", "synthetic")
    with pytest.raises(RuntimeError, match="forbidden"):
        build_provider()


def test_production_requires_license_approval(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("DEPLOYMENT_MODE", "production")
    monkeypatch.setenv("MARKET_DATA_PROVIDER", "twelve_data")
    monkeypatch.setenv("TWELVE_DATA_API_KEY", "test-key")
    monkeypatch.delenv("MARKET_DATA_LICENSE_APPROVED", raising=False)
    with pytest.raises(RuntimeError, match="LICENSE_APPROVED"):
        build_provider()
