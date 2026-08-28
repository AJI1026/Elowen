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
import { ConceptTooltipProps } from "../../services/floating_panel_service";
import { styles } from "./concept_tooltip.scss";
import { core } from "../../core/core";
import { DocumentStateService } from "../../services/document_state.service";
import { FirebaseService } from "../../services/firebase.service";
import { SettingsService } from "../../services/settings.service";
import { HistoryService } from "../../services/history.service";
import { getElowenResponseCallable } from "../../shared/callables";
import { ElowenAnswer } from "../../shared/api";
import { ElowenContent } from "../../shared/elowen_doc";
import { t } from "../../shared/i18n";

import "../../pair-components/circular_progress";
import "../elowen_concept/elowen_concept_contents";
import "../elowen_content/elowen_content";
import "../wikipedia_section/wikipedia_section";

/**
 * A tooltip that explains a ElowenConcept using the configured response language,
 * with an optional Wikipedia enrichment section.
 */
@customElement("concept-tooltip")
export class ConceptTooltip extends MobxLitElement {
  static override styles: CSSResultGroup = [styles];

  @property({ type: Object }) props!: ConceptTooltipProps;

  @state() private answer?: ElowenAnswer;
  @state() private isLoading = true;
  @state() private loadFailed = false;

  private readonly documentStateService = core.getService(DocumentStateService);
  private readonly firebaseService = core.getService(FirebaseService);
  private readonly settingsService = core.getService(SettingsService);
  private readonly historyService = core.getService(HistoryService);

  override connectedCallback(): void {
    super.connectedCallback();
    void this.loadDefinition();
  }

  private async loadDefinition() {
    const elowenDoc = this.documentStateService.elowenDocManager?.elowenDoc;
    if (!elowenDoc || !this.props?.concept) {
      this.isLoading = false;
      this.loadFailed = true;
      return;
    }

    this.isLoading = true;
    this.loadFailed = false;

    try {
      this.answer = await getElowenResponseCallable(
        this.firebaseService.functions,
        elowenDoc,
        {
          query: "",
          highlight: this.props.concept.name,
          highlightedSpans: this.props.spanId
            ? [{ spanId: this.props.spanId }]
            : [],
        },
        this.settingsService.getModelConfig()
      );
    } catch (error) {
      console.error("Error loading concept definition:", error);
      this.loadFailed = true;
    } finally {
      this.isLoading = false;
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

  private renderWikipedia() {
    return html`<elowen-wikipedia-section
      .term=${this.props.concept.name}
      .enabled=${true}
    ></elowen-wikipedia-section>`;
  }

  override render() {
    if (!this.props?.concept) {
      return nothing;
    }

    const { concept } = this.props;

    if (this.isLoading) {
      return html`
        <div class="concept-tooltip-component">
          <div class="concept-name">${concept.name}</div>
          <div class="loading">
            <pr-circular-progress></pr-circular-progress>
          </div>
          ${this.renderWikipedia()}
        </div>
      `;
    }

    if (this.answer?.responseContent?.length) {
      return html`
        <div class="concept-tooltip-component">
          <div class="concept-name">${concept.name}</div>
          ${this.answer.responseContent.map((content) =>
            this.renderAnswerContent(content)
          )}
          ${this.renderWikipedia()}
        </div>
      `;
    }

    return html`
      <div class="concept-tooltip-component">
        <div class="concept-name">${concept.name}</div>
        ${this.loadFailed
          ? html`<div class="fallback-note">
              ${t(
                "concept.loadFailed",
                this.settingsService.responseLanguage.value
              )}
            </div>`
          : nothing}
        <elowen-concept-contents
          .conceptId=${concept.id}
          .contents=${concept.contents}
        ></elowen-concept-contents>
        ${this.renderWikipedia()}
      </div>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    "concept-tooltip": ConceptTooltip;
  }
}
