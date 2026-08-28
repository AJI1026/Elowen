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

import os

# ---------------------------------------------------------------------------
# AI model provider configuration (server-side).
#
# Copy this file to api_config.py (gitignored) and set your key / provider:
#   cp models/api_config.example.py models/api_config.py
#
# Supported providers:
#   * "gemini"   - Google Gemini (default, uses the google-genai SDK)
#   * "deepseek" - DeepSeek (OpenAI-compatible API)
#   * "openai"   - OpenAI (OpenAI-compatible API)
#
# Every value below can be overridden by an environment variable when you
# start the Firebase emulator / functions (recommended for local / CI).
# ---------------------------------------------------------------------------

# Which provider to use. One of: "gemini", "deepseek", "openai".
# Env: ELOWEN_MODEL_PROVIDER
MODEL_PROVIDER = os.environ.get("ELOWEN_MODEL_PROVIDER", "gemini").strip().lower()

# Default model names per provider. Used when ELOWEN_MODEL_NAME /
# ELOWEN_MODEL_NAME_STRONG are unset so switching provider alone is enough.
_PROVIDER_DEFAULT_MODELS = {
    "gemini": ("gemini-2.5-flash", "gemini-2.5-pro"),
    "deepseek": (
        "deepseek-v4-flash-vision-exp",
        "deepseek-v4-flash-vision-exp",
    ),
    "openai": ("gpt-4o-mini", "gpt-4o"),
}

_default_model, _default_strong = _PROVIDER_DEFAULT_MODELS.get(
    MODEL_PROVIDER, _PROVIDER_DEFAULT_MODELS["gemini"]
)

# Model name sent to the provider.
#   Gemini: "gemini-2.5-flash", "gemini-2.5-pro"
#   DeepSeek: "deepseek-chat", "deepseek-reasoner",
#             "deepseek-v4-flash-vision-exp" (vision → images / PDF formatting)
#   OpenAI: "gpt-4o", "gpt-4o-mini"
# Env: ELOWEN_MODEL_NAME
MODEL_NAME = os.environ.get("ELOWEN_MODEL_NAME", _default_model)

# Heavyweight tasks (PDF formatting / import).
# Env: ELOWEN_MODEL_NAME_STRONG
MODEL_NAME_STRONG = os.environ.get("ELOWEN_MODEL_NAME_STRONG", _default_strong)

# Server API key used for paper import and other backend LLM calls.
# Prefer setting ELOWEN_API_KEY in the environment; or paste a default here.
# Env: ELOWEN_API_KEY
DEFAULT_API_KEY = os.environ.get("ELOWEN_API_KEY", "")

# Base URL for OpenAI-compatible providers. Leave empty to use the defaults
# in DEFAULT_BASE_URLS (DeepSeek → https://api.deepseek.com).
# Env: ELOWEN_BASE_URL
BASE_URL = os.environ.get("ELOWEN_BASE_URL", "")

DEFAULT_BASE_URLS = {
    "gemini": "",
    "deepseek": "https://api.deepseek.com",
    "openai": "https://api.openai.com/v1",
}
