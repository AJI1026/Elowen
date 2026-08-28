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

import { action, makeObservable } from "mobx";
import { Highlight } from "./elowen_doc";
import { HighlightManagerBase } from "./highlight_manager";
import { HIGHLIGHT_METADATA_ANNOTATION_KEY } from "./constants";
import { UserAnnotation } from "./types_local_storage";

/**
 * Manages persistent user-created highlights and notes on a document.
 */
export class UserHighlightManager extends HighlightManagerBase {
  override getObservables() {
    return {
      ...super.getObservables(),
      populateFromAnnotations: action,
      addAnnotation: action,
      updateAnnotation: action,
      removeAnnotation: action,
    };
  }

  populateFromAnnotations(annotations: UserAnnotation[]) {
    this.clearHighlights();
    for (const annotation of annotations) {
      this.addAnnotation(annotation);
    }
  }

  addAnnotation(annotation: UserAnnotation) {
    for (const highlightedSpan of annotation.highlightedSpans) {
      const { spanId, position } = highlightedSpan;
      const highlight: Highlight = {
        spanId,
        position,
        color: annotation.color,
        metadata: {
          [HIGHLIGHT_METADATA_ANNOTATION_KEY]: annotation,
        },
      };

      const existing = this.highlightedSpans.get(spanId) || [];
      this.highlightedSpans.set(spanId, [...existing, highlight]);
    }
  }

  updateAnnotation(annotation: UserAnnotation) {
    this.removeAnnotation(annotation.id);
    this.addAnnotation(annotation);
  }

  removeAnnotation(annotationId: string) {
    for (const [spanId, highlights] of this.highlightedSpans.entries()) {
      const filtered = highlights.filter(
        (highlight) =>
          highlight.metadata?.[HIGHLIGHT_METADATA_ANNOTATION_KEY]?.id !==
          annotationId
      );
      if (filtered.length === 0) {
        this.highlightedSpans.delete(spanId);
      } else if (filtered.length !== highlights.length) {
        this.highlightedSpans.set(spanId, filtered);
      }
    }
  }
}
