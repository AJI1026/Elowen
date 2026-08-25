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
to work. The default model names default to Gemini, but the actual provider
(and model) is resolved from :mod:`models.api_config` — switchable to DeepSeek /
OpenAI via ``LUMI_MODEL_PROVIDER`` etc.
"""

import time
from typing import List, Type, TypeVar

from models import api_config
from models import prompts
from models import llm_client
from shared.lumi_doc import LumiConcept
from shared.import_tags import L_REFERENCES_START, L_REFERENCES_END

API_KEY_LOGGING_MESSAGE = "Ran with user-specified API key"
QUERY_RESPONSE_MAX_OUTPUT_TOKENS = 4000

T = TypeVar("T")


class GeminiInvalidResponseException(Exception):
    pass


def call_predict(
    query="The opposite of happy is",
    model="gemini-2.5-flash",
    api_key: str | None = None,
    model_config: dict | None = None,
) -> str:
    """Calls the configured LLM with a plain-text prompt.

    Defaults to Gemini but delegates to ``llm_client`` so the provider can be
    switched via config. ``model_config`` may carry per-request overrides:
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
    model="gemini-2.5-flash",
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
    model="gemini-2.5-flash",
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
    default_model: str,
    default_api_key: str | None,
) -> tuple:
    """Extracts per-request overrides from ``model_config``.

    Returns ``(provider, model, base_url, api_key)`` where missing fields fall
    back to ``model_config``'s global defaults (None / empty) so that
    ``llm_client`` resolves from ``api_config`` when nothing is specified.
    """
    if not model_config:
        return None, default_model, None, default_api_key

    provider = model_config.get("provider") or None
    model = model_config.get("modelName") or default_model
    base_url = model_config.get("baseUrl") or None
    api_key = model_config.get("apiKey") or default_api_key
    return provider, model, base_url, api_key


def format_pdf_with_latex(
    pdf_data: bytes,
    latex_string: str,
    concepts: List[LumiConcept],
    model="gemini-2.5-pro",
) -> str:
    """Calls the configured LLM to format the pdf, using the latex source.

    Delegates to ``llm_client`` for the actual model call. This function passes
    the PDF as an image-like input to Gemini; for OpenAI-compatible providers the
    raw text prompt is sent (image content may not be supported).
    """
    start_time = time.time()
    prompt = prompts.make_import_pdf_prompt(concepts)
    truncated_prompt = (prompt[:200] + "...") if len(prompt) > 200 else prompt
    print(f"  > Calling to format PDF, prompt: '{truncated_prompt}'")

    try:
        response_text = llm_client.call_predict_with_image(
            prompt=prompt,
            image_bytes=pdf_data,
            model=model,
            api_key=None,
        )
    except Exception as e:
        print(f"  > Model PDF formatting failed, falling back to text: {e}")
        response_text = llm_client.call_predict(query=prompt, model=model, api_key=None)

    print(f"  > Format PDF call took: {time.time() - start_time:.2f}s")

    if not response_text:
        raise GeminiInvalidResponseException()

    if L_REFERENCES_START in response_text and L_REFERENCES_END not in response_text:
        response_text += L_REFERENCES_END
    return response_text
