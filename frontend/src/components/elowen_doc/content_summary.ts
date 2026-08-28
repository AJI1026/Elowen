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

import { html, nothing } from "lit";
import { customElement, property, state } from "lit/decorators.js";
import { classMap } from "lit/directives/class-map.js";
import { ElowenContent, ElowenSummary } from "../../shared/elowen_doc";
import { FocusState } from "../../shared/types";
import { AnswerHighlightManager } from "../../shared/answer_highlight_manager";
import { UserHighlightManager } from "../../shared/user_highlight_manager";
import { HighlightManager } from "../../shared/highlight_manager";
import { ElowenAnswer } from "../../shared/api";
import { UserAnnotation } from "../../shared/types_local_storage";
import { ElowenFont } from "../../shared/types";
import { LightMobxLitElement } from "../light_mobx_lit_element/light_mobx_lit_element";
import { styles } from "./content_summary.scss";

import "../elowen_span/elowen_span";
import "../../pair-components/icon";
import { getSpanHighlightsFromManagers } from "../elowen_span/elowen_span_utils";
import { core } from "../../core/core";
import { SettingsService } from "../../services/settings.service";
import { t } from "../../shared/i18n";

@customElement("elowen-content-summary")
export class ElowenContentSummary extends LightMobxLitElement {
  private readonly settingsService = core.getService(SettingsService);
  @property({ type: Object }) content!: ElowenContent;
  @property({ type: Object }) summary!: ElowenSummary | null;
  @property({ type: Object }) spanSummaries: Map<string, ElowenSummary> =
    new Map();
  @property({ type: String }) focusedSpanId: string | null = null;
  @property({ type: Boolean }) isCollapsed = false;
  @property({ type: Object }) onCollapseChange: () => void = () => {};
  @property({ type: Object }) onSpanSummaryMouseEnter: (
    spanIds: string[]
  ) => void = () => {};
  @property({ type: Object }) onSpanSummaryMouseLeave: () => void = () => {};
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

  @state() private keyPointsExpanded = true;

  private getFocusState(spanIds: string[]) {
    const isFocused =
      !!this.focusedSpanId && spanIds.includes(this.focusedSpanId);
    const hasFocus = !!this.focusedSpanId;

    const focusState = isFocused
      ? FocusState.FOCUSED
      : hasFocus
      ? FocusState.UNFOCUSED
      : FocusState.DEFAULT;
    return { isFocused, hasFocus, focusState };
  }

  private getUniqueSpanSummaries(): Array<{
    summary: ElowenSummary;
    spanIds: string[];
  }> {
    if (!this.spanSummaries || this.spanSummaries.size === 0) {
      return [];
    }
    if (this.content.listContent) {
      return [];
    }

    const summariesToSpanIds = new Map<string, string[]>();
    this.spanSummaries.forEach((summary) => {
      const text = summary.summary.text;
      const existingIds = summariesToSpanIds.get(text);
      if (existingIds) {
        existingIds.push(summary.id);
      } else {
        summariesToSpanIds.set(text, [summary.id]);
      }
    });

    return Array.from(summariesToSpanIds.entries())
      .map(([summaryText, spanIds]) => {
        const summary = Array.from(this.spanSummaries.values()).find(
          (s) => s.summary.text === summaryText
        );
        return summary ? { summary, spanIds } : null;
      })
      .filter((entry): entry is { summary: ElowenSummary; spanIds: string[] } =>
        Boolean(entry)
      );
  }

  private renderSpanSummaryItem(
    summary: ElowenSummary,
    spanIds: string[],
    isFirst: boolean
  ) {
    const { focusState } = this.getFocusState(spanIds);
    const isActive = focusState === FocusState.FOCUSED;

    const itemClasses = classMap({
      "key-point-item": true,
      active: isActive,
    });

    return html`
      <li
        class=${itemClasses}
        @mouseenter=${() => this.onSpanSummaryMouseEnter(spanIds)}
        @mouseleave=${() => this.onSpanSummaryMouseLeave()}
      >
        <elowen-span
          .classMap=${{ "span-summary-text": true }}
          .span=${summary.summary}
          .focusState=${focusState}
          .showFocusUnderline=${isFirst}
          .highlights=${getSpanHighlightsFromManagers(
            summary.summary.id,
            this.highlightManager,
            this.answerHighlightManager,
            this.userHighlightManager
          )}
          .onAnswerHighlightClick=${this.onAnswerHighlightClick}
          .onUserAnnotationClick=${this.onUserAnnotationClick}
          .font=${ElowenFont.SPAN_SUMMARY_TEXT}
        ></elowen-span>
      </li>
    `;
  }

  private renderKeyPoints() {
    const entries = this.getUniqueSpanSummaries();
    if (entries.length === 0) {
      return nothing;
    }

    const toggleClasses = classMap({
      "key-points-toggle": true,
      expanded: this.keyPointsExpanded,
    });

    return html`
      <div class="key-points-section">
        <button
          class=${toggleClasses}
          @click=${() => {
            this.keyPointsExpanded = !this.keyPointsExpanded;
          }}
          title=${this.keyPointsExpanded
            ? t(
                "content.collapseKeyPoints",
                this.settingsService.responseLanguage.value
              )
            : t(
                "content.expandKeyPoints",
                this.settingsService.responseLanguage.value
              )}
        >
          <pr-icon
            icon="chevron_right"
            variant="default"
            class="toggle-icon"
          ></pr-icon>
        </button>
        ${this.keyPointsExpanded
          ? html`<ul class="key-points-list">
              ${entries.map((entry, index) =>
                this.renderSpanSummaryItem(
                  entry.summary,
                  entry.spanIds,
                  index === 0
                )
              )}
            </ul>`
          : nothing}
      </div>
    `;
  }

  override render() {
    const keyPointEntries = this.getUniqueSpanSummaries();
    const hasContentSummary = !!this.summary;
    const hasKeyPoints = keyPointEntries.length > 0;

    if (this.content.imageContent || (!hasContentSummary && !hasKeyPoints)) {
      return nothing;
    }

    if (this.isCollapsed) {
      return html`
        <style>
          ${styles}
        </style>
        <div class="content-summary-renderer-container collapsed-mobile">
          <button
            class="mobile-summary-toggle"
            @click=${() => this.onCollapseChange()}
            title=${t(
              "content.showParagraphGuide",
              this.settingsService.responseLanguage.value
            )}
          >
            <pr-icon icon="chevron_left" variant="default"></pr-icon>
          </button>
        </div>
      `;
    }

    return html`
      <style>
        ${styles}
      </style>
      <div class="content-summary-renderer-container">
        <div class="summary-card">
          ${hasContentSummary
            ? html`<div class="main-summary">
                <elowen-span
                  .classMap=${{ "summary-span": true }}
                  .span=${this.summary!.summary}
                  .highlights=${getSpanHighlightsFromManagers(
                    this.summary!.summary.id,
                    this.highlightManager,
                    this.answerHighlightManager,
                    this.userHighlightManager
                  )}
                  .onAnswerHighlightClick=${this.onAnswerHighlightClick}
                  .onUserAnnotationClick=${this.onUserAnnotationClick}
                ></elowen-span>
              </div>`
            : nothing}
          ${this.summary?.purpose
            ? html`<div class="purpose-summary">
                <elowen-span
                  .classMap=${{ "purpose-span": true }}
                  .span=${this.summary.purpose}
                  .highlights=${getSpanHighlightsFromManagers(
                    this.summary.purpose.id,
                    this.highlightManager,
                    this.answerHighlightManager,
                    this.userHighlightManager
                  )}
                  .onAnswerHighlightClick=${this.onAnswerHighlightClick}
                  .onUserAnnotationClick=${this.onUserAnnotationClick}
                ></elowen-span>
              </div>`
            : nothing}
          ${this.renderKeyPoints()}
        </div>
      </div>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    "elowen-content-summary": ElowenContentSummary;
  }
}
