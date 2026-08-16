from __future__ import annotations

import pytest
from jsonschema import ValidationError

from app.contract_validation import validate_research_output


def test_rejects_incomplete_snapshot_before_persistence() -> None:
    with pytest.raises(ValidationError):
        validate_research_output({"schemaVersion": "1.0.0"}, {})
