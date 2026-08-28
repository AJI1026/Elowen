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

import "../../pair-components/button";
import "../../pair-components/dialog";
import "../../pair-components/icon_button";
import "../../pair-components/textinput";

import { MobxLitElement } from "@adobe/lit-mobx";
import { CSSResultGroup, html, nothing } from "lit";
import { customElement, property, state } from "lit/decorators.js";

import { core } from "../../core/core";
import { HistoryService } from "../../services/history.service";
import { getElowenPaperUrl } from "../../services/router.service";
import { SettingsService } from "../../services/settings.service";

import { ArxivMetadata } from "../../shared/elowen_doc";
import { sortPaperDataByTimestamp } from "../../shared/elowen_paper_utils";
import { I18nKey, t } from "../../shared/i18n";

import { styles } from "./reading_history.scss";

/** Reading history used for history dialog, settings page */
@customElement("reading-history")
export class ReadingHistory extends MobxLitElement {
  static override styles: CSSResultGroup = [styles];

  private readonly historyService = core.getService(HistoryService);
  private readonly settingsService = core.getService(SettingsService);

  @property({ type: Boolean }) showTitle = false;

  @state() private confirmOpen = false;
  @state() private confirmTitleKey: I18nKey = "settings.removePaperTitle";
  @state() private confirmMessageKey: I18nKey = "settings.removePaperConfirm";
  private pendingConfirm: (() => void) | null = null;

  private uiLang() {
    return this.settingsService.responseLanguage.value;
  }

  private openConfirm(
    titleKey: I18nKey,
    messageKey: I18nKey,
    onConfirm: () => void
  ) {
    this.confirmTitleKey = titleKey;
    this.confirmMessageKey = messageKey;
    this.pendingConfirm = onConfirm;
    this.confirmOpen = true;
  }

  private closeConfirm() {
    this.confirmOpen = false;
    this.pendingConfirm = null;
  }

  private handleConfirm() {
    const action = this.pendingConfirm;
    this.closeConfirm();
    action?.();
    this.requestUpdate();
  }

  renderHistoryItem(item: ArxivMetadata) {
    const lang = this.uiLang();
    return html`
      <div class="history-item">
        <div class="left">
          <a
            href=${getElowenPaperUrl(item.paperId)}
            rel="noopener noreferrer"
            class="title"
          >
            ${item.title}
          </a>
          <div>${item.authors.join(", ")}</div>
          <i>${item.paperId}</i>
        </div>
        <div class="right">
          <pr-icon-button
            color="neutral"
            icon="delete"
            variant="default"
            @click=${(e: Event) => {
              e.stopPropagation();
              this.openConfirm(
                "settings.removePaperTitle",
                "settings.removePaperConfirm",
                () => this.historyService.deletePaper(item.paperId)
              );
            }}
          >
          </pr-icon-button>
        </div>
      </div>
    `;
  }

  renderClearButton() {
    const lang = this.uiLang();
    return html`
      <pr-button
        @click=${() => {
          this.openConfirm(
            "settings.clearHistoryTitle",
            "settings.clearHistoryConfirm",
            () => this.historyService.clearAllHistory()
          );
        }}
        color="error"
        variant="tonal"
      >
        ${t("settings.clearHistory", lang)}
      </pr-button>
    `;
  }

  private renderConfirmDialog() {
    const lang = this.uiLang();
    return html`
      <pr-dialog
        .showDialog=${this.confirmOpen}
        .onClose=${() => this.closeConfirm()}
        enableEscape
      >
        <div slot="title">${t(this.confirmTitleKey, lang)}</div>
        <p class="confirm-message">${t(this.confirmMessageKey, lang)}</p>
        <div slot="actions-right" class="confirm-actions">
          <pr-button variant="default" @click=${() => this.closeConfirm()}>
            ${t("common.cancel", lang)}
          </pr-button>
          <pr-button
            color="error"
            variant="tonal"
            @click=${() => this.handleConfirm()}
          >
            ${t("common.confirm", lang)}
          </pr-button>
        </div>
      </pr-dialog>
    `;
  }

  override render() {
    const historyItems = sortPaperDataByTimestamp(
      this.historyService.getPaperHistory()
    ).map((item) => item.metadata);
    const hasItems = historyItems.length > 0;
    const lang = this.uiLang();

    return html`
      ${this.showTitle
        ? html`<h2>
            ${t("settings.historyTitle", lang, {
              count: historyItems.length,
            })}
          </h2>`
        : nothing}
      ${!hasItems ? html`<i>${t("settings.historyEmpty", lang)}</i>` : nothing}
      ${historyItems.map((item) => this.renderHistoryItem(item))}
      ${hasItems ? this.renderClearButton() : nothing}
      ${this.renderConfirmDialog()}
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    "reading-history": ReadingHistory;
  }
}
