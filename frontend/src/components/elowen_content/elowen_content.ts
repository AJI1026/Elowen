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

import { html, nothing, PropertyValues, TemplateResult } from "lit";
import { customElement, property, state } from "lit/decorators.js";
import { classMap } from "lit/directives/class-map.js";
import { styleMap } from "lit/directives/style-map.js";
import {
  ListContent,
  ElowenContent,
  ElowenFootnote,
  ElowenReference,
  ElowenSpan,
  ElowenSummary,
  TextContent,
} from "../../shared/elowen_doc";
import { FocusState, ElowenFont } from "../../shared/types";
import "../elowen_span/elowen_span";

import "../elowen_content/elowen_image_content";
import "../elowen_content/elowen_html_figure_content";
import "../elowen_doc/content_summary";
import { HighlightManager } from "../../shared/highlight_manager";
import { CollapseManager } from "../../shared/collapse_manager";
import { AnswerHighlightManager } from "../../shared/answer_highlight_manager";
import { UserHighlightManager } from "../../shared/user_highlight_manager";
import { ElowenAnswer } from "../../shared/api";
import { UserAnnotation } from "../../shared/types_local_storage";
import { LightMobxLitElement } from "../light_mobx_lit_element/light_mobx_lit_element";
import { styles } from "./elowen_content.scss";
import { getSpanHighlightsFromManagers } from "../elowen_span/elowen_span_utils";

/**
 * A custom event dispatched when a elowen-content element is first rendered.
 */
export class ElowenContentRenderedEvent extends Event {
  static readonly eventName = "elowen-content-rendered";
  readonly element: ElowenContentViz;

  constructor(element: ElowenContentViz) {
    super(ElowenContentRenderedEvent.eventName, {
      bubbles: true,
      composed: true,
    });
    this.element = element;
  }
}

@customElement("elowen-content")
export class ElowenContentViz extends LightMobxLitElement {
  @property({ type: Object }) content!: ElowenContent;
  @property({ type: Array }) references?: ElowenReference[];
  @property({ type: Array }) footnotes?: ElowenFootnote[];
  @property({ type: Array }) referencedSpans?: ElowenSpan[];
  @property({ type: Object }) summary: ElowenSummary | null = null;
  @property({ type: Object }) spanSummaries = new Map<string, ElowenSummary>();
  @property({ type: String }) focusedSpanId: string | null = null;
  @property({ type: Object }) getImageUrl?: (path: string) => Promise<string>;
  @property({ type: Object }) onSpanSummaryMouseEnter: (
    spanIds: string[]
  ) => void = () => {};
  @property({ type: Object }) onSpanSummaryMouseLeave: () => void = () => {};
  @property({ type: Object }) highlightManager!: HighlightManager;
  @property({ type: Object }) answerHighlightManager!: AnswerHighlightManager;
  @property({ type: Object }) userHighlightManager!: UserHighlightManager;
  @property({ type: Object }) collapseManager!: CollapseManager;
  @property({ type: Object }) onSpanReferenceClicked?: (
    referenceId: string
  ) => void;
  @property({ type: Object }) onPaperReferenceClick?: (
    reference: ElowenReference,
    target: HTMLElement
  ) => void;
  @property({ type: Object }) onFootnoteClick?: (
    footnote: ElowenFootnote,
    target: HTMLElement
  ) => void;
  @property({ type: Object }) onImageClick?: (
    info: { storagePath: string; caption?: string },
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
  @property({ type: Object }) font?: ElowenFont;
  @property({ type: Boolean }) dense?: boolean = false;

  @property({ type: Boolean }) virtualize: boolean = false;
  @property({ type: Boolean }) shouldFadeIn: boolean = false;

  @state() private isVisible = false;

  override firstUpdated() {
    if (this.virtualize) {
      this.dispatchEvent(new ElowenContentRenderedEvent(this));
    }
  }

  override updated(changedProperties: PropertyValues) {
    super.updated(changedProperties);
  }

  setVisible(visible: boolean) {
    this.isVisible = visible;
  }

  private getFocusState(focusedSpanId: string | null, spanIds: string[]) {
    const isFocused = !!focusedSpanId && spanIds.includes(focusedSpanId);
    const hasFocus = !!focusedSpanId;

    const focusState = isFocused
      ? FocusState.FOCUSED
      : hasFocus
      ? FocusState.UNFOCUSED
      : FocusState.DEFAULT;
    return { isFocused, hasFocus, focusState };
  }

  private renderSpans(spans: ElowenSpan[], monospace = false): TemplateResult[] {
    const isVirtual = !this.isVisible && this.virtualize;
    return spans.map((span) => {
      const { focusState } = this.getFocusState(this.focusedSpanId, [span.id]);
      return html`<elowen-span
        .span=${span}
        .focusState=${focusState}
        .monospace=${monospace}
        .references=${this.references}
        .footnotes=${this.footnotes}
        .referencedSpans=${this.referencedSpans}
        .highlights=${getSpanHighlightsFromManagers(
          span.id,
          this.highlightManager,
          this.answerHighlightManager,
          this.userHighlightManager
        )}
        .onSpanReferenceClicked=${this.onSpanReferenceClicked}
        .onPaperReferenceClick=${this.onPaperReferenceClick}
        .onFootnoteClick=${this.onFootnoteClick}
        .onAnswerHighlightClick=${this.onAnswerHighlightClick}
        .onUserAnnotationClick=${this.onUserAnnotationClick}
        .font=${this.font}
        .isVirtual=${isVirtual}
        .shouldFadeIn=${this.shouldFadeIn}
      ></elowen-span>`;
    });
  }

  private renderListContent(
    listContent: ListContent
  ): TemplateResult | typeof nothing {
    if (!listContent) {
      return nothing;
    }

    const listItemsHtml: TemplateResult[] = listContent.listItems.map(
      (listItem) => {
        const spans = listItem.spans;
        const classesObject: { [key: string]: boolean } = {
          "list-item": true,
        };
        return html`<li class=${classMap(classesObject)}>
          ${this.renderSpans(spans)}
          ${listItem.subListContent
            ? this.renderListContent(listItem.subListContent)
            : nothing}
        </li>`;
      }
    );

    if (listContent.isOrdered) {
      return html`<ol>
        ${listItemsHtml}
      </ol>`;
    } else {
      return html`<ul>
        ${listItemsHtml}
      </ul>`;
    }
  }

  private renderTextContent(
    textContent: TextContent
  ): TemplateResult | typeof nothing {
    const tagName = textContent?.tagName ?? "";
    if (!tagName) {
      return nothing;
    }
    const spans = textContent?.spans ?? [];
    const monospace = tagName === "code" || tagName === "pre";

    const spansHtml = this.renderSpans(spans, monospace);
    if (tagName === "p") {
      return html`<p>${spansHtml}</p>`;
    } else if (tagName === "code") {
      return html`<code class="code">${spansHtml}</code>`;
    } else if (tagName === "pre") {
      return html` <pre>${spansHtml}</pre> `;
    } else if (tagName === "figcaption") {
      return html`<figcaption>${spansHtml}</figcaption>`;
    } else {
      console.error("Unsupported tag name: ", tagName);
      return html`<div>${spansHtml}</div>`;
    }
  }

  private renderMainContent() {
    const { content, getImageUrl, onImageClick } = this;
    if (content.htmlFigureContent) {
      return html`<elowen-html-figure-content
        .content=${content.htmlFigureContent}
      ></elowen-html-figure-content>`;
    }
    if (content.imageContent) {
      return html`<elowen-image-content
        .content=${content.imageContent}
        .getImageUrl=${getImageUrl}
        .onImageClick=${onImageClick}
        .highlightManager=${this.highlightManager}
        .answerHighlightManager=${this.answerHighlightManager}
        .userHighlightManager=${this.userHighlightManager}
      ></elowen-image-content>`;
    }
    if (content.figureContent) {
      return html`<elowen-image-content
        .content=${content.figureContent}
        .getImageUrl=${getImageUrl}
        .onImageClick=${onImageClick}
        .highlightManager=${this.highlightManager}
        .answerHighlightManager=${this.answerHighlightManager}
        .userHighlightManager=${this.userHighlightManager}
      ></elowen-image-content>`;
    }
    if (content.textContent) {
      return this.renderTextContent(content.textContent);
    }
    if (content.listContent) {
      return this.renderListContent(content.listContent);
    }
    return nothing;
  }

  override render() {
    const onContentClick = (e: MouseEvent) => {
      e.stopPropagation();
      e.preventDefault();
    };

    const mainContentClassesObject: { [key: string]: boolean } = {
      "main-content": true,
      "pre-container": this.content.textContent?.tagName === "pre",
      "code-container": this.content.textContent?.tagName === "code",
      dense: this.dense ?? false,
    };

    const isCollapsed = this.collapseManager.getMobileSummaryCollapseState(
      this.content.id
    );

    const isFigureContent =
      this.content.imageContent != null ||
      this.content.figureContent != null ||
      this.content.htmlFigureContent != null;

    const contentRendererContainerClassesObject: { [key: string]: boolean } = {
      ["content-renderer-container"]: true,
      ["has-summary"]:
        this.summary != null ||
        (this.spanSummaries != null && this.spanSummaries.size > 0),
      ["collapsed"]: isCollapsed,
      ["is-figure-content"]: isFigureContent,
    };

    const outerContainerclasses = classMap({
      "content-renderer-grid-container": true,
      ["dense"]: this.dense ?? false,
    });

    return html`
      <style>
        ${styles}
      </style>
      <div class=${outerContainerclasses}>
        <div class=${classMap(contentRendererContainerClassesObject)}>
          <div
            class=${classMap(mainContentClassesObject)}
            @click=${onContentClick}
          >
            ${this.renderMainContent()}
          </div>
          <elowen-content-summary
            .content=${this.content}
            .summary=${this.summary}
            .spanSummaries=${this.spanSummaries}
            .focusedSpanId=${this.focusedSpanId}
            .isCollapsed=${isCollapsed}
            .onCollapseChange=${() => {
              this.collapseManager.toggleMobileSummaryCollapse(this.content.id);
              this.requestUpdate();
            }}
            .onSpanSummaryMouseEnter=${this.onSpanSummaryMouseEnter}
            .onSpanSummaryMouseLeave=${this.onSpanSummaryMouseLeave}
            .highlightManager=${this.highlightManager}
            .answerHighlightManager=${this.answerHighlightManager}
            .userHighlightManager=${this.userHighlightManager}
            .onAnswerHighlightClick=${this.onAnswerHighlightClick}
            .onUserAnnotationClick=${this.onUserAnnotationClick}
          >
          </elowen-content-summary>
        </div>
      </div>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    "elowen-content": ElowenContentViz;
  }
}
