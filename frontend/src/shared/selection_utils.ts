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
