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

"""Backward-compatible wrapper around :mod:`models.llm_client`.

Kept under the ``gemini`` module name so existing call sites
(``from models import gemini``) and tests (``@patch('...gemini...')``) continue
to work. The actual provider (and model) is resolved from
:mod:`models.api_config` — DeepSeek or OpenAI via ``ELOWEN_MODEL_PROVIDER`` etc.
"""

import time
from typing import List, Type, TypeVar

from models import api_config
from models import prompts
from models import llm_client
from shared.elowen_doc import ElowenConcept
from shared.import_tags import (
    L_REFERENCES_START,
    L_REFERENCES_END,
    L_CONTENT_START,
    L_CONTENT_END,
    L_FOOTNOTES_START,
)

API_KEY_LOGGING_MESSAGE = "Ran with user-specified API key"
QUERY_RESPONSE_MAX_OUTPUT_TOKENS = 4000

T = TypeVar("T")


class GeminiInvalidResponseException(Exception):
    pass


def call_predict(
    query="The opposite of happy is",
    model: str | None = None,
    api_key: str | None = None,
    model_config: dict | None = None,
) -> str:
    """Calls the configured LLM with a plain-text prompt.

    Delegates to ``llm_client`` so the provider can be switched via config.
    ``model_config`` may carry per-request overrides:
    ``provider``, ``modelName``, ``baseUrl``, ``apiKey``.
    """
    provider, out_model, base_url, out_key = _unpack_model_config(
        model_config, model, api_key
    )
    return llm_client.call_predict(
        query=query, model=out_model, api_key=out_key,
        provider=provider, base_url=base_url,
    )


def call_predict_with_image(
    prompt: str,
    image_bytes: bytes,
    model: str | None = None,
    api_key: str | None = None,
    model_config: dict | None = None,
) -> str:
    """Calls the configured LLM with a prompt and an image."""
    provider, out_model, base_url, out_key = _unpack_model_config(
        model_config, model, api_key
    )
    return llm_client.call_predict_with_image(
        prompt=prompt, image_bytes=image_bytes, model=out_model,
        api_key=out_key, provider=provider, base_url=base_url,
    )


def call_predict_with_schema(
    query: str,
    response_schema: Type[T],
    model: str | None = None,
    api_key: str | None = None,
    model_config: dict | None = None,
) -> T | List[T] | None:
    """Calls the configured LLM with a response schema for structured output."""
    provider, out_model, base_url, out_key = _unpack_model_config(
        model_config, model, api_key
    )
    return llm_client.call_predict_with_schema(
        query=query,
        response_schema=response_schema,
        model=out_model,
        api_key=out_key,
        provider=provider,
        base_url=base_url,
    )


def _unpack_model_config(
    model_config: dict | None,
    default_model: str | None,
    default_api_key: str | None,
) -> tuple:
    """Extracts per-request overrides from ``model_config``.

    Returns ``(provider, model, base_url, api_key)`` where missing fields fall
    back to request context, then ``api_config``.
    """
    from models import request_context

    ctx_config = request_context.get_request_model_config() or {}
    merged: dict = {**ctx_config, **(model_config or {})}

    provider = merged.get("provider") or None
    model = merged.get("modelName") or default_model
    base_url = merged.get("baseUrl") or None
    api_key = (
        merged.get("apiKey")
        or default_api_key
        or request_context.get_request_api_key()
    )
    return provider, model, base_url, api_key


def format_pdf_with_latex(
    pdf_data: bytes,
    latex_string: str,
    concepts: List[ElowenConcept],
    model: str | None = None,
    api_key: str | None = None,
    model_config: dict | None = None,
) -> str:
    """Calls the configured LLM to format the paper from LaTeX source.

    DeepSeek/OpenAI receive the LaTeX source embedded in the text prompt
    (PDF bytes are not sent as multimodal image input).
    """
    del pdf_data  # Reserved for future multimodal import paths.
    start_time = time.time()
    prompt = prompts.make_import_pdf_prompt(concepts)
    truncated_prompt = (prompt[:200] + "...") if len(prompt) > 200 else prompt
    print(f"  > Calling to format PDF, prompt: '{truncated_prompt}'")

    provider, out_model, base_url, out_key = _unpack_model_config(
        model_config, model or api_config.MODEL_NAME_STRONG or api_config.MODEL_NAME, api_key
    )
    provider = (provider or api_config.MODEL_PROVIDER or "deepseek").strip().lower()

    # Prefer a non-vision flash model and disable thinking so reasoning cannot
    # consume the whole token budget.
    import_model = out_model
    if provider == "deepseek" and "vision" in (out_model or "").lower():
        import_model = "deepseek-v4-flash"
        print(
            f"  > Switching import model from {out_model!r} to {import_model!r} "
            "(text-only latex conversion)"
        )
    print(
        f"  > Using latex text import for provider={provider!r} "
        f"(latex_chars={len(latex_string)}, model={import_model!r})"
    )
    try:
        response_text = llm_client.call_predict(
            query=_build_latex_import_query(prompt, latex_string),
            model=import_model,
            api_key=out_key,
            provider=provider,
            base_url=base_url,
            strong=True,
            max_output_tokens=llm_client.IMPORT_MAX_OUTPUT_TOKENS,
            disable_thinking=True,
        )
    except llm_client.LLMInvalidResponseException as e:
        print(f"  > Import call empty/invalid ({e}); retrying with truncated latex")
        truncated = (latex_string or "")[:20000]
        response_text = llm_client.call_predict(
            query=_build_latex_import_query(prompt, truncated),
            model=import_model,
            api_key=out_key,
            provider=provider,
            base_url=base_url,
            strong=True,
            max_output_tokens=llm_client.IMPORT_MAX_OUTPUT_TOKENS,
            disable_thinking=True,
        )

    print(f"  > Format PDF call took: {time.time() - start_time:.2f}s")
    print(f"  > Format PDF response chars: {len(response_text or '')}")

    if not response_text:
        raise GeminiInvalidResponseException()

    if L_REFERENCES_START in response_text and L_REFERENCES_END not in response_text:
        response_text += L_REFERENCES_END
    # DeepSeek often emits an opening [[l-con]] without a matching closer before
    # references; without this the body parses as empty.
    if L_CONTENT_START in response_text:
        first = response_text.find(L_CONTENT_START)
        after = response_text[first + len(L_CONTENT_START) :]
        if L_CONTENT_END not in after:
            insert_at = response_text.find(L_REFERENCES_START)
            if insert_at == -1:
                insert_at = response_text.find(L_FOOTNOTES_START)
            if insert_at == -1:
                response_text += L_CONTENT_END
            else:
                response_text = (
                    response_text[:insert_at]
                    + L_CONTENT_END
                    + "\n"
                    + response_text[insert_at:]
                )
    return response_text


def _build_latex_import_query(prompt: str, latex_string: str) -> str:
    latex = latex_string or ""
    if len(latex) > llm_client.IMPORT_MAX_LATEX_CHARS:
        latex = (
            latex[: llm_client.IMPORT_MAX_LATEX_CHARS]
            + "\n\n[LaTeX truncated for model context limits]\n"
        )
    return (
        f"{prompt}\n\n"
        "=== LaTeX source (use this as the primary content) ===\n"
        f"{latex}\n"
        "=== End LaTeX source ===\n"
    )
