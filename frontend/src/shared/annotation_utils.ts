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

import { HighlightColor } from "./elowen_doc";
import { HighlightSelection } from "./selection_utils";
import { UserAnnotation } from "./types_local_storage";
import { generateId } from "./utils";

/** Creates a new user annotation for the given text selection. */
export function createUserAnnotation(
  selectedText: string,
  highlightedSpans: HighlightSelection[],
  note?: string,
  color: HighlightColor = "yellow"
): UserAnnotation {
  return {
    id: generateId(),
    selectedText,
    highlightedSpans,
    note,
    color,
    createdAt: Date.now(),
  };
}
