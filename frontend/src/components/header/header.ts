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
import "../../pair-components/icon_button";
import "../../pair-components/tooltip";
import "../language_toggle/language_toggle";
import "../elowen_logo/elowen_logo";
import { MobxLitElement } from "@adobe/lit-mobx";
import { CSSResultGroup, html, nothing } from "lit";
import { customElement } from "lit/decorators.js";

import { core } from "../../core/core";
import {
  DialogService,
  UserFeedbackDialogProps,
} from "../../services/dialog.service";
import { HomeService } from "../../services/home.service";
import { Pages, RouterService } from "../../services/router.service";
import { SettingsService } from "../../services/settings.service";

import { APP_NAME } from "../../shared/constants";
import { t } from "../../shared/i18n";
import { styles } from "./header.scss";
import {
  AnalyticsAction,
  AnalyticsService,
} from "../../services/analytics.service";

/** Header component for app pages */
@customElement("page-header")
export class Header extends MobxLitElement {
  static override styles: CSSResultGroup = [styles];

  private readonly analyticsService = core.getService(AnalyticsService);
  private readonly homeService = core.getService(HomeService);
  private readonly routerService = core.getService(RouterService);
  private readonly dialogService = core.getService(DialogService);
  private readonly settingsService = core.getService(SettingsService);

  private uiLang() {
    return this.settingsService.responseLanguage.value;
  }

  override render() {
    const isBrandTitle =
      this.routerService.activePage === Pages.HOME ||
      this.routerService.activePage === Pages.COLLECTION;

    return html`
      <div class="header">
        <div class="left">
          ${this.renderHomeButton()}
          <h1 class=${isBrandTitle ? "brand-title" : ""}>
            ${this.renderTitle()}
          </h1>
        </div>
        <div class="right">${this.renderActions()}</div>
      </div>
    `;
  }

  private renderTitle() {
    const activePage = this.routerService.activePage;
    const lang = this.uiLang();

    switch (activePage) {
      case Pages.HOME:
        return APP_NAME;
      case Pages.COLLECTION:
        return APP_NAME;
      case Pages.SETTINGS:
        return t("header.settingsTitle", lang);
      default:
        return "";
    }
  }

  private renderActions() {
    const activePage = this.routerService.activePage;
    if (activePage === Pages.SETTINGS) {
      return html`<language-toggle></language-toggle>`;
    }

    return html`
      <language-toggle></language-toggle>
      ${this.renderFeedbackButton()} ${this.renderSettingsButton()}
      ${this.renderImportButton()}
    `;
  }

  private renderHomeButton() {
    const handleClick = () => {
      this.routerService.navigate(Pages.HOME);
    };

    const activePage = this.routerService.activePage;
    const lang = this.uiLang();

    if (activePage === Pages.SETTINGS) {
      return html`
        <pr-tooltip text=${t("header.home", lang)} position="BOTTOM_START">
          <pr-icon-button
            color="neutral"
            icon="arrow_back"
            variant="default"
            @click=${handleClick}
          >
          </pr-icon-button>
        </pr-tooltip>
      `;
    }

    return html`
      <pr-tooltip text=${t("header.home", lang)} position="BOTTOM_START">
        <elowen-logo
          .title=${t("header.home", lang)}
          .onClick=${handleClick}
        ></elowen-logo>
      </pr-tooltip>
    `;
  }

  private renderImportButton() {
    const openDialog = () => {
      this.homeService.setShowUploadDialog(true);
    };
    const lang = this.uiLang();

    return html`
      <pr-tooltip text="" position="BOTTOM_END" class="import-button-tooltip">
        <pr-button variant="filled" @click=${openDialog}>
          ${t("header.importPaper", lang)}
        </pr-button>
      </pr-tooltip>
    `;
  }

  private renderFeedbackButton() {
    const handleClick = () => {
      this.analyticsService.trackAction(
        AnalyticsAction.HOME_HEADER_FEEDBACK_CLICK
      );
      this.dialogService.show(new UserFeedbackDialogProps());
    };
    const lang = this.uiLang();

    return html`
      <pr-tooltip text=${t("header.feedback", lang)} position="BOTTOM_END">
        <pr-icon-button
          color="neutral"
          icon="feedback"
          variant="default"
          @click=${handleClick}
        >
        </pr-icon-button>
      </pr-tooltip>
    `;
  }

  private renderSettingsButton() {
    const handleClick = () => {
      this.routerService.navigate(Pages.SETTINGS);
    };
    const lang = this.uiLang();

    return html`
      <pr-tooltip text=${t("header.settings", lang)} position="BOTTOM_END">
        <pr-icon-button
          color="neutral"
          icon="settings"
          variant="default"
          @click=${handleClick}
        >
        </pr-icon-button>
      </pr-tooltip>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    "page-header": Header;
  }
}
