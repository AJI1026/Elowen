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

import "../../../pair-components/dialog";
import "../../../pair-components/button";

import { MobxLitElement } from "@adobe/lit-mobx";
import { CSSResultGroup, html, nothing } from "lit";
import { customElement } from "lit/decorators.js";

import { core } from "../../../core/core";
import {
  DialogService,
  TutorialDialogProps,
} from "../../../services/dialog.service";
import { styles } from "./tutorial_dialog.scss";
import {
  staticAssetUrl,
  TUTORIAL_IMAGE_QUESTION_IMAGE_PATH,
  TUTORIAL_QUESTION_IMAGE_PATH,
} from "../../../shared/constants";
import { SettingsService } from "../../../services/settings.service";
import { t } from "../../../shared/i18n";

/**
 * The tutorial dialog component.
 */
@customElement("tutorial-dialog")
export class TutorialDialog extends MobxLitElement {
  static override styles: CSSResultGroup = [styles];

  private readonly dialogService = core.getService(DialogService);
  private readonly settingsService = core.getService(SettingsService);

  private uiLang() {
    return this.settingsService.responseLanguage.value;
  }

  private handleClose() {
    if (this.dialogService) {
      this.dialogService.hide(new TutorialDialogProps());
    }
  }

  private shouldShowDialog() {
    return this.dialogService.dialogProps instanceof TutorialDialogProps;
  }

  private renderHideForeverButton() {
    if (!this.dialogService.dialogProps) return nothing;

    // Only show this if it wasn't opened by the user
    if (
      (this.dialogService.dialogProps as TutorialDialogProps).isUserTriggered
    ) {
      return nothing;
    }

    return html`<pr-button
      variant="default"
      @click=${() => {
        this.settingsService.isTutorialConfirmed.value = true;
        this.handleClose();
      }}
    >
      ${t("tutorial.dontShowAgain", this.uiLang())}
    </pr-button>`;
  }

  private renderTipList() {
    const lang = this.uiLang();
    const tips = [
      "tutorial.tipExplain",
      "tutorial.tipAsk",
      "tutorial.tipMindmap",
      "tutorial.tipNotes",
      "tutorial.tipGuide",
    ] as const;

    return html`<ul class="tip-list">
      ${tips.map((key) => html`<li>${t(key, lang)}</li>`)}
    </ul>`;
  }

  override render() {
    const lang = this.uiLang();

    return html`
      <pr-dialog
        .onClose=${() => {
          this.handleClose();
        }}
        .showDialog=${this.shouldShowDialog()}
      >
        <div slot="title">${t("tutorial.title", lang)}</div>
        <div class="tutorial-body">
          <p class="dialog-explanation">${t("tutorial.intro", lang)}</p>
          <div class="images">
            <figure class="tutorial-figure">
              <img
                class="tutorial-image"
                src=${staticAssetUrl(TUTORIAL_QUESTION_IMAGE_PATH)}
                alt=${t("tutorial.captionSelect", lang)}
              />
              <figcaption>${t("tutorial.captionSelect", lang)}</figcaption>
            </figure>
            <figure class="tutorial-figure">
              <img
                class="tutorial-image"
                src=${staticAssetUrl(TUTORIAL_IMAGE_QUESTION_IMAGE_PATH)}
                alt=${t("tutorial.captionImage", lang)}
              />
              <figcaption>${t("tutorial.captionImage", lang)}</figcaption>
            </figure>
          </div>
          ${this.renderTipList()}
        </div>
        <div slot="actions-right" class="actions">
          ${this.renderHideForeverButton()}
          <pr-button
            @click=${() => {
              this.handleClose();
            }}
          >
            ${t("tutorial.gotIt", lang)}
          </pr-button>
        </div>
      </pr-dialog>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    "tutorial-dialog": TutorialDialog;
  }
}
