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
import { CSSResultGroup, html } from "lit";
import { customElement } from "lit/decorators.js";
import { classMap } from "lit/directives/class-map.js";
import { core } from "../../core/core";
import { SettingsService } from "../../services/settings.service";
import { ResponseLanguage } from "../../shared/model_config";
import { applyDocumentLanguage, t } from "../../shared/i18n";
import { styles } from "./language_toggle.scss";

/**
 * Global EN / 中 toggle. Updates UI chrome language and LLM response language.
 */
@customElement("language-toggle")
export class LanguageToggle extends MobxLitElement {
  static override styles: CSSResultGroup = [styles];

  private readonly settingsService = core.getService(SettingsService);

  private setLanguage(language: ResponseLanguage) {
    this.settingsService.setModelConfig({ responseLanguage: language });
    applyDocumentLanguage(language);
  }

  override connectedCallback(): void {
    super.connectedCallback();
    applyDocumentLanguage(this.settingsService.responseLanguage.value);
  }

  override render() {
    const current = this.settingsService.responseLanguage.value;
    const enClasses = classMap({
      "lang-button": true,
      selected: current === ResponseLanguage.EN,
    });
    const zhClasses = classMap({
      "lang-button": true,
      selected: current === ResponseLanguage.ZH,
    });

    return html`
      <div
        class="language-toggle"
        title=${t("lang.toggleTitle", current)}
        role="group"
        aria-label=${t("lang.toggleTitle", current)}
      >
        <button
          type="button"
          class=${enClasses}
          @click=${() => this.setLanguage(ResponseLanguage.EN)}
          title=${t("lang.enTitle", current)}
          aria-pressed=${current === ResponseLanguage.EN}
        >
          EN
        </button>
        <span class="lang-sep" aria-hidden="true">/</span>
        <button
          type="button"
          class=${zhClasses}
          @click=${() => this.setLanguage(ResponseLanguage.ZH)}
          title=${t("lang.zhTitle", current)}
          aria-pressed=${current === ResponseLanguage.ZH}
        >
          中
        </button>
      </div>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    "language-toggle": LanguageToggle;
  }
}
