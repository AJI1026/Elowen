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
import "../../pair-components/textinput";
import "./reading_history";

import { MobxLitElement } from "@adobe/lit-mobx";
import { CSSResultGroup, html } from "lit";
import { customElement } from "lit/decorators.js";

import { core } from "../../core/core";
import { SettingsService } from "../../services/settings.service";

import { ColorMode } from "../../shared/types";
import {
  DEFAULT_BASE_URLS,
  DEFAULT_MODEL_NAMES,
  ModelProvider,
} from "../../shared/model_config";
import { t } from "../../shared/i18n";

import { styles } from "./settings.scss";

/** Settings page component */
@customElement("settings-page")
export class Settings extends MobxLitElement {
  static override styles: CSSResultGroup = [styles];

  private readonly settingsService = core.getService(SettingsService);

  private uiLang() {
    return this.settingsService.responseLanguage.value;
  }

  private isProvider(provider: ModelProvider) {
    return this.settingsService.modelProvider.value === provider;
  }

  override render() {
    const lang = this.uiLang();
    const provider = this.settingsService.modelProvider.value;

    return html`
      <div class="settings">
        <div class="section">
          <reading-history showTitle></reading-history>
        </div>
        <div class="section">
          <h2>${t("settings.model", lang)}</h2>
          <div>${t("settings.modelHelp", lang)}</div>

          <div class="field">
            <div class="action-buttons">
              <pr-button
                color=${this.isProvider(ModelProvider.DEEPSEEK)
                  ? "primary"
                  : "neutral"}
                variant=${this.isProvider(ModelProvider.DEEPSEEK)
                  ? "tonal"
                  : "default"}
                @click=${() => this.selectProvider(ModelProvider.DEEPSEEK)}
              >
                ${t("settings.providerDeepSeek", lang)}
              </pr-button>
              <pr-button
                color=${this.isProvider(ModelProvider.OPENAI)
                  ? "primary"
                  : "neutral"}
                variant=${this.isProvider(ModelProvider.OPENAI)
                  ? "tonal"
                  : "default"}
                @click=${() => this.selectProvider(ModelProvider.OPENAI)}
              >
                ${t("settings.providerCustom", lang)}
              </pr-button>
            </div>
          </div>

          <div class="field">
            <pr-textinput
              .value=${this.settingsService.modelName}
              .onChange=${(e: InputEvent) => {
                this.settingsService.updateActiveModelName(
                  (e.target as HTMLInputElement).value
                );
              }}
              placeholder=${DEFAULT_MODEL_NAMES[provider] ??
              t("settings.modelName", lang)}
              label=${t("settings.modelName", lang)}
            ></pr-textinput>
          </div>

          <div class="field">
            <pr-textinput
              .value=${this.settingsService.modelBaseUrl}
              .onChange=${(e: InputEvent) => {
                this.settingsService.updateActiveBaseUrl(
                  (e.target as HTMLInputElement).value
                );
              }}
              placeholder=${DEFAULT_BASE_URLS[provider] ??
              "https://api.example.com/v1"}
              label=${t("settings.baseUrl", lang)}
            ></pr-textinput>
          </div>

          <div class="field">
            <pr-textinput
              .value=${this.settingsService.apiKey}
              .onChange=${(e: InputEvent) => {
                this.settingsService.updateActiveApiKey(
                  (e.target as HTMLInputElement).value
                );
              }}
              placeholder=${t("settings.apiKeyPlaceholder", lang)}
              label=${t("settings.apiKey", lang)}
            ></pr-textinput>
          </div>
        </div>
        <div class="section">
          <h2>${t("settings.about", lang)}</h2>
          <p class="about-text">${t("settings.aboutIntro", lang)}</p>
          <p class="about-text">${t("settings.aboutFeatures", lang)}</p>
        </div>
      </div>
    `;
  }

  /** Applies provider defaults when the user switches provider. */
  private selectProvider(provider: ModelProvider) {
    this.settingsService.selectProvider(provider);
  }

  private renderColorModeSection() {
    const handleClick = (mode: ColorMode) => {
      this.settingsService.setColorMode(mode);
    };

    const isMode = (mode: ColorMode) => {
      return this.settingsService.colorMode === mode;
    };

    return html`
      <div class="section">
        <h2>Color Mode</h2>
        <div class="action-buttons">
          <pr-button
            color=${isMode(ColorMode.LIGHT) ? "primary" : "neutral"}
            variant=${isMode(ColorMode.LIGHT) ? "tonal" : "default"}
            @click=${() => {
              handleClick(ColorMode.LIGHT);
            }}
          >
            Light
          </pr-button>
          <pr-button
            color=${isMode(ColorMode.DARK) ? "primary" : "neutral"}
            variant=${isMode(ColorMode.DARK) ? "tonal" : "default"}
            @click=${() => {
              handleClick(ColorMode.DARK);
            }}
          >
            Dark
          </pr-button>
          <pr-button
            color=${isMode(ColorMode.DEFAULT) ? "primary" : "neutral"}
            variant=${isMode(ColorMode.DEFAULT) ? "tonal" : "default"}
            @click=${() => {
              handleClick(ColorMode.DEFAULT);
            }}
          >
            System Default
          </pr-button>
        </div>
      </div>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    "settings-page": Settings;
  }
}
