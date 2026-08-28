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

# summaries.py
"""Preprocessing functions for Elowen."""

import json
import uuid
from typing import List, Type, Dict
from pydantic import BaseModel

from dataclasses import dataclass
from shared.elowen_doc import (
    ElowenDoc,
    ElowenSpan,
    ElowenSummaries,
    ElowenSummary,
    ListContent,
    ElowenSection,
    ElowenContent,
)
from shared import prompt_utils
import models.gemini as gemini
from import_pipeline.convert_html_to_elowen import (
    convert_raw_output_to_spans,
)
from shared.utils import get_unique_id


@dataclass
class FetchElowenSummariesRequestOptions:
    include_section_summaries: bool = False
    include_content_summaries: bool = False
    include_span_summaries: bool = False
    include_abstract_excerpt: bool = False


# These are Pydantic BaseModels used to specify structured output to Gemini
class AbstractExcerptSchema(BaseModel):
    id: str


class LabelSchema(BaseModel):
    id: str
    label: str


class ContentLabelSchema(BaseModel):
    id: str
    gist: str
    purpose: str = ""


MIN_CHARACTER_LENGTH = 100

SPAN_SUMMARIES_DEFAULT_BATCH_SIZE = 500
SECTION_SUMMARIES_DEFAULT_BATCH_SIZE = 50
CONTENT_SUMMARIES_DEFAULT_BATCH_SIZE = 100

# Shared prompt instructions
_PROMPT_FORMATTING_INSTRUCTIONS = """可用 markdown 格式，例如 <b>加粗</b>。公式或变量请用 $...$ 包裹（含 \\sqrt）。"""
_PROMPT_JSON_OUTPUT_INSTRUCTIONS = """请返回 JSON 对象列表，每项两个字段：id（string）和 label（string，简体中文）。键值用双引号，字符串内可用单引号。"""


def _create_summary_span(raw_label: str) -> ElowenSpan:
    """Parses a raw string label, potentially with formatting, into a ElowenSpan."""
    spans = convert_raw_output_to_spans(raw_label, skip_tokenize=True)
    if spans:
        return spans[0]

    return ElowenSpan(
        id=get_unique_id(),
        text=raw_label,
        inner_tags=[],
    )


def generate_elowen_summaries(
    document: ElowenDoc,
    options: FetchElowenSummariesRequestOptions = FetchElowenSummariesRequestOptions(
        include_content_summaries=True,
        include_section_summaries=True,
        include_span_summaries=True,
        include_abstract_excerpt=True,
    ),
) -> ElowenSummaries:
    """Generates Elowen summaries."""
    elowen_summaries = ElowenSummaries(
        section_summaries=[], content_summaries=[], span_summaries=[]
    )

    if options.include_section_summaries:
        section_summaries = generate_section_summaries(document)
        elowen_summaries.section_summaries.extend(section_summaries)

    if options.include_content_summaries:
        content_summaries = generate_content_summaries(document)
        elowen_summaries.content_summaries.extend(content_summaries)

    if options.include_span_summaries:
        span_summaries = generate_span_summaries(document)
        elowen_summaries.span_summaries.extend(span_summaries)

    if options.include_abstract_excerpt and document.abstract:
        abstract_excerpt_span_id = _select_abstract_excerpt(document)
        elowen_summaries.abstract_excerpt_span_id = abstract_excerpt_span_id

    return elowen_summaries


def _get_all_spans_from_doc(document: ElowenDoc) -> List[ElowenSpan]:
    """Extracts all ElowenSpan objects from a ElowenDoc by iterating through its contents."""
    all_spans = []

    def _collect_spans_recursive(sections: List[ElowenSection]):
        for section in sections:
            for content in section.contents:
                all_spans.extend(_get_spans_from_content(content))
            if section.sub_sections:
                _collect_spans_recursive(section.sub_sections)

    _collect_spans_recursive(document.sections)
    return all_spans


def _get_spans_from_content(content: ElowenContent) -> List[ElowenSpan]:
    """Extracts all ElowenSpan objects from a ElowenContent block."""
    content_spans = []
    if content.text_content:
        content_spans.extend(content.text_content.spans)
    elif content.list_content:

        def extract_spans_from_list(list_content: ListContent) -> List[ElowenSpan]:
            spans: List[ElowenSpan] = []
            for item in list_content.list_items:
                spans.extend(item.spans)
                if item.subListContent:
                    spans.extend(extract_spans_from_list(item.subListContent))
            return spans

        content_spans.extend(extract_spans_from_list(content.list_content))
    return content_spans


def _get_text_from_content(content: ElowenContent) -> str:
    """Gets the concatenated text from all spans within a ElowenContent."""
    spans = _get_spans_from_content(content)
    return " ".join(span.text for span in spans)


def _get_text_from_section(section: ElowenSection) -> str:
    """Gets the concatenated text from all spans within a ElowenSection, including sub-sections."""
    all_text = []
    for content in section.contents:
        all_text.append(_get_text_from_content(content))
    if section.sub_sections:
        for sub_section in section.sub_sections:
            all_text.append(_get_text_from_section(sub_section))
    return " ".join(all_text)


# ------------------------------------------------------------------------------
# Abstract Excerpt
# ------------------------------------------------------------------------------
def _select_abstract_excerpt_prompt(spans: List[ElowenSpan]) -> str:
    """Generates a prompt to select the most important sentence from an abstract."""
    formatted_spans = prompt_utils.get_formatted_spans_list(spans)
    spans_string = "\n".join(formatted_spans)
    prompt = f"""You will be given the sentences from a document's abstract. Your task is to identify the single most important sentence that best summarizes the core contribution or finding of the paper.
Here are the sentences:
{spans_string}

Please return only the 'id' of the most important sentence as a JSON object with a single key "id". For example: {{"id": "s123"}}.
"""
    return prompt


def _select_abstract_excerpt(document: ElowenDoc) -> str | None:
    """Identifies the most important sentence from the abstract."""
    if not document.abstract:
        return None

    abstract_spans: List[ElowenSpan] = []
    for content in document.abstract.contents:
        abstract_spans.extend(_get_spans_from_content(content))

    if not abstract_spans:
        return None

    prompt = _select_abstract_excerpt_prompt(abstract_spans)
    response = gemini.call_predict_with_schema(
        prompt, response_schema=AbstractExcerptSchema
    )

    if response and response.id:
        return response.id
    else:
        print(f"Failed to generate abstract excerpt response.")
        return None


# ------------------------------------------------------------------------------
# Span summaries.
# ------------------------------------------------------------------------------
def _generate_span_summaries_prompt(spans: List[ElowenSpan]) -> str:
    """Generates a prompt for sentence role labels (grouped in the UI)."""
    formatted_spans = prompt_utils.get_formatted_spans_list(spans)

    spans_string = "\n".join(formatted_spans)
    prompt = f"""你将收到若干论文句子。请为每个句子打一个「内容角色」短标签，用于段落侧栏按类合并展示，而不是逐句摘要。

标签规则：
1. 标签表示该句在论证中的角色，优先从下列类别选取（可略作具体化，仍保持短）：
   - 背景原因（为何重要、问题从何而来）
   - 方法策略（做法、算法、公式、步骤）
   - 定义概念（术语、符号含义）
   - 对比局限（已有方法不足、挑战）
   - 结果证据（实验、数据、结论）
   - 贡献目标（本文要做什么）
2. 同一话题下语义相近的句子必须使用完全相同的标签文案（逐字相同），以便界面合并成一条。
3. 每个局部话题通常只需 2–4 个不同标签；严禁给每句造独特短语。
4. 标签长度 2–8 个汉字，不要句号，不要复述整句内容。

{_PROMPT_FORMATTING_INSTRUCTIONS}
句子列表：
{spans_string}

请用简体中文作答。

{_PROMPT_JSON_OUTPUT_INSTRUCTIONS}
"""
    return prompt


def generate_span_summaries(
    document: ElowenDoc,
    batch_size: int = SPAN_SUMMARIES_DEFAULT_BATCH_SIZE,
) -> List[ElowenSummary]:
    """Generates sentence labels."""
    spans = _get_all_spans_from_doc(document)
    all_summaries: List[ElowenSummary] = []

    prompts = []
    for i in range(0, len(spans), batch_size):
        sentences = spans[i : i + batch_size]
        prompt = _generate_span_summaries_prompt(sentences)
        prompts.append(prompt)

    for prompt in prompts:
        schema_labels = gemini.call_predict_with_schema(
            prompt, response_schema=list[LabelSchema]
        )
        if schema_labels:
            # Convert from List[LabelSchema] to List[ElowenSummary]
            summaries = [
                ElowenSummary(id=sl.id, summary=_create_summary_span(sl.label))
                for sl in schema_labels
            ]
            all_summaries.extend(summaries)
        else:
            print(f"Failed to parse JSON response for span summaries.")
            continue

    return all_summaries


# ------------------------------------------------------------------------------
# Section summaries.
# ------------------------------------------------------------------------------
def _get_all_sections_with_text(document: ElowenDoc) -> List[Dict[str, str]]:
    """Recursively collects all sections and their text from a ElowenDoc."""
    section_data = []

    def _collect_recursive(sections: List[ElowenSection]):
        for section in sections:
            section_data.append(
                {"id": section.id, "text": _get_text_from_section(section)}
            )
            if section.sub_sections:
                _collect_recursive(section.sub_sections)

    _collect_recursive(document.sections)
    return section_data


def _generate_section_summaries_prompt(section_data: List[Dict[str, str]]) -> str:
    """Generates a prompt for section labels."""
    section_strings = [
        "{{ id: {id}, text: {text}}}".format(id=s["id"], text=s["text"])
        for s in section_data
        if len(s["text"]) > MIN_CHARACTER_LENGTH
    ]
    section_string = "\n".join(section_strings)
    prompt = f"""你将收到论文各章节内容。请为每个章节写一句易懂的简体中文摘要（约 18–40 个汉字）：说明该章主要讲什么、关键贡献或结论是什么，避免过短标签。{_PROMPT_FORMATTING_INSTRUCTIONS}
章节内容：
{section_string}

请用简体中文作答。

{_PROMPT_JSON_OUTPUT_INSTRUCTIONS}
"""
    return prompt


def generate_section_summaries(
    document: ElowenDoc,
    batch_size: int = SECTION_SUMMARIES_DEFAULT_BATCH_SIZE,
) -> List[ElowenSummary]:
    """Generates section labels."""
    all_summaries: List[ElowenSummary] = []
    all_sections_data = _get_all_sections_with_text(document)

    for i in range(0, len(all_sections_data), batch_size):
        batch_data = all_sections_data[i : i + batch_size]
        prompt = _generate_section_summaries_prompt(batch_data)
        schema_labels = gemini.call_predict_with_schema(
            prompt, response_schema=list[LabelSchema]
        )

        if schema_labels:
            # Convert from List[LabelSchema] to List[ElowenSummary]
            summaries = [
                ElowenSummary(id=sl.id, summary=_create_summary_span(sl.label))
                for sl in schema_labels
            ]
            all_summaries.extend(summaries)
        else:
            print(f"Failed to parse JSON response for section summaries.")
            continue
    return all_summaries


# ------------------------------------------------------------------------------
# Content summaries.
# ------------------------------------------------------------------------------
def _get_all_contents_with_text(document: ElowenDoc) -> List[Dict[str, str]]:
    """Recursively collects all content blocks and their text from a ElowenDoc."""
    content_data = []

    def _collect_recursive(sections: List[ElowenSection]):
        for section in sections:
            for content in section.contents:
                if content.text_content or content.list_content:
                    content_data.append(
                        {"id": content.id, "text": _get_text_from_content(content)}
                    )
            if section.sub_sections:
                _collect_recursive(section.sub_sections)

    _collect_recursive(document.sections)
    return content_data


def _get_generate_content_summaries_prompt(content_data: List[Dict[str, str]]) -> str:
    """Generates a prompt for content labels."""
    content_strings = [
        "{{ id: {id}, text: {text}}}".format(id=c["id"], text=c["text"])
        for c in content_data
        if len(c["text"]) > MIN_CHARACTER_LENGTH
    ]
    content_string = "\n".join(content_strings)
    prompt = f"""你将收到若干论文段落。请为每个段落用简体中文写导读，帮助非专家读者快速理解：

1. gist：这段在讲什么。写 1–2 句完整中文（约 25–60 个汉字），说清对象、做法或结论，避免电报式短语。
2. purpose：作者写这段的用意。写 1 句完整中文（约 12–28 个汉字），说明修辞角色（如引入问题、铺垫背景、给出定义、描述方法、对比实验、总结贡献等），不要只写两三个字的标签。

要求：
- 尽量具体，点出关键术语/方法名，但不要逐句翻译整段
- 不要编造原文没有的信息
- gist 里可用 <b>关键术语</b> 加粗

{_PROMPT_FORMATTING_INSTRUCTIONS}
段落内容：
{content_string}

请返回 JSON 对象列表，每项字段：id（string）、gist（string）、purpose（string）。键值用双引号。
"""
    return prompt


def generate_content_summaries(
    document: ElowenDoc,
    batch_size: int = CONTENT_SUMMARIES_DEFAULT_BATCH_SIZE,
) -> List[ElowenSummary]:
    """Generates content labels."""
    all_summaries: List[ElowenSummary] = []
    all_contents_data = _get_all_contents_with_text(document)

    for i in range(0, len(all_contents_data), batch_size):
        batch_data = all_contents_data[i : i + batch_size]
        prompt = _get_generate_content_summaries_prompt(batch_data)
        schema_labels = gemini.call_predict_with_schema(
            prompt, response_schema=list[ContentLabelSchema]
        )

        if schema_labels:
            summaries = [
                ElowenSummary(
                    id=sl.id,
                    summary=_create_summary_span(sl.gist),
                    purpose=_create_summary_span(sl.purpose),
                )
                for sl in schema_labels
            ]
            all_summaries.extend(summaries)
        else:
            print(f"Failed to parse JSON response for content summaries.")
            continue

    return all_summaries
