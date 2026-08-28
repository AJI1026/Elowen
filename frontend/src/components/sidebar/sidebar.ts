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
import { CSSResultGroup, html, nothing } from "lit";
import { customElement, property, query } from "lit/decorators.js";
import { classMap } from "lit/directives/class-map.js";
import { computed, makeObservable } from "mobx";
import "../elowen_concept/elowen_concept";
import "../elowen_questions/elowen_questions";
import "../elowen_annotations/elowen_annotations";
import "../tab_component/tab_component";
import "../table_of_contents/table_of_contents";
import "./sidebar_header";
import { styles } from "./sidebar.scss";

import { DocumentStateService } from "../../services/document_state.service";
import { core } from "../../core/core";
import { consume } from "@lit/context";
import { scrollContext, ScrollState } from "../../contexts/scroll_context";
import {
  AnalyticsAction,
  AnalyticsService,
} from "../../services/analytics.service";
import { SIDEBAR_TABS } from "../../shared/constants";
import { sidebarTabLabel } from "../../shared/i18n";
import { SettingsService } from "../../services/settings.service";
import {
  AnswerHighlightTooltipProps,
  FloatingPanelService,
  UserAnnotationTooltipProps,
} from "../../services/floating_panel_service";
import { LightMobxLitElement } from "../light_mobx_lit_element/light_mobx_lit_element";
import { HistoryService } from "../../services/history.service";
import { ElowenAnswer } from "../../shared/api";
import { UserAnnotation } from "../../shared/types_local_storage";
import { createRef, Ref, ref } from "lit/directives/ref.js";

/**
 * A sidebar component that displays a list of concepts.
 */
@customElement("elowen-sidebar")
export class ElowenSidebar extends LightMobxLitElement {
  private readonly documentStateService = core.getService(DocumentStateService);
  private readonly floatingPanelService = core.getService(FloatingPanelService);
  private readonly analyticsService = core.getService(AnalyticsService);
  private readonly historyService = core.getService(HistoryService);
  private readonly settingsService = core.getService(SettingsService);
  private readonly collapseManager = this.documentStateService.collapseManager;

  @query(".tabs-container")
  private readonly tabsContainer!: HTMLDivElement;

  private scrollContainerRef: Ref<HTMLElement> = createRef();

  @consume({ context: scrollContext, subscribe: true })
  private scrollContext?: ScrollState;

  constructor() {
    super();
    makeObservable(this);
  }

  override connectedCallback() {
    super.connectedCallback();

    this.updateComplete.then(() => {
      if (this.scrollContainerRef.value) {
        this.scrollContext?.registerAnswersScrollContainer(
          this.scrollContainerRef
        );
      }
    });
  }

  override disconnectedCallback() {
    this.scrollContext?.unregisterAnswersScrollContainer();
    super.disconnectedCallback();
  }

  private renderHeader() {
    const handleTabClick = (tab: string) => {
      this.analyticsService.trackAction(AnalyticsAction.SIDEBAR_TAB_CHANGE);
      this.collapseManager?.setSidebarTabSelection(tab);
      if (this.collapseManager?.isMobileSidebarCollapsed) {
        this.collapseManager?.toggleMobileSidebarCollapsed();
      }
    };
    const selectedTab = this.collapseManager?.sidebarTabSelection;
    const lang = this.settingsService.responseLanguage.value;

    return html`
      <div class="sidebar-top">
        <sidebar-header></sidebar-header>
        <div class="tabs-header" role="tablist">
          ${Object.values(SIDEBAR_TABS).map(
            (tab) => html`
              <button
                class="tab-button ${selectedTab === tab ? "selected" : ""}"
                role="tab"
                aria-selected=${selectedTab === tab ? "true" : "false"}
                @click=${() => handleTabClick(tab)}
              >
                ${sidebarTabLabel(tab, lang)}
              </button>
            `
          )}
        </div>
      </div>
    `;
  }

  private renderQuestions() {
    const classes = {
      "elowen-questions-container": true,
    };

    return html`
      <div class=${classMap(classes)} slot=${SIDEBAR_TABS.ANSWERS}>
        <elowen-questions></elowen-questions>
      </div>
    `;
  }

  private getDocId(): string | undefined {
    return this.documentStateService.elowenDocManager?.elowenDoc.metadata?.paperId;
  }

  private renderAnnotations() {
    const docId = this.getDocId();
    if (!docId) return nothing;

    return html`
      <div class="annotations-container" slot=${SIDEBAR_TABS.ANNOTATIONS}>
        <elowen-annotations .docId=${docId}></elowen-annotations>
      </div>
    `;
  }

  private readonly handleAnswerHighlightClick = (
    answer: ElowenAnswer,
    target: HTMLElement
  ) => {
    const props = new AnswerHighlightTooltipProps(answer);
    this.floatingPanelService.show(props, target);
  };

  private readonly handleUserAnnotationClick = (
    annotation: UserAnnotation,
    target: HTMLElement
  ) => {
    const docId = this.getDocId();
    if (!docId) return;

    const props = new UserAnnotationTooltipProps(
      annotation,
      docId,
      (updated) => this.historyService.updateAnnotation(docId, updated),
      (annotationId) =>
        this.historyService.removeAnnotation(docId, annotationId),
      (item) =>
        this.documentStateService.focusOnSpan(item.highlightedSpans, {
          color: item.color,
        })
    );
    this.floatingPanelService.show(props, target);
  };

  private renderConcepts() {
    if (!this.collapseManager) return nothing;

    const concepts =
      this.documentStateService.elowenDocManager?.elowenDoc.concepts || [];

    return html`
      <div class="concepts-container" slot=${SIDEBAR_TABS.CONCEPTS}>
        <div class="concepts-list">
          ${concepts.map(
            (concept) =>
              html`<elowen-concept
                .concept=${concept}
                .highlightManager=${this.documentStateService.highlightManager}
                .answerHighlightManager=${this.historyService
                  .answerHighlightManager}
                .userHighlightManager=${this.historyService.userHighlightManager}
                .onAnswerHighlightClick=${this.handleAnswerHighlightClick.bind(
                  this
                )}
                .onUserAnnotationClick=${this.handleUserAnnotationClick.bind(
                  this
                )}
              ></elowen-concept>`
          )}
        </div>
      </div>
    `;
  }

  private renderToc() {
    return html`
      <div class="toc-container" slot=${SIDEBAR_TABS.TOC}>
        <table-of-contents
          .sections=${this.documentStateService.elowenDocManager?.elowenDoc
            .sections}
          .elowenSummariesMap=${this.documentStateService.elowenDocManager
            ?.summaryMaps}
          .onSectionClicked=${(sectionId: string) => {
            this.analyticsService.trackAction(
              AnalyticsAction.SIDEBAR_TOC_SECTION_CLICK
            );

            this.scrollContext?.scrollToSection(sectionId);
          }}
        ></table-of-contents>
      </div>
    `;
  }

  private renderContents() {
    const tabsContainerClasses = classMap({
      ["tabs-container"]: true,
      ["is-mobile-sidebar-collapsed"]:
        this.collapseManager?.isMobileSidebarCollapsed ?? true,
    });

    return html`
      <div class="contents">
        ${this.renderHeader()}
        <div class=${tabsContainerClasses} ${ref(this.scrollContainerRef)}>
          <tab-component
            .tabs=${Object.values(SIDEBAR_TABS)}
            .selectedTab=${this.collapseManager?.sidebarTabSelection}
          >
            ${this.renderQuestions()} ${this.renderAnnotations()}
            ${this.renderConcepts()}
            ${this.renderToc()}
          </tab-component>
        </div>
        ${this.renderMobileCollapseButton()}
      </div>
    `;
  }

  private renderMobileCollapseButton() {
    const icon = this.collapseManager?.isMobileSidebarCollapsed
      ? "keyboard_arrow_down"
      : "keyboard_arrow_up";
    return html`
      <div
        class="mobile-collapse-button"
        @click=${() => {
          this.tabsContainer.scrollTop = 0;
          this.collapseManager?.toggleMobileSidebarCollapsed();
        }}
      >
        <pr-icon icon=${icon}></pr-icon>
      </div>
    `;
  }

  override render() {
    return html`
      <style>
        ${styles}
      </style>
      <div class="sidebar-host">${this.renderContents()}</div>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    "elowen-sidebar": ElowenSidebar;
  }
}
