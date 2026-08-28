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
import { ArxivMetadata, HighlightColor } from "./elowen_doc";
import { ElowenAnswer } from "./api";
import { HighlightSelection } from "./selection_utils";

/** A user-created highlight or note on a document. */
export interface UserAnnotation {
  id: string;
  selectedText: string;
  highlightedSpans: HighlightSelection[];
  note?: string;
  color: HighlightColor;
  createdAt: number;
}

/** Local Storage State */
export interface PaperData {
  metadata: ArxivMetadata;
  history: ElowenAnswer[];
  personalSummary?: ElowenAnswer;
  annotations?: UserAnnotation[];
  status: "loading" | "complete";
  addedTimestamp?: number;
}
