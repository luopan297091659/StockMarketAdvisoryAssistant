from __future__ import annotations

import json
import os
from functools import lru_cache
from pathlib import Path
from typing import Any

from jsonschema import Draft202012Validator, FormatChecker


def _default_contract_dir() -> Path:
    repository_root = Path(__file__).resolve().parents[3]
    return repository_root / "docs" / "contracts"


@lru_cache(maxsize=2)
def _validator(filename: str) -> Draft202012Validator:
    directory = Path(os.getenv("CONTRACT_SCHEMA_DIR", str(_default_contract_dir())))
    schema = json.loads((directory / filename).read_text(encoding="utf-8"))
    Draft202012Validator.check_schema(schema)
    return Draft202012Validator(schema, format_checker=FormatChecker())


def validate_research_output(snapshot: dict[str, Any], report: dict[str, Any]) -> None:
    _validator("research-snapshot.schema.json").validate(snapshot)
    _validator("structured-report.schema.json").validate(report)
