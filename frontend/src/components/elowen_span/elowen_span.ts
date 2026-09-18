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

import { html, PropertyValues, TemplateResult } from "lit";
import { customElement, property, state } from "lit/decorators.js";
import { createRef, ref, Ref } from "lit/directives/ref.js";
import { consume } from "@lit/context";
import { classMap } from "lit/directives/class-map.js";
import { renderKatex } from "../../directives/katex_directive";

import { scrollContext, ScrollState } from "../../contexts/scroll_context";
import { FocusState, ElowenFont } from "../../shared/types";
import {
  HIGHLIGHT_METADATA_ANSWER_KEY,
  HIGHLIGHT_METADATA_ANNOTATION_KEY,
  CITATION_CLASSNAME,
  FOOTNOTE_CLASSNAME,
} from "../../shared/constants";
import {
  Highlight,
  InnerTagMetadata,
  InnerTagName,
  ElowenFootnote,
  ElowenReference,
  ElowenSpan,
} from "../../shared/elowen_doc";
import { HighlightManager } from "../../shared/highlight_manager";
import { AnswerHighlightManager } from "../../shared/answer_highlight_manager";
import { ElowenAnswer } from "../../shared/api";
import { UserAnnotation } from "../../shared/types_local_storage";
import { flattenTags } from "./elowen_span_utils";
import { sanitizeUnresolvedLatex } from "../../shared/string_utils";

import { styles } from "./elowen_span.scss";
import { LightMobxLitElement } from "../light_mobx_lit_element/light_mobx_lit_element";
import { styleMap } from "lit/directives/style-map.js";
import { areArraysEqual } from "../../shared/utils";

interface FormattingCounter {
  [key: string]: InnerTagMetadata;
}

interface InlineCitation {
  index: number;
  reference: ElowenReference;
}

interface InlineSpanCitation {
  index: number;
  id: string;
}

const GENERAL_HIGHLIGHT_KEY = "general_highlight_key";
const COLOR_HIGHLIGHT_KEY = "highlight_color";

/**
 * A span visualization in the Elowen visualization.
 */
@customElement("elowen-span")
export class ElowenSpanViz extends LightMobxLitElement {
  @consume({ context: scrollContext, subscribe: true })
  private scrollContext?: ScrollState;

  private spanRef: Ref<HTMLSpanElement> = createRef();

  // Component properties
  @property({ type: Object }) span!: ElowenSpan;
  @property({ type: Boolean }) monospace = false;
  @property({ type: String }) focusState = FocusState.DEFAULT;
  @property({ type: Object }) classMap: { [key: string]: boolean } = {};
  @property({ type: Boolean }) noScrollContext = false;
  @property({ type: Boolean }) showFocusUnderline = false;
  @property({ type: Boolean }) isVirtual = false;
  @property({ type: Boolean }) shouldFadeIn = false;

  // Renderer properties
  @property({ type: Array }) highlights?: Highlight[];
  @property({ type: Array }) references?: ElowenReference[];
  @property({ type: Array }) footnotes?: ElowenFootnote[];
  @property({ type: Array }) referencedSpans?: ElowenSpan[];
  @property({ type: Object }) onReferenceClicked?: (
    referenceId: string
  ) => void;
  @property({ type: Object }) onSpanReferenceClicked?: (
    referenceId: string
  ) => void;
  @property({ type: Object }) onConceptClick?: (
    conceptId: string,
    target: HTMLElement
  ) => void;
  @property({ type: Object }) onPaperReferenceClick?: (
    reference: ElowenReference,
    target: HTMLElement
  ) => void;
  @property({ type: Object }) onFootnoteClick?: (
    footnote: ElowenFootnote,
    target: HTMLElement
  ) => void;
  @property({ type: Object }) onAnswerHighlightClick?: (
    answer: ElowenAnswer,
    target: HTMLElement
  ) => void;
  @property({ type: Object }) onUserAnnotationClick?: (
    annotation: UserAnnotation,
    target: HTMLElement
  ) => void;
  @property({ type: String }) font?: ElowenFont;

  @state() private renderedContent: TemplateResult | null = null;

  protected override willUpdate(changedProperties: PropertyValues): void {
    super.willUpdate(changedProperties);

    // Compute the characters/insertions that `render()` consumes here rather
    // than in `updated()`. Lit's update is still flagged as pending during
    // `willUpdate`, so writing the `renderedContent` state does not schedule a
    // second update (which would trigger the "change-in-update" warning).
    const hasHighlightChanges =
      changedProperties.has("highlights") &&
      this.highlights &&
      !areArraysEqual(
        changedProperties.get("highlights") ?? [],
        this.highlights
      );

    if (
      changedProperties.has("span") ||
      hasHighlightChanges ||
      changedProperties.has("references") ||
      changedProperties.has("footnotes") ||
      changedProperties.has("referencedSpans")
    ) {
      this.calculateRenderedContent();
    }
  }

  override firstUpdated(_changedProperties: PropertyValues): void {
    this.id = this.span.id;
  }

  override connectedCallback() {
    super.connectedCallback();

    if (this.noScrollContext) return;

    this.updateComplete.then(() => {
      if (this.spanRef.value && this.span) {
        this.scrollContext?.registerSpan(this.span.id, this.spanRef);
      }
    });
  }

  override disconnectedCallback() {
    if (this.span && !this.noScrollContext) {
      this.scrollContext?.unregisterSpan(this.span.id);
    }
    super.disconnectedCallback();
  }

  private getSpanClassesObject() {
    const classesObject: { [key: string]: boolean } = {
      "outer-span": true,
      "span-fade-in": this.shouldFadeIn,
      monospace: this.monospace,
      focused: this.focusState === FocusState.FOCUSED,
      unfocused: this.focusState === FocusState.UNFOCUSED,
      "show-focus-underline": this.showFocusUnderline,
      ...this.classMap,
    };
    return classesObject;
  }

  private renderEquation(
    equationText: string,
    hasDisplayMathTag: boolean
  ): TemplateResult {
    const equationClasses = classMap({
      ["equation"]: true,
      ["display"]: hasDisplayMathTag,
    });
    return html`<span
      class=${equationClasses}
      ${renderKatex(equationText, hasDisplayMathTag)}
    ></span>`;
  }

  private normalizeSpanText(text: string): string {
    return sanitizeUnresolvedLatex(text);
  }

  private matchHtmlLineBreak(text: string, index: number): number {
    const brMatch = text.slice(index).match(/^<br\s*\/?>/i);
    return brMatch ? brMatch[0].length : 0;
  }

  private renderFormattedCharacter(
    character: string,
    classesAndMetadata: { [key: string]: { [key: string]: any } }
  ): TemplateResult {
    if (character === "\n") {
      return html`<br />`;
    }

    const classesObject: { [key: string]: boolean } = {};
    Object.keys(classesAndMetadata).forEach((key) => {
      classesObject[key] = true;
    });

    if (this.font) {
      classesObject[this.font] = true;
    }

    const highlightMetadata = classesAndMetadata[GENERAL_HIGHLIGHT_KEY];
    if (highlightMetadata) {
      classesObject[highlightMetadata[COLOR_HIGHLIGHT_KEY]] = true;
      if (highlightMetadata[HIGHLIGHT_METADATA_ANSWER_KEY]) {
        classesObject["clickable"] = true;
      }
      if (highlightMetadata[HIGHLIGHT_METADATA_ANNOTATION_KEY]) {
        classesObject["clickable"] = true;
      }
    }

    // REFERENCE, SPAN_REFERENCE, and FOOTNOTE tags are handled by the insertions map now.
    if (
      classesObject[InnerTagName.REFERENCE] ||
      classesObject[InnerTagName.SPAN_REFERENCE] ||
      classesObject[InnerTagName.FOOTNOTE]
    ) {
      return html``;
    }

    if (classesObject[InnerTagName.A]) {
      const metadata = classesAndMetadata[InnerTagName.A];
      const href = metadata["href"] || "#";
      // Use a real <a> tag for links.
      return html`<a
        href=${href}
        target="_blank"
        class=${classMap(classesObject)}
        >${character}</a
      >`;
    }

    const onClick = (e: MouseEvent) => {
      if (Object.keys(classesObject).includes(InnerTagName.CONCEPT)) {
        const metadata = classesAndMetadata[InnerTagName.CONCEPT];
        if (metadata["conceptId"] && this.onConceptClick) {
          this.onConceptClick(
            metadata["conceptId"],
            e.currentTarget as HTMLElement
          );
        }
      }

      if (classesAndMetadata[GENERAL_HIGHLIGHT_KEY]) {
        const metadata = classesAndMetadata[GENERAL_HIGHLIGHT_KEY];
        const answer = metadata[HIGHLIGHT_METADATA_ANSWER_KEY];
        if (answer && this.onAnswerHighlightClick) {
          this.onAnswerHighlightClick(
            answer as ElowenAnswer,
            e.currentTarget as HTMLElement
          );
        }

        const annotation = metadata[HIGHLIGHT_METADATA_ANNOTATION_KEY];
        if (annotation && this.onUserAnnotationClick) {
          this.onUserAnnotationClick(
            annotation as UserAnnotation,
            e.currentTarget as HTMLElement
          );
        }
      }
    };

    return html`<span class=${classMap(classesObject)} @click=${onClick}
      >${character}</span
    >`;
  }

  private renderNonformattedCharacters(value: string): TemplateResult {
    const characterClasses: { [key: string]: boolean } = {
      ["character"]: true,
    };

    if (this.font) {
      characterClasses[this.font] = true;
    }

    const parts: TemplateResult[] = [];
    for (let index = 0; index < value.length; ) {
      const brLength = this.matchHtmlLineBreak(value, index);
      if (brLength > 0) {
        parts.push(html`<br />`);
        index += brLength;
        continue;
      }
      const character = value[index];
      if (character === "\n") {
        parts.push(html`<br />`);
        index += 1;
        continue;
      }
      parts.push(
        html`<span class=${classMap(characterClasses)}>${character}</span>`
      );
      index += 1;
    }
    return html`${parts}`;
  }

  private createInsertionsMap() {
    new Map<number, TemplateResult[]>();
    const {
      span,
      references,
      footnotes,
      referencedSpans,
      onPaperReferenceClick,
      onFootnoteClick,
      onSpanReferenceClicked,
    } = this;
    const insertions = new Map<number, TemplateResult[]>();
    // Pre-process tags to create an insertions map.
    span.innerTags.forEach((innerTag) => {
      if (
        innerTag.tagName === InnerTagName.REFERENCE &&
        innerTag.metadata["id"] &&
        references
      ) {
        const refIds = innerTag.metadata["id"].split(",").map((s) => s.trim());
        const citations: InlineCitation[] = [];

        refIds.forEach((refId) => {
          const refIndex = references.findIndex((ref) => ref.id === refId);
          if (refIndex !== -1) {
            citations.push({
              index: refIndex + 1,
              reference: references[refIndex],
            });
          }
        });

        if (citations.length > 0) {
          const citationTemplate = html`<span class=${CITATION_CLASSNAME}
            >${citations.map((citation) => {
              return html`<span
                class="inline-citation"
                tabindex="0"
                @click=${(e: MouseEvent) => {
                  if (onPaperReferenceClick) {
                    e.stopPropagation();
                    onPaperReferenceClick(
                      citation.reference,
                      e.currentTarget as HTMLElement
                    );
                  }
                }}
                >${citation.index}</span
              >`;
            })}</span
          >`;

          const insertionIndex = innerTag.position.startIndex;
          if (!insertions.has(insertionIndex)) {
            insertions.set(insertionIndex, []);
          }
          insertions.get(insertionIndex)!.push(citationTemplate);
        }
      } else if (
        innerTag.tagName === InnerTagName.FOOTNOTE &&
        innerTag.metadata["id"] &&
        footnotes
      ) {
        const footnoteId = innerTag.metadata["id"];
        const footnoteIndex = footnotes.findIndex(
          (note) => note.id === footnoteId
        );

        if (footnoteIndex !== -1) {
          const index = footnoteIndex + 1;
          const footnote = footnotes[footnoteIndex];

          const footnoteTemplate = html`<sup
            class=${FOOTNOTE_CLASSNAME}
            tabindex="0"
            @click=${(e: MouseEvent) => {
              if (onFootnoteClick) {
                e.stopPropagation();
                onFootnoteClick(footnote, e.currentTarget as HTMLElement);
              }
            }}
            >${index}</sup
          >`;

          const insertionIndex = innerTag.position.startIndex;
          if (!insertions.has(insertionIndex)) {
            insertions.set(insertionIndex, []);
          }
          insertions.get(insertionIndex)!.push(footnoteTemplate);
        }
      } else if (
        innerTag.tagName === InnerTagName.SPAN_REFERENCE &&
        innerTag.metadata["id"] &&
        referencedSpans
      ) {
        const refId = innerTag.metadata["id"];
        const citations: InlineSpanCitation[] = [];

        const refIndex = referencedSpans.map((span) => span.id).indexOf(refId);
        if (refIndex !== -1) {
          citations.push({
            index: refIndex + 1,
            id: refId,
          });
        }

        if (citations.length > 0) {
          const citationTemplate = html`<span class="citation-marker"
            >${citations.map((citation) => {
              return html`<span
                class="span-inline-citation inline-citation"
                tabindex="0"
                @click=${(e: MouseEvent) => {
                  if (onSpanReferenceClicked) {
                    e.stopPropagation();
                    onSpanReferenceClicked(citation.id);
                  }
                }}
                >${citation.index}</span
              >`;
            })}</span
          >`;

          const insertionIndex = innerTag.position.startIndex;
          if (!insertions.has(insertionIndex)) {
            insertions.set(insertionIndex, []);
          }
          insertions.get(insertionIndex)!.push(citationTemplate);
        }
      }
    });

    return insertions;
  }

  private calculateRenderedContent() {
    const { span, highlights = [], monospace = false } = this;

    if (!span) {
      this.renderedContent = html``;
      return;
    }

    const allHighlights = [...highlights];
    const spanText = this.normalizeSpanText(span.text);
    const hasHighlight = highlights.length > 0;

    const allInnerTags = flattenTags(span.innerTags || []);

    const insertions = this.createInsertionsMap();

    // Wrap all the character parts in a single parent span.
    const spanClasses = {
      monospace,
      "elowen-span-renderer-element": true,
    };

    // If there are no inner tags or highlights, and no insertions,
    // we can just return the plain text.
    if (!hasHighlight && !allInnerTags.length && insertions.size === 0) {
      this.renderedContent = html`<span class=${classMap(spanClasses)}>
        ${this.renderNonformattedCharacters(this.normalizeSpanText(span.text))}
      </span>`;
      return;
    }

    // Create an array of objects, one for each character in the span's text.
    // Each object will store the formatting tags (like 'b' for bold, 'i' for
    // italic, or a highlight color) that apply to that character.
    const formattingCounters = spanText
      .split("")
      .map((): FormattingCounter => ({}));

    // Iterate through each `innerTag` (e.g., bold, italic, link) defined in the
    // span. For each tag, mark all characters within its start and end indices
    // with the tag's name and metadata.
    allInnerTags.forEach((innerTag) => {
      const position = innerTag.position;
      for (let i = position.startIndex; i < position.endIndex; i++) {
        const currentCounter = formattingCounters[i];
        if (currentCounter) {
          currentCounter[innerTag.tagName] = {
            ...innerTag.metadata,
            ...(currentCounter[innerTag.tagName] || {}),
          };
        }
      }
    });

    // Do the same for highlights, marking the affected characters with the
    // highlight color.
    allHighlights.forEach((highlight) => {
      const position = highlight.position;
      // Defaults to the entire span if position is null.
      const startIndex = position ? position.startIndex : 0;
      const endIndex = position ? position.endIndex : this.span.text.length;

      for (let i = startIndex; i < endIndex; i++) {
        const currentCounter = formattingCounters[i];
        if (currentCounter) {
          currentCounter[GENERAL_HIGHLIGHT_KEY] = {
            [COLOR_HIGHLIGHT_KEY]: highlight.color,
          };
          if (highlight.metadata) {
            currentCounter[GENERAL_HIGHLIGHT_KEY] = {
              ...highlight.metadata,
              ...currentCounter[GENERAL_HIGHLIGHT_KEY],
            };
          }
        }
      }
    });

    let equationText = "";
    const partsTemplateResults: TemplateResult[] = [];
    for (let index = 0; index < spanText.length; ) {
      const brLength = this.matchHtmlLineBreak(spanText, index);
      if (brLength > 0) {
        partsTemplateResults.push(html`<br />`);
        index += brLength;
        continue;
      }

      const char = spanText[index];

      // Prepend any insertions for the current index.
      if (insertions.has(index)) {
        partsTemplateResults.push(...insertions.get(index)!);
      }

      const hasBasicMathTag =
        formattingCounters[index][InnerTagName.MATH] != null;
      const hasDisplayMathTag =
        formattingCounters[index][InnerTagName.MATH_DISPLAY] != null;
      const hasMathTag = hasBasicMathTag || hasDisplayMathTag;

      // Special handling for LaTeX math equations.
      if (formattingCounters[index] && hasMathTag) {
        equationText += char;
        const nextIndex = index + 1;
        const tagToCheck = hasBasicMathTag
          ? InnerTagName.MATH
          : InnerTagName.MATH_DISPLAY;
        if (
          nextIndex < spanText.length &&
          formattingCounters[nextIndex] &&
          formattingCounters[nextIndex][tagToCheck]
        ) {
          index += 1;
          continue;
        }

        const currentEquationText = equationText;
        equationText = "";
        partsTemplateResults.push(
          this.renderEquation(currentEquationText, hasDisplayMathTag)
        );
        index += 1;
        continue;
      }

      partsTemplateResults.push(
        this.renderFormattedCharacter(char, {
          character: {},
          ...formattingCounters[index],
        })
      );
      index += 1;
    }

    // Add any insertions at the very end of the span.
    if (insertions.has(spanText.length)) {
      partsTemplateResults.push(...insertions.get(spanText.length)!);
    }

    this.renderedContent = html`<span class=${classMap(spanClasses)}
      >${partsTemplateResults}</span
    >`;
  }

  private renderElowenSpan() {
    return this.renderedContent;
  }

  override render() {
    if (this.isVirtual) {
      return html`<span
        ${ref(this.spanRef)}
        id=${this.span.id}
        style=${styleMap({ visibility: "hidden" })}
      >
        ${this.normalizeSpanText(this.span.text)}
      </span>`;
    }

    return html`
      <style>
        ${styles}
      </style>
      <span
        ${ref(this.spanRef)}
        id=${this.span.id}
        class=${classMap(this.getSpanClassesObject())}
      >
        ${this.renderElowenSpan()}
      </span>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    "elowen-span": ElowenSpanViz;
  }
}
