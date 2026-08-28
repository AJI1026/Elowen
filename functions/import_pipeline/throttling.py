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
"""Simple in-process import rate limiting (replaces Firestore throttle)."""

from __future__ import annotations

import threading
import time
from collections import deque

MAX_IMPORTS_PER_MINUTE = 5

_lock = threading.Lock()
_recent_successes: deque[float] = deque()


class ThrottleError(RuntimeError):
    """Raised when the import rate limit is exceeded."""


def check_throttle() -> None:
    """
    Enforce a simple rate limit of MAX_IMPORTS_PER_MINUTE successful imports
    per rolling 60-second window in this process.

    Raises:
        ThrottleError: If the rate limit is exceeded.
    """
    now = time.monotonic()
    with _lock:
        while _recent_successes and now - _recent_successes[0] > 60:
            _recent_successes.popleft()

        if len(_recent_successes) >= MAX_IMPORTS_PER_MINUTE:
            raise ThrottleError(
                "Too many import requests. Please try again in a minute."
            )

        _recent_successes.append(now)
