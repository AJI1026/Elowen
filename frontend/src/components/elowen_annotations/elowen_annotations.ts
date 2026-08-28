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
import { core } from "../../core/core";
import { DocumentStateService } from "../../services/document_state.service";
import { HistoryService } from "../../services/history.service";
import { LightMobxLitElement } from "../light_mobx_lit_element/light_mobx_lit_element";
import { UserAnnotation } from "../../shared/types_local_storage";
import { normalizeSelectionText } from "../../shared/selection_utils";
import { styles } from "./elowen_annotations.scss";
import {
  UserAnnotationTooltipProps,
  FloatingPanelService,
} from "../../services/floating_panel_service";
import { SettingsService } from "../../services/settings.service";
import { t } from "../../shared/i18n";

/**
 * Lists user annotations for the current document.
 */
@customElement("elowen-annotations")
export class ElowenAnnotations extends LightMobxLitElement {
  private readonly documentStateService = core.getService(DocumentStateService);
  private readonly historyService = core.getService(HistoryService);
  private readonly floatingPanelService = core.getService(FloatingPanelService);
  private readonly settingsService = core.getService(SettingsService);

  @property({ type: String }) docId = "";

  private getAnnotations(): UserAnnotation[] {
    if (!this.docId) return [];
    return this.historyService.getAnnotations(this.docId);
  }

  private handleGoTo(annotation: UserAnnotation) {
    this.documentStateService.focusOnSpan(annotation.highlightedSpans, {
      color: annotation.color,
    });
  }

  private handleItemClick(annotation: UserAnnotation, target: HTMLElement) {
    const props = new UserAnnotationTooltipProps(
      annotation,
      this.docId,
      (updated) => this.historyService.updateAnnotation(this.docId, updated),
      (annotationId) =>
        this.historyService.removeAnnotation(this.docId, annotationId),
      (item) => this.handleGoTo(item)
    );
    this.floatingPanelService.show(props, target);
  }

  private formatDate(timestamp: number): string {
    return new Date(timestamp).toLocaleDateString(undefined, {
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  }

  override render() {
    const annotations = this.getAnnotations();

    return html`
      <style>
        ${styles}
      </style>
      <div class="elowen-annotations-host">
        ${annotations.length === 0
          ? html`<div class="empty-state">
              ${t("notes.empty", this.settingsService.responseLanguage.value)}
            </div>`
          : annotations.map(
              (annotation) => html`
                <div
                  class="annotation-item"
                  @click=${(e: MouseEvent) =>
                    this.handleItemClick(
                      annotation,
                      e.currentTarget as HTMLElement
                    )}
                >
                  <div class="annotation-text">
                    "${normalizeSelectionText(annotation.selectedText)}"
                  </div>
                  ${annotation.note
                    ? html`<div class="annotation-note">${annotation.note}</div>`
                    : nothing}
                  <div class="annotation-meta">
                    ${this.formatDate(annotation.createdAt)}
                  </div>
                </div>
              `
            )}
      </div>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    "elowen-annotations": ElowenAnnotations;
  }
}
