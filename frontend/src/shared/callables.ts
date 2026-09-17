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

import { ArxivMetadata, ElowenDoc } from "./elowen_doc";
import { ElowenAnswer, ElowenAnswerRequest, UserFeedback } from "./api";
import { PaperData } from "./types_local_storage";
import { ModelConfig } from "./model_config";
import { httpApi } from "./http_api";

/** The result from requesting a document import. */
export interface RequestArxivDocImportResult {
  metadata?: ArxivMetadata;
  error?: string;
}

/**
 * Requests the import for a given arxiv doc.
 * Passes the Settings model config (including API key) so desktop users
 * do not need a server-side api_config.py.
 */
export const requestArxivDocImportCallable = async (
  _functions: unknown,
  arxivId: string,
  modelConfig?: ModelConfig
): Promise<RequestArxivDocImportResult> => {
  return httpApi.importPaper(arxivId, {
    modelConfig,
    apiKey: modelConfig?.apiKey,
  });
};

/**
 * Requests a Elowen answer based on the document and user input.
 * Pass ``history`` (oldest→newest prior answers on this paper) for multi-turn context.
 * Long histories are summarized server-side; ``conversationSummary`` is a rolling cache.
 */
export const getElowenResponseCallable = async (
  _functions: unknown,
  doc: ElowenDoc,
  request: ElowenAnswerRequest,
  modelConfig: ModelConfig,
  history: ElowenAnswer[] = [],
  conversationSummary?: string
): Promise<ElowenAnswer & { conversationSummary?: string }> => {
  return httpApi.ask({
    doc,
    request,
    modelConfig,
    apiKey: modelConfig.apiKey,
    history,
    conversationSummary,
  });
};

/**
 * Requests arxiv metadata object from the arxiv paper id.
 */
export const getArxivMetadata = async (
  _functions: unknown,
  arxivId: string
): Promise<ArxivMetadata> => {
  return httpApi.getMetadata(arxivId);
};

/**
 * Requests a personalized summary based on the document and user's history.
 */
export const getPersonalSummaryCallable = async (
  _functions: unknown,
  doc: ElowenDoc,
  pastPapers: PaperData[],
  modelConfig: ModelConfig
): Promise<ElowenAnswer> => {
  return httpApi.personalSummary({
    doc,
    past_papers: pastPapers,
    modelConfig,
    apiKey: modelConfig.apiKey,
  });
};

/**
 * Saves user feedback.
 */
export const saveUserFeedbackCallable = async (
  _functions: unknown,
  feedback: UserFeedback
): Promise<void> => {
  await httpApi.feedback({
    user_feedback_text: feedback.userFeedbackText,
    arxiv_id: feedback.arxivId,
  });
};
