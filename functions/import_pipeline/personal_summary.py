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
import time
from typing import List
from models import gemini, prompts
from shared.elowen_doc import ElowenDoc, ElowenSpan, ElowenContent, TextContent
from shared.types_local_storage import PaperData
from shared import prompt_utils
from import_pipeline import convert_html_to_elowen, markdown_utils
from shared.api import ElowenAnswer, ElowenAnswerRequest
from shared.utils import get_unique_id
from shared.constants import PERSONAL_SUMMARY_QUERY_NAME


def get_personal_summary(doc: ElowenDoc, past_papers: List[PaperData], api_key:str|None, model_config:dict|None = None) -> ElowenAnswer:
    """
    Generates a personalized summary for a document.

    Args:
        doc (ElowenDoc): The document to summarize.
        past_papers (List[PaperData]): A list of past papers for context.
        api_key (str|None): API key override (backward compatible).
        model_config (dict|None): Per-request provider/model/base_url overrides.

    Returns:
        ElowenAnswer: The generated personalized summary, packaged as a ElowenAnswer.
    """
    prompt = prompts.make_personal_summary_prompt(doc, past_papers)
    prompt += prompt_utils.get_response_language_instruction(model_config)
    markdown_response = gemini.call_predict(
        prompt, api_key=api_key, model_config=model_config
    )
    html_response = markdown_utils.markdown_to_html(markdown_response)

    # Parse the markdown response to create ElowenContent objects.
    response_sections = convert_html_to_elowen.convert_to_elowen_sections(
        html_response, placeholder_map={}, strip_double_brackets=True
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

    request = ElowenAnswerRequest(query=PERSONAL_SUMMARY_QUERY_NAME)

    return ElowenAnswer(
        id=get_unique_id(),
        request=request,
        response_content=response_content,
        timestamp=int(time.time()),
    )
