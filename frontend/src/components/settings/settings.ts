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
import "./tos_content";

import { MobxLitElement } from "@adobe/lit-mobx";
import { CSSResultGroup, html, nothing } from "lit";
import { customElement } from "lit/decorators.js";

import { core } from "../../core/core";
import { getLumiPaperUrl } from "../../services/router.service";
import { SettingsService } from "../../services/settings.service";

import { ArxivMetadata } from "../../shared/lumi_doc";
import { sortPaperDataByTimestamp } from "../../shared/lumi_paper_utils";
import { ColorMode } from "../../shared/types";
import {
  DEFAULT_BASE_URLS,
  DEFAULT_MODEL_NAMES,
  ModelProvider,
} from "../../shared/model_config";

import { styles } from "./settings.scss";

/** Settings page component */
@customElement("settings-page")
export class Settings extends MobxLitElement {
  static override styles: CSSResultGroup = [styles];

  private readonly settingsService = core.getService(SettingsService);

  override render() {
    return html`
      <div class="settings">
        <div class="section">
          <reading-history showTitle></reading-history>
        </div>
        <div class="section">
          <h2>Model</h2>
          <div>
            Optional: Configure the LLM used for "Ask Lumi" queries inside a
            paper. Your API key will never be used to import papers.
          </div>

          <div class="field">
            <div class="action-buttons">
              <pr-button
                color=${this.settingsService.modelProvider.value === ModelProvider.GEMINI ? "primary" : "neutral"}
                variant=${this.settingsService.modelProvider.value === ModelProvider.GEMINI ? "tonal" : "default"}
                @click=${() => this.selectProvider(ModelProvider.GEMINI)}
              >
                Gemini
              </pr-button>
              <pr-button
                color=${this.settingsService.modelProvider.value === ModelProvider.DEEPSEEK ? "primary" : "neutral"}
                variant=${this.settingsService.modelProvider.value === ModelProvider.DEEPSEEK ? "tonal" : "default"}
                @click=${() => this.selectProvider(ModelProvider.DEEPSEEK)}
              >
                DeepSeek
              </pr-button>
              <pr-button
                color=${this.settingsService.modelProvider.value === ModelProvider.OPENAI ? "primary" : "neutral"}
                variant=${this.settingsService.modelProvider.value === ModelProvider.OPENAI ? "tonal" : "default"}
                @click=${() => this.selectProvider(ModelProvider.OPENAI)}
              >
                OpenAI
              </pr-button>
            </div>
          </div>

          <div class="field">
            <pr-textinput
              .value=${this.settingsService.modelName.value}
              .onChange=${(e: InputEvent) => {
                this.settingsService.modelName.value = (e.target as HTMLInputElement).value;
              }}
              placeholder=${DEFAULT_MODEL_NAMES[this.settingsService.modelProvider.value] ?? "Model name"}
              label="Model name"
            ></pr-textinput>
          </div>

          <div class="field">
            <pr-textinput
              .value=${this.settingsService.modelBaseUrl.value}
              .onChange=${(e: InputEvent) => {
                this.settingsService.modelBaseUrl.value = (e.target as HTMLInputElement).value;
              }}
              placeholder=${DEFAULT_BASE_URLS[this.settingsService.modelProvider.value] ?? "https://api.example.com"}
              label="Base URL (optional)"
            ></pr-textinput>
          </div>

          <div class="field">
            <pr-textinput
              .value=${this.settingsService.apiKey.value}
              .onChange=${(e: InputEvent) => {
                this.settingsService.apiKey.value = (e.target as HTMLInputElement).value;
              }}
              placeholder="Paste API key here"
              label="API key"
            ></pr-textinput>
          </div>
        </div>
        <div class="section">
          <h2>About Lumi</h2>
          <tos-content></tos-content>
        </div>
      </div>
    `;
  }

  /** Applies provider defaults when the user switches provider. */
  private selectProvider(provider: ModelProvider) {
    this.settingsService.applyProviderDefaults(provider);
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
