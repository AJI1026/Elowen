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

import { html, nothing } from "lit";
import { customElement, property, state } from "lit/decorators.js";

import { core } from "../../core/core";
import { HistoryService } from "../../services/history.service";
import { ElowenAnswer, ElowenAnswerRequest } from "../../shared/api";

import "./answer_item";
import "../elowen_span/elowen_span";
import "../../pair-components/icon_button";
import "../../pair-components/textarea";
import "../../pair-components/icon";

import { styles } from "./elowen_questions.scss";
import { DocumentStateService } from "../../services/document_state.service";
import {
  HighlightSelection,
  SelectionInfo,
} from "../../shared/selection_utils";
import { classMap } from "lit/directives/class-map.js";
import {
  AnalyticsAction,
  AnalyticsService,
} from "../../services/analytics.service";
import {
  AnswerHighlightTooltipProps,
  FloatingPanelService,
  UserAnnotationTooltipProps,
} from "../../services/floating_panel_service";
import { isViewportSmall } from "../../shared/responsive_utils";
import {
  INPUT_DEBOUNCE_MS,
  MAX_QUERY_INPUT_LENGTH,
} from "../../shared/constants";
import { getElowenResponseCallable } from "../../shared/callables";
import { createTemporaryAnswer } from "../../shared/answer_utils";
import { RouterService } from "../../services/router.service";
import { SnackbarService } from "../../services/snackbar.service";
import { FirebaseService } from "../../services/firebase.service";
import { LightMobxLitElement } from "../light_mobx_lit_element/light_mobx_lit_element";
import { SettingsService } from "../../services/settings.service";
import { debounce } from "../../shared/utils";
import { UserAnnotation } from "../../shared/types_local_storage";
import { t } from "../../shared/i18n";

/**
 * A component for asking questions to Elowen and viewing the history.
 */
@customElement("elowen-questions")
export class ElowenQuestions extends LightMobxLitElement {
  private readonly analyticsService = core.getService(AnalyticsService);
  private readonly documentStateService = core.getService(DocumentStateService);
  private readonly firebaseService = core.getService(FirebaseService);
  private readonly floatingPanelService = core.getService(FloatingPanelService);
  private readonly historyService = core.getService(HistoryService);
  private readonly routerService = core.getService(RouterService);
  private readonly snackbarService = core.getService(SnackbarService);
  private readonly settingsService = core.getService(SettingsService);

  @property() onTextSelection: (selectionInfo: SelectionInfo) => void =
    () => {};
  @state() private query = "";

  private onReferenceClick(highlightedSpans: HighlightSelection[]) {
    this.analyticsService.trackAction(
      AnalyticsAction.QUESTIONS_REFERENCE_CLICK
    );
    this.documentStateService.focusOnSpan(highlightedSpans);
  }

  private onImageReferenceClick(imageStoragePath: string) {
    this.analyticsService.trackAction(
      AnalyticsAction.QUESTIONS_IMAGE_REFERENCE_CLICK
    );
    this.documentStateService.focusOnImage(imageStoragePath);
  }

  private getAnswersToRender(docId: string): ElowenAnswer[] {
    const answers = this.historyService.getAnswers(docId);
    const tempAnswers = this.historyService.getTemporaryAnswers();

    return [...tempAnswers, ...answers];
  }

  private getDocId() {
    return this.documentStateService.elowenDocManager?.elowenDoc.metadata?.paperId;
  }

  private async handleSearch() {
    const elowenDoc = this.documentStateService.elowenDocManager?.elowenDoc;

    if (!this.query || !elowenDoc || this.historyService.isAnswerLoading) {
      return;
    }
    this.analyticsService.trackAction(AnalyticsAction.HEADER_EXECUTE_SEARCH);

    const docId = this.routerService.getActiveRouteParams()["document_id"];

    const request: ElowenAnswerRequest = {
      query: this.query,
    };

    const tempAnswer = createTemporaryAnswer(request);
    this.historyService.addTemporaryAnswer(tempAnswer);
    const queryToClear = this.query;

    try {
      const response = await getElowenResponseCallable(
        this.firebaseService.functions,
        elowenDoc,
        request,
        this.settingsService.getModelConfig()
      );
      this.historyService.addAnswer(docId, response);
      this.query = "";
    } catch (e) {
      console.error("Error getting Elowen response:", e);
      this.snackbarService.show(
        t("ask.errorResponse", this.settingsService.responseLanguage.value)
      );
    } finally {
      this.historyService.removeTemporaryAnswer(tempAnswer.id);
      if (this.query === queryToClear) {
        this.query = "";
      }
    }
  }

  private async handlePaperMindmap() {
    const elowenDoc = this.documentStateService.elowenDocManager?.elowenDoc;
    if (!elowenDoc || this.historyService.isAnswerLoading) {
      return;
    }

    this.analyticsService.trackAction(AnalyticsAction.QUESTIONS_MINDMAP_CLICK);
    const docId = this.routerService.getActiveRouteParams()["document_id"];
    const request: ElowenAnswerRequest = {
      query: t(
        "ask.paperMindmapQuery",
        this.settingsService.responseLanguage.value
      ),
      responseMode: "mindmap",
    };

    const tempAnswer = createTemporaryAnswer(request);
    this.historyService.addTemporaryAnswer(tempAnswer);

    try {
      const response = await getElowenResponseCallable(
        this.firebaseService.functions,
        elowenDoc,
        request,
        this.settingsService.getModelConfig()
      );
      this.historyService.addAnswer(docId, response);
    } catch (e) {
      console.error("Error getting Elowen mindmap:", e);
      this.snackbarService.show(
        t("ask.errorResponse", this.settingsService.responseLanguage.value)
      );
    } finally {
      this.historyService.removeTemporaryAnswer(tempAnswer.id);
    }
  }

  private debouncedUpdate = debounce((value: string) => {
    this.query = value;
  }, INPUT_DEBOUNCE_MS);

  private renderSearch() {
    const isLoading = this.historyService.isAnswerLoading;
    const lang = this.settingsService.responseLanguage.value;

    const textareaSize = isViewportSmall() ? "medium" : "small";
    return html`
      <div class="input-container">
        <pr-textarea
          .value=${this.query}
          size=${textareaSize}
          .maxLength=${MAX_QUERY_INPUT_LENGTH}
          @change=${(e: CustomEvent) => {
            this.debouncedUpdate(e.detail.value);
          }}
          @keydown=${(e: CustomEvent) => {
            if (e.detail.key === "Enter") {
              this.handleSearch();
            }
          }}
          placeholder=${t("ask.placeholder", lang)}
          class="search-input"
          ?disabled=${isLoading}
        ></pr-textarea>
        <pr-icon-button
          title=${t("ask.paperMindmapTitle", lang)}
          color="tertiary"
          icon="account_tree"
          ?disabled=${isLoading}
          @click=${this.handlePaperMindmap}
          variant="default"
        ></pr-icon-button>
        <pr-icon-button
          title=${t("ask.sendTitle", lang)}
          color="tertiary"
          icon="send"
          ?disabled=${!this.query || isLoading}
          @click=${this.handleSearch}
          variant="default"
        ></pr-icon-button>
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

  private handleDismissAnswer(answerId: string) {
    const docId = this.getDocId();
    if (!docId) return;

    this.analyticsService.trackAction(AnalyticsAction.QUESTIONS_DISMISS_ANSWER);
    this.historyService.removeAnswer(docId, answerId);
  }

  private renderAnswer(answer: ElowenAnswer) {
    return html`
      <answer-item
        .onReferenceClick=${this.onReferenceClick.bind(this)}
        .onImageReferenceClick=${this.onImageReferenceClick.bind(this)}
        .answer=${answer}
        .isLoading=${answer.isLoading || false}
        .elowenDocManager=${this.documentStateService.elowenDocManager}
        .highlightManager=${this.documentStateService.highlightManager}
        .answerHighlightManager=${this.historyService.answerHighlightManager}
        .userHighlightManager=${this.historyService.userHighlightManager}
        .onAnswerHighlightClick=${this.handleAnswerHighlightClick.bind(this)}
        .onUserAnnotationClick=${this.handleUserAnnotationClick.bind(this)}
        .onDismiss=${this.handleDismissAnswer.bind(this)}
        .collapseManager=${this.documentStateService.collapseManager}
        .historyCollapseManager=${this.historyService.historyCollapseManager}
      ></answer-item>
    `;
  }

  private renderHistory() {
    const docId = this.getDocId();
    if (!docId) return nothing;

    const answersToRender = this.getAnswersToRender(docId);
    if (answersToRender.length === 0) {
      return nothing;
    }

    const historyContainerClasses = classMap({
      "history-container": true,
    });
    return html`
      <div class=${historyContainerClasses}>
        ${answersToRender.map((answer: ElowenAnswer) => {
          return this.renderAnswer(answer);
        })}
      </div>
    `;
  }

  override render() {
    return html`
      <style>
        ${styles}
      </style>
      <div class="elowen-questions-host">
        ${this.renderSearch()} ${this.renderHistory()}
      </div>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    "elowen-questions": ElowenQuestions;
  }
}
