/**
 * @license
 * Copyright 2025 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import { CITATION_CLASSNAME, FOOTNOTE_CLASSNAME } from "./constants";
import { Position } from "./elowen_doc";

// Helper to find a parent element matching a condition
function findParent(
  startNode: Node,
  condition: (el: HTMLElement) => boolean
): HTMLElement | null {
  let current: Node | null = startNode;
  while (current) {
    if (current instanceof HTMLElement && condition(current)) {
      return current;
    }
    // Use parentElement for traversing up the DOM tree
    current = current.parentElement;
  }
  return null;
}

export interface HighlightSelection {
  spanId: string;
  position?: Position;
}

/**
 * An interface describing the information returned for a valid text selection
 * within a <elowen-span> element.
 */
export interface SelectionInfo {
  selectedText: string;
  parentSpan: HTMLElement;
  highlightSelection: HighlightSelection[];
}

/**
 * KaTeX DOM selection often inserts a newline between every math token
 * (e.g. "o\\ng\\n" for $o_g$). Collapse that into readable horizontal text.
 */
export function normalizeSelectionText(text: string): string {
  const trimmed = text.replace(/\r\n/g, "\n").trim();
  if (!trimmed.includes("\n")) {
    return trimmed;
  }

  const lines = trimmed
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.length > 0);

  if (lines.length <= 1) {
    return lines[0] ?? "";
  }

  const shortLineRatio =
    lines.filter((line) => line.length <= 16).length / lines.length;
  // Mostly fragmented tokens from KaTeX / inline markup.
  if (shortLineRatio >= 0.5) {
    let out = "";
    for (const line of lines) {
      if (!out) {
        out = line;
        continue;
      }
      const prev = out[out.length - 1] ?? "";
      const afterEnglishWord =
        /[A-Za-z]{3,}$/.test(out) && /^[A-Za-zτσαβγ]$/.test(line);
      const tightGlue =
        !afterEnglishWord &&
        (line.length <= 2 ||
          /^[^\w\s]$/.test(line) ||
          /^[^\w\s]$/.test(prev) ||
          /^(max|min|mid|sin|cos|tan|log|exp|inf|sup|lim|arg|mod)$/i.test(
            line
          ));
      out += tightGlue ? line : ` ${line}`;
    }
    return out.replace(/[ \t]{2,}/g, " ").trim();
  }

  // Ordinary multi-line selection: join with spaces.
  return lines.join(" ").replace(/[ \t]{2,}/g, " ").trim();
}

function isTextCharElement(el: Element): el is HTMLElement {
  if (!(el instanceof HTMLElement)) return false;
  if (
    el.classList.contains(CITATION_CLASSNAME) ||
    el.classList.contains(FOOTNOTE_CLASSNAME)
  ) {
    return false;
  }
  if (el.classList.contains("equation") || el.classList.contains("katex")) {
    return false;
  }
  if (el.tagName === "A" || el.tagName === "SUP") return false;
  return (el.textContent ?? "").length > 0;
}

/** True when the click target should not trigger click-to-translate. */
export function shouldSkipWordTranslate(target: HTMLElement): boolean {
  if (target.closest("a, button, pr-button, input, textarea")) return true;
  if (target.classList.contains("concept") || target.closest(".concept")) {
    return true;
  }
  if (target.classList.contains("clickable") || target.closest(".clickable")) {
    return true;
  }
  if (
    target.closest(
      `.${CITATION_CLASSNAME}, .${FOOTNOTE_CLASSNAME}, .equation, .katex`
    )
  ) {
    return true;
  }
  return false;
}

/** Innermost paper character span from a click, if any. */
export function characterElementFromEvent(event: Event): HTMLElement | null {
  for (const node of event.composedPath()) {
    if (!(node instanceof HTMLElement)) continue;
    if (node.classList.contains("character")) return node;
  }
  return null;
}

function wordRangeAt(text: string, index: number): { start: number; end: number; text: string } | null {
  if (index < 0 || index >= text.length) return null;

  const ch = text[index] ?? "";
  if (/\p{Script=Han}/u.test(ch)) {
    return { start: index, end: index + 1, text: ch };
  }
  const isWordChar = (c: string) => /[\p{L}\p{N}'’._-]/u.test(c);
  if (!isWordChar(ch)) return null;
  let start = index;
  let end = index + 1;
  while (start > 0 && isWordChar(text[start - 1] ?? "")) start--;
  while (end < text.length && isWordChar(text[end] ?? "")) end++;
  const word = text.slice(start, end).replace(/^['’._-]+|['’._-]+$/g, "");
  if (!word) return null;
  const trimmedStart = text.indexOf(word, start);
  return {
    start: trimmedStart,
    end: trimmedStart + word.length,
    text: word,
  };
}

/**
 * Expand the character under a paper click into a word, using the
 * per-character spans rendered inside `<elowen-span>`.
 */
export function getWordAtCharacterElement(
  target: HTMLElement
): SelectionInfo | null {
  const resolved = resolveWordAtCharacterElement(target);
  if (!resolved) return null;
  const { elowenSpan, children, range } = resolved;

  const anchor = children[range.startChar] ?? target;

  return {
    selectedText: range.text,
    parentSpan: anchor,
    highlightSelection: [
      {
        spanId: elowenSpan.id,
        position: { startIndex: range.start, endIndex: range.end },
      },
    ],
  };
}

interface ResolvedWord {
  elowenSpan: HTMLElement;
  /** Character spans belonging to the word, in reading order. */
  children: HTMLElement[];
  range: { start: number; end: number; text: string; startChar: number };
}

function resolveWordAtCharacterElement(
  target: HTMLElement
): ResolvedWord | null {
  const elowenSpan = target.closest("elowen-span");
  if (!(elowenSpan instanceof HTMLElement) || !elowenSpan.id) return null;

  const renderer =
    (target.closest(".elowen-span-renderer-element") as HTMLElement | null) ??
    (elowenSpan.querySelector(".elowen-span-renderer-element") as HTMLElement | null) ??
    (target.parentElement instanceof HTMLElement ? target.parentElement : null);
  if (!renderer) return null;

  const allChildren = Array.from(renderer.children).filter(isTextCharElement);
  let index = allChildren.indexOf(target);
  if (index < 0) {
    const wrapped = target.closest("span");
    if (wrapped instanceof HTMLElement) {
      index = allChildren.indexOf(wrapped);
    }
  }
  if (index < 0) return null;

  const pieces = allChildren.map((el) => el.textContent ?? "");
  const full = pieces.join("");
  let offset = 0;
  for (let i = 0; i < index; i++) {
    offset += pieces[i].length;
  }

  const range = wordRangeAt(full, offset);
  if (!range) return null;

  let startChild = 0;
  let seen = 0;
  while (
    startChild < pieces.length &&
    seen + pieces[startChild].length <= range.start
  ) {
    seen += pieces[startChild].length;
    startChild++;
  }
  let endChild = startChild;
  let seenEnd = seen;
  while (endChild < pieces.length && seenEnd < range.end) {
    seenEnd += pieces[endChild].length;
    endChild++;
  }

  return {
    elowenSpan,
    children: allChildren.slice(startChild, endChild),
    range: { ...range, startChar: startChild },
  };
}

/**
 * Character spans covered by the word under a paper hover, so the whole word
 * (not just one glyph) can be highlighted as a click affordance.
 */
export function getWordCharElements(target: HTMLElement): HTMLElement[] {
  return resolveWordAtCharacterElement(target)?.children ?? [];
}

/** True when text looks like KaTeX/tokenized clipboard fragmentation. */
export function looksLikeFragmentedClipboardText(text: string): boolean {
  if (!text.includes("\n")) return false;
  const lines = text
    .replace(/\r\n/g, "\n")
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);
  if (lines.length < 3) return false;
  const shortLineRatio =
    lines.filter((line) => line.length <= 16).length / lines.length;
  return shortLineRatio >= 0.5;
}

/**
 * Given a text node contained in a <elowen-span>, find the character offset from the start of the
 * containing <elowen-span> element.
 */
function getOffsetInElowenSpan(textNode: Node): number {
  const characterSpan = textNode.parentElement;
  if (!characterSpan) return -1;

  const elowenSpanRendererElement = characterSpan.parentElement;
  if (!elowenSpanRendererElement) return -1;

  const elowenSpanRendererChildren = Array.from(elowenSpanRendererElement.children);
  const spanIndex = elowenSpanRendererChildren.indexOf(characterSpan);

  let inlineTagOffset = 0;

  for (const element of elowenSpanRendererChildren.slice(0, spanIndex)) {
    if (
      Array.from(element.classList).includes(CITATION_CLASSNAME) ||
      Array.from(element.classList).includes(FOOTNOTE_CLASSNAME)
    ) {
      inlineTagOffset++;
    }
  }

  return spanIndex - inlineTagOffset;
}

/**
 * Processes a `Selection` object to extract information about text selected
 * within a <elowen-span> element, accounting for Shadow DOM boundaries.
 *
 * @param selection The `Selection` object from `window.getSelection()`.
 * @param shadowRoot The `shadowRoot` of the component where selection occurs.
 * @returns A `SelectionInfo` object if a valid selection is found, otherwise `null`.
 */
export function getSelectionInfo(selection: Selection): SelectionInfo | null {
  const selectedText = normalizeSelectionText(selection.toString());
  if (selectedText.length === 0) {
    return null;
  }

  const range = selection.getRangeAt(0);
  if (!range) {
    return null;
  }

  const startElowenSpan = findParent(
    range.startContainer,
    (el) => el.tagName.toLowerCase() === "elowen-span"
  );

  const endElowenSpan = findParent(
    range.endContainer,
    (el) => el.tagName.toLowerCase() === "elowen-span"
  );

  if (!startElowenSpan || !endElowenSpan || !startElowenSpan.id || !endElowenSpan.id) {
    return null;
  }

  const highlightSelection: HighlightSelection[] = [];
  const allElowenSpans: HTMLElement[] = [startElowenSpan];

  // If selection spans multiple elowen-spans, collect them all
  if (startElowenSpan !== endElowenSpan) {
    let current: Element | null = startElowenSpan;
    while (current && current !== endElowenSpan) {
      current = current.nextElementSibling;
      if (
        current instanceof HTMLElement &&
        current.tagName.toLowerCase() === "elowen-span"
      ) {
        allElowenSpans.push(current);
      }
    }
  }

  for (const elowenSpan of allElowenSpans) {
    if (!elowenSpan.id) continue;

    // Default for the middle spans is to give the
    // full offset, from the first to last character.
    let startOffset = 0;
    let endOffset = elowenSpan.textContent?.length ?? 0;

    if (elowenSpan === startElowenSpan) {
      startOffset = getOffsetInElowenSpan(range.startContainer);
    }
    if (elowenSpan === endElowenSpan) {
      endOffset = getOffsetInElowenSpan(range.endContainer);
    }

    highlightSelection.push({
      spanId: elowenSpan.id,
      position: { startIndex: startOffset, endIndex: endOffset + 1 },
    });
  }

  const firstParentSpan = findParent(
    range.startContainer,
    (el) => el.tagName.toLowerCase() === "span"
  );

  if (!firstParentSpan) {
    return null;
  }

  return {
    selectedText,
    parentSpan: firstParentSpan,
    highlightSelection,
  };
}
