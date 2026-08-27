# Copyright 2025 Google LLC
#
# Licensed under the Apache License, Version 2.0 (the "License");
# you may not use this file except in compliance with the License.
# You may obtain a copy of the License at
#
#     http://www.apache.org/licenses/LICENSE-2.0
#
# Unless required by applicable law or agreed to in writing, software
# distributed under the License is distributed on an "AS IS" BASIS,
# WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
# See the License for the specific language governing permissions and
# limitations under the License.
# ==============================================================================

"""Unified LLM client abstraction.

The rest of the codebase calls the convenience functions in ``models.gemini``
(e.g. ``gemini.call_predict``). This module is the underlying implementation that
dispatches to the configured provider (Gemini, DeepSeek, OpenAI). It keeps
``models.gemini`` as a thin, backward-compatible wrapper so existing call sites
and tests keep working unchanged.
"""

import json
import time
from typing import List, Type, TypeVar

from firebase_functions import logger

from models import api_config

T = TypeVar("T")

API_KEY_LOGGING_MESSAGE = "Ran with user-specified API key"
QUERY_RESPONSE_MAX_OUTPUT_TOKENS = 4000
# Import needs room for both reasoning (if enabled) and final tagged markdown.
IMPORT_MAX_OUTPUT_TOKENS = 65536
# Keep latex payloads within practical provider context limits.
IMPORT_MAX_LATEX_CHARS = 40000


class LLMInvalidResponseException(Exception):
    """Raised when the model returns an empty/unparseable response."""


class UnsupportedProviderError(ValueError):
    """Raised when an unknown provider is configured."""


def _resolve_api_key(api_key: str | None) -> str:
    if api_key:
        logger.info(API_KEY_LOGGING_MESSAGE)
        return api_key
    return api_config.DEFAULT_API_KEY


def _resolve_provider(override: str | None = None) -> str:
    provider = (override or api_config.MODEL_PROVIDER or "gemini").strip().lower()
    if provider not in {"gemini", "deepseek", "openai"}:
        raise UnsupportedProviderError(
            f"Unsupported LUMI_MODEL_PROVIDER: {provider!r}. "
            "Expected one of: gemini, deepseek, openai."
        )
    return provider


def _resolve_base_url(provider: str, override: str | None = None) -> str:
    if override:
        return override.rstrip("/")
    if api_config.BASE_URL:
        return api_config.BASE_URL.rstrip("/")
    return api_config.DEFAULT_BASE_URLS.get(provider, "").rstrip("/")


# -----------------------------------------------------------------------------
# Public API
# -----------------------------------------------------------------------------
def call_predict(
    query: str,
    model: str | None = None,
    api_key: str | None = None,
    provider: str | None = None,
    base_url: str | None = None,
    strong: bool = False,
    max_output_tokens: int | None = None,
    disable_thinking: bool = False,
) -> str:
    """Generate text from a plain-text prompt."""
    provider = _resolve_provider(provider)
    key = _resolve_api_key(api_key)
    model = _resolve_model(provider, model, strong=strong)
    base_url = _resolve_base_url(provider, base_url)
    max_tokens = max_output_tokens or QUERY_RESPONSE_MAX_OUTPUT_TOKENS

    if provider == "gemini":
        return _gemini_text(query, model, key, max_tokens=max_tokens)
    return _openai_text(
        query,
        model,
        key,
        base_url,
        max_tokens=max_tokens,
        disable_thinking=disable_thinking,
    )


def call_predict_with_image(
    prompt: str,
    image_bytes: bytes,
    model: str | None = None,
    api_key: str | None = None,
    provider: str | None = None,
    base_url: str | None = None,
    strong: bool = False,
) -> str:
    """Generate text from a prompt plus a PNG image."""
    provider = _resolve_provider(provider)
    key = _resolve_api_key(api_key)
    model = _resolve_model(provider, model, strong=strong)
    base_url = _resolve_base_url(provider, base_url)

    truncated_query = (prompt[:200] + "...") if len(prompt) > 200 else prompt
    print(f"  > Calling {provider} with image, prompt: '{truncated_query}'")

    if provider == "gemini":
        return _gemini_image(prompt, image_bytes, model, key)
    if _supports_vision(model):
        return _openai_image(prompt, image_bytes, model, key, base_url)
    # OpenAI-compatible models without vision support fall back to text-only.
    print(f"  > Model {model!r} may not support images; sending text only.")
    return _openai_text(prompt, model, key, base_url)


def call_predict_with_schema(
    query: str,
    response_schema: Type[T],
    model: str | None = None,
    api_key: str | None = None,
    provider: str | None = None,
    base_url: str | None = None,
    strong: bool = False,
) -> T | List[T] | None:
    """Generate structured (JSON) output constrained by ``response_schema``."""
    provider = _resolve_provider(provider)
    key = _resolve_api_key(api_key)
    model = _resolve_model(provider, model, strong=strong)
    base_url = _resolve_base_url(provider, base_url)

    start_time = time.time()
    truncated_query = (query[:200] + "...") if len(query) > 200 else query
    print(f"  > Calling {provider} with schema, prompt: '{truncated_query}'")

    try:
        if provider == "gemini":
            parsed = _gemini_schema(query, response_schema, model, key)
        else:
            parsed = _openai_schema(query, response_schema, model, key, base_url)
        print(f"  > {provider} with schema call took: {time.time() - start_time:.2f}s")
        return parsed
    except Exception as e:
        print(f"An error occurred during predict with schema API call: {e}")
        return None


def _model_matches_provider(provider: str, model: str) -> bool:
    """True when ``model`` looks compatible with ``provider``."""
    name = model.strip().lower()
    if provider == "gemini":
        return name.startswith("gemini")
    if provider == "deepseek":
        return name.startswith("deepseek")
    if provider == "openai":
        return name.startswith("gpt-") or name.startswith("o1") or name.startswith("o3")
    return True


def _resolve_model(
    provider: str, model: str | None, *, strong: bool = False
) -> str:
    """Pick a model name that matches the active provider.

    Hardcoded Gemini defaults from older call sites are ignored when the
    configured provider is DeepSeek/OpenAI (and vice versa).
    """
    if model and _model_matches_provider(provider, model):
        return model

    if strong and api_config.MODEL_NAME_STRONG:
        strong_model = api_config.MODEL_NAME_STRONG
        if _model_matches_provider(provider, strong_model):
            return strong_model

    if api_config.MODEL_NAME and _model_matches_provider(
        provider, api_config.MODEL_NAME
    ):
        return api_config.MODEL_NAME

    # Last resort: provider-safe built-in defaults (never cross-provider).
    defaults = {
        "gemini": ("gemini-2.5-flash", "gemini-2.5-pro"),
        "deepseek": (
            "deepseek-v4-flash-vision-exp",
            "deepseek-v4-flash-vision-exp",
        ),
        "openai": ("gpt-4o-mini", "gpt-4o"),
    }
    normal, heavy = defaults.get(provider, defaults["gemini"])
    return heavy if strong else normal


# -----------------------------------------------------------------------------
# Gemini backend (google-genai SDK)
# -----------------------------------------------------------------------------
def _gemini_text(
    query: str, model: str, api_key: str, max_tokens: int = QUERY_RESPONSE_MAX_OUTPUT_TOKENS
) -> str:
    from google import genai
    from google.genai import types

    client = genai.Client(api_key=api_key)
    response = client.models.generate_content(
        model=model,
        contents=query,
        config=types.GenerateContentConfig(
            temperature=0, max_output_tokens=max_tokens
        ),
    )
    if not response.text:
        raise LLMInvalidResponseException()
    return response.text


def _gemini_image(prompt: str, image_bytes: bytes, model: str, api_key: str) -> str:
    from google import genai
    from google.genai import types

    client = genai.Client(api_key=api_key)
    response = client.models.generate_content(
        model=model,
        contents=[
            prompt,
            # When imported, paper images are all saved in PNG format.
            types.Part.from_bytes(data=image_bytes, mime_type="image/png"),
        ],
        config=types.GenerateContentConfig(
            temperature=0, max_output_tokens=QUERY_RESPONSE_MAX_OUTPUT_TOKENS
        ),
    )
    if not response.text:
        raise LLMInvalidResponseException()
    return response.text


def _gemini_schema(query: str, response_schema: Type[T], model: str, api_key: str) -> T | List[T] | None:
    from google import genai
    from google.genai import types

    client = genai.Client(api_key=api_key)
    response = client.models.generate_content(
        model=model,
        contents=query,
        config={
            "response_mime_type": "application/json",
            "response_schema": response_schema,
            "temperature": 0,
        },
    )
    if not response.parsed:
        raise LLMInvalidResponseException()
    return response.parsed


# -----------------------------------------------------------------------------
# OpenAI-compatible backend (DeepSeek / OpenAI) using the `openai` SDK
# -----------------------------------------------------------------------------
def _supports_vision(model: str) -> bool:
    """Heuristically detect whether an OpenAI-compatible model supports images."""
    name = model.lower()
    return "vision" in name or "vlm" in name or "vl" in name or "4o" in name


def _openai_image(prompt: str, image_bytes: bytes, model: str, api_key: str, base_url: str) -> str:
    from openai import OpenAI

    client = OpenAI(api_key=api_key, base_url=base_url)
    response = client.chat.completions.create(
        model=model,
        messages=[
            {
                "role": "system",
                "content": "You are Lumi, a helpful research-paper reading assistant.",
            },
            {
                "role": "user",
                "content": [
                    {"type": "text", "text": prompt},
                    {
                        "type": "image_url",
                        "image_url": {
                            "url": f"data:image/png;base64,{_b64encode(image_bytes)}",
                        },
                    },
                ],
            },
        ],
        temperature=0,
        max_tokens=QUERY_RESPONSE_MAX_OUTPUT_TOKENS,
    )
    text = response.choices[0].message.content
    if not text:
        raise LLMInvalidResponseException()
    return text


def _b64encode(data: bytes) -> str:
    import base64

    return base64.b64encode(data).decode("ascii")


def _openai_text(
    query: str,
    model: str,
    api_key: str,
    base_url: str,
    max_tokens: int = QUERY_RESPONSE_MAX_OUTPUT_TOKENS,
    disable_thinking: bool = False,
) -> str:
    from openai import OpenAI

    client = OpenAI(api_key=api_key, base_url=base_url)
    create_kwargs = {
        "model": model,
        "messages": [
            {
                "role": "system",
                "content": (
                    "You are Lumi, a helpful research-paper reading assistant. "
                    "Follow the output tag format exactly. Do not include chain-of-thought."
                ),
            },
            {"role": "user", "content": query},
        ],
        "temperature": 0,
        "max_tokens": max_tokens,
    }
    # DeepSeek V4 reasoning can consume the entire max_tokens budget in
    # reasoning_content and return empty content (finish_reason=length).
    if disable_thinking:
        create_kwargs["extra_body"] = {"thinking": {"type": "disabled"}}

    response = client.chat.completions.create(**create_kwargs)
    choice = response.choices[0] if response.choices else None
    message = choice.message if choice else None
    text = _extract_message_text(message)
    if not text:
        finish = getattr(choice, "finish_reason", None) if choice else None
        usage = getattr(response, "usage", None)
        print(
            f"  > Empty model response (finish_reason={finish!r}, usage={usage!r})"
        )
        raise LLMInvalidResponseException(
            f"Empty model response (finish_reason={finish})"
        )
    return text


def _extract_message_text(message) -> str:
    if message is None:
        return ""
    content = getattr(message, "content", None)
    if isinstance(content, str) and content.strip():
        return content
    if isinstance(content, list):
        parts = []
        for part in content:
            if isinstance(part, dict) and part.get("type") == "text":
                parts.append(part.get("text") or "")
            else:
                text = getattr(part, "text", None)
                if text:
                    parts.append(text)
        joined = "".join(parts).strip()
        if joined:
            return joined
    # Last resort: some gateways only populate reasoning when budget is exhausted.
    for attr in ("reasoning_content", "reasoning"):
        reasoning = getattr(message, attr, None)
        if isinstance(reasoning, str) and reasoning.strip():
            print(f"  > Falling back to {attr} because content was empty")
            return reasoning
    return ""


def _openai_schema(
    query: str, response_schema: Type[T], model: str, api_key: str, base_url: str
) -> T | List[T] | None:
    from openai import OpenAI

    client = OpenAI(api_key=api_key, base_url=base_url)
    response = client.chat.completions.create(
        model=model,
        messages=[
            {
                "role": "system",
                "content": (
                    "Respond with only valid JSON, matching the requested schema. "
                    "Use double quotes. No markdown fences."
                ),
            },
            {"role": "user", "content": query},
        ],
        temperature=0,
        response_format={"type": "json_object"},
    )
    text = response.choices[0].message.content
    if not text:
        raise LLMInvalidResponseException()

    parsed = _parse_schema_response(text, response_schema)
    if parsed is None:
        raise LLMInvalidResponseException()
    return parsed


def _parse_schema_response(
    text: str, response_schema: Type[T]
) -> T | List[T] | None:
    """Attempts to parse JSON text into ``response_schema`` (or list of it)."""
    data = json.loads(text)
    return _coerce_to_schema(data, response_schema)


def _coerce_to_schema(data, response_schema: Type[T]) -> T | List[T] | None:
    """Coerces parsed JSON into the schema, handling lists and dicts."""
    if isinstance(data, list):
        return [response_schema(**item) for item in data]
    if isinstance(data, dict):
        return response_schema(**data)
    return None
