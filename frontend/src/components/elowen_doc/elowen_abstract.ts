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
import { customElement, property } from "lit/decorators.js";
import { Highlight, ElowenAbstract, ElowenFootnote } from "../../shared/elowen_doc";
import { HighlightManager } from "../../shared/highlight_manager";
import { AnswerHighlightManager } from "../../shared/answer_highlight_manager";
import { UserHighlightManager } from "../../shared/user_highlight_manager";
import { ElowenAnswer } from "../../shared/api";
import { UserAnnotation } from "../../shared/types_local_storage";
import { ElowenFont } from "../../shared/types";
import { LightMobxLitElement } from "../light_mobx_lit_element/light_mobx_lit_element";
import { styles } from "./elowen_abstract.scss";

import "../elowen_span/elowen_span";
import "../../pair-components/icon_button";
import { makeObservable, observable, ObservableMap } from "mobx";
import { getSpanHighlightsFromManagers } from "../elowen_span/elowen_span_utils";
import { core } from "../../core/core";
import { SettingsService } from "../../services/settings.service";
import { t } from "../../shared/i18n";

@customElement("elowen-abstract")
export class ElowenAbstractViz extends LightMobxLitElement {
  private readonly settingsService = core.getService(SettingsService);
  @property({ type: Object }) abstract!: ElowenAbstract;
  @property({ type: Boolean }) isCollapsed = false;
  @property({ type: Object }) onCollapseChange: (isCollapsed: boolean) => void =
    () => {};
  @property() excerptSpanId?: string = "";
  @property({ type: Object }) highlightManager!: HighlightManager;
  @property({ type: Object }) answerHighlightManager!: AnswerHighlightManager;
  @property({ type: Object }) userHighlightManager!: UserHighlightManager;
  @property({ type: Object }) onAnswerHighlightClick?: (
    answer: ElowenAnswer,
    target: HTMLElement
  ) => void;
  @property({ type: Object }) onUserAnnotationClick?: (
    annotation: UserAnnotation,
    target: HTMLElement
  ) => void;
  @property({ type: Object }) onConceptClick?: (
    conceptId: string,
    target: HTMLElement
  ) => void;
  @property({ type: Object }) onFootnoteClick?: (
    footnote: ElowenFootnote,
    target: HTMLElement
  ) => void;
  @property({ type: Array }) footnotes?: ElowenFootnote[];

  @observable.shallow private highlightsMap = new ObservableMap<
    string,
    Highlight[]
  >();

  constructor() {
    super();
    makeObservable(this);
  }

  protected firstUpdated(_changedProperties: PropertyValues): void {
    this.updateHighlightsMap();
  }

  protected override updated(_changedProperties: PropertyValues): void {
    if (!_changedProperties.get("abstract")) {
      return;
    }
    this.updateHighlightsMap();
  }

  private updateHighlightsMap() {
    this.highlightsMap.clear();
    if (!this.abstract?.contents) {
      return;
    }

    this.abstract.contents.map((content) => {
      content.textContent?.spans.map((span) => {
        const newHighlights: Highlight[] = [];
        // Add a special highlight for the excerpt span when not collapsed
        if (!this.isCollapsed && span.id === this.excerptSpanId) {
          newHighlights.push({
            color: "cyan",
            spanId: span.id,
            position: {
              startIndex: 0,
              endIndex: span.text.length - 1,
            },
          });
        }
        this.highlightsMap.set(span.id, newHighlights);
      });
    });
  }

  override render() {
    if (!this.abstract?.contents) {
      return nothing;
    }
    return html`
      <style>
        ${styles}
      </style>
      <div class="abstract-renderer-container">
        <div class="abstract">
          <h2 class="abstract-header">
            <pr-icon-button
              variant="default"
              @click=${() => {
                this.onCollapseChange(!this.isCollapsed);
              }}
              .icon=${this.isCollapsed
                ? "chevron_right"
                : "keyboard_arrow_down"}
            ></pr-icon-button
            >${t("doc.abstract", this.settingsService.responseLanguage.value)}
          </h2>
          ${this.abstract.contents.map((content) => {
            return html`<div class="abstract-content">
              ${content.textContent?.spans.map((span) => {
                if (this.isCollapsed && span.id !== this.excerptSpanId)
                  return nothing;

                const highlights = [
                  ...(this.highlightsMap.get(span.id) ?? []),
                  ...getSpanHighlightsFromManagers(
                    span.id,
                    this.highlightManager,
                    this.answerHighlightManager,
                    this.userHighlightManager
                  ),
                ];
                return html`<elowen-span
                  .span=${span}
                  .highlights=${highlights}
                  .onAnswerHighlightClick=${this.onAnswerHighlightClick}
                  .onUserAnnotationClick=${this.onUserAnnotationClick}
                  .onConceptClick=${this.onConceptClick}
                  .footnotes=${this.footnotes}
                  .onFootnoteClick=${this.onFootnoteClick}
                  .font=${ElowenFont.PAPER_TEXT}
                ></elowen-span>`;
              })}
            </div>`;
          })}
        </div>
      </div>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    "elowen-abstract": ElowenAbstractViz;
  }
}
