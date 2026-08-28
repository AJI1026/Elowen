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
import { ConceptContent, ElowenSpan } from "../../shared/elowen_doc";
import { LightMobxLitElement } from "../light_mobx_lit_element/light_mobx_lit_element";
import { styles } from "./elowen_concept_contents.scss";
import { core } from "../../core/core";
import { SettingsService } from "../../services/settings.service";
import { t } from "../../shared/i18n";
import { HighlightManager } from "../../shared/highlight_manager";
import { AnswerHighlightManager } from "../../shared/answer_highlight_manager";
import { UserHighlightManager } from "../../shared/user_highlight_manager";
import { ElowenAnswer } from "../../shared/api";
import { UserAnnotation } from "../../shared/types_local_storage";

import "../../pair-components/icon";
import "../elowen_span/elowen_span";
import { classMap } from "lit/directives/class-map.js";
import { getSpanHighlightsFromManagers } from "../elowen_span/elowen_span_utils";
import { ELOWEN_CONCEPT_SPAN_ID_PREFIX } from "../../shared/constants";

/**
 * A component to render the contents of a ElowenConcept.
 */
@customElement("elowen-concept-contents")
export class ElowenConceptContents extends LightMobxLitElement {
  private readonly settingsService = core.getService(SettingsService);

  @property({ type: String }) conceptId: string = "";
  @property({ type: Array }) contents: ConceptContent[] = [];
  @property({ type: Object }) highlightManager?: HighlightManager;
  @property({ type: Object }) answerHighlightManager?: AnswerHighlightManager;
  @property({ type: Object }) userHighlightManager?: UserHighlightManager;

  @state() private showAll = false;

  @property() onAnswerHighlightClick?: (
    answer: ElowenAnswer,
    target: HTMLElement
  ) => void = () => {};
  @property() onUserAnnotationClick?: (
    annotation: UserAnnotation,
    target: HTMLElement
  ) => void = () => {};

  private showContent() {
    this.showAll = true;
  }

  override render() {
    const contentToShow = this.showAll
      ? this.contents
      : this.contents.slice(0, 1);
    const hasMoreContent = this.contents.length > 1;

    const showButton = hasMoreContent && !this.showAll;

    const contentItemClasses = classMap({
      "content-item": true,
      "no-show-all-button": !showButton,
    });

    return html`
      <style>
        ${styles}
      </style>
      ${contentToShow.map((content, index) => {
        const tempSpan: ElowenSpan = {
          id: `${ELOWEN_CONCEPT_SPAN_ID_PREFIX}-${this.conceptId}-${index}`,
          text: content.value,
          innerTags: [],
        };

        const spanClassMap = {
          "concept-expand-text": index === 1,
        };

        return html`
          <div class=${contentItemClasses}>
            <div class="content-value">
              <elowen-span
                .span=${tempSpan}
                .noScrollContext=${true}
                .classMap=${spanClassMap}
                .highlights=${getSpanHighlightsFromManagers(
                  tempSpan.id,
                  this.highlightManager,
                  this.answerHighlightManager,
                  this.userHighlightManager
                )}
                .onAnswerHighlightClick=${this.onAnswerHighlightClick}
                .onUserAnnotationClick=${this.onUserAnnotationClick}
              ></elowen-span>
            </div>
          </div>
        `;
      })}
      ${showButton
        ? html`<pr-icon-button
            title=${t(
              "content.seeMore",
              this.settingsService.responseLanguage.value
            )}
            icon="more_horiz"
            variant="default"
            class="show-more-button"
            color="secondary"
            @click=${this.showContent.bind(this)}
          ></pr-icon-button>`
        : nothing}
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    "elowen-concept-contents": ElowenConceptContents;
  }
}
