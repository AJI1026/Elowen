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

import { html, nothing, PropertyValues } from "lit";
import { customElement, property, state } from "lit/decorators.js";
import { classMap } from "lit/directives/class-map.js";
import { ElowenAnswer } from "../../shared/api";
import { UserAnnotation } from "../../shared/types_local_storage";
import { ElowenContent, ElowenSpan, ListContent, TextContent } from "../../shared/elowen_doc";
import { getReferencedSpanIdsFromContent } from "../../shared/elowen_doc_utils";
import { ElowenDocManager } from "../../shared/elowen_doc_manager";

import "../../pair-components/icon";
import "../../pair-components/icon_button";
import "../../pair-components/circular_progress";
import "../elowen_span/elowen_span";
import "../elowen_content/elowen_content";
import "../elowen_mindmap/elowen_mindmap";
import "../wikipedia_section/wikipedia_section";

import { styles } from "./answer_item.scss";

import {
  HighlightSelection,
  normalizeSelectionText,
} from "../../shared/selection_utils";
import { HighlightManager } from "../../shared/highlight_manager";
import { HistoryCollapseManager } from "../../shared/history_collapse_manager";
import { AnswerHighlightManager } from "../../shared/answer_highlight_manager";
import { UserHighlightManager } from "../../shared/user_highlight_manager";
import { LightMobxLitElement } from "../light_mobx_lit_element/light_mobx_lit_element";
import { FocusState, ElowenFont } from "../../shared/types";
import { getSpanHighlightsFromManagers } from "../elowen_span/elowen_span_utils";
import { CollapseManager } from "../../shared/collapse_manager";
import { SettingsService } from "../../services/settings.service";
import { core } from "../../core/core";
import { t } from "../../shared/i18n";

/**
 * An answer item in the Elowen questions history.
 */
@customElement("answer-item")
export class AnswerItem extends LightMobxLitElement {
  private readonly settingsService = core.getService(SettingsService);

  private uiLang() {
    return this.settingsService.responseLanguage.value;
  }
  @property({ type: Object }) answer!: ElowenAnswer;
  @property({ type: Boolean }) isLoading = false;
  @property({ type: Object }) elowenDocManager?: ElowenDocManager;
  @property({ type: Object }) highlightManager?: HighlightManager;
  @property({ type: Object }) answerHighlightManager?: AnswerHighlightManager;
  @property({ type: Object }) userHighlightManager?: UserHighlightManager;
  @property({ type: Object }) onAnswerHighlightClick?: (
    answer: ElowenAnswer,
    target: HTMLElement
  ) => void;
  @property({ type: Object }) onUserAnnotationClick?: (
    annotation: UserAnnotation,
    target: HTMLElement
  ) => void;

  @property({ type: Object }) collapseManager?: CollapseManager;
  @property({ type: Object }) historyCollapseManager?: HistoryCollapseManager;

  @property()
  onReferenceClick: (highlightedSpans: HighlightSelection[]) => void = () => {};
  @property()
  onImageReferenceClick: (imageStoragePath: string) => void = () => {};
  @property() onDismiss?: (answerId: string) => void;
  @property()
  onInfoTooltipClick: (text: string, element: HTMLElement) => void = () => {};
  @property() infoTooltipText: string = "";

  @state() private areReferencesShown = false;
  @state() private referencedSpans: ElowenSpan[] = [];
  @state() private isHighlightExpanded = false;

  /** Collapse long quoted highlights unless the user expands them. */
  private static readonly HIGHLIGHT_COLLAPSE_CHARS = 220;

  private toggleReferences() {
    this.areReferencesShown = !this.areReferencesShown;
  }

  private toggleAnswer() {
    if (!this.historyCollapseManager) return;
    this.historyCollapseManager.toggleAnswerCollapsed(this.answer.id);
  }

  private isCollapsed() {
    if (!this.historyCollapseManager) return false;
    return this.historyCollapseManager.isAnswerCollapsed(this.answer.id);
  }

  protected override updated(_changedProperties: PropertyValues): void {
    if (_changedProperties.has("answer")) {
      this.isHighlightExpanded = false;
      if (!this.elowenDocManager) {
        return;
      }
      const referencedIds = getReferencedSpanIdsFromContent(
        this.answer.responseContent
      );
      this.referencedSpans = referencedIds
        .map((id) => this.elowenDocManager!.getSpanById(id))
        .filter((span): span is ElowenSpan => span !== undefined);
    }

    if (_changedProperties.has("isLoading")) {
      if (this.isLoading) {
        this.historyCollapseManager?.setAnswerCollapsed(this.answer.id, false);
      }
    }
  }

  private renderReferences() {
    if (!this.areReferencesShown) {
      return nothing;
    }

    if (this.referencedSpans.length === 0) {
      return nothing;
    }

    return html`
      <div class="references-panel">
        <div class="references-content">
          ${this.referencedSpans.map((span, i) => {
            // Make a copy of the span and use a separate unique id.
            const copiedSpan = { ...span, id: `${span.id}-ref` };
            return html`
              <div
                class="reference-item"
                @click=${() => this.onReferenceClick([{ spanId: span.id }])}
              >
                <span class="number">${i + 1}.</span>
                <elowen-span
                  .span=${copiedSpan}
                  .references=${this.elowenDocManager?.elowenDoc.references}
                  .highlights=${getSpanHighlightsFromManagers(
                    copiedSpan.id,
                    this.highlightManager,
                    this.answerHighlightManager,
                    this.userHighlightManager
                  )}
                ></elowen-span>
              </div>
            `;
          })}
        </div>
      </div>
    `;
  }

  private renderImagePreview() {
    const imageStoragePath = this.answer.request.image?.imageStoragePath;
    if (!imageStoragePath) {
      return nothing;
    }

    return html`
      <div class="highlight" .title=${t("answer.imageTitle", this.uiLang())}>
        <span>${t("answer.imageLabel", this.uiLang())}</span>
        <pr-icon-button
          icon="arrow_forward"
          ?disabled=${this.isLoading}
          variant="default"
          @click=${() => {
            this.onImageReferenceClick(imageStoragePath);
          }}
        ></pr-icon-button>
      </div>
    `;
  }

  private canCollapseHighlight(text: string) {
    return text.length > AnswerItem.HIGHLIGHT_COLLAPSE_CHARS;
  }

  private getHighlightDisplayText(highlight: string) {
    return normalizeSelectionText(highlight);
  }

  private getHighlightSpans(): ElowenSpan[] {
    const highlightedSpans = this.answer.request.highlightedSpans;
    if (!highlightedSpans?.length || !this.elowenDocManager) {
      return [];
    }
    return highlightedSpans
      .map((item) => this.elowenDocManager!.getSpanById(item.spanId))
      .filter((span): span is ElowenSpan => span !== undefined);
  }

  private renderHighlightSpans(spans: ElowenSpan[]) {
    return spans.map(
      (span) => html`<elowen-span
        .span=${span}
        .focusState=${FocusState.DEFAULT}
        .highlights=${getSpanHighlightsFromManagers(
          span.id,
          this.highlightManager,
          this.answerHighlightManager,
          this.userHighlightManager
        )}
        .onAnswerHighlightClick=${this.onAnswerHighlightClick}
        .onUserAnnotationClick=${this.onUserAnnotationClick}
        .font=${ElowenFont.DEFAULT}
      ></elowen-span>`
    );
  }

  private renderHighlightedText() {
    const highlightedSpans = this.answer.request.highlightedSpans;
    const highlight = this.answer.request.highlight;
    if (!highlight || !highlightedSpans || highlightedSpans.length === 0) {
      return nothing;
    }

    const displayText = this.getHighlightDisplayText(highlight);
    const spanObjects = this.getHighlightSpans();
    const collapseSource =
      spanObjects.length > 0
        ? spanObjects.map((span) => span.text).join(" ")
        : displayText;
    const canCollapse = this.canCollapseHighlight(collapseSource);
    const isCollapsed = canCollapse && !this.isHighlightExpanded;
    const highlightClasses = classMap({
      highlight: true,
      "is-text-collapsed": isCollapsed,
    });

    return html`
      <div class=${highlightClasses}>
        <div class="highlight-body">
          <span class="highlight-text"
            >"${spanObjects.length > 0
              ? this.renderHighlightSpans(spanObjects)
              : displayText}"</span
          >
          ${canCollapse
            ? html`<button
                class="highlight-expand-toggle"
                type="button"
                @click=${(e: Event) => {
                  e.stopPropagation();
                  this.isHighlightExpanded = !this.isHighlightExpanded;
                }}
              >
                ${this.isHighlightExpanded
                  ? t("answer.collapse", this.uiLang())
                  : t("answer.expand", this.uiLang())}
              </button>`
            : nothing}
        </div>
        <pr-icon-button
          icon="arrow_forward"
          color="tertiary"
          ?disabled=${this.isLoading}
          variant="default"
          @click=${() => {
            this.onReferenceClick(highlightedSpans);
          }}
        ></pr-icon-button>
      </div>
    `;
  }

  private onAnswerSpanReferenceClicked(referenceId: string) {
    this.onReferenceClick([{ spanId: referenceId }]);
  }

  private isMindmapAnswer() {
    return this.answer.request.responseMode === "mindmap";
  }

  /** Highlight-only DEFINE (划词解释), not Ask / mindmap / image. */
  private isDefineAnswer() {
    const { query, highlight, image, responseMode } = this.answer.request;
    return (
      !!highlight &&
      !query &&
      !image &&
      responseMode !== "mindmap"
    );
  }

  private getDefineWikiTerm(): string {
    const highlight = this.answer.request.highlight;
    if (!highlight) return "";
    return this.getHighlightDisplayText(highlight);
  }

  private renderWikipediaSection() {
    if (!this.isDefineAnswer() || this.isLoading) {
      return nothing;
    }
    return html`<elowen-wikipedia-section
      class="answer-wiki"
      .term=${this.getDefineWikiTerm()}
      .enabled=${true}
    ></elowen-wikipedia-section>`;
  }

  private renderMindmapAnswer() {
    const textContents: TextContent[] = [];
    const listContents: ListContent[] = [];
    for (const content of this.answer.responseContent) {
      if (content.textContent) {
        textContents.push(content.textContent);
      }
      if (content.listContent) {
        listContents.push(content.listContent);
      }
    }

    return html`<div class="answer mindmap-answer">
      <elowen-mindmap
        .textContents=${textContents}
        .listContents=${listContents}
        .references=${this.elowenDocManager?.elowenDoc.references}
        .referencedSpans=${this.referencedSpans}
        .highlightManager=${this.highlightManager}
        .answerHighlightManager=${this.answerHighlightManager}
        .userHighlightManager=${this.userHighlightManager}
        .onAnswerHighlightClick=${this.onAnswerHighlightClick?.bind(this)}
        .onUserAnnotationClick=${this.onUserAnnotationClick?.bind(this)}
        .onSpanReferenceClicked=${this.onAnswerSpanReferenceClicked.bind(this)}
      ></elowen-mindmap>
    </div>`;
  }

  private renderAnswer() {
    if (this.isLoading) {
      return html`
        <div class="spinner">
          <pr-circular-progress></pr-circular-progress>
        </div>
      `;
    }

    if (this.isMindmapAnswer()) {
      return this.renderMindmapAnswer();
    }

    return html`<div class="answer">
      ${this.answer.responseContent.map((content: ElowenContent) => {
        return html`<elowen-content
          .content=${content}
          .references=${this.elowenDocManager?.elowenDoc.references}
          .referencedSpans=${this.referencedSpans}
          .summary=${null}
          .spanSummaries=${new Map()}
          .focusedSpanId=${null}
          .highlightManager=${this.highlightManager!}
          .answerHighlightManager=${this.answerHighlightManager!}
          .userHighlightManager=${this.userHighlightManager!}
          .onAnswerHighlightClick=${this.onAnswerHighlightClick?.bind(this)}
          .onUserAnnotationClick=${this.onUserAnnotationClick?.bind(this)}
          .collapseManager=${this.collapseManager}
          .onSpanSummaryMouseEnter=${() => {}}
          .onSpanSummaryMouseLeave=${() => {}}
          .onSpanReferenceClicked=${this.onAnswerSpanReferenceClicked.bind(
            this
          )}
          .dense=${true}
        ></elowen-content>`;
      })}
      ${this.renderWikipediaSection()}
    </div>`;
  }

  private renderContent() {
    if (this.isCollapsed()) return nothing;
    return html`
      ${this.renderHighlightedText()} ${this.renderImagePreview()}
      ${this.renderAnswer()}
    `;
  }

  private renderCancelButton() {
    if (!this.onDismiss) return nothing;

    return html`
      <pr-icon-button
        class="dismiss-button"
        icon="close"
        color="tertiary"
        variant="default"
        title=${t("answer.delete", this.uiLang())}
        @click=${(e: Event) => {
          e.stopPropagation();
          if (this.onDismiss) {
            this.onDismiss(this.answer.id);
          }
        }}
        ?hidden=${this.isLoading}
      ></pr-icon-button>
    `;
  }

  private getTitleText() {
    const lang = this.uiLang();
    const { query, highlight, image, responseMode } = this.answer.request;
    if (query) return query;
    if (responseMode === "mindmap") {
      return highlight
        ? t("answer.paragraphMindmap", lang)
        : t("answer.paperMindmap", lang);
    }

    if (image) {
      return t("answer.explainImage", lang);
    }

    if (!highlight) return "";

    if (this.isCollapsed()) {
      return t("answer.explainHighlight", lang, { highlight });
    }

    return t("answer.explainText", lang);
  }

  private renderInfoIcon() {
    if (!this.infoTooltipText) return nothing;

    return html`
      <pr-icon
        class="c-elowen-info-icon"
        icon="info"
        variant="default"
        color="neutral"
        title=${t("answer.clickToView", this.uiLang())}
        @click=${(e: Event) => {
          if (e.currentTarget instanceof HTMLElement) {
            this.onInfoTooltipClick(this.infoTooltipText, e.currentTarget);
          }
        }}
        ?hidden=${this.isLoading}
      ></pr-icon>
    `;
  }

  override render() {
    const isAnswerCollapsed = this.isCollapsed();

    const classes = {
      "history-item": true,
    };

    const questionAnswerContainerStyles = {
      "question-answer-container": true,
      "are-references-shown": this.areReferencesShown,
    };

    const historyItemClasses = {
      "history-item": true,
      "is-collapsed": isAnswerCollapsed,
    };

    const questionTextClasses = {
      "question-text": true,
      "is-collapsed": isAnswerCollapsed,
    };

    return html`
      <style>
        ${styles}
      </style>
      <div class=${classMap(historyItemClasses)}>
        <div class=${classMap(questionAnswerContainerStyles)}>
          <div class="question">
            <div class="left">
              <pr-icon-button
                class="toggle-answer-button"
                icon=${isAnswerCollapsed ? "chevron_right" : "expand_more"}
                color="tertiary"
                variant="default"
                @click=${this.toggleAnswer}
                ?disabled=${this.isLoading}
              ></pr-icon-button>
              <span
                class=${classMap(questionTextClasses)}
                title=${this.answer.request.query}
              >
                ${this.getTitleText()} ${this.renderInfoIcon()}
              </span>
            </div>
            ${this.renderCancelButton()}
          </div>
          ${this.renderContent()}
        </div>
        ${this.referencedSpans.length > 0
          ? html`
              <div
                tabindex="0"
                class="toggle-button"
                @click=${this.toggleReferences}
              >
                <pr-icon
                  .icon=${this.areReferencesShown
                    ? "keyboard_arrow_up"
                    : "keyboard_arrow_down"}
                  color="tertiary"
                ></pr-icon>
                <span class="mentions-text"
                  >${t("answer.references", this.uiLang(), {
                    count: this.referencedSpans.length,
                  })}</span
                >
              </div>
            `
          : nothing}
        ${this.renderReferences()}
      </div>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    "answer-item": AnswerItem;
  }
}
