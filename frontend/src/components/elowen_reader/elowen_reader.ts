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

import "../elowen_doc/elowen_doc";
import "../sidebar/sidebar";
import "../loading_document/loading_document";
import "../../pair-components/circular_progress";
import "../../pair-components/button";
import "../../pair-components/icon_button";

import { CSSResultGroup, html, nothing, TemplateResult } from "lit";
import { customElement, property, state } from "lit/decorators.js";
import { provide } from "@lit/context";

import { core } from "../../core/core";
import { ApiService } from "../../services/api.service";
import { HistoryService } from "../../services/history.service";
import { DocumentStateService } from "../../services/document_state.service";
import { SnackbarService } from "../../services/snackbar.service";
import {
  ElowenDoc,
  LoadingStatus,
  ElowenReference,
  ElowenFootnote,
  LOADING_STATUS_ERROR_STATES,
  ArxivMetadata,
} from "../../shared/elowen_doc";
import {
  getArxivMetadata,
  getElowenResponseCallable,
  getPersonalSummaryCallable,
} from "../../shared/callables";
import { scrollContext, ScrollState } from "../../contexts/scroll_context";
import {
  AnswerHighlightTooltipProps,
  ConceptTooltipProps,
  FloatingPanelService,
  FootnoteTooltipProps,
  ReferenceTooltipProps,
  SmartHighlightMenuProps,
  UserAnnotationTooltipProps,
} from "../../services/floating_panel_service";
import { ImageInfo, ElowenAnswer, ElowenAnswerRequest } from "../../shared/api";
import { createUserAnnotation } from "../../shared/annotation_utils";
import { UserAnnotation } from "../../shared/types_local_storage";

import { styles } from "./elowen_reader.scss";

import {
  getSelectionInfo,
  HighlightSelection,
  normalizeSelectionText,
  SelectionInfo,
} from "../../shared/selection_utils";
import { createTemporaryAnswer } from "../../shared/answer_utils";
import { classMap } from "lit/directives/class-map.js";
import {
  AnalyticsAction,
  AnalyticsService,
} from "../../services/analytics.service";
import { isViewportSmall } from "../../shared/responsive_utils";
import {
  PERSONAL_SUMMARY_QUERY_NAME,
  SIDEBAR_TABS,
} from "../../shared/constants";
import { LightMobxLitElement } from "../light_mobx_lit_element/light_mobx_lit_element";
import { pollVersionDoc } from "../../shared/http_api";
import { RouterService, getArxivPaperUrl } from "../../services/router.service";
import { BannerService } from "../../services/banner.service";
import { createRef, ref } from "lit/directives/ref.js";
import { SettingsService } from "../../services/settings.service";
import { friendlyImportErrorMessage, t } from "../../shared/i18n";
import {
  DialogService,
  TOSDialogProps,
  TutorialDialogProps,
} from "../../services/dialog.service";

const LOADING_STATES_ALLOW_PERSONAL_SUMMARY: string[] = [
  LoadingStatus.SUCCESS,
  LoadingStatus.SUMMARIZING,
  LoadingStatus.ERROR_SUMMARIZING,
  LoadingStatus.ERROR_SUMMARIZING_INVALID_RESPONSE,
  LoadingStatus.ERROR_SUMMARIZING_QUOTA_EXCEEDED,
];

const LOADING_STATES_RENDER_ERROR: string[] = [
  LoadingStatus.ERROR_DOCUMENT_LOAD_INVALID_RESPONSE,
  LoadingStatus.ERROR_DOCUMENT_LOAD_QUOTA_EXCEEDED,
  LoadingStatus.ERROR_DOCUMENT_LOAD,
  LoadingStatus.TIMEOUT,
];

const TUTORIAL_DIALOG_DELAY = 800;

/**
 * The component responsible for fetching a single document and passing it
 * to the elowen-doc component.
 */
@customElement("elowen-reader")
export class ElowenReader extends LightMobxLitElement {
  static override styles: CSSResultGroup = [styles];

  private readonly analyticsService = core.getService(AnalyticsService);
  private readonly bannerService = core.getService(BannerService);
  private readonly dialogService = core.getService(DialogService);
  private readonly documentStateService = core.getService(DocumentStateService);
  private readonly apiService = core.getService(ApiService);
  private readonly floatingPanelService = core.getService(FloatingPanelService);
  private readonly historyService = core.getService(HistoryService);
  private readonly routerService = core.getService(RouterService);
  private readonly snackbarService = core.getService(SnackbarService);
  private readonly settingsService = core.getService(SettingsService);

  @provide({ context: scrollContext })
  private scrollState = new ScrollState();

  @property({ type: String }) documentId = "";
  @state() loadingStatus = LoadingStatus.UNSET;
  @state() metadata?: ArxivMetadata;
  @state() metadataNotFound? = false;

  @state() hoveredSpanId: string | null = null;

  private mobileSmartHighlightContainerRef = createRef<HTMLElement>();

  private unsubscribeListener?: () => void;

  override connectedCallback() {
    super.connectedCallback();
    this.documentStateService.setScrollState(this.scrollState);
    this.historyService.setScrollState(this.scrollState);
    if (this.documentId) {
      this.loadDocument();
    }

    document.onselectionchange = () => {
      const selection = window.getSelection();

      if (!selection) return;

      const selectionInfo = getSelectionInfo(selection);

      if (selectionInfo) {
        this.handleTextSelection(selectionInfo);
      }
    };

    document.addEventListener("copy", this.handlePaperCopy);
  }

  private readonly handlePaperCopy = (event: ClipboardEvent) => {
    const selection = window.getSelection();
    if (!selection || selection.isCollapsed || !event.clipboardData) {
      return;
    }

    const raw = selection.toString();
    if (!raw.includes("\n")) {
      return;
    }

    // Only rewrite clipboard when copying from paper/KaTeX content.
    const anchor =
      selection.anchorNode instanceof Element
        ? selection.anchorNode
        : selection.anchorNode?.parentElement;
    const inPaper = !!anchor?.closest(
      "elowen-span, elowen-doc, .katex, .equation, .main-content"
    );
    if (!inPaper) {
      return;
    }

    const normalized = normalizeSelectionText(raw);
    if (normalized === raw.trim()) {
      return;
    }

    event.clipboardData.setData("text/plain", normalized);
    event.preventDefault();
  };

  private showPopupDialogs() {
    if (!this.settingsService.isTosConfirmed.value) {
      const onClose = () => {
        this.dialogService.show(new TutorialDialogProps());
      };
      this.dialogService.show(new TOSDialogProps(onClose));
    } else if (!this.settingsService.isTutorialConfirmed.value) {
      window.setTimeout(() => {
        this.dialogService.show(new TutorialDialogProps());
      }, TUTORIAL_DIALOG_DELAY);
    }
  }

  override disconnectedCallback() {
    this.bannerService.clearBannerProperties();
    document.removeEventListener("copy", this.handlePaperCopy);

    super.disconnectedCallback();
    if (this.unsubscribeListener) {
      this.unsubscribeListener();
    }
  }

  private setLoadingStatus(status: LoadingStatus) {
    if (status === this.loadingStatus) return;

    if (status === LoadingStatus.SUMMARIZING) {
      this.bannerService.setBannerProperties({
        message: t(
          "reader.loadingSummaries",
          this.settingsService.responseLanguage.value
        ),
        icon: "hourglass",
      });
    } else {
      if (this.bannerService.isBannerOpen) {
        this.bannerService.clearBannerProperties();
      }
    }

    if (status === LoadingStatus.SUCCESS) {
      this.showPopupDialogs();
    }

    this.loadingStatus = status;
  }

  private async loadDocument() {
    if (this.unsubscribeListener) {
      this.unsubscribeListener();
    }

    let metadata: ArxivMetadata | null = null;
    try {
      metadata = await getArxivMetadata(null, this.documentId);
    } catch (error) {
      console.error("Warning: Document metadata or version not found.", error);
    }

    if (!metadata || !metadata.version) {
      this.metadataNotFound = true;
      return;
    }

    // Add the paper to local storage history if it does not yet exist.
    const paperData = this.historyService.getPaperData(this.documentId);
    if (!paperData) {
      this.historyService.addPaper(this.documentId, metadata);
    }

    this.unsubscribeListener = pollVersionDoc(
      this.documentId,
      metadata.version,
      (data: ElowenDoc) => {
        if (
          data.loadingStatus === LoadingStatus.SUCCESS ||
          data.loadingStatus === LoadingStatus.SUMMARIZING
        ) {
          this.documentStateService.setDocument(data);
        }

        this.setLoadingStatus(data.loadingStatus as LoadingStatus);
        this.metadata = data.metadata;
        this.requestUpdate();

        if (
          LOADING_STATES_ALLOW_PERSONAL_SUMMARY.includes(data.loadingStatus)
        ) {
          if (!this.historyService.personalSummaries.has(this.documentId)) {
            this.fetchPersonalSummary();
          }
        }

        if (
          LOADING_STATUS_ERROR_STATES.includes(
            data.loadingStatus as LoadingStatus
          )
        ) {
          this.snackbarService.show(
            friendlyImportErrorMessage(
              this.settingsService.responseLanguage.value,
              {
                loadingStatus: data.loadingStatus,
                errorText: data.loadingError,
              }
            )
          );
        }
      }
    );
  }

  private async fetchPersonalSummary() {
    const currentDoc = this.documentStateService.elowenDocManager?.elowenDoc;
    if (!currentDoc) return;

    const tempAnswer = createTemporaryAnswer({
      query: PERSONAL_SUMMARY_QUERY_NAME,
    });
    this.historyService.addTemporaryAnswer(tempAnswer);

    try {
      // Filter out the current paper.
      const pastPapers = this.historyService
        .getPaperHistory()
        .filter(
          (paper) =>
            paper.metadata.paperId !== this.documentId &&
            paper.status === "complete"
        );
      const summaryAnswer = await getPersonalSummaryCallable(
        null,
        currentDoc,
        pastPapers,
        this.settingsService.getModelConfig()
      );

      this.historyService.addPersonalSummary(this.documentId, summaryAnswer);
    } catch (e) {
      console.error("Error getting personal summary:", e);
      this.snackbarService.show(
        t(
          "reader.snackPersonalSummaryError",
          this.settingsService.responseLanguage.value
        )
      );
    } finally {
      this.historyService.removeTemporaryAnswer(tempAnswer.id);
    }
  }

  private get getImageUrl() {
    return (path: string) => this.apiService.getDownloadUrl(path);
  }

  private checkChangeTabs() {
    const { collapseManager } = this.documentStateService;
    if (!collapseManager) return;

    if (isViewportSmall() && collapseManager.isMobileSidebarCollapsed) {
      collapseManager.toggleMobileSidebarCollapsed();
    }

    if (collapseManager.sidebarTabSelection !== SIDEBAR_TABS.ANSWERS) {
      collapseManager.setSidebarTabSelection(SIDEBAR_TABS.ANSWERS);
    }
  }

  private readonly handleDefine = async (
    text: string,
    highlightedSpans: HighlightSelection[],
    imageInfo?: ImageInfo
  ) => {
    if (!this.documentStateService.elowenDocManager) return;

    const request: ElowenAnswerRequest = {
      query: ``,
      highlight: text,
      highlightedSpans,
      image: imageInfo,
    };

    const tempAnswer = createTemporaryAnswer(request);
    this.historyService.addTemporaryAnswer(tempAnswer);

    this.checkChangeTabs();

    try {
      const response = await getElowenResponseCallable(
        null,
        this.documentStateService.elowenDocManager.elowenDoc,
        request,
        this.settingsService.getModelConfig()
      );
      this.historyService.addAnswer(this.documentId, response);
    } catch (e) {
      const lang = this.settingsService.responseLanguage.value;
      let message = t("ask.errorResponse", lang);

      if (
        String((e as Error).message || "").toLowerCase().includes("unavailable") || String((e as Error).message || "").toLowerCase().includes("api key") &&
        this.settingsService.apiKey !== ""
      ) {
        message = t("ask.errorApiKey", lang);
      } else if (String((e as Error).message || "").toLowerCase().includes("quota") || String((e as Error).message || "").toLowerCase().includes("resource-exhausted")) {
        message = t("ask.errorQuota", lang);
      }

      this.snackbarService.show(message, 5000);
    } finally {
      this.historyService.removeTemporaryAnswer(tempAnswer.id);
    }
  };

  private readonly handleAsk = async (
    highlightedText: string,
    query: string,
    highlightedSpans: HighlightSelection[],
    imageInfo?: ImageInfo
  ) => {
    const currentDoc = this.documentStateService.elowenDocManager?.elowenDoc;
    if (!currentDoc) return;

    const request: ElowenAnswerRequest = {
      highlight: highlightedText,
      query: query,
      highlightedSpans,
      image: imageInfo,
    };

    this.checkChangeTabs();

    const tempAnswer = createTemporaryAnswer(request);
    this.historyService.addTemporaryAnswer(tempAnswer);

    try {
      const response = await getElowenResponseCallable(
        null,
        currentDoc,
        request,
        this.settingsService.getModelConfig()
      );
      this.historyService.addAnswer(this.documentId, response);
    } catch (e) {
      console.error("Error getting Elowen response:", e);
      this.snackbarService.show(
        t("ask.errorResponse", this.settingsService.responseLanguage.value)
      );
    } finally {
      this.historyService.removeTemporaryAnswer(tempAnswer.id);
    }
  };

  private readonly handleMindmap = async (
    text: string,
    highlightedSpans: HighlightSelection[],
    imageInfo?: ImageInfo
  ) => {
    const currentDoc = this.documentStateService.elowenDocManager?.elowenDoc;
    if (!currentDoc) return;

    const request: ElowenAnswerRequest = {
      query: text
        ? t(
            "ask.paragraphMindmapQuery",
            this.settingsService.responseLanguage.value
          )
        : t(
            "ask.paperMindmapQuery",
            this.settingsService.responseLanguage.value
          ),
      highlight: text || undefined,
      highlightedSpans: highlightedSpans.length ? highlightedSpans : undefined,
      image: imageInfo,
      responseMode: "mindmap",
    };

    this.checkChangeTabs();

    const tempAnswer = createTemporaryAnswer(request);
    this.historyService.addTemporaryAnswer(tempAnswer);

    try {
      const response = await getElowenResponseCallable(
        null,
        currentDoc,
        request,
        this.settingsService.getModelConfig()
      );
      this.historyService.addAnswer(this.documentId, response);
    } catch (e) {
      console.error("Error getting Elowen mindmap:", e);
      this.snackbarService.show(
        t("ask.errorResponse", this.settingsService.responseLanguage.value)
      );
    } finally {
      this.historyService.removeTemporaryAnswer(tempAnswer.id);
    }
  };

  private readonly handleConceptClick = (id: string, target: HTMLElement) => {
    this.analyticsService.trackAction(AnalyticsAction.READER_CONCEPT_CLICK);

    const concept =
      this.documentStateService.elowenDocManager?.getConceptById(id);
    if (!concept) return;

    const spanEl = target.closest("elowen-span");
    const spanId = spanEl?.id;

    const props = new ConceptTooltipProps(concept, spanId);
    this.floatingPanelService.show(props, target);
  };

  private readonly handleScroll = () => {
    if (this.floatingPanelService.isVisible) {
      this.floatingPanelService.hide();
    }

    this.hoveredSpanId = null;
  };

  private readonly handleTextSelection = (selectionInfo: SelectionInfo) => {
    this.analyticsService.trackAction(AnalyticsAction.READER_TEXT_SELECTION);

    const props = new SmartHighlightMenuProps(
      selectionInfo.selectedText,
      selectionInfo.highlightSelection,
      this.handleDefine.bind(this),
      this.handleAsk.bind(this),
      this.handleHighlight.bind(this),
      this.handleAddNote.bind(this),
      undefined,
      this.handleMindmap.bind(this)
    );

    if (isViewportSmall()) {
      if (this.mobileSmartHighlightContainerRef.value) {
        this.floatingPanelService.show(
          props,
          this.mobileSmartHighlightContainerRef.value
        );
      }
    } else {
      this.floatingPanelService.show(props, selectionInfo.parentSpan);
    }
  };

  private readonly handleImageClick = (
    info: ImageInfo,
    target: HTMLElement
  ) => {
    this.analyticsService.trackAction(AnalyticsAction.READER_IMAGE_CLICK);

    const props = new SmartHighlightMenuProps(
      "",
      [],
      this.handleDefine.bind(this),
      this.handleAsk.bind(this),
      undefined,
      undefined,
      info
    );
    this.floatingPanelService.show(props, target);
    this.documentStateService.highlightManager?.addImageHighlight(
      info.imageStoragePath
    );
  };

  private readonly handlePaperReferenceClick = (
    reference: ElowenReference,
    target: HTMLElement
  ) => {
    const props = new ReferenceTooltipProps(reference);
    this.floatingPanelService.show(props, target);
  };

  private readonly handleFootnoteClick = (
    footnote: ElowenFootnote,
    target: HTMLElement
  ) => {
    const props = new FootnoteTooltipProps(footnote);
    this.floatingPanelService.show(props, target);
  };

  private readonly handleAnswerHighlightClick = (
    answer: ElowenAnswer,
    target: HTMLElement
  ) => {
    const props = new AnswerHighlightTooltipProps(answer);
    this.floatingPanelService.show(props, target);
  };

  private readonly handleHighlight = (
    text: string,
    highlightedSpans: HighlightSelection[]
  ) => {
    const annotation = createUserAnnotation(text, highlightedSpans);
    this.historyService.addAnnotation(this.documentId, annotation);
  };

  private readonly handleAddNote = (
    text: string,
    note: string,
    highlightedSpans: HighlightSelection[]
  ) => {
    const annotation = createUserAnnotation(text, highlightedSpans, note);
    this.historyService.addAnnotation(this.documentId, annotation);
  };

  private readonly handleUserAnnotationClick = (
    annotation: UserAnnotation,
    target: HTMLElement
  ) => {
    const props = new UserAnnotationTooltipProps(
      annotation,
      this.documentId,
      (updated) => this.historyService.updateAnnotation(this.documentId, updated),
      (annotationId) =>
        this.historyService.removeAnnotation(this.documentId, annotationId),
      (item) =>
        this.documentStateService.focusOnSpan(item.highlightedSpans, {
          color: item.color,
        })
    );
    this.floatingPanelService.show(props, target);
  };

  private readonly handleHomeClick = () => {
    this.routerService.navigateToDefault();
  };

  private onSpanSummaryMouseEnter(spanIds: string[]) {
    if (spanIds.length === 0) {
      return;
    }
    this.hoveredSpanId = spanIds[0];
  }

  private onSpanSummaryMouseLeave() {
    this.hoveredSpanId = null;
  }

  private renderLoadingMetadata() {
    return html`<div class="loading-metadata-container status-container">
      <div class="loading-metadata status-inner-container">
        <div class="spinner">
          <pr-circular-progress></pr-circular-progress>
        </div>
        <span class="loading-metadata-text"
          >${t(
            "reader.loadingDocument",
            this.settingsService.responseLanguage.value
          )}</span
        >
      </div>
    </div>`;
  }

  private renderNotFound() {
    const lang = this.settingsService.responseLanguage.value;
    return html`<div class="error-container status-container">
      <div class="error-inner-container status-inner-container">
        <span class="not-found-header">404</span>
        <span class="not-found-body">${t("home.pageNotFound", lang)}</span>
        <div class="error-footer">
          <pr-button variant="tonal" @click=${this.handleHomeClick}
            >${t("nav.backHome", lang)}</pr-button
          >
        </div>
      </div>
    </div>`;
  }

  private renderError(metadata?: ArxivMetadata) {
    const lang = this.settingsService.responseLanguage.value;
    return html`<div class="error-container status-container">
      <div class="error-inner-container status-inner-container">
        <span class="error-header">${t("reader.errorTitle", lang)}</span>
        <span class="error-body"
          >${t("reader.importFailed", lang, {
            title: metadata?.title ?? "",
          })}
          <a
            href=${getArxivPaperUrl(this.metadata?.paperId ?? "")}
            class="arxiv-link"
            target="_blank"
            rel="noopener noreferrer"
          >
            <pr-icon-button
              class="open-button"
              variant="default"
              icon="open_in_new"
              title=${t("arxiv.openPaper", lang)}
            >
            </pr-icon-button>
          </a>
        </span>
        <div class="error-footer">
          <pr-button variant="tonal" @click=${this.handleHomeClick}
            >${t("nav.backHome", lang)}</pr-button
          >
        </div>
      </div>
    </div>`;
  }

  private renderImportingDocumentLoadingState(metadata?: ArxivMetadata) {
    return html`<loading-document
      .onBackClick=${this.handleHomeClick}
      .metadata=${metadata}
    ></loading-document>`;
  }

  private renderWithStyles(content: TemplateResult) {
    return html`
      <style>
        ${styles}
      </style>
      ${content}
    `;
  }

  private renderMobileSmartHighlightMenu() {
    if (!isViewportSmall()) return nothing;
    return html`
      <div
        ${ref(this.mobileSmartHighlightContainerRef)}
        class="smart-highlight-menu-container"
      ></div>
    `;
  }

  private clearHighlightsAndMenus() {
    this.floatingPanelService.hide();
    this.documentStateService.highlightManager?.clearHighlights();
  }

  override render() {
    if (this.metadataNotFound) {
      return this.renderWithStyles(this.renderNotFound());
    }

    if (this.loadingStatus === LoadingStatus.UNSET) {
      return this.renderWithStyles(this.renderLoadingMetadata());
    }

    if (this.loadingStatus === LoadingStatus.WAITING) {
      return this.renderWithStyles(
        this.renderImportingDocumentLoadingState(this.metadata)
      );
    }

    if (LOADING_STATES_RENDER_ERROR.includes(this.loadingStatus)) {
      return this.renderWithStyles(this.renderError(this.metadata));
    }

    const sidebarWrapperClasses = classMap({
      ["sidebar-wrapper"]: true,
      ["is-mobile-sidebar-collapsed"]:
        this.documentStateService.collapseManager?.isMobileSidebarCollapsed ??
        false,
    });

    return this.renderWithStyles(html`
      <div
        class=${sidebarWrapperClasses}
        @mousedown=${() => {
          this.floatingPanelService.hide();
        }}
      >
        <elowen-sidebar></elowen-sidebar>
      </div>
      <div
        class="doc-wrapper"
        @mousedown=${() => {
          this.clearHighlightsAndMenus();
        }}
      >
        <elowen-doc
          .elowenDocManager=${this.documentStateService.elowenDocManager}
          .highlightManager=${this.documentStateService.highlightManager}
          .answerHighlightManager=${this.historyService.answerHighlightManager}
          .userHighlightManager=${this.historyService.userHighlightManager}
          .collapseManager=${this.documentStateService.collapseManager}
          .getImageUrl=${this.getImageUrl.bind(this)}
          .onConceptClick=${this.handleConceptClick.bind(this)}
          .onImageClick=${this.handleImageClick.bind(this)}
          .onScroll=${this.handleScroll.bind(this)}
          .onPaperReferenceClick=${this.handlePaperReferenceClick.bind(this)}
          .onFootnoteClick=${this.handleFootnoteClick.bind(this)}
          .onAnswerHighlightClick=${this.handleAnswerHighlightClick.bind(this)}
          .onUserAnnotationClick=${this.handleUserAnnotationClick.bind(this)}
          .onSpanSummaryMouseEnter=${this.onSpanSummaryMouseEnter.bind(this)}
          .onSpanSummaryMouseLeave=${this.onSpanSummaryMouseLeave.bind(this)}
          .hoveredSpanId=${this.hoveredSpanId}
        ></elowen-doc>
      </div>
      ${this.renderMobileSmartHighlightMenu()}
    `);
  }
}

declare global {
  interface HTMLElementTagNameMap {
    "elowen-reader": ElowenReader;
  }
}
