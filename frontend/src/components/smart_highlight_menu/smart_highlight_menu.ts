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
import { customElement, property, state, query } from "lit/decorators.js";
import { classMap } from "lit/directives/class-map.js";

import { core } from "../../core/core";
import {
  FloatingPanelService,
  SmartHighlightMenuProps,
} from "../../services/floating_panel_service";

import "../../pair-components/button";
import "../../pair-components/icon_button";
import "../../pair-components/textinput";
import "../../pair-components/textarea";

import { styles } from "./smart_highlight_menu.scss";
import { TextInput } from "../../pair-components/textinput";
import {
  AnalyticsAction,
  AnalyticsService,
} from "../../services/analytics.service";
import {
  INPUT_DEBOUNCE_MS,
  MAX_QUERY_INPUT_LENGTH,
} from "../../shared/constants";
import { debounce } from "../../shared/utils";
import { HistoryService } from "../../services/history.service";
import { isViewportSmall } from "../../shared/responsive_utils";
import { DocumentStateService } from "../../services/document_state.service";
import { SettingsService } from "../../services/settings.service";
import { t } from "../../shared/i18n";

/**
 * The menu that appears on text selection.
 */
@customElement("smart-highlight-menu")
export class SmartHighlightMenu extends MobxLitElement {
  static override styles: CSSResultGroup = [styles];
  private readonly floatingPanelService = core.getService(FloatingPanelService);
  private readonly analyticsService = core.getService(AnalyticsService);
  private readonly documentStateService = core.getService(DocumentStateService);
  private readonly historyService = core.getService(HistoryService);
  private readonly settingsService = core.getService(SettingsService);

  private uiLang() {
    return this.settingsService.responseLanguage.value;
  }

  @property({ type: Object }) props!: SmartHighlightMenuProps;

  @state() private isAsking = false; // If true, shows the `asking questions` UI
  @state() private isAddingNote = false; // If true, shows the note input UI
  @state() private queryText = "";
  @state() private noteText = "";
  @query("pr-textinput") private textInput?: TextInput;

  private handleDefineClick() {
    this.analyticsService.trackAction(AnalyticsAction.MENU_EXPLAIN_CLICK);
    this.props.onDefine(
      this.props.selectedText,
      this.props.highlightedSpans,
      this.props.imageInfo
    );
    this.floatingPanelService.hide();
  }

  private handleAskClick() {
    this.analyticsService.trackAction(AnalyticsAction.MENU_ASK_CLICK);
    this.isAsking = true;

    this.documentStateService.focusOnSpan(this.props.highlightedSpans, {
      shouldScroll: false,
      color: "green-light",
    });

    this.updateComplete.then(() => {
      this.textInput?.focus();
    });
  }

  private handleMindmapClick() {
    if (!this.props.onMindmap) return;
    this.analyticsService.trackAction(AnalyticsAction.MENU_MINDMAP_CLICK);
    this.props.onMindmap(
      this.props.selectedText,
      this.props.highlightedSpans,
      this.props.imageInfo
    );
    this.floatingPanelService.hide();
  }

  private handleSendClick() {
    this.analyticsService.trackAction(AnalyticsAction.MENU_SEND_QUERY);
    this.props.onAsk(
      this.props.selectedText,
      this.queryText,
      this.props.highlightedSpans,
      this.props.imageInfo
    );
    this.floatingPanelService.hide();
  }

  private handleHighlightClick() {
    if (!this.props.onHighlight) return;
    this.props.onHighlight(
      this.props.selectedText,
      this.props.highlightedSpans
    );
    this.floatingPanelService.hide();
  }

  private handleNoteClick() {
    this.isAddingNote = true;
  }

  private handleSaveNoteClick() {
    if (!this.props.onAddNote || !this.noteText.trim()) return;
    this.props.onAddNote(
      this.props.selectedText,
      this.noteText.trim(),
      this.props.highlightedSpans
    );
    this.floatingPanelService.hide();
  }

  private renderDefaultView() {
    const lang = this.uiLang();
    const explainButtonName = this.props.imageInfo
      ? t("menu.explainImage", lang)
      : t("menu.explainText", lang);
    const showAnnotationActions =
      !this.props.imageInfo &&
      (this.props.onHighlight || this.props.onAddNote);

    return html`
      <pr-button
        variant="default"
        color="tertiary"
        @click=${this.handleDefineClick}
        ?disabled=${this.historyService.isAnswerLoading}
        >${explainButtonName}</pr-button
      >
      <div class="divider"></div>
      <pr-button
        variant="default"
        color="tertiary"
        @click=${this.handleAskClick}
        ?disabled=${this.historyService.isAnswerLoading}
        >${t("menu.askElowen", lang)}</pr-button
      >
      ${this.props.onMindmap && !this.props.imageInfo
        ? html`
            <div class="divider"></div>
            <pr-button
              variant="default"
              color="tertiary"
              @click=${this.handleMindmapClick}
              ?disabled=${this.historyService.isAnswerLoading}
              >${t("menu.mindmap", lang)}</pr-button
            >
          `
        : nothing}
      ${showAnnotationActions
        ? html`
            <div class="divider"></div>
            ${this.props.onHighlight
              ? html`<pr-button
                  variant="default"
                  color="tertiary"
                  @click=${this.handleHighlightClick}
                  >${t("menu.highlight", lang)}</pr-button
                >`
              : nothing}
            ${this.props.onAddNote
              ? html`<pr-button
                  variant="default"
                  color="tertiary"
                  @click=${this.handleNoteClick}
                  >${t("menu.note", lang)}</pr-button
                >`
              : nothing}
          `
        : nothing}
    `;
  }

  private debouncedUpdate = debounce((value: string) => {
    this.queryText = value;
  }, INPUT_DEBOUNCE_MS);

  private debouncedNoteUpdate = debounce((value: string) => {
    this.noteText = value;
  }, INPUT_DEBOUNCE_MS);

  private renderNoteView() {
    const inputSize = isViewportSmall() ? "medium" : "small";
    return html`
      <pr-textarea
        size=${inputSize}
        .value=${this.noteText}
        @change=${(e: CustomEvent) => {
          this.debouncedNoteUpdate(e.detail.value);
        }}
        placeholder=${t("menu.addNotePlaceholder", this.uiLang())}
        .maxLength=${MAX_QUERY_INPUT_LENGTH}
        color="tertiary"
      ></pr-textarea>
      <pr-icon-button
        icon="check"
        color="tertiary"
        ?disabled=${!this.noteText.trim()}
        @click=${this.handleSaveNoteClick}
        variant="default"
      ></pr-icon-button>
    `;
  }

  private renderAskView() {
    const inputSize = isViewportSmall() ? "medium" : "small";
    return html`
      <pr-textinput
        size=${inputSize}
        .value=${this.queryText}
        .onChange=${(e: InputEvent) => {
          this.debouncedUpdate((e.target as HTMLInputElement).value);
        }}
        .onKeydown=${(e: KeyboardEvent) => {
          if (e.key === "Enter") this.handleSendClick();
        }}
        ?disabled=${this.historyService.isAnswerLoading}
        placeholder=${t("menu.askPlaceholder", this.uiLang())}
        .maxLength=${MAX_QUERY_INPUT_LENGTH}
        color="tertiary"
      ></pr-textinput>
      <pr-icon-button
        icon="send"
        color="tertiary"
        ?disabled=${!this.queryText || this.historyService.isAnswerLoading}
        @click=${this.handleSendClick}
        variant="default"
      ></pr-icon-button>
    `;
  }

  override render() {
    const classes = {
      "smart-highlight-menu": true,
      "is-asking": this.isAsking || this.isAddingNote,
    };

    const content = this.isAddingNote
      ? this.renderNoteView()
      : this.isAsking
        ? this.renderAskView()
        : this.renderDefaultView();

    return html`
      <div class=${classMap(classes)}>
        ${content}
      </div>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    "smart-highlight-menu": SmartHighlightMenu;
  }
}
