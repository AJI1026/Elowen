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
import { HighlightSelection } from "../../shared/selection_utils";

import "./elowen_abstract";
import "./elowen_references";
import "./elowen_footnotes";
import "./elowen_section";
import "../elowen_span/elowen_span";
import "../../pair-components/icon_button";
import "../multi_icon_toggle/multi_icon_toggle";

import { styles } from "./elowen_doc.scss";
import { ElowenDocManager } from "../../shared/elowen_doc_manager";
import { CollapseManager } from "../../shared/collapse_manager";
import { HighlightManager } from "../../shared/highlight_manager";
import { AnswerHighlightManager } from "../../shared/answer_highlight_manager";
import { UserHighlightManager } from "../../shared/user_highlight_manager";

import { getArxivPaperUrl } from "../../services/router.service";
import { ElowenFootnote, ElowenReference } from "../../shared/elowen_doc";
import { ElowenAnswer } from "../../shared/api";
import { UserAnnotation } from "../../shared/types_local_storage";
import { LightMobxLitElement } from "../light_mobx_lit_element/light_mobx_lit_element";
import {
  ElowenContentRenderedEvent,
  ElowenContentViz,
} from "../elowen_content/elowen_content";
import { createRef, ref, Ref } from "lit/directives/ref.js";
import { core } from "../../core/core";
import { SettingsService } from "../../services/settings.service";
import { t } from "../../shared/i18n";

/**
 * Displays a Elowen Document.
 */
@customElement("elowen-doc")
export class ElowenDocViz extends LightMobxLitElement {
  private readonly settingsService = core.getService(SettingsService);
  @property({ type: Object }) elowenDocManager!: ElowenDocManager;
  @property({ type: Object }) collapseManager!: CollapseManager;
  @property({ type: Object }) highlightManager!: HighlightManager;
  @property({ type: Object }) answerHighlightManager!: AnswerHighlightManager;
  @property({ type: Object }) userHighlightManager!: UserHighlightManager;
  @property({ type: Object }) getImageUrl?: (path: string) => Promise<string>;
  @property() onPaperReferenceClick: (
    reference: ElowenReference,
    target: HTMLElement
  ) => void = () => {};
  @property() onFootnoteClick: (
    footnote: ElowenFootnote,
    target: HTMLElement
  ) => void = () => {};
  @property() onConceptClick: (conceptId: string, target: HTMLElement) => void =
    () => {};
  @property() onImageClick?: (
    info: { storagePath: string; caption?: string },
    target: HTMLElement
  ) => void = () => {};
  @property() onAnswerHighlightClick: (
    answer: ElowenAnswer,
    target: HTMLElement
  ) => void = () => {};
  @property() onUserAnnotationClick: (
    annotation: UserAnnotation,
    target: HTMLElement
  ) => void = () => {};
  @property() onScroll: () => void = () => {};
  @property() onSpanSummaryMouseEnter: () => void = () => {};
  @property() onSpanSummaryMouseLeave: () => void = () => {};
  @property() hoveredSpanId: string | null = null;

  private intersectionObserver?: IntersectionObserver;
  private scrollRef: Ref<HTMLElement> = createRef<HTMLElement>();

  get elowenDoc() {
    return this.elowenDocManager.elowenDoc;
  }

  private handleElowenContentRendered(event: ElowenContentRenderedEvent) {
    this.intersectionObserver?.observe(event.element);
  }

  override firstUpdated() {
    const scrollableElement = this.scrollRef.value;
    if (!scrollableElement) {
      console.error(
        "Elowen-doc scrollable element not found for IntersectionObserver"
      );
      return;
    }

    this.intersectionObserver = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          const elowenContent = entry.target as ElowenContentViz;
          const visible = entry.isIntersecting;
          elowenContent.setVisible(visible);
        });
      },
      { root: scrollableElement }
    );
  }

  override connectedCallback(): void {
    super.connectedCallback();

    this.addEventListener(
      ElowenContentRenderedEvent.eventName,
      this.handleElowenContentRendered as EventListener
    );
  }

  override disconnectedCallback() {
    super.disconnectedCallback();
    this.intersectionObserver?.disconnect();
    this.removeEventListener(
      ElowenContentRenderedEvent.eventName,
      this.handleElowenContentRendered as EventListener
    );
  }

  override render() {
    const publishedTimestamp =
      this.elowenDocManager.elowenDoc.metadata?.publishedTimestamp;
    const date = publishedTimestamp
      ? new Date(publishedTimestamp).toLocaleDateString()
      : "";
    return html`
      <style>
        ${styles}
      </style>
      <div
        class="elowen-doc"
        ${ref(this.scrollRef)}
        @scroll=${this.onScroll.bind(this)}
      >
        <div class="elowen-doc-content">
          <div class="title-section">
            <h1 class="main-column title">
              ${this.elowenDoc.metadata?.title}
              <a
                href=${getArxivPaperUrl(this.elowenDoc.metadata?.paperId ?? "")}
                class="arxiv-link"
                target="_blank"
                rel="noopener noreferrer"
              >
                <pr-icon-button
                  class="open-button"
                  variant="default"
                  icon="open_in_new"
                  title=${t(
                    "arxiv.open",
                    this.settingsService.responseLanguage.value
                  )}
                >
                </pr-icon-button>
              </a>
            </h1>
            <div class="main-column date">
              ${t("doc.published", this.settingsService.responseLanguage.value, {
                date,
              })}
            </div>
            <div class="main-column authors">
              ${this.elowenDoc.metadata?.authors.join(", ")}
            </div>
          </div>
          ${this.elowenDoc.abstract
            ? html`<elowen-abstract
                .abstract=${this.elowenDoc.abstract}
                .isCollapsed=${this.collapseManager.isAbstractCollapsed}
                .onCollapseChange=${(isCollapsed: boolean) => {
                  this.collapseManager.setAbstractCollapsed(isCollapsed);
                }}
                .onFootnoteClick=${this.onFootnoteClick.bind(this)}
                .onConceptClick=${this.onConceptClick.bind(this)}
                .excerptSpanId=${this.elowenDoc.summaries?.abstractExcerptSpanId}
                .highlightManager=${this.highlightManager}
                .answerHighlightManager=${this.answerHighlightManager}
                .userHighlightManager=${this.userHighlightManager}
                .onAnswerHighlightClick=${this.onAnswerHighlightClick}
                .onUserAnnotationClick=${this.onUserAnnotationClick}
                .footnotes=${this.elowenDoc.footnotes}
              >
              </elowen-abstract>`
            : nothing}
          ${(this.elowenDoc.sections ?? []).map((section) => {
            return html`<elowen-section
              .section=${section}
              .references=${this.elowenDoc.references}
              .footnotes=${this.elowenDoc.footnotes}
              .summaryMaps=${this.elowenDocManager.summaryMaps}
              .hoverFocusedSpanId=${this.hoveredSpanId}
              .getImageUrl=${this.getImageUrl}
              .onSpanSummaryMouseEnter=${this.onSpanSummaryMouseEnter.bind(
                this
              )}
              .onSpanSummaryMouseLeave=${this.onSpanSummaryMouseLeave.bind(
                this
              )}
              .highlightManager=${this.highlightManager}
              .answerHighlightManager=${this.answerHighlightManager}
              .userHighlightManager=${this.userHighlightManager}
              .collapseManager=${this.collapseManager}
              .onPaperReferenceClick=${this.onPaperReferenceClick}
              .onFootnoteClick=${this.onFootnoteClick}
              .onImageClick=${this.onImageClick}
              .onAnswerHighlightClick=${this.onAnswerHighlightClick}
              .onUserAnnotationClick=${this.onUserAnnotationClick}
              .isSubsection=${false}
            >
            </elowen-section>`;
          })}
          <elowen-references
            .references=${this.elowenDoc.references}
            .isCollapsed=${this.collapseManager.areReferencesCollapsed}
            .onCollapseChange=${(isCollapsed: boolean) => {
              this.collapseManager.setReferencesCollapsed(isCollapsed);
            }}
            .highlightManager=${this.highlightManager}
            .answerHighlightManager=${this.answerHighlightManager}
            .userHighlightManager=${this.userHighlightManager}
            .onAnswerHighlightClick=${this.onAnswerHighlightClick}
            .onUserAnnotationClick=${this.onUserAnnotationClick}
          >
          </elowen-references>
          <elowen-footnotes
            .footnotes=${this.elowenDoc.footnotes || []}
            .isCollapsed=${this.collapseManager.areFootnotesCollapsed}
            .onCollapseChange=${(isCollapsed: boolean) => {
              this.collapseManager.setFootnotesCollapsed(isCollapsed);
            }}
          >
          </elowen-footnotes>
        </div>
      </div>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    "elowen-doc": ElowenDocViz;
  }
}
