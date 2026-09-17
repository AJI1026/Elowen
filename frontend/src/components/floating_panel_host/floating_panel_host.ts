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

import "@material/web/menu/menu.js";

import { MobxLitElement } from "@adobe/lit-mobx";
import { CSSResultGroup, html, nothing, PropertyValues } from "lit";
import { customElement } from "lit/decorators.js";
import { createRef, ref } from "lit/directives/ref.js";
import { reaction } from "mobx";

import { core } from "../../core/core";
import {
  AnswerHighlightTooltipProps,
  ConceptTooltipProps,
  FloatingPanelService,
  FootnoteTooltipProps,
  InfoTooltipProps,
  OverflowMenuProps,
  ReferenceTooltipProps,
  SmartHighlightMenuProps,
  TranslateTooltipProps,
  UserAnnotationTooltipProps,
} from "../../services/floating_panel_service";
import { RouterService } from "../../services/router.service";

import type { MdMenu } from "@material/web/menu/menu.js";
import { styles } from "./floating_panel_host.scss";

import "../answer_highlight_tooltip/answer_highlight_tooltip";
import "../concept_tooltip/concept_tooltip";
import "../footnote_tooltip/footnote_tooltip";
import "../translate_tooltip/translate_tooltip";
import "../info_tooltip/info_tooltip";
import "../overflow_menu/overflow_menu";
import "../reference_tooltip/reference_tooltip";
import "../user_annotation_tooltip/user_annotation_tooltip";
import { classMap } from "lit/directives/class-map.js";
import { keyed } from "lit/directives/keyed.js";

/**
 * A host component that displays and positions a floating panel using md-menu.
 */
@customElement("floating-panel-host")
export class FloatingPanelHost extends MobxLitElement {
  static override styles: CSSResultGroup = [styles];

  private readonly floatingPanelService = core.getService(FloatingPanelService);
  private readonly routerService = core.getService(RouterService);
  private readonly menuRef = createRef<MdMenu>();
  private closingIntentionally = false;

  private disposer: () => void = () => {};
  protected override firstUpdated(_changedProperties: PropertyValues): void {
    this.disposer = reaction(
      () =>
        [
          this.floatingPanelService.isVisible,
          this.floatingPanelService.contentProps,
          this.floatingPanelService.targetElement,
          this.routerService.activePage,
        ] as const,
      ([isVisible, , , page], prev) => {
        const prevPage = prev?.[3];
        if (prevPage !== undefined && page !== prevPage) {
          this.floatingPanelService.hide();
          return;
        }
        if (isVisible) {
          this.openMenu();
        } else {
          this.closeMenu();
        }
      }
    );
  }

  override disconnectedCallback() {
    this.disposer();
    super.disconnectedCallback();
  }

  private openMenu() {
    if (!this.menuRef.value) {
      return;
    }

    const anchorElement = this.floatingPanelService.targetElement;
    if (!anchorElement || !anchorElement.isConnected) {
      this.floatingPanelService.hide();
      return;
    }

    this.menuRef.value.anchorElement = anchorElement;
    this.menuRef.value.yOffset = 4;

    if (!this.menuRef.value.open) {
      window.setTimeout(() => {
        if (this.floatingPanelService.isVisible) {
          this.menuRef.value?.show();
        }
      });
    }
  }

  private closeMenu() {
    if (this.menuRef.value?.open) {
      this.closingIntentionally = true;
      this.menuRef.value.close();
    }
  }

  private handleMenuClosed() {
    const intended = this.closingIntentionally;
    this.closingIntentionally = false;
    if (intended) {
      if (this.floatingPanelService.isVisible) {
        this.openMenu();
      }
      return;
    }
    this.floatingPanelService.hide();
  }

  private renderContent() {
    const contentProps = this.floatingPanelService.contentProps;
    if (!contentProps) {
      return nothing;
    }

    if (contentProps instanceof SmartHighlightMenuProps) {
      return html`
        <smart-highlight-menu .props=${contentProps}></smart-highlight-menu>
      `;
    }

    if (contentProps instanceof ReferenceTooltipProps) {
      return html`
        <reference-tooltip .props=${contentProps}></reference-tooltip>
      `;
    }

    if (contentProps instanceof ConceptTooltipProps) {
      return html` <concept-tooltip .props=${contentProps}></concept-tooltip> `;
    }

    if (contentProps instanceof TranslateTooltipProps) {
      return keyed(
        contentProps.selectedText,
        html`<translate-tooltip .props=${contentProps}></translate-tooltip>`
      );
    }

    if (contentProps instanceof FootnoteTooltipProps) {
      return html`
        <footnote-tooltip .props=${contentProps}></footnote-tooltip>
      `;
    }

    if (contentProps instanceof AnswerHighlightTooltipProps) {
      return html`
        <answer-highlight-tooltip
          .props=${contentProps}
        ></answer-highlight-tooltip>
      `;
    }

    if (contentProps instanceof UserAnnotationTooltipProps) {
      return html`
        <user-annotation-tooltip
          .props=${contentProps}
        ></user-annotation-tooltip>
      `;
    }

    if (contentProps instanceof OverflowMenuProps) {
      return html` <overflow-menu .props=${contentProps}></overflow-menu> `;
    }

    if (contentProps instanceof InfoTooltipProps) {
      return html` <info-tooltip .props=${contentProps}></info-tooltip> `;
    }

    // Note: Add other cases for different panel content here.

    return nothing;
  }

  override render() {
    const anchorCorner = this.floatingPanelService.anchorCorner;
    const menuCorner = this.floatingPanelService.menuCorner;
    const hasFlatContainer = this.floatingPanelService.hasFlatContainer;

    const menuWrapperClasses = classMap({
      "menu-wrapper": true,
      "has-flat-container": hasFlatContainer === true,
    });

    const panelClasses = classMap({
      panel: true,
      "has-flat-container": hasFlatContainer === true,
    });
    const stayOpenOnOutsideClick = !(
      this.floatingPanelService.contentProps instanceof TranslateTooltipProps
    );

    return html`
      <span class=${menuWrapperClasses}>
        <md-menu
          ${ref(this.menuRef)}
          quick
          @closed=${this.handleMenuClosed}
          .stayOpenOnOutsideClick=${stayOpenOnOutsideClick}
          positioning="popover"
          anchor-corner=${anchorCorner}
          menu-corner=${menuCorner}
        >
          <div class=${panelClasses}>${this.renderContent()}</div>
        </md-menu>
      </span>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    "floating-panel-host": FloatingPanelHost;
  }
}
