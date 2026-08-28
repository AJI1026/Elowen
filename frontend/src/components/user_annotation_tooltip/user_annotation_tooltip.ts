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
import { CSSResultGroup, html, TemplateResult } from "lit";
import { customElement, property, state } from "lit/decorators.js";
import {
  FloatingPanelService,
  UserAnnotationTooltipProps,
} from "../../services/floating_panel_service";
import { styles } from "./user_annotation_tooltip.scss";
import { core } from "../../core/core";
import { MAX_QUERY_INPUT_LENGTH } from "../../shared/constants";
import { normalizeSelectionText } from "../../shared/selection_utils";
import { SettingsService } from "../../services/settings.service";
import { t } from "../../shared/i18n";

import "../../pair-components/button";
import "../../pair-components/textarea";
import "../../pair-components/icon_button";

/**
 * A tooltip for viewing and editing a user annotation.
 */
@customElement("user-annotation-tooltip")
export class UserAnnotationTooltip extends MobxLitElement {
  static override styles: CSSResultGroup = [styles];

  @property({ type: Object }) props!: UserAnnotationTooltipProps;
  @state() private noteText = "";

  private floatingPanelService = core.getService(FloatingPanelService);
  private settingsService = core.getService(SettingsService);

  private uiLang() {
    return this.settingsService.responseLanguage.value;
  }

  override willUpdate() {
    if (this.props?.annotation && this.noteText === "") {
      this.noteText = this.props.annotation.note ?? "";
    }
  }

  private handleSave() {
    const updatedAnnotation = {
      ...this.props.annotation,
      note: this.noteText.trim() || undefined,
    };
    this.props.onUpdate(updatedAnnotation);
    this.floatingPanelService.hide();
  }

  private handleDelete() {
    this.props.onDelete(this.props.annotation.id);
    this.floatingPanelService.hide();
  }

  private handleGoTo() {
    this.props.onGoTo(this.props.annotation);
    this.floatingPanelService.hide();
  }

  override render(): TemplateResult {
    const { selectedText } = this.props.annotation;
    const lang = this.uiLang();

    return html`
      <div class="user-annotation-tooltip">
        <div class="selected-text">
          "${normalizeSelectionText(selectedText)}"
        </div>
        <pr-textarea
          class="note-input"
          size="small"
          .value=${this.noteText}
          placeholder=${t("notes.addPlaceholder", lang)}
          .maxLength=${MAX_QUERY_INPUT_LENGTH}
          @change=${(e: CustomEvent) => {
            this.noteText = e.detail.value;
          }}
        ></pr-textarea>
        <div class="actions">
          <pr-button variant="text" color="secondary" @click=${this.handleGoTo}>
            ${t("notes.goTo", lang)}
          </pr-button>
          <pr-button
            variant="text"
            color="secondary"
            @click=${this.handleDelete}
          >
            ${t("notes.delete", lang)}
          </pr-button>
          <pr-button variant="default" color="tertiary" @click=${this.handleSave}>
            ${t("notes.save", lang)}
          </pr-button>
        </div>
      </div>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    "user-annotation-tooltip": UserAnnotationTooltip;
  }
}
