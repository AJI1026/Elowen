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

# AI model provider configuration.
#
# Supported providers:
#   * "gemini"   - Google Gemini (default, uses the google-genai SDK)
#   * "deepseek" - DeepSeek (OpenAI-compatible API)
#   * "openai"   - OpenAI (OpenAI-compatible API)
#
# All values can be overridden via environment variables (LUMI_*), which is
# the recommended approach for local development / CI.

# One of: "gemini", "deepseek", "openai"
MODEL_PROVIDER = "gemini"

# Model name sent to the provider.
#   Gemini: "gemini-2.5-flash", "gemini-2.5-pro"
#   DeepSeek: "deepseek-chat", "deepseek-reasoner", "deepseek-v4-flash-vision-exp"
#             (the "-vision-exp" variant supports image input → keeps PDF formatting
#              and figure-explanation working under DeepSeek)
#   OpenAI: "gpt-4o", "gpt-4o-mini"
MODEL_NAME = "gemini-2.5-flash"

# Default model used for heavyweight tasks (PDF formatting / import).
MODEL_NAME_STRONG = "gemini-2.5-pro"

# API key. Gemini uses DEFAULT_API_KEY; OpenAI-compatible providers use their
# own key (DeepSeek/OpenAI).
DEFAULT_API_KEY = ""

# Base URL. Only required for OpenAI-compatible providers when not using the
# pre-filled defaults. For DeepSeek leave empty to use https://api.deepseek.com.
BASE_URL = ""
