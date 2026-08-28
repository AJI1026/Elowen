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

import {
  InnerTagName,
  ListContent,
  ElowenContent,
  ElowenSection,
  ElowenSpan,
} from "./elowen_doc";

/**
 * Extracts all unique referenced span IDs from the `spanref` tags within an
 * array of ElowenContent objects.
 *
 * @param contents The `ElowenContent[]` that may contain `spanref` tags.
 * @returns A unique array of referenced span IDs.
 */
export function getReferencedSpanIdsFromContent(
  contents: ElowenContent[]
): string[] {
  const referencedIds = new Set<string>();

  function findRefsInSpans(spans: ElowenSpan[]) {
    for (const span of spans) {
      for (const tag of span.innerTags) {
        if (tag.tagName === InnerTagName.SPAN_REFERENCE && tag.metadata?.id) {
          referencedIds.add(tag.metadata.id);
        }
      }
    }
  }

  function addAllRefs(currentContents: ElowenContent[]) {
    for (const content of currentContents) {
      if (content.textContent) {
        findRefsInSpans(content.textContent.spans);
      }
      if (content.listContent) {
        for (const item of content.listContent.listItems) {
          findRefsInSpans(item.spans);
          if (item.subListContent) {
            for (const subItem of item.subListContent.listItems) {
              findRefsInSpans(subItem.spans);
            }
          }
        }
      }

      if (content.imageContent?.caption) {
        findRefsInSpans([content.imageContent.caption]);
      }
      if (content.htmlFigureContent?.caption) {
        findRefsInSpans([content.htmlFigureContent.caption]);
      }
    }
  }

  addAllRefs(contents);
  return Array.from(referencedIds);
}

/**
 * Recursively traverses a ElowenSection and its subSections to collect all
 * ElowenContent objects into a single flat array.
 *
 * @param section The root `ElowenSection` to start traversal from.
 * @returns A flat array of all `ElowenContent` objects found.
 */
export function getAllContents(section: ElowenSection): ElowenContent[] {
  const allContents: ElowenContent[] = [];

  function traverse(currentSection: ElowenSection) {
    allContents.push(...currentSection.contents);

    if (currentSection.subSections) {
      for (const subSection of currentSection.subSections) {
        traverse(subSection);
      }
    }
  }

  traverse(section);
  return allContents;
}

/**
 * Extracts all `ElowenSpan` objects from an array of `ElowenContent` objects.
 * This function recursively traverses different content types (text, lists,
 * captions) to find all spans.
 *
 * @param contents The array of `ElowenContent` objects to search through.
 * @returns A flattened array of all `ElowenSpan` objects found.
 */
export function getAllSpansFromContents(contents: ElowenContent[]): ElowenSpan[] {
  const allSpans: ElowenSpan[] = [];

  function findSpansInList(listContent: ListContent) {
    for (const item of listContent.listItems) {
      allSpans.push(...item.spans);
      if (item.subListContent) {
        findSpansInList(item.subListContent);
      }
    }
  }

  for (const content of contents) {
    if (content.textContent?.spans) {
      allSpans.push(...content.textContent.spans);
    }
    if (content.listContent) {
      findSpansInList(content.listContent);
    }
    if (content.imageContent?.caption) {
      allSpans.push(content.imageContent.caption);
    }
    if (content.figureContent?.caption) {
      allSpans.push(content.figureContent.caption);
    }
    if (content.htmlFigureContent?.caption) {
      allSpans.push(content.htmlFigureContent.caption);
    }
  }

  return allSpans;
}

const PREVIEW_MAX_LENGTH = 120;

/** Returns a plain-text preview of a content block for sidebar display. */
export function getContentPreviewText(content: ElowenContent): string {
  const spans = getAllSpansFromContents([content]);
  const text = spans.map((span) => span.text).join(" ").replace(/\s+/g, " ").trim();
  if (text.length <= PREVIEW_MAX_LENGTH) {
    return text;
  }
  return `${text.slice(0, PREVIEW_MAX_LENGTH)}…`;
}
