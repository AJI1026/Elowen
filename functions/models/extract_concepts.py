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

import uuid
from typing import List
import re
from models.gemini import call_predict_with_schema
from models.prompts import make_concept_extraction_prompt
from dataclasses import dataclass
from pydantic import BaseModel

from shared.utils import get_unique_id
from shared.elowen_doc import (
    ConceptContent,
    ElowenConcept,
    ElowenSpan,
    InnerTag,
    InnerTagName,
    Position,
)


@dataclass
class LLMExtractedConcept:
    """The key concept or term extracted from the abstract."""

    name: str
    contents: List[ConceptContent]


# This is a Pydantic BaseModel used to specify structured output to Gemini
class LLMResponseSchema(BaseModel):
    """A list of content details for the concept, e.g., its description."""

    concepts: List[LLMExtractedConcept]


def parse_elowen_concepts(parsed_llm_output: LLMResponseSchema) -> List[ElowenConcept]:
    if not parsed_llm_output or not parsed_llm_output.concepts:
        return []

    elowen_concepts: List[ElowenConcept] = []
    for i, concept_data in enumerate(parsed_llm_output.concepts):
        elowen_concept = ElowenConcept(
            id=f"concept-{i}",
            name=concept_data.name,
            contents=concept_data.contents,
            in_text_citations=[],
        )
        elowen_concepts.append(elowen_concept)

    return elowen_concepts


def extract_concepts(abstract: str):
    """
    Calls Gemini to extract key concepts from the abstract using constrained decoding.

    Args:
        abstract (str): The abstract text.

    Returns:
        List[ElowenConcept]: A list of ElowenConcepts found in the abstract.
    """

    try:
        parsed_response = call_predict_with_schema(
            query=make_concept_extraction_prompt(abstract),
            response_schema=LLMResponseSchema,
        )

        if not parsed_response:
            print("LLM returned an empty or invalid response.")
            return []

        elowen_concepts = parse_elowen_concepts(parsed_response)

        return elowen_concepts

    except Exception as e:
        print(f"An unexpected error occurred in extract_concepts: {e}")
        return []


def annotate_concepts_in_place(
    spans: List[ElowenSpan], concepts: List[ElowenConcept]
) -> List[ElowenSpan]:
    """
    Finds occurrences of concept names in ElowenSpans and adds CONCEPT inner tags.

    Args:
        spans: A list of ElowenSpan objects to be annotated.
        concepts: A list of ElowenConcept objects to search for.

    Returns:
        The list of ElowenSpan objects with added inner tags for concepts.
    """
    for span in spans:
        for concept in concepts:
            # Use word boundaries to avoid matching substrings within words.
            # The pattern is case-insensitive.
            pattern = r"\b" + re.escape(concept.name) + r"\b"
            for match in re.finditer(pattern, span.text, re.IGNORECASE):
                start, end = match.span()
                new_tag = InnerTag(
                    id=get_unique_id(),
                    tag_name=InnerTagName.CONCEPT,
                    metadata={"concept_id": concept.id},
                    position=Position(start_index=start, end_index=end),
                    children=[],
                )
                span.inner_tags.append(new_tag)
