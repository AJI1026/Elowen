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
import "@material/web/textfield/outlined-text-field.js";

import { MobxLitElement } from "@adobe/lit-mobx";
import { CSSResultGroup, html } from "lit";
import { customElement, property, state } from "lit/decorators.js";

import { core } from "../../../core/core";
import {
  DialogService,
  UserFeedbackDialogProps,
} from "../../../services/dialog.service";
import { FirebaseService } from "../../../services/firebase.service";
import { RouterService } from "../../../services/router.service";
import { SettingsService } from "../../../services/settings.service";
import { SnackbarService } from "../../../services/snackbar.service";
import { saveUserFeedbackCallable } from "../../../shared/callables";
import { ResponseLanguage } from "../../../shared/model_config";
import { t } from "../../../shared/i18n";
import { styles } from "./user_feedback_dialog.scss";

/**
 * The user feedback dialog component.
 */
@customElement("user-feedback-dialog")
export class UserFeedbackDialog extends MobxLitElement {
  static override styles: CSSResultGroup = [styles];

  private readonly dialogService = core.getService(DialogService);
  private readonly firebaseService = core.getService(FirebaseService);
  private readonly routerService = core.getService(RouterService);
  private readonly settingsService = core.getService(SettingsService);
  private readonly snackbarService = core.getService(SnackbarService);

  /** Injected by elowen-dialogs so language switches always refresh this UI. */
  @property({ type: String }) lang: ResponseLanguage = ResponseLanguage.ZH;

  @state() private feedbackText = "";
  @state() private isLoading = false;

  private uiLang() {
    return this.lang || this.settingsService.responseLanguage.value;
  }

  private handleClose() {
    if (this.dialogService) {
      this.dialogService.hide(new UserFeedbackDialogProps());
    }
  }

  private async handleSend() {
    const arxivId =
      this.routerService.activeRoute.params.document_id ?? undefined;
    const lang = this.uiLang();

    try {
      this.isLoading = true;
      await saveUserFeedbackCallable(this.firebaseService.functions, {
        userFeedbackText: this.feedbackText,
        arxivId,
      });
      this.snackbarService.show(t("feedback.snackSuccess", lang));
      this.handleClose();
      this.feedbackText = "";
    } catch (e) {
      console.error("Error sending feedback:", e);
      this.snackbarService.show(t("feedback.snackError", lang));
    } finally {
      this.isLoading = false;
    }
  }

  private shouldShowDialog() {
    return this.dialogService.dialogProps instanceof UserFeedbackDialogProps;
  }

  override render() {
    const lang = this.uiLang();
    return html`
      <pr-dialog
        .showDialog=${this.shouldShowDialog()}
        .onClose=${this.handleClose}
        enableEscape
      >
        <div slot="title">${t("feedback.title", lang)}</div>
        <div class="dialog-content">
          <p class="dialog-explanation">
            ${t("feedback.bodyBefore", lang)}
            <a
              href="https://github.com/AJI1026/Elowen/discussions"
              target="_blank"
              rel="noopener noreferrer"
              >${t("feedback.githubLink", lang)}</a
            >${t("feedback.bodyAfter", lang)}
          </p>
          <md-outlined-text-field
            type="textarea"
            rows="5"
            .value=${this.feedbackText}
            ?disabled=${this.isLoading}
            @input=${(e: InputEvent) => {
              this.feedbackText = (e.target as HTMLTextAreaElement).value;
            }}
            .placeholder=${t("feedback.placeholder", lang)}
            label=${t("feedback.placeholder", lang)}
          >
          </md-outlined-text-field>
        </div>
        <div slot="actions-right" class="actions">
          <pr-button
            @click=${() => {
              this.feedbackText = "";
              this.handleClose();
            }}
            variant="default"
            ?disabled=${this.isLoading}
            >${t("common.cancel", lang)}</pr-button
          >
          <pr-button
            @click=${this.handleSend}
            ?loading=${this.isLoading}
            ?disabled=${this.feedbackText.trim() === ""}
          >
            ${t("feedback.send", lang)}
          </pr-button>
        </div>
      </pr-dialog>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    "user-feedback-dialog": UserFeedbackDialog;
  }
}
