"""Generates answers to user queries based on document context."""

import time
from typing import List, Optional, Sequence

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

# Keep prompt size bounded while still giving multi-turn memory.
_RECENT_FULL_TURNS = 4  # Keep these verbatim
_MAX_HISTORY_TURNS = 24  # Hard cap of turns considered
_MAX_HISTORY_ANSWER_CHARS = 1200  # Per-turn truncation before summarize/format
_MAX_PLAIN_HISTORY_CHARS = 5000  # Above this, compress older turns
_MAX_SUMMARY_CHARS = 1500


def _wants_mindmap(request: ElowenAnswerRequest) -> bool:
    """True when the client requested a mind map or the query clearly asks for one."""
    if (request.response_mode or "").lower() == "mindmap":
        return True
    query = (request.query or "").lower()
    return any(keyword in query for keyword in _MINDMAP_QUERY_KEYWORDS)


def _wants_translate(request: ElowenAnswerRequest) -> bool:
    """True when the client asked to translate the highlighted text."""
    return (request.response_mode or "").lower() == "translate"


def _content_plain_text(contents: Sequence[ElowenContent] | None) -> str:
    if not contents:
        return ""
    parts: list[str] = []
    for content in contents:
        text_content = getattr(content, "text_content", None)
        if text_content and getattr(text_content, "spans", None):
            parts.append(
                " ".join(
                    span.text
                    for span in text_content.spans
                    if getattr(span, "text", None)
                )
            )
        list_content = getattr(content, "list_content", None)
        if list_content and getattr(list_content, "items", None):
            for item in list_content.items:
                nested = getattr(item, "contents", None) or getattr(
                    item, "content", None
                )
                if nested:
                    parts.append(
                        _content_plain_text(
                            nested if isinstance(nested, list) else [nested]
                        )
                    )
                elif getattr(item, "spans", None):
                    parts.append(
                        " ".join(
                            span.text
                            for span in item.spans
                            if getattr(span, "text", None)
                        )
                    )
    return " ".join(p for p in parts if p).strip()


def _turn_user_text(answer: ElowenAnswer) -> str:
    req = answer.request
    user_bits = []
    if req.query:
        user_bits.append(req.query.strip())
    if req.highlight:
        user_bits.append(f"(highlighted: {req.highlight.strip()[:300]})")
    if req.image and req.image.caption:
        user_bits.append(f"(image: {req.image.caption.strip()[:200]})")
    return " ".join(user_bits) or "(no query text)"


def _turn_assistant_text(answer: ElowenAnswer) -> str:
    assistant_text = _content_plain_text(answer.response_content)
    if len(assistant_text) > _MAX_HISTORY_ANSWER_CHARS:
        return assistant_text[:_MAX_HISTORY_ANSWER_CHARS] + "…"
    return assistant_text or "(empty)"


def _format_turns(turns: Sequence[ElowenAnswer], start_index: int = 1) -> str:
    blocks: list[str] = []
    for i, answer in enumerate(turns, start=start_index):
        blocks.append(
            f"Turn {i}\nUser: {_turn_user_text(answer)}\n"
            f"Assistant: {_turn_assistant_text(answer)}"
        )
    return "\n\n".join(blocks)


def _history_plain_char_count(turns: Sequence[ElowenAnswer]) -> int:
    return sum(
        len(_turn_user_text(a)) + len(_turn_assistant_text(a)) for a in turns
    )


def _summarize_older_turns(
    older_turns: Sequence[ElowenAnswer],
    api_key: str | None,
    model_config: dict | None,
    prior_summary: str | None = None,
) -> str:
    """LLM-compress older turns into a short rolling summary."""
    older_text = _format_turns(older_turns)
    if not older_text and not prior_summary:
        return ""

    prior_block = ""
    if prior_summary and prior_summary.strip():
        prior_block = (
            "Existing summary of even earlier conversation:\n"
            f"{prior_summary.strip()}\n\n"
        )

    prompt = f"""Compress the following paper Q&A conversation into a concise memory note.
Keep: entities, methods, definitions the user cared about, unresolved follow-ups, and user preferences.
Drop: greetings, repeated wording, long citations, and boilerplate.
Write 5-12 tight bullet points (or a short paragraph if better). Max ~200 words.
Do not answer a new question — only summarize.

{prior_block}Conversation to compress:
{older_text}
"""
    try:
        summary = gemini.call_predict(
            prompt, api_key=api_key, model_config=model_config
        )
        summary = (summary or "").strip()
        if len(summary) > _MAX_SUMMARY_CHARS:
            summary = summary[:_MAX_SUMMARY_CHARS] + "…"
        return summary
    except Exception:
        # Fallback: truncate concatenated older turns
        fallback = older_text
        if prior_summary:
            fallback = prior_summary.strip() + "\n\n" + fallback
        if len(fallback) > _MAX_SUMMARY_CHARS:
            return fallback[:_MAX_SUMMARY_CHARS] + "…"
        return fallback


def build_conversation_history_block(
    prior_answers: Optional[Sequence[ElowenAnswer]],
    api_key: str | None = None,
    model_config: dict | None = None,
    existing_summary: str | None = None,
) -> tuple[str, str]:
    """
    Build the history section for the ask prompt.

    Returns ``(prompt_block, updated_summary)``.

    Strategy:
    - Keep the last ``_RECENT_FULL_TURNS`` verbatim.
    - If there are older turns, LLM-compress them (optionally folding in
      ``existing_summary``) into a short rolling summary.
    """
    turns = list(prior_answers or [])[-_MAX_HISTORY_TURNS:]
    summary = (existing_summary or "").strip()

    if not turns and not summary:
        return "", ""

    if len(turns) <= _RECENT_FULL_TURNS and _history_plain_char_count(turns) <= _MAX_PLAIN_HISTORY_CHARS:
        parts: list[str] = [
            "Prior conversation on this paper (use for follow-ups; do not "
            "repeat verbatim unless asked):"
        ]
        if summary:
            parts.append(f"Earlier conversation summary:\n{summary}")
        if turns:
            parts.append(_format_turns(turns))
        return "\n\n".join(parts) + "\n", summary

    recent = turns[-_RECENT_FULL_TURNS:]
    older = turns[:-_RECENT_FULL_TURNS]

    if older:
        # Only compress newly provided older turns; fold into prior summary.
        summary = _summarize_older_turns(
            older, api_key, model_config, prior_summary=summary or None
        )
    elif not summary:
        summary = ""

    parts = [
        "Prior conversation on this paper (use for follow-ups; do not "
        "repeat verbatim unless asked):"
    ]
    if summary:
        parts.append(f"Earlier conversation summary:\n{summary}")
    if recent:
        parts.append(
            "Recent conversation:\n"
            + _format_turns(
                recent, start_index=max(1, len(turns) - len(recent) + 1)
            )
        )
    return "\n\n".join(parts) + "\n", summary


def _format_conversation_history(
    prior_answers: Optional[Sequence[ElowenAnswer]],
    api_key: str | None = None,
    model_config: dict | None = None,
    existing_summary: str | None = None,
) -> str:
    """Backward-compatible helper that returns only the prompt block."""
    block, _ = build_conversation_history_block(
        prior_answers,
        api_key=api_key,
        model_config=model_config,
        existing_summary=existing_summary,
    )
    return block



def generate_elowen_answer(
    doc: ElowenDoc,
    request: ElowenAnswerRequest,
    api_key: str | None,
    model_config: dict | None = None,
    prior_answers: Optional[Sequence[ElowenAnswer]] = None,
    conversation_summary: str | None = None,
) -> tuple[ElowenAnswer, str]:
    """
    Generates a ElowenAnswer by calling the configured LLM.

    ``prior_answers`` is optional conversation history on this paper (oldest first).
    ``conversation_summary`` is an optional rolling summary of even older turns.

    Returns ``(answer, updated_conversation_summary)``.
    """
    query = request.query
    highlight = request.highlight
    image_info = request.image
    wants_mindmap = _wants_mindmap(request)
    wants_translate = _wants_translate(request)
    conversation_history, updated_summary = build_conversation_history_block(
        prior_answers,
        api_key=api_key,
        model_config=model_config,
        existing_summary=conversation_summary,
    )

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
                conversation_history=conversation_history,
            )
        else:
            prompt = prompts.ELOWEN_PROMPT_MINDMAP.format(
                spans_string=spans_string,
                metadata_string=metadata_string,
                conversation_history=conversation_history,
            )
        request.response_mode = "mindmap"
    elif wants_translate and highlight and not image_info:
        prompt = prompts.ELOWEN_PROMPT_TRANSLATE.format(
            spans_string=spans_string,
            highlight=highlight,
            metadata_string=metadata_string,
            conversation_history=conversation_history,
        )
        request.response_mode = "translate"
    elif image_info:
        caption = image_info.caption or ""
        if query:
            prompt = prompts.ELOWEN_PROMPT_ANSWER_IMAGE.format(
                spans_string=spans_string,
                query=query,
                caption=caption,
                metadata_string=metadata_string,
                conversation_history=conversation_history,
            )
        else:
            prompt = prompts.ELOWEN_PROMPT_DEFINE_IMAGE.format(
                spans_string=spans_string,
                caption=caption,
                metadata_string=metadata_string,
                conversation_history=conversation_history,
            )
    else:
        if query and highlight:
            prompt = prompts.ELOWEN_PROMPT_ANSWER_WITH_CONTEXT.format(
                spans_string=spans_string,
                highlight=highlight,
                query=query,
                metadata_string=metadata_string,
                conversation_history=conversation_history,
            )
        elif query:
            prompt = prompts.ELOWEN_PROMPT_ANSWER.format(
                spans_string=spans_string,
                query=query,
                metadata_string=metadata_string,
                conversation_history=conversation_history,
            )
        elif highlight:
            prompt = prompts.ELOWEN_PROMPT_DEFINE.format(
                spans_string=spans_string,
                highlight=highlight,
                metadata_string=metadata_string,
                conversation_history=conversation_history,
            )
        else:
            raise ValueError("Request must include at least a query or a highlight.")

    prompt += prompt_utils.get_response_language_instruction(model_config)

    if image_info:
        image_bytes = image_utils.download_image_from_gcs(image_info.image_storage_path)
        markdown_response = gemini.call_predict_with_image(
            prompt=prompt,
            image_bytes=image_bytes,
            api_key=api_key,
            model_config=model_config,
        )
    else:
        markdown_response = gemini.call_predict(
            prompt, api_key=api_key, model_config=model_config
        )

    markdown_response = markdown_utils.normalize_bare_span_refs(markdown_response)
    markdown_response, equation_map = markdown_utils.extract_equations_to_placeholders(
        markdown_response
    )
    html_response = markdown_utils.markdown_to_html(markdown_response)

    response_sections = convert_html_to_elowen.convert_to_elowen_sections(
        html_response, placeholder_map=equation_map, strip_double_brackets=True
    )

    response_content: List[ElowenContent] = []
    for section in response_sections:
        response_content.extend(section.contents)

    if not response_content:
        fallback_span = ElowenSpan(
            id=get_unique_id(), text=markdown_response, inner_tags=[]
        )
        fallback_text_content = TextContent(tag_name="p", spans=[fallback_span])
        fallback_content = ElowenContent(
            id=get_unique_id(), text_content=fallback_text_content
        )
        response_content = [fallback_content]

    return (
        ElowenAnswer(
            id=get_unique_id(),
            request=request,
            response_content=response_content,
            timestamp=int(time.time()),
        ),
        updated_summary,
    )


def remove_p_tags(html_string: str):
    html_string = html_string.strip()
    if html_string.startswith("<p>"):
        html_string = html_string[3:]
    if html_string.endswith("</p>"):
        html_string = html_string[:-4]
    return html_string
