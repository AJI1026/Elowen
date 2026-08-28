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
"""Generates answers to user queries based on document context."""

import time
from typing import List

from shared.elowen_doc import ElowenDoc, ElowenSpan, ElowenContent, TextContent
from shared import prompt_utils
from shared.api import ElowenAnswer, ElowenAnswerRequest
from models import gemini
from models import prompts
from import_pipeline import convert_html_to_elowen, markdown_utils, image_utils
from shared.utils import get_unique_id

_MINDMAP_QUERY_KEYWORDS = (
    "思维导图",
    "逻辑导图",
    "结构图",
    "mind map",
    "mindmap",
    "mind-map",
)


def _wants_mindmap(request: ElowenAnswerRequest) -> bool:
    """True when the client requested a mind map or the query clearly asks for one."""
    if (request.response_mode or "").lower() == "mindmap":
        return True
    query = (request.query or "").lower()
    return any(keyword in query for keyword in _MINDMAP_QUERY_KEYWORDS)


def generate_elowen_answer(
    doc: ElowenDoc,
    request: ElowenAnswerRequest,
    api_key: str|None,
    model_config: dict|None = None
) -> ElowenAnswer:
    """
    Generates a ElowenAnswer by calling the configured LLM.

    This function selects the appropriate prompt based on the user's request
    (query, highlight, or both), calls the LLM to get a markdown response with
    inline citations, and then formats it into a ElowenAnswer object. ``api_key``
    is kept for backward compatibility; ``model_config`` may carry per-request
    provider/model/base_url overrides.
    """
    query = request.query
    highlight = request.highlight
    image_info = request.image
    wants_mindmap = _wants_mindmap(request)

    all_spans = prompt_utils.get_all_spans_from_doc(doc)
    formatted_spans = prompt_utils.get_formatted_spans_list(all_spans)
    spans_string = "\n".join(formatted_spans)

    metadata_string = ""
    if doc.metadata:
        metadata = doc.metadata
        authors = ", ".join(metadata.authors)
        metadata_string = f"""
Document Metadata:
Title: {metadata.title}
Authors: {authors}
Paper ID: {metadata.paper_id}
Version: {metadata.version}
Published: {metadata.published_timestamp}
Last Updated: {metadata.updated_timestamp}
"""

    if wants_mindmap and not image_info:
        if highlight:
            prompt = prompts.ELOWEN_PROMPT_MINDMAP_WITH_CONTEXT.format(
                spans_string=spans_string,
                highlight=highlight,
                metadata_string=metadata_string,
            )
        else:
            prompt = prompts.ELOWEN_PROMPT_MINDMAP.format(
                spans_string=spans_string,
                metadata_string=metadata_string,
            )
        # Persist mode so the client can render the nested list as a tree.
        request.response_mode = "mindmap"
    elif image_info:
        caption = image_info.caption or ""
        if query:
            prompt = prompts.ELOWEN_PROMPT_ANSWER_IMAGE.format(
                spans_string=spans_string,
                query=query,
                caption=caption,
                metadata_string=metadata_string,
            )
        else:
            prompt = prompts.ELOWEN_PROMPT_DEFINE_IMAGE.format(
                spans_string=spans_string,
                caption=caption,
                metadata_string=metadata_string,
            )
    else:
        if query and highlight:
            prompt = prompts.ELOWEN_PROMPT_ANSWER_WITH_CONTEXT.format(
                spans_string=spans_string,
                highlight=highlight,
                query=query,
                metadata_string=metadata_string,
            )
        elif query:
            prompt = prompts.ELOWEN_PROMPT_ANSWER.format(
                spans_string=spans_string,
                query=query,
                metadata_string=metadata_string,
            )
        elif highlight:
            prompt = prompts.ELOWEN_PROMPT_DEFINE.format(
                spans_string=spans_string,
                highlight=highlight,
                metadata_string=metadata_string,
            )
        else:
            # Should not happen with proper request validation
            raise ValueError("Request must include at least a query or a highlight.")

    prompt += prompt_utils.get_response_language_instruction(model_config)

    if image_info:
        image_bytes = image_utils.download_image_from_gcs(image_info.image_storage_path)
        markdown_response = gemini.call_predict_with_image(
            prompt=prompt, image_bytes=image_bytes, api_key=api_key,
            model_config=model_config
        )
    else:
        markdown_response = gemini.call_predict(
            prompt, api_key=api_key, model_config=model_config
        )

    # Extract equations before markdown conversion to prevent misinterpretation.
    markdown_response, equation_map = markdown_utils.extract_equations_to_placeholders(markdown_response)
    # Models often omit the l-sref- prefix; normalize before HTML conversion.
    markdown_response = markdown_utils.normalize_bare_span_refs(markdown_response)
    html_response = markdown_utils.markdown_to_html(markdown_response)

    # Parse the markdown response to create ElowenContent objects.
    response_sections = convert_html_to_elowen.convert_to_elowen_sections(
        html_response, placeholder_map=equation_map, strip_double_brackets=True
    )

    response_content: List[ElowenContent] = []
    for section in response_sections:
        response_content.extend(section.contents)

    # If parsing fails or returns no content, create a single raw span as a fallback.
    if not response_content:
        fallback_span = ElowenSpan(
            id=get_unique_id(), text=markdown_response, inner_tags=[]
        )
        fallback_text_content = TextContent(tag_name="p", spans=[fallback_span])
        fallback_content = ElowenContent(
            id=get_unique_id(), text_content=fallback_text_content
        )
        response_content = [fallback_content]

    return ElowenAnswer(
        id=get_unique_id(),
        request=request,
        response_content=response_content,
        # TODO(ellenj): Unify on timestamps with the front-end.
        timestamp=int(time.time()),
    )


def remove_p_tags(html_string: str):
    html_string = html_string.strip()
    if html_string.startswith("<p>"):
        html_string = html_string[3:]
    if html_string.endswith("</p>"):
        html_string = html_string[:-4]
    return html_string
