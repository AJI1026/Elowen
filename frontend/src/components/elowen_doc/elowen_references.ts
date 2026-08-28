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
import { customElement, property } from "lit/decorators.js";
import { classMap } from "lit/directives/class-map.js";
import { ElowenReference } from "../../shared/elowen_doc";
import { AnswerHighlightManager } from "../../shared/answer_highlight_manager";
import { UserHighlightManager } from "../../shared/user_highlight_manager";
import { HighlightManager } from "../../shared/highlight_manager";
import { ElowenFont } from "../../shared/types";
import { ElowenAnswer } from "../../shared/api";
import { UserAnnotation } from "../../shared/types_local_storage";
import { LightMobxLitElement } from "../light_mobx_lit_element/light_mobx_lit_element";
import { styles } from "./elowen_references.scss";

import "../elowen_span/elowen_span";
import "../../pair-components/icon_button";
import { getSpanHighlightsFromManagers } from "../elowen_span/elowen_span_utils";
import { core } from "../../core/core";
import { SettingsService } from "../../services/settings.service";
import { t } from "../../shared/i18n";

@customElement("elowen-references")
export class ElowenReferences extends LightMobxLitElement {
  private readonly settingsService = core.getService(SettingsService);
  @property({ type: Array }) references!: ElowenReference[];
  @property({ type: Boolean }) isCollapsed = false;
  @property({ type: Object }) onCollapseChange: (isCollapsed: boolean) => void =
    () => {};
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

  private renderReference(reference: ElowenReference) {
    const elowenSpanClasses = classMap({
      reference: true,
    });

    return html`<elowen-span
      id=${reference.id}
      class=${elowenSpanClasses}
      .span=${reference.span}
      .highlights=${getSpanHighlightsFromManagers(
        reference.span.id,
        this.highlightManager,
        this.answerHighlightManager,
        this.userHighlightManager
      )}
      .onAnswerHighlightClick=${this.onAnswerHighlightClick}
      .onUserAnnotationClick=${this.onUserAnnotationClick}
      .font=${ElowenFont.PAPER_TEXT}
    ></elowen-span>`;
  }

  override render() {
    return html`
      <style>
        ${styles}
      </style>
      <div class="references-renderer-container">
        <div class="references">
          <h2 class="references-header">
            <pr-icon-button
              variant="default"
              @click=${() => {
                this.onCollapseChange(!this.isCollapsed);
              }}
              .icon=${this.isCollapsed
                ? "chevron_right"
                : "keyboard_arrow_down"}
            ></pr-icon-button>
            ${t("doc.references", this.settingsService.responseLanguage.value)}
          </h2>
          ${this.isCollapsed
            ? nothing
            : this.references.map((reference) =>
                this.renderReference(reference)
              )}
        </div>
      </div>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    "elowen-references": ElowenReferences;
  }
}
