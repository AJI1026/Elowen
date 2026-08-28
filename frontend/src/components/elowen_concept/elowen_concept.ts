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

import { html } from "lit";
import { customElement, property } from "lit/decorators.js";

import { ElowenConcept } from "../../shared/elowen_doc";

import "../elowen_span/elowen_span";
import "./elowen_concept_contents";

import { styles } from "./elowen_concept.scss";
import { LightMobxLitElement } from "../light_mobx_lit_element/light_mobx_lit_element";
import { AnswerHighlightManager } from "../../shared/answer_highlight_manager";
import { UserHighlightManager } from "../../shared/user_highlight_manager";
import { HighlightManager } from "../../shared/highlight_manager";
import { ElowenAnswer } from "../../shared/api";
import { UserAnnotation } from "../../shared/types_local_storage";

/**
 * Displays a Elowen Concept.
 */
@customElement("elowen-concept")
export class ElowenConceptViz extends LightMobxLitElement {
  @property({ type: Object }) concept!: ElowenConcept;
  @property({ type: Object }) highlightManager!: HighlightManager;
  @property({ type: Object }) answerHighlightManager!: AnswerHighlightManager;
  @property({ type: Object }) userHighlightManager!: UserHighlightManager;

  @property() onAnswerHighlightClick: (
    answer: ElowenAnswer,
    target: HTMLElement
  ) => void = () => {};
  @property() onUserAnnotationClick: (
    annotation: UserAnnotation,
    target: HTMLElement
  ) => void = () => {};

  override render() {
    return html`
      <style>
        ${styles}
      </style>
      <div class="elowen-concept-host">
        <div class="elowen-concept-header">
          <h2 class="elowen-concept-heading">${this.concept.name}</h2>
        </div>
        ${this.renderContents()}
      </div>
    `;
  }

  private renderContents() {
    return html`
      <elowen-concept-contents
        .conceptId=${this.concept.id}
        .contents=${this.concept.contents}
        .highlightManager=${this.highlightManager}
        .answerHighlightManager=${this.answerHighlightManager}
        .userHighlightManager=${this.userHighlightManager}
        .onAnswerHighlightClick=${this.onAnswerHighlightClick}
        .onUserAnnotationClick=${this.onUserAnnotationClick}
      >
      </elowen-concept-contents>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    "elowen-concept": ElowenConceptViz;
  }
}
