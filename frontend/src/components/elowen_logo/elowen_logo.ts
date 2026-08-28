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
import { customElement, property } from "lit/decorators.js";
import { LOGO_ASSET_PATH, staticAssetUrl } from "../../shared/constants";
import { styles } from "./elowen_logo.scss";

/**
 * Brand mark for Elowen (科研.svg / favicon.svg).
 */
@customElement("elowen-logo")
export class ElowenLogo extends MobxLitElement {
  static override styles: CSSResultGroup = [styles];

  @property({ type: String }) size: "small" | "medium" = "medium";
  @property({ type: String }) title = "";
  @property({ type: Object }) onClick: (() => void) | null = null;

  override render() {
    return html`
      <button
        type="button"
        class="logo-button"
        title=${this.title}
        aria-label=${this.title || "Elowen"}
        @click=${() => this.onClick?.()}
      >
        <img
          class="logo-mark"
          src=${staticAssetUrl(LOGO_ASSET_PATH)}
          alt=""
          width="24"
          height="24"
          draggable="false"
        />
      </button>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    "elowen-logo": ElowenLogo;
  }
}
