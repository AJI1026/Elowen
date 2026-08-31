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
import { html, nothing } from "lit";
import { customElement, property } from "lit/decorators.js";

import { ReferenceTooltipProps } from "../../services/floating_panel_service";
import "../elowen_span/elowen_span";
import "../../pair-components/icon_button";
import { core } from "../../core/core";
import { SettingsService } from "../../services/settings.service";
import { t } from "../../shared/i18n";
import { getReferenceExternalLink } from "../../shared/reference_link_utils";

import { styles } from "./reference_tooltip.scss";

/**
 * A component that renders a reference in a tooltip.
 */
@customElement("reference-tooltip")
export class ReferenceTooltip extends MobxLitElement {
  static override styles = [styles];

  private readonly settingsService = core.getService(SettingsService);

  @property({ type: Object }) props!: ReferenceTooltipProps;

  override render() {
    if (!this.props?.reference) {
      return html``;
    }

    const referenceContent = this.props.reference.span;
    const link = getReferenceExternalLink(referenceContent?.text);
    const lang = this.settingsService.responseLanguage.value;
    const open = (e: Event) => {
      e.preventDefault();
      e.stopPropagation();
      if (link) window.open(link.url, "_blank", "noopener,noreferrer");
    };

    return html`<div class="reference-tooltip-component">
      <elowen-span .span=${referenceContent}></elowen-span>
      ${link
        ? html`<div
            class="reference-external-link"
            role="link"
            tabindex="0"
            title=${t("doc.openReference", lang)}
            @click=${open}
            @keydown=${(e: KeyboardEvent) => {
              if (e.key === "Enter" || e.key === " ") open(e);
            }}
          >
            <pr-icon-button
              variant="default"
              icon="open_in_new"
              title=${t("doc.openReference", lang)}
              @click=${open}
            ></pr-icon-button>
            <span>${t("doc.openReference", lang)}</span>
          </div>`
        : nothing}
    </div>`;
  }
}declare global {
  interface HTMLElementTagNameMap {
    "reference-tooltip": ReferenceTooltip;
  }
}
