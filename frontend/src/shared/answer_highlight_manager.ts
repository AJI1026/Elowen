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

import { action, makeObservable, observable } from "mobx";
import { Highlight } from "./elowen_doc";
import { ElowenAnswer } from "./api";
import { HighlightManagerBase } from "./highlight_manager";
import { HIGHLIGHT_METADATA_ANSWER_KEY } from "./constants";

const ANSWER_HIGHLIGHT_COLOR = "green";

/**
 * Manages the persistent highlight state of spans derived from ElowenAnswers.
 */
export class AnswerHighlightManager extends HighlightManagerBase {
  override getObservables() {
    return {
      ...super.getObservables(),
      populateFromAnswers: action,
      addAnswer: action,
      removeAnswer: action,
    };
  }

  /**
   * Clears existing highlights and populates them from an array of answers.
   * This is typically used on initial load.
   */
  populateFromAnswers(answers: ElowenAnswer[]) {
    this.clearHighlights();
    for (const answer of answers) {
      this.addAnswer(answer);
    }
  }

  /**
   * Adds highlights from a single new answer.
   */
  addAnswer(answer: ElowenAnswer) {
    if (!answer.request.highlightedSpans) {
      return;
    }

    for (const highlightedSpan of answer.request.highlightedSpans) {
      const { spanId, position } = highlightedSpan;
      const highlight: Highlight = {
        spanId,
        position,
        color: ANSWER_HIGHLIGHT_COLOR,
        metadata: {
          [HIGHLIGHT_METADATA_ANSWER_KEY]: answer,
        },
      };

      const existing = this.highlightedSpans.get(spanId) || [];
      this.highlightedSpans.set(spanId, [...existing, highlight]);
    }
  }

  /**
   * Removes all highlights associated with a given answer.
   */
  removeAnswer(answerId: string) {
    for (const [spanId, highlights] of this.highlightedSpans.entries()) {
      const remaining = highlights.filter((highlight) => {
        const answer = highlight.metadata?.[
          HIGHLIGHT_METADATA_ANSWER_KEY
        ] as ElowenAnswer | undefined;
        return answer?.id !== answerId;
      });

      if (remaining.length === 0) {
        this.highlightedSpans.delete(spanId);
      } else {
        this.highlightedSpans.set(spanId, remaining);
      }
    }
  }
}
