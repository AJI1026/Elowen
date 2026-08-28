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
import { LocalStorageService } from "./local_storage.service";
import { ArxivMetadata } from "../shared/elowen_doc";
import { sortPaperDataByTimestamp } from "../shared/elowen_paper_utils";
import { PERSONAL_SUMMARY_QUERY_NAME } from "../shared/constants";
import { AnswerHighlightManager } from "../shared/answer_highlight_manager";
import { UserHighlightManager } from "../shared/user_highlight_manager";
import { HistoryCollapseManager } from "../shared/history_collapse_manager";
import { ScrollState } from "../contexts/scroll_context";
import { getAllSpansFromContents } from "../shared/elowen_doc_utils";

const PAPER_KEY_PREFIX = "elowen-paper:";
const INITIAL_SUMMARY_COLLAPSE_STATE = true;

interface ServiceProvider {
  localStorageService: LocalStorageService;
}

/**
 * A service to manage the history of Elowen questions and answers.
 * History is stored per document ID in local storage.
 */
export class HistoryService extends Service {
  answers = new Map<string, ElowenAnswer[]>();
  temporaryAnswers: ElowenAnswer[] = [];
  paperMetadata = new Map<string, ArxivMetadata>();
  personalSummaries = new Map<string, ElowenAnswer>();
  annotations = new Map<string, UserAnnotation[]>();
  readonly answerHighlightManager: AnswerHighlightManager;
  readonly userHighlightManager: UserHighlightManager;
  readonly historyCollapseManager: HistoryCollapseManager;

  private scrollState?: ScrollState;
  private readonly spanIdToAnswerIdMap = new Map<string, string>();

  constructor(private readonly sp: ServiceProvider) {
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
      getPaperHistory: observable,
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

  override initialize(): void {
    // Load all paper data from local storage on initialization
    const paperKeys = this.sp.localStorageService.listKeys(PAPER_KEY_PREFIX);
    const allAnswers: ElowenAnswer[] = [];
    const allAnnotations: UserAnnotation[] = [];
    for (const key of paperKeys) {
      const paperData = this.sp.localStorageService.getData<PaperData | null>(
        key,
        null
      );
      if (paperData) {
        const paperId = paperData.metadata.paperId;
        this.paperMetadata.set(paperId, paperData.metadata);
        this.answers.set(paperId, paperData.history);
        allAnswers.push(...paperData.history);
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
    }
    this.answerHighlightManager.populateFromAnswers(allAnswers);
    this.userHighlightManager.populateFromAnnotations(allAnnotations);
    this.historyCollapseManager.initialize(allAnswers);

    for (const answer of allAnswers) {
      this.updateAnswerSpansMap(answer);
    }
  }

  /**
   * Retrieves the answer history for a given document ID.
   * @param docId The ID of the document.
   * @returns An array of ElowenAnswer objects, or an empty array if none exist.
   */
  getAnswers(docId: string): ElowenAnswer[] {
    return this.answers.get(docId) || [];
  }

  getAnnotations(docId: string): UserAnnotation[] {
    return this.annotations.get(docId) || [];
  }

  getPaperData(docId: string): PaperData | null {
    const key = `${PAPER_KEY_PREFIX}${docId}`;
    return this.sp.localStorageService.getData<PaperData | null>(key, null);
  }

  /**
   * Retrieves all paper data from local storage.
   * @returns An array of PaperData objects.
   */
  getPaperHistory(sortByTimestamp = true): PaperData[] {
    const paperKeys = this.sp.localStorageService.listKeys(PAPER_KEY_PREFIX);
    const papers: PaperData[] = [];
    for (const key of paperKeys) {
      const paperData = this.sp.localStorageService.getData<PaperData | null>(
        key,
        null
      );
      if (paperData) {
        papers.push(paperData);
      }
    }
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

  /**
   * Adds a new answer to the history for a given document ID.
   * Answers are prepended to the array to keep the most recent first.
   * @param docId The ID of the document.
   * @param answer The ElowenAnswer object to add.
   */
  addAnswer(docId: string, answer: ElowenAnswer) {
    const currentAnswers = this.getAnswers(docId);
    this.answers.set(docId, [answer, ...currentAnswers]);
    this.answerHighlightManager.addAnswer(answer);
    this.historyCollapseManager.setAnswerCollapsed(answer.id, false);

    this.updateAnswerSpansMap(answer);
    this.syncPaperToLocalStorage(docId);
  }

  /**
   * Removes an answer from history for a given document ID.
   * Also clears associated highlights and temporary entries if present.
   */
  removeAnswer(docId: string, answerId: string) {
    const currentAnswers = this.getAnswers(docId);
    const nextAnswers = currentAnswers.filter(
      (answer) => answer.id !== answerId
    );

    if (nextAnswers.length !== currentAnswers.length) {
      this.answers.set(docId, nextAnswers);
      this.answerHighlightManager.removeAnswer(answerId);
      this.removeAnswerSpansMap(answerId);
      this.syncPaperToLocalStorage(docId);
    }

    this.removeTemporaryAnswer(answerId);
  }

  /**
   * Adds a new temporary answer for a given document ID.
   * @param docId The ID of the document.
   * @param answer The temporary ElowenAnswer object to add.
   * @param collapseOthers Whether to collapse other answers.
   */
  addTemporaryAnswer(answer: ElowenAnswer, collapseOthers = true) {
    this.temporaryAnswers.push(answer);

    if (collapseOthers) {
      this.historyCollapseManager.collapseAllAnswersExcept(answer.id);
      this.scrollState?.scrollAnswersToTop();
    }
  }

  /**
   * Removes a temporary answer for a given document ID.
   * @param docId The ID of the document.
   * @param answerId The ID of the temporary ElowenAnswer object to remove.
   */
  removeTemporaryAnswer(answerId: string) {
    const answerIndex = this.temporaryAnswers.findIndex(
      (answer) => answer.id === answerId
    );
    if (answerIndex > -1) {
      this.temporaryAnswers.splice(answerIndex, 1);
    }
  }

  /**
   * Retrieves the temporary answer history for a given document ID.
   * @param docId The ID of the document.
   * @returns An array of ElowenAnswer objects, or an empty array if none exist.
   */
  getTemporaryAnswers(): ElowenAnswer[] {
    return this.temporaryAnswers;
  }

  /**
   * Clears all temporary answers.
   */
  clearTemporaryAnswers() {
    this.temporaryAnswers = [];
  }

  /**
   * Adds a new personal summary for a given document ID.
   * @param docId The ID of the document.
   * @param summary The ElowenAnswer object to add.
   */
  addPersonalSummary(docId: string, summary: ElowenAnswer) {
    this.personalSummaries.set(docId, summary);
    this.syncPaperToLocalStorage(docId);
  }

  addAnnotation(docId: string, annotation: UserAnnotation) {
    const currentAnnotations = this.getAnnotations(docId);
    this.annotations.set(docId, [annotation, ...currentAnnotations]);
    this.userHighlightManager.addAnnotation(annotation);
    this.syncPaperToLocalStorage(docId);
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
    this.syncPaperToLocalStorage(docId);
  }

  removeAnnotation(docId: string, annotationId: string) {
    const currentAnnotations = this.getAnnotations(docId);
    this.annotations.set(
      docId,
      currentAnnotations.filter((item) => item.id !== annotationId)
    );
    this.userHighlightManager.removeAnnotation(annotationId);
    this.syncPaperToLocalStorage(docId);
  }

  /**
   * Adds a paper with 'loading' status.
   * @param docId The ID of the document.
   * @param metadata The metadata of the paper.
   */
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
    this.sp.localStorageService.setData(
      `${PAPER_KEY_PREFIX}${docId}`,
      newPaper
    );
  }

  /**
   * Adds a paper to the history or updates its status to 'complete'.
   * @param docId The ID of the document.
   * @param metadata The metadata of the paper.
   */
  addPaper(docId: string, metadata: ArxivMetadata) {
    // If the paper already exists (i.e., it was a loading paper),
    // we just update its status. Otherwise, we create a new entry.
    const existingPaper = this.getPaperData(docId);
    if (existingPaper) {
      existingPaper.status = "complete";
      this.sp.localStorageService.setData(
        `${PAPER_KEY_PREFIX}${docId}`,
        existingPaper
      );
    } else {
      this.paperMetadata.set(docId, metadata);
      const newPaper: PaperData = {
        metadata,
        history: [],
        status: "complete",
        addedTimestamp: Date.now(),
      };
      this.sp.localStorageService.setData(
        `${PAPER_KEY_PREFIX}${docId}`,
        newPaper
      );
    }
  }

  /**
   * Deletes a paper and its history.
   * @param docId The ID of the document to delete.
   */
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
    this.sp.localStorageService.deleteData(`${PAPER_KEY_PREFIX}${docId}`);
  }

  /**
   * Clears all paper history from memory and local storage.
   */
  clearAllHistory() {
    const paperKeys = this.sp.localStorageService.listKeys(PAPER_KEY_PREFIX);
    for (const key of paperKeys) {
      this.sp.localStorageService.deleteData(key);
    }
    this.paperMetadata.clear();
    this.answers.clear();
    this.personalSummaries.clear();
    this.annotations.clear();
    this.answerHighlightManager.clearHighlights();
    this.userHighlightManager.clearHighlights();
    this.spanIdToAnswerIdMap.clear();
  }

  /**
   * Retrieves the Answer ID for a given Span ID.
   * @param spanId The ID of the span.
   * @returns The Answer ID if found, otherwise undefined.
   */
  getAnswerIdForSpan(spanId: string): string | undefined {
    return this.spanIdToAnswerIdMap.get(spanId);
  }

  private syncPaperToLocalStorage(docId: string) {
    const paperData = this.getPaperData(docId);
    if (!paperData) {
      console.warn(`Attempted to sync paper that does not exist: ${docId}`);
      return;
    }

    const updatedPaperData: PaperData = {
      ...paperData,
      history: this.getAnswers(docId),
      personalSummary: this.personalSummaries.get(docId),
      annotations: this.getAnnotations(docId),
    };

    this.sp.localStorageService.setData(
      `${PAPER_KEY_PREFIX}${docId}`,
      updatedPaperData
    );
  }
}
