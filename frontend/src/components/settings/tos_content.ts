/**
 * Copyright 2024 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *    https://www.apache.org/licenses/LICENSE-2.0
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

import { core } from "../../core/core";
import { SettingsService } from "../../services/settings.service";
import { t } from "../../shared/i18n";
import { styles } from "./tos_content.scss";

/** TOS content. */
@customElement("tos-content")
export class TOSContent extends MobxLitElement {
  static override styles: CSSResultGroup = [styles];

  private readonly settingsService = core.getService(SettingsService);

  private uiLang() {
    return this.settingsService.responseLanguage.value;
  }

  override render() {
    const lang = this.uiLang();
    return html`
      <p>${t("tos.p1", lang)}</p>
      <p>${t("tos.p2", lang)}</p>
      <p>${t("tos.p3", lang)}</p>
      <p>
        ${t("tos.p5Before", lang)}
        <a href="https://github.com/AJI1026/Elowen" target="_blank">
          ${t("tos.p5Link", lang)}</a
        >${t("tos.p5After", lang)}
      </p>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    "tos-content": TOSContent;
  }
}
