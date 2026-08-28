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

import { html, nothing, TemplateResult } from "lit";
import { customElement, property } from "lit/decorators.js";
import { classMap } from "lit/directives/class-map.js";
import {
  ListContent,
  ListItem,
  ElowenFootnote,
  ElowenReference,
  ElowenSpan,
  TextContent,
} from "../../shared/elowen_doc";
import { FocusState, ElowenFont } from "../../shared/types";
import { HighlightManager } from "../../shared/highlight_manager";
import { AnswerHighlightManager } from "../../shared/answer_highlight_manager";
import { UserHighlightManager } from "../../shared/user_highlight_manager";
import { ElowenAnswer } from "../../shared/api";
import { UserAnnotation } from "../../shared/types_local_storage";
import { LightMobxLitElement } from "../light_mobx_lit_element/light_mobx_lit_element";
import { getSpanHighlightsFromManagers } from "../elowen_span/elowen_span_utils";
import { styles } from "./elowen_mindmap.scss";
import { core } from "../../core/core";
import { SettingsService } from "../../services/settings.service";
import { SnackbarService } from "../../services/snackbar.service";
import { t } from "../../shared/i18n";
import {
  downloadMindmapDrawio,
  mindmapToDrawioXml,
  openMindmapInDrawio,
} from "../../shared/drawio_utils";

import "../elowen_span/elowen_span";
import "../../pair-components/button";

/**
 * Renders nested list answer content as a visual logic mind map tree,
 * with optional export/open in diagrams.net (draw.io).
 */
@customElement("elowen-mindmap")
export class ElowenMindmap extends LightMobxLitElement {
  @property({ type: Array }) textContents: TextContent[] = [];
  @property({ type: Array }) listContents: ListContent[] = [];
  @property({ type: Array }) references?: ElowenReference[];
  @property({ type: Array }) footnotes?: ElowenFootnote[];
  @property({ type: Array }) referencedSpans?: ElowenSpan[];
  @property({ type: Object }) highlightManager?: HighlightManager;
  @property({ type: Object }) answerHighlightManager?: AnswerHighlightManager;
  @property({ type: Object }) userHighlightManager?: UserHighlightManager;
  @property({ type: Object }) onSpanReferenceClicked?: (
    referenceId: string
  ) => void;
  @property({ type: Object }) onAnswerHighlightClick?: (
    answer: ElowenAnswer,
    target: HTMLElement
  ) => void;
  @property({ type: Object }) onUserAnnotationClick?: (
    annotation: UserAnnotation,
    target: HTMLElement
  ) => void;

  private readonly settingsService = core.getService(SettingsService);
  private readonly snackbarService = core.getService(SnackbarService);

  private uiLang() {
    return this.settingsService.responseLanguage.value;
  }

  private getDrawioXml() {
    return mindmapToDrawioXml(this.textContents, this.listContents);
  }

  private handleOpenDrawio() {
    const opened = openMindmapInDrawio(this.getDrawioXml());
    if (!opened) {
      this.snackbarService.show(t("mindmap.drawioBlocked", this.uiLang()));
    }
  }

  private handleDownloadDrawio() {
    downloadMindmapDrawio(this.getDrawioXml());
  }

  private sanitizeSpan(span: ElowenSpan): ElowenSpan {
    // Older answers may still contain bare [[spanId]] leftovers in nested list text.
    if (!span.text.includes("[[")) {
      return span;
    }
    const cleaned = span.text
      .replace(/\[\[[^\]]*\]\]/g, "")
      .replace(/[ \t]{2,}/g, " ")
      .trim();
    return cleaned === span.text ? span : { ...span, text: cleaned };
  }

  private renderSpans(spans: ElowenSpan[]): TemplateResult[] {
    return spans.map((rawSpan) => {
      const span = this.sanitizeSpan(rawSpan);
      return html`<elowen-span
        .span=${span}
        .focusState=${FocusState.DEFAULT}
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
        .onAnswerHighlightClick=${this.onAnswerHighlightClick}
        .onUserAnnotationClick=${this.onUserAnnotationClick}
        .font=${ElowenFont.DEFAULT}
      ></elowen-span>`;
    });
  }

  private renderNode(item: ListItem, depth: number): TemplateResult {
    const classes = classMap({
      "mindmap-node": true,
      [`depth-${Math.min(depth, 3)}`]: true,
    });
    return html`
      <li class=${classes}>
        <div class="node-card">${this.renderSpans(item.spans)}</div>
        ${item.subListContent
          ? this.renderBranch(item.subListContent, depth + 1)
          : nothing}
      </li>
    `;
  }

  private renderBranch(
    listContent: ListContent,
    depth: number
  ): TemplateResult {
    return html`<ul class="mindmap-branch depth-${Math.min(depth, 3)}">
      ${listContent.listItems.map((item) => this.renderNode(item, depth))}
    </ul>`;
  }

  private renderTitles() {
    if (this.textContents.length === 0) return nothing;
    return html`<div class="mindmap-title">
      ${this.textContents.map(
        (textContent) =>
          html`<div class="title-line">
            ${this.renderSpans(textContent.spans ?? [])}
          </div>`
      )}
    </div>`;
  }

  private renderActions() {
    const lang = this.uiLang();
    return html`<div class="mindmap-actions">
      <pr-button
        variant="tonal"
        color="tertiary"
        @click=${this.handleOpenDrawio}
        >${t("mindmap.openDrawio", lang)}</pr-button
      >
      <pr-button
        variant="default"
        color="tertiary"
        @click=${this.handleDownloadDrawio}
        >${t("mindmap.downloadDrawio", lang)}</pr-button
      >
    </div>`;
  }

  override render() {
    if (this.listContents.length === 0 && this.textContents.length === 0) {
      return nothing;
    }

    return html`
      <style>
        ${styles}
      </style>
      <div class="elowen-mindmap">
        ${this.renderActions()} ${this.renderTitles()}
        ${this.listContents.map((list) => this.renderBranch(list, 0))}
      </div>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    "elowen-mindmap": ElowenMindmap;
  }
}
