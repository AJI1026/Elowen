"""Persist model / UI settings to DATA_DIR/settings.json (not the browser)."""

from __future__ import annotations

import json
import logging
from pathlib import Path
from typing import Any

from .config import DATA_DIR, ensure_data_dirs

logger = logging.getLogger(__name__)

_EMPTY: dict[str, Any] = {
    "modelProvider": "deepseek",
    "providerSettings": {},
    "responseLanguage": "zh",
}


def settings_path() -> Path:
    return DATA_DIR / "settings.json"


def load_settings() -> dict[str, Any]:
    path = settings_path()
    if not path.is_file():
        return dict(_EMPTY)
    try:
        raw = json.loads(path.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError) as e:
        logger.warning("Failed to read %s: %s", path, e)
        return dict(_EMPTY)
    if not isinstance(raw, dict):
        return dict(_EMPTY)
    out = dict(_EMPTY)
    if isinstance(raw.get("modelProvider"), str):
        out["modelProvider"] = raw["modelProvider"]
    if isinstance(raw.get("providerSettings"), dict):
        out["providerSettings"] = raw["providerSettings"]
    if isinstance(raw.get("responseLanguage"), str):
        out["responseLanguage"] = raw["responseLanguage"]
    return out


def save_settings(payload: dict[str, Any]) -> dict[str, Any]:
    """Merge partial payload into existing settings and write to disk."""
    ensure_data_dirs()
    current = load_settings()
    if "modelProvider" in payload and isinstance(payload["modelProvider"], str):
        current["modelProvider"] = payload["modelProvider"]
    if "providerSettings" in payload and isinstance(payload["providerSettings"], dict):
        current["providerSettings"] = payload["providerSettings"]
    if "responseLanguage" in payload and isinstance(
        payload["responseLanguage"], str
    ):
        current["responseLanguage"] = payload["responseLanguage"]

    path = settings_path()
    path.write_text(
        json.dumps(current, ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8",
    )
    logger.info("Wrote user settings to %s", path)
    return current
