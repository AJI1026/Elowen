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

import { MobxLitElement } from "@adobe/lit-mobx";
import { CSSResultGroup, html, nothing } from "lit";
import { customElement, property, state } from "lit/decorators.js";
import { TranslateTooltipProps } from "../../services/floating_panel_service";
import { styles } from "./translate_tooltip.scss";
import { core } from "../../core/core";
import { DocumentStateService } from "../../services/document_state.service";
import { SettingsService } from "../../services/settings.service";
import { HistoryService } from "../../services/history.service";
import { getElowenResponseCallable } from "../../shared/callables";
import { ElowenAnswer } from "../../shared/api";
import { ElowenContent } from "../../shared/elowen_doc";
import { t } from "../../shared/i18n";

import "../../pair-components/circular_progress";
import "../elowen_content/elowen_content";

/**
 * A compact popup that translates the current text selection in place.
 */
const translationCache = new Map<string, ElowenAnswer>();
const MAX_CACHE_ENTRIES = 200;

@customElement("translate-tooltip")
export class TranslateTooltip extends MobxLitElement {
  static override styles: CSSResultGroup = [styles];

  @property({ type: Object }) props!: TranslateTooltipProps;

  @state() private answer?: ElowenAnswer;
  @state() private isLoading = true;
  @state() private loadFailed = false;
  private loadGeneration = 0;
  private loadedText = "";

  private readonly documentStateService = core.getService(DocumentStateService);
  private readonly settingsService = core.getService(SettingsService);
  private readonly historyService = core.getService(HistoryService);

  protected override updated() {
    // Idempotent: load whenever the rendered text differs from the last load.
    // (Lit's changed-properties map is not reliable for the first update.)
    const text = this.props?.selectedText?.trim();
    if (!text || text === this.loadedText) return;
    this.loadedText = text;
    void this.loadTranslation();
  }

  private displayText() {
    const text = this.props?.selectedText?.trim() ?? "";
    if (text.length <= 80) return text;
    return `${text.slice(0, 77)}…`;
  }

  private async loadTranslation() {
    const elowenDoc = this.documentStateService.elowenDocManager?.elowenDoc;
    const selectedText = this.props?.selectedText?.trim();
    const generation = ++this.loadGeneration;
    if (!elowenDoc || !selectedText) {
      this.isLoading = false;
      this.loadFailed = true;
      return;
    }

    const lang = this.settingsService.responseLanguage.value;
    const cacheKey = `${lang}:${selectedText}`;
    const cached = translationCache.get(cacheKey);
    if (cached) {
      this.isLoading = false;
      this.loadFailed = false;
      this.answer = cached;
      return;
    }

    this.isLoading = true;
    this.loadFailed = false;
    this.answer = undefined;

    try {
      const paperId = elowenDoc.metadata?.paperId ?? "";
      const askContext = paperId
        ? this.historyService.getAskContext(paperId)
        : { history: [] as ElowenAnswer[] };
      const answer = await getElowenResponseCallable(
        null,
        elowenDoc,
        {
          query: "",
          highlight: selectedText,
          highlightedSpans: this.props.highlightedSpans,
          responseMode: "translate",
        },
        this.settingsService.getModelConfig(),
        askContext.history,
        askContext.conversationSummary
      );
      if (generation !== this.loadGeneration) return;
      if (translationCache.size >= MAX_CACHE_ENTRIES) {
        translationCache.clear();
      }
      translationCache.set(cacheKey, answer);
      this.answer = answer;
    } catch (error) {
      if (generation !== this.loadGeneration) return;
      console.error("Error loading translation:", error);
      this.loadFailed = true;
    } finally {
      if (generation === this.loadGeneration) {
        this.isLoading = false;
      }
    }
  }

  private renderAnswerContent(content: ElowenContent) {
    return html`<elowen-content
      .content=${content}
      .references=${this.documentStateService.elowenDocManager?.elowenDoc
        .references}
      .summary=${null}
      .spanSummaries=${new Map()}
      .focusedSpanId=${null}
      .highlightManager=${this.documentStateService.highlightManager!}
      .answerHighlightManager=${this.historyService.answerHighlightManager}
      .userHighlightManager=${this.historyService.userHighlightManager}
      .collapseManager=${this.documentStateService.collapseManager!}
      .onSpanSummaryMouseEnter=${() => {}}
      .onSpanSummaryMouseLeave=${() => {}}
      .dense=${true}
    ></elowen-content>`;
  }

  override render() {
    if (!this.props?.selectedText) {
      return nothing;
    }

    const lang = this.settingsService.responseLanguage.value;

    if (this.isLoading) {
      return html`
        <div class="translate-tooltip-component">
          <div class="selected-text">${this.displayText()}</div>
          <div class="loading">
            <pr-circular-progress></pr-circular-progress>
          </div>
        </div>
      `;
    }

    if (this.answer?.responseContent?.length) {
      return html`
        <div class="translate-tooltip-component">
          <div class="selected-text">${this.displayText()}</div>
          ${this.answer.responseContent.map((content) =>
            this.renderAnswerContent(content)
          )}
        </div>
      `;
    }

    return html`
      <div class="translate-tooltip-component">
        <div class="selected-text">${this.displayText()}</div>
        <div class="fallback-note">
          ${t("translate.loadFailed", lang)}
        </div>
      </div>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    "translate-tooltip": TranslateTooltip;
  }
}
