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

import { Service } from "./service";
import { Highlight, HighlightColor, ElowenDoc } from "../shared/elowen_doc";
import { ScrollState } from "../contexts/scroll_context";
import { HighlightManager } from "../shared/highlight_manager";
import { CollapseManager } from "../shared/collapse_manager";
import { ElowenDocManager } from "../shared/elowen_doc_manager";
import { action, makeObservable, observable } from "mobx";
import { HighlightSelection } from "../shared/selection_utils";
import { HistoryService } from "./history.service";
import { ELOWEN_CONCEPT_SPAN_ID_PREFIX, SIDEBAR_TABS } from "../shared/constants";

interface SpanFocusOptions {
  color?: HighlightColor;
  shouldScroll?: boolean;
}

interface ServiceProvider {
  historyService: HistoryService;
}

/**
 * A service to manage the UI state of a single document, such as section
 * collapse states and span highlights. This allows different components to
 * share and react to this state in a centralized way.
 */
export class DocumentStateService extends Service {
  highlightManager?: HighlightManager;
  collapseManager?: CollapseManager;
  elowenDocManager?: ElowenDocManager;

  private scrollState?: ScrollState;

  constructor(private readonly sp: ServiceProvider) {
    super();
    makeObservable(this);
  }

  setDocument(elowenDoc: ElowenDoc) {
    this.highlightManager = new HighlightManager();

    this.elowenDocManager = new ElowenDocManager(elowenDoc);
    this.collapseManager = new CollapseManager(this.elowenDocManager);
    this.collapseManager.initialize();
  }

  clearDocument() {
    this.highlightManager = undefined;
    this.elowenDocManager = undefined;
    this.collapseManager = undefined;
  }

  setScrollState(scrollState: ScrollState) {
    this.scrollState = scrollState;
  }

  scrollToSpan(spanId: string) {
    this.scrollState?.scrollToSpan(spanId);
  }

  scrollToImage(imageStoragePath: string) {
    this.scrollState?.scrollToImage(imageStoragePath);
  }

  focusOnImage(imageStoragePath: string) {
    if (!this.highlightManager) return;

    this.highlightManager.clearHighlights();
    this.highlightManager.addImageHighlight(imageStoragePath);

    this.scrollToImage(imageStoragePath);
  }

  focusOnSpan(
    highlightedSpans: HighlightSelection[],
    { color = "purple", shouldScroll = true }: SpanFocusOptions = {}
  ) {
    if (
      !this.collapseManager ||
      !this.highlightManager ||
      !highlightedSpans.length
    )
      return;

    const spanId = highlightedSpans[0].spanId;

    this.highlightManager.clearHighlights();
    const highlights: Highlight[] = highlightedSpans.map(
      (highlightedSpansObject) => {
        return {
          spanId: highlightedSpansObject.spanId,
          position: highlightedSpansObject.position,
          color,
        };
      }
    );
    this.highlightManager.addHighlights(highlights);

    const isConceptId = spanId.includes(ELOWEN_CONCEPT_SPAN_ID_PREFIX);
    if (isConceptId) {
      this.collapseManager.setSidebarTabSelection(SIDEBAR_TABS.CONCEPTS);
    } else {
      const answerId = this.sp.historyService.getAnswerIdForSpan(spanId);
      if (answerId) {
        this.collapseManager.setSidebarTabSelection(SIDEBAR_TABS.ANSWERS);
        this.sp.historyService.historyCollapseManager.setAnswerCollapsed(
          answerId,
          false
        );
      }
    }

    if (shouldScroll) {
      window.setTimeout(() => {
        this.scrollToSpan(spanId);
      });
    }
  }
}
