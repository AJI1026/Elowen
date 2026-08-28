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

from dataclasses import dataclass
from typing import Any, List, Optional
from shared.elowen_doc import ElowenContent, Position


@dataclass
class HighlightSelection:
    """Represents a highlighted section of a span."""

    span_id: str
    position: Position


@dataclass
class ImageInfo:
    """Information about an image for a request."""

    image_storage_path: str
    caption: Optional[str] = None


@dataclass
class ElowenAnswerRequest:
    """Request object for getting a Elowen answer."""

    query: Optional[str] = None
    highlight: Optional[str] = None
    highlighted_spans: Optional[List[HighlightSelection]] = None
    image: Optional[ImageInfo] = None
    # "mindmap" requests a nested logic map instead of a short prose answer.
    response_mode: Optional[str] = None


@dataclass
class ElowenAnswer:
    """A Elowen answer object, containing the response and citations."""

    id: str
    request: ElowenAnswerRequest
    response_content: List[ElowenContent]
    timestamp: int


@dataclass
class QueryLog:
    """Schema for logging user queries."""

    created_timestamp: Any  # datetime or ISO string
    expire_timestamp: Any  # datetime or ISO string
    answer: ElowenAnswer
    arxiv_id: str
    version: str


@dataclass
class UserFeedback:
    """Schema for user feedback."""

    user_feedback_text: str
    created_timestamp: Any  # datetime or ISO string
    arxiv_id: Optional[str] = None