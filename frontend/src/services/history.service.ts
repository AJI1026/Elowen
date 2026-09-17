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

import { action, computed, makeObservable, observable } from "mobx";
import { Service } from "./service";
import { ElowenAnswer } from "../shared/api";
import { PaperData, UserAnnotation } from "../shared/types_local_storage";
import { ArxivMetadata } from "../shared/elowen_doc";
import { sortPaperDataByTimestamp } from "../shared/elowen_paper_utils";
import { PERSONAL_SUMMARY_QUERY_NAME } from "../shared/constants";
import { AnswerHighlightManager } from "../shared/answer_highlight_manager";
import { UserHighlightManager } from "../shared/user_highlight_manager";
import { HistoryCollapseManager } from "../shared/history_collapse_manager";
import { ScrollState } from "../contexts/scroll_context";
import { getAllSpansFromContents } from "../shared/elowen_doc_utils";
import { httpApi } from "../shared/http_api";

const LEGACY_PAPER_KEY_PREFIX = "elowen-paper:";
const INITIAL_SUMMARY_COLLAPSE_STATE = true;
const SAVE_DEBOUNCE_MS = 400;

/**
 * History of Elowen questions / papers.
 * Paper list + per-paper state persist in data/ (SQLite) via the local API.
 */
export class HistoryService extends Service {
  answers = new Map<string, ElowenAnswer[]>();
  temporaryAnswers: ElowenAnswer[] = [];
  paperMetadata = new Map<string, ArxivMetadata>();
  personalSummaries = new Map<string, ElowenAnswer>();
  annotations = new Map<string, UserAnnotation[]>();
  /** In-memory PaperData mirror of the server library. */
  paperDataMap = new Map<string, PaperData>();
  readonly answerHighlightManager: AnswerHighlightManager;
  readonly userHighlightManager: UserHighlightManager;
  readonly historyCollapseManager: HistoryCollapseManager;

  private scrollState?: ScrollState;
  private readonly spanIdToAnswerIdMap = new Map<string, string>();
  private readonly saveTimers = new Map<string, ReturnType<typeof setTimeout>>();
  private persistSuspended = false;

  constructor() {
    super();
    this.answerHighlightManager = new AnswerHighlightManager();
    this.userHighlightManager = new UserHighlightManager();
    this.historyCollapseManager = new HistoryCollapseManager();
    makeObservable(this, {
      answers: observable.shallow,
      temporaryAnswers: observable.shallow,
      paperMetadata: observable.shallow,
      personalSummaries: observable.shallow,
      annotations: observable.shallow,
      paperDataMap: observable.shallow,
      isAnswerLoading: computed,
      addAnswer: action,
      removeAnswer: action,
      addTemporaryAnswer: action,
      removeTemporaryAnswer: action,
      clearTemporaryAnswers: action,
      addPaper: action,
      addPersonalSummary: action,
      addAnnotation: action,
      updateAnnotation: action,
      removeAnnotation: action,
      addLoadingPaper: action,
      deletePaper: action,
      clearAllHistory: action,
    });
  }

  setScrollState(scrollState: ScrollState) {
    this.scrollState = scrollState;
  }

  get isAnswerLoading() {
    return this.temporaryAnswers.length > 0;
  }

  get isNonSummaryAnswerLoading() {
    if (this.temporaryAnswers.length === 0) return false;
    for (const answer of this.temporaryAnswers) {
      if (answer.request.query === PERSONAL_SUMMARY_QUERY_NAME) {
        return false;
      }
    }
    return true;
  }

  override async initialize(): Promise<void> {
    this.persistSuspended = true;
    try {
      let papers = await httpApi.getLibrary();
      if (!Array.isArray(papers) || papers.length === 0) {
        const migrated = this.readLegacyBrowserPapers();
        if (migrated.length > 0) {
          for (const paper of migrated) {
            const id = paper.metadata?.paperId;
            if (!id) continue;
            await httpApi.putLibraryPaper(id, paper);
          }
          this.clearLegacyBrowserPapers();
          papers = await httpApi.getLibrary();
        }
      } else {
        this.clearLegacyBrowserPapers();
      }
      this.hydrateFromPapers(Array.isArray(papers) ? papers : []);
    } catch (e) {
      console.warn("Failed to load library from server; trying browser migration", e);
      const migrated = this.readLegacyBrowserPapers();
      if (migrated.length > 0) {
        this.hydrateFromPapers(migrated);
        for (const paper of migrated) {
          const id = paper.metadata?.paperId;
          if (!id) continue;
          try {
            await httpApi.putLibraryPaper(id, paper);
          } catch {
            // keep in-memory
          }
        }
        this.clearLegacyBrowserPapers();
      }
    } finally {
      this.persistSuspended = false;
    }
    if (typeof window !== "undefined") {
      window.addEventListener("beforeunload", () => this.flushPendingSaves());
    }
  }

  private hydrateFromPapers(papers: PaperData[]) {
    const allAnswers: ElowenAnswer[] = [];
    const allAnnotations: UserAnnotation[] = [];
    for (const paperData of papers) {
      if (!paperData?.metadata?.paperId) continue;
      const paperId = paperData.metadata.paperId;
      this.paperDataMap.set(paperId, paperData);
      this.paperMetadata.set(paperId, paperData.metadata);
      this.answers.set(paperId, paperData.history ?? []);
      allAnswers.push(...(paperData.history ?? []));
      if (paperData.personalSummary) {
        this.personalSummaries.set(paperId, paperData.personalSummary);
        this.historyCollapseManager.setAnswerCollapsed(
          paperData.personalSummary.id,
          INITIAL_SUMMARY_COLLAPSE_STATE
        );
      }
      if (paperData.annotations) {
        this.annotations.set(paperId, paperData.annotations);
        allAnnotations.push(...paperData.annotations);
      }
    }
    this.answerHighlightManager.populateFromAnswers(allAnswers);
    this.userHighlightManager.populateFromAnnotations(allAnnotations);
    this.historyCollapseManager.initialize(allAnswers);
    for (const answer of allAnswers) {
      this.updateAnswerSpansMap(answer);
    }
  }

  getAnswers(docId: string): ElowenAnswer[] {
    return this.answers.get(docId) || [];
  }

  /**
   * Prior answers for LLM context (oldest first). UI stores newest first.
   * Prefer ``getAskContext`` so already-summarized turns are not re-sent.
   */
  getConversationHistory(docId: string, limit = 24): ElowenAnswer[] {
    const answers = this.getAnswers(docId).filter((a) => !a.isLoading);
    return [...answers].reverse().slice(-limit);
  }

  getConversationSummary(docId: string): string | undefined {
    return this.paperDataMap.get(docId)?.conversationSummary;
  }

  /** History + rolling summary payload for /api/ask. */
  getAskContext(docId: string): {
    history: ElowenAnswer[];
    conversationSummary?: string;
  } {
    const all = this.getConversationHistory(docId, 100);
    const paper = this.getPaperData(docId);
    const through = Math.max(0, paper?.conversationSummaryThrough ?? 0);
    // Always include at least the last 4 raw turns; skip older ones already
    // represented in the rolling summary.
    const keepRaw = 4;
    const start = Math.min(through, Math.max(0, all.length - keepRaw));
    return {
      history: all.slice(start).slice(-24),
      conversationSummary: paper?.conversationSummary,
    };
  }

  setConversationSummary(
    docId: string,
    summary: string,
    summarizedThrough?: number
  ) {
    const existing = this.getPaperData(docId);
    if (!existing) return;
    const updated: PaperData = {
      ...existing,
      conversationSummary: summary,
      ...(summarizedThrough !== undefined
        ? { conversationSummaryThrough: summarizedThrough }
        : {}),
    };
    this.paperDataMap.set(docId, updated);
    this.persistPaperNow(docId, updated);
  }

  /**
   * Persist a new answer and optionally a refreshed conversation summary
   * returned by the ask API after server-side compression.
   */
  addAnswerFromResponse(
    docId: string,
    response: ElowenAnswer & { conversationSummary?: string }
  ) {
    const priorCount = this.getAnswers(docId).filter((a) => !a.isLoading).length;
    const { conversationSummary, ...answer } = response;
    this.addAnswer(docId, answer as ElowenAnswer);
    if (typeof conversationSummary === "string" && conversationSummary.trim()) {
      const through = priorCount > 4 ? priorCount - 4 : priorCount;
      this.setConversationSummary(docId, conversationSummary.trim(), through);
    }
  }

  getAnnotations(docId: string): UserAnnotation[] {
    return this.annotations.get(docId) || [];
  }

  getPaperData(docId: string): PaperData | null {
    return this.paperDataMap.get(docId) ?? null;
  }

  getPaperHistory(sortByTimestamp = true): PaperData[] {
    const papers = [...this.paperDataMap.values()];
    if (sortByTimestamp) {
      return sortPaperDataByTimestamp(papers);
    }
    return papers;
  }

  private updateAnswerSpansMap(answer: ElowenAnswer) {
    const spans = getAllSpansFromContents(answer.responseContent);
    for (const span of spans) {
      this.spanIdToAnswerIdMap.set(span.id, answer.id);
    }
  }

  private removeAnswerSpansMap(answerId: string) {
    for (const [spanId, mappedAnswerId] of this.spanIdToAnswerIdMap.entries()) {
      if (mappedAnswerId === answerId) {
        this.spanIdToAnswerIdMap.delete(spanId);
      }
    }
  }

  addAnswer(docId: string, answer: ElowenAnswer) {
    const currentAnswers = this.getAnswers(docId);
    this.answers.set(docId, [answer, ...currentAnswers]);
    this.answerHighlightManager.addAnswer(answer);
    this.historyCollapseManager.setAnswerCollapsed(answer.id, false);

    this.updateAnswerSpansMap(answer);
    this.syncPaper(docId);
  }

  removeAnswer(docId: string, answerId: string) {
    const currentAnswers = this.getAnswers(docId);
    const nextAnswers = currentAnswers.filter(
      (answer) => answer.id !== answerId
    );

    if (nextAnswers.length !== currentAnswers.length) {
      this.answers.set(docId, nextAnswers);
      this.answerHighlightManager.removeAnswer(answerId);
      this.removeAnswerSpansMap(answerId);
      this.syncPaper(docId);
    }

    this.removeTemporaryAnswer(answerId);
  }

  addTemporaryAnswer(answer: ElowenAnswer, collapseOthers = true) {
    this.temporaryAnswers.push(answer);

    if (collapseOthers) {
      this.historyCollapseManager.collapseAllAnswersExcept(answer.id);
      this.scrollState?.scrollAnswersToTop();
    }
  }

  removeTemporaryAnswer(answerId: string) {
    const answerIndex = this.temporaryAnswers.findIndex(
      (answer) => answer.id === answerId
    );
    if (answerIndex > -1) {
      this.temporaryAnswers.splice(answerIndex, 1);
    }
  }

  getTemporaryAnswers(): ElowenAnswer[] {
    return this.temporaryAnswers;
  }

  clearTemporaryAnswers() {
    this.temporaryAnswers = [];
  }

  addPersonalSummary(docId: string, summary: ElowenAnswer) {
    this.personalSummaries.set(docId, summary);
    this.syncPaper(docId);
  }

  addAnnotation(docId: string, annotation: UserAnnotation) {
    const currentAnnotations = this.getAnnotations(docId);
    this.annotations.set(docId, [annotation, ...currentAnnotations]);
    this.userHighlightManager.addAnnotation(annotation);
    this.syncPaper(docId);
  }

  updateAnnotation(docId: string, annotation: UserAnnotation) {
    const currentAnnotations = this.getAnnotations(docId);
    this.annotations.set(
      docId,
      currentAnnotations.map((item) =>
        item.id === annotation.id ? annotation : item
      )
    );
    this.userHighlightManager.updateAnnotation(annotation);
    this.syncPaper(docId);
  }

  removeAnnotation(docId: string, annotationId: string) {
    const currentAnnotations = this.getAnnotations(docId);
    this.annotations.set(
      docId,
      currentAnnotations.filter((item) => item.id !== annotationId)
    );
    this.userHighlightManager.removeAnnotation(annotationId);
    this.syncPaper(docId);
  }

  addLoadingPaper(docId: string, metadata: ArxivMetadata) {
    if (this.paperMetadata.has(docId)) {
      return;
    }
    this.paperMetadata.set(docId, metadata);
    const newPaper: PaperData = {
      metadata,
      history: [],
      status: "loading",
      addedTimestamp: Date.now(),
    };
    this.paperDataMap.set(docId, newPaper);
    this.persistPaperNow(docId, newPaper);
  }

  addPaper(docId: string, metadata: ArxivMetadata) {
    const existingPaper = this.getPaperData(docId);
    if (existingPaper) {
      const updated: PaperData = {
        ...existingPaper,
        metadata,
        status: "complete",
      };
      this.paperDataMap.set(docId, updated);
      this.paperMetadata.set(docId, metadata);
      this.persistPaperNow(docId, updated);
    } else {
      this.paperMetadata.set(docId, metadata);
      const newPaper: PaperData = {
        metadata,
        history: [],
        status: "complete",
        addedTimestamp: Date.now(),
      };
      this.paperDataMap.set(docId, newPaper);
      this.persistPaperNow(docId, newPaper);
    }
  }

  deletePaper(docId: string) {
    for (const answer of this.getAnswers(docId)) {
      this.answerHighlightManager.removeAnswer(answer.id);
      this.removeAnswerSpansMap(answer.id);
    }
    for (const annotation of this.getAnnotations(docId)) {
      this.userHighlightManager.removeAnnotation(annotation.id);
    }
    this.paperMetadata.delete(docId);
    this.answers.delete(docId);
    this.personalSummaries.delete(docId);
    this.annotations.delete(docId);
    this.paperDataMap.delete(docId);
    const timer = this.saveTimers.get(docId);
    if (timer) {
      clearTimeout(timer);
      this.saveTimers.delete(docId);
    }
    void httpApi.deleteLibraryPaper(docId).catch((e) => {
      console.warn(`Failed to delete library paper ${docId}`, e);
    });
  }

  clearAllHistory() {
    for (const timer of this.saveTimers.values()) {
      clearTimeout(timer);
    }
    this.saveTimers.clear();
    this.paperDataMap.clear();
    this.paperMetadata.clear();
    this.answers.clear();
    this.personalSummaries.clear();
    this.annotations.clear();
    this.answerHighlightManager.clearHighlights();
    this.userHighlightManager.clearHighlights();
    this.spanIdToAnswerIdMap.clear();
    void httpApi.clearLibrary().catch((e) => {
      console.warn("Failed to clear library", e);
    });
  }

  getAnswerIdForSpan(spanId: string): string | undefined {
    return this.spanIdToAnswerIdMap.get(spanId);
  }

  private syncPaper(docId: string) {
    let existing = this.getPaperData(docId);
    if (!existing) {
      const metadata = this.paperMetadata.get(docId);
      if (!metadata) {
        console.warn(`Attempted to sync paper that does not exist: ${docId}`);
        return;
      }
      existing = {
        metadata,
        history: [],
        status: "complete",
        addedTimestamp: Date.now(),
      };
    }

    const updatedPaperData: PaperData = {
      ...existing,
      history: this.getAnswers(docId),
      personalSummary: this.personalSummaries.get(docId),
      annotations: this.getAnnotations(docId),
    };
    this.paperDataMap.set(docId, updatedPaperData);

    if (this.persistSuspended) return;
    // Persist Q&A immediately so refresh does not lose the latest turn.
    const prev = this.saveTimers.get(docId);
    if (prev) clearTimeout(prev);
    this.saveTimers.delete(docId);
    this.persistPaperNow(docId, updatedPaperData);
  }

  private persistPaperNow(docId: string, data: PaperData) {
    if (this.persistSuspended) return;
    void httpApi.putLibraryPaper(docId, data).catch((e) => {
      console.warn(`Failed to save library paper ${docId}`, e);
    });
  }

  /** Flush any deferred saves (kept for compatibility; sync is now immediate). */
  flushPendingSaves() {
    for (const [docId, timer] of this.saveTimers.entries()) {
      clearTimeout(timer);
      const data = this.paperDataMap.get(docId);
      if (data) this.persistPaperNow(docId, data);
      this.saveTimers.delete(docId);
    }
  }

  private readLegacyBrowserPapers(): PaperData[] {
    const papers: PaperData[] = [];
    try {
      for (let i = 0; i < window.localStorage.length; i++) {
        const key = window.localStorage.key(i);
        if (!key || !key.startsWith(LEGACY_PAPER_KEY_PREFIX)) continue;
        const raw = window.localStorage.getItem(key);
        if (!raw) continue;
        try {
          const paper = JSON.parse(raw) as PaperData;
          if (paper?.metadata?.paperId) papers.push(paper);
        } catch {
          // skip bad entry
        }
      }
    } catch {
      // ignore
    }
    return papers;
  }

  private clearLegacyBrowserPapers() {
    try {
      const keys: string[] = [];
      for (let i = 0; i < window.localStorage.length; i++) {
        const key = window.localStorage.key(i);
        if (key && key.startsWith(LEGACY_PAPER_KEY_PREFIX)) keys.push(key);
      }
      for (const key of keys) {
        window.localStorage.removeItem(key);
      }
    } catch {
      // ignore
    }
  }
}
