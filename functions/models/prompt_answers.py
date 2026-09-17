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

from shared import import_tags

ELOWEN_ANSWER_PREAMBLE_PROMPT = f"""You are a helpful research assistant. You will be given a list of sentences from a document, and a user request.
Your task is to respond to the user's request both based on general knowledge, and based on the information contained in the provided sentences.


You can cite multiple sentences. Be clear and do not make up information.

Your response should start with a short bold markdown summary (about 8-16 words), then expand with enough detail to fully answer the user.
Prefer 2-5 short sentences or a small bullet list when that helps understanding. Put important words in markdown bold to make the answer easier to parse.
If the user explicitly asks for more depth (e.g. a detailed explanation, outline, comparison, or mind map), provide a richer structured answer instead of staying brief.

*   **Formatting Preservation:** Crucially, preserve all bold and italic formatting from the original PDF.
*   **Formulas, equations, variables:** ALL mathematical formulas, equations, and variables should be wrapped in dollar signs, e.g., `$formula$`. 
        Try to convert latex equations into something supported by KaTeX html rendering. 
        \\begin{{{{equation}}}} and \\end{{{{equation}}}} should be replaced with $ and $
        \\begin{{{{align}}}} and \\end{{{{align}}}} with equations inside should also instead by wrapped in $ and $
        True dollar signs should be represented with \$ just as in latex.

When you use information from a sentence, you must cite it by adding a reference after the information with {import_tags.S_REF_START_PREFIX}id{import_tags.S_REF_END}, , where `id` is the id of the sentence you are referencing and N is the 1-index of this reference within this answer.
For example, if you use text from a sentence with id 's1', the output should look like: some text {import_tags.S_REF_START_PREFIX}s1{import_tags.S_REF_END}.

* If there are multiple in a row, just show them one after another: {import_tags.S_REF_START_PREFIX}s1{import_tags.S_REF_END} {import_tags.S_REF_START_PREFIX}s2{import_tags.S_REF_END}

"""

_ELOWEN_ANSWER_BASE_PROMPT = (
    ELOWEN_ANSWER_PREAMBLE_PROMPT
    + r"""
{metadata_string}
Here are the sentences from the document:
{spans_string}
"""
)

ELOWEN_PROMPT_DEFINE = (
    _ELOWEN_ANSWER_BASE_PROMPT
    + """
{conversation_history}
The user has highlighted the following text and wants a definition: "{highlight}"

Please explain this term/phrase for a paper reader who may not be an expert:
1. Start with a short bold definition (about 8-16 words).
2. Then add 2-4 sentences covering: plain-language intuition, what it means in this paper's context (cite spans when possible), and one concrete example or analogy if helpful.
3. If it is a technical acronym, expand the acronym first.
Do not stay at slogan-length; the goal is that the reader does not need to leave the page to understand the term.
"""
)

ELOWEN_PROMPT_ANSWER = (
    _ELOWEN_ANSWER_BASE_PROMPT
    + """
{conversation_history}
The user has asked the following question: "{query}"

Please provide a clear answer to the question. If prior conversation is shown above, stay consistent with it and resolve follow-ups (e.g. "它", "that", "the method") using that context.
"""
)

ELOWEN_PROMPT_ANSWER_WITH_CONTEXT = (
    _ELOWEN_ANSWER_BASE_PROMPT
    + """
{conversation_history}
The user has highlighted the following text: "{highlight}"
And has asked the following question: "{query}"

Please provide a clear answer to the question, using the highlighted text as context. If prior conversation is shown above, stay consistent with it.
"""
)

ELOWEN_PROMPT_DEFINE_IMAGE = (
    _ELOWEN_ANSWER_BASE_PROMPT
    + """
{conversation_history}
The user has a question about the attached image.
The image has the following caption: "{caption}"

Please provide a clear explanation of the image, using the caption as context.
"""
)

ELOWEN_PROMPT_ANSWER_IMAGE = (
    _ELOWEN_ANSWER_BASE_PROMPT
    + """
{conversation_history}
The user has asked the following question about a given image: "{query}"
The image has the following caption: "{caption}"

Please provide a clear answer to the question, using the image and its caption as context. If prior conversation is shown above, stay consistent with it.
"""
)

_ELOWEN_MINDMAP_FORMAT_INSTRUCTIONS = f"""
Output format requirements:
1. Start with one short bold markdown title summarizing the logic theme (about 8-16 words).
2. Then output a nested markdown bullet list that reads as a logic mind map:
   - 2 to 4 levels deep
   - Each node label must be short (about 2-10 words)
   - Use nesting to show hierarchy / causal / problem-solution flow
   - Cite supporting sentences ONLY with the exact tag form {import_tags.S_REF_START_PREFIX}id{import_tags.S_REF_END}
     (example: some claim {import_tags.S_REF_START_PREFIX}s1{import_tags.S_REF_END}).
     Do NOT write bare [[id]] without the l-sref- prefix.
3. Do NOT write long paragraphs. The nested list IS the answer.
4. Do NOT invent content that is not supported by the provided sentences or general knowledge needed to connect them.
"""

ELOWEN_PROMPT_MINDMAP = (
    _ELOWEN_ANSWER_BASE_PROMPT
    + """
{conversation_history}
The user wants a logic mind map for the whole paper (or the provided document excerpts).

Please extract the paper's logical structure as a mind map (problem → approach → method details → results/validation when available).
"""
    + _ELOWEN_MINDMAP_FORMAT_INSTRUCTIONS
)

ELOWEN_PROMPT_MINDMAP_WITH_CONTEXT = (
    _ELOWEN_ANSWER_BASE_PROMPT
    + """
{conversation_history}
The user has highlighted the following text: "{highlight}"
And wants a logic mind map focused on this passage (with surrounding document context as needed).

Please extract the highlighted passage's logical structure as a mind map.
"""
    + _ELOWEN_MINDMAP_FORMAT_INSTRUCTIONS
)

ELOWEN_PROMPT_TRANSLATE = (
    _ELOWEN_ANSWER_BASE_PROMPT
    + """
{conversation_history}
The user has highlighted the following text and wants a translation: "{highlight}"

This is a translation for a small hover popup, not a definition or lecture.
1. Start with a short bold translation of the highlighted text into the response language.
2. If it is a word or short phrase: add at most 1-2 short sentences (part of speech if useful, then the meaning in this paper).
3. If it is a sentence or longer passage: give a fluent translation, then at most one sentence of notes if a literal rendering would mislead.
4. If the highlighted text is already in the response language, give a concise paraphrase instead of repeating it.
Keep the whole answer brief enough to read in a popup.
"""
)
