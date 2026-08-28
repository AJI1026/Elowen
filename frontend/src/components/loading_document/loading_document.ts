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
import { html, CSSResultGroup } from "lit";
import { customElement, property } from "lit/decorators.js";
import { core } from "../../core/core";
import { getArxivPaperUrl } from "../../services/router.service";
import { SettingsService } from "../../services/settings.service";
import { ArxivMetadata } from "../../shared/elowen_doc";
import { t } from "../../shared/i18n";
import { styles } from "./loading_document.scss";

import "../../pair-components/circular_progress";
import "../../pair-components/button";
import "../../pair-components/icon_button";

/**
 * A component to display document metadata while the full document is loading.
 */
@customElement("loading-document")
export class LoadingDocument extends MobxLitElement {
  static override styles: CSSResultGroup = [styles];

  private readonly settingsService = core.getService(SettingsService);

  @property({ type: Object }) metadata?: ArxivMetadata;
  @property({ type: Object }) onBackClick: () => void = () => {};

  private uiLang() {
    return this.settingsService.responseLanguage.value;
  }

  override render() {
    if (!this.metadata) {
      return html``;
    }

    const lang = this.uiLang();

    return html`
      <div class="loading-container">
        <div class="loading-content">
          <div class="header">
            <div class="importing-group">
              <pr-circular-progress></pr-circular-progress>
              <span>${t("loading.importing", lang)}</span>
            </div>
            <span class="note-text"> ${t("loading.importHint", lang)} </span>
          </div>
          <div class="metadata-content">
            <h1 class="title">
              <span
                >${this.metadata.title}
                <a
                  href=${getArxivPaperUrl(this.metadata.paperId)}
                  class="arxiv-link"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  <pr-icon-button
                    class="open-button"
                    variant="default"
                    icon="open_in_new"
                    title=${t("arxiv.open", lang)}
                  >
                  </pr-icon-button>
                </a>
              </span>
            </h1>
            <div class="authors">${this.metadata.authors.join(", ")}</div>
            <div class="summary">${this.metadata.summary}</div>
          </div>
          <div class="footer">
            <pr-button variant="tonal" @click=${this.onBackClick.bind(this)}
              >${t("nav.backHome", lang)}</pr-button
            >
          </div>
        </div>
      </div>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    "loading-document": LoadingDocument;
  }
}
