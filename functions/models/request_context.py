"""Per-request LLM credentials (from the desktop/web Settings UI).

Import and other background jobs set these so pipeline code that still calls
``models.gemini`` without explicit kwargs uses the user's key/provider.
"""

from __future__ import annotations

from contextlib import contextmanager
from contextvars import ContextVar
from typing import Any, Iterator

_api_key: ContextVar[str | None] = ContextVar("elowen_api_key", default=None)
_model_config: ContextVar[dict[str, Any] | None] = ContextVar(
    "elowen_model_config", default=None
)


def get_request_api_key() -> str | None:
    return _api_key.get()


def get_request_model_config() -> dict[str, Any] | None:
    return _model_config.get()


@contextmanager
def use_model_credentials(
    api_key: str | None = None,
    model_config: dict[str, Any] | None = None,
) -> Iterator[None]:
    """Bind credentials for the current task / request."""
    key_token = _api_key.set(api_key)
    cfg_token = _model_config.set(model_config)
    try:
        yield
    finally:
        _api_key.reset(key_token)
        _model_config.reset(cfg_token)
