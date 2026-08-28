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

import {
  ListContent,
  ElowenConcept,
  ElowenContent,
  ElowenDoc,
  ElowenSection,
  ElowenSpan,
} from "./elowen_doc";
import { ElowenSummaryMaps } from "./elowen_summary_maps";

function makeEmptySummaries() {
  return {
    sectionSummaries: [],
    contentSummaries: [],
    spanSummaries: [],
  };
}

/**
 * A helper class for manipulating a ElowenDoc.
 * e.g. efficiently helps to look up spans in a ElowenDoc by their ID.
 */
export class ElowenDocManager {
  private readonly spanMap = new Map<string, ElowenSpan>();
  private readonly spanToSectionMap = new Map<string, ElowenSection>();
  private readonly sectionToParentMap = new Map<string, ElowenSection>();
  private readonly innerSummaryMaps: ElowenSummaryMaps;
  private readonly innerElowenDoc: ElowenDoc;
  private readonly conceptMap = new Map<string, ElowenConcept>();

  constructor(elowenDoc: ElowenDoc) {
    this.innerElowenDoc = elowenDoc;
    this.innerSummaryMaps = new ElowenSummaryMaps(
      this.innerElowenDoc.summaries ?? makeEmptySummaries()
    );

    this.initializeMaps(this.innerElowenDoc);
  }

  get elowenDoc() {
    return this.innerElowenDoc;
  }

  get summaryMaps() {
    return this.innerSummaryMaps;
  }

  /**
   * Retrieves a ElowenSpan by its ID.
   * @param id The ID of the span to retrieve.
   * @returns The ElowenSpan if found, otherwise undefined.
   */
  getSpanById(id: string): ElowenSpan | undefined {
    return this.spanMap.get(id);
  }

  /**
   * Retrieves a ElowenSpan by its ID.
   * @param id The ID of the span to retrieve.
   * @returns The ElowenSpan if found, otherwise undefined.
   */
  getConceptById(id: string): ElowenConcept | undefined {
    return this.conceptMap.get(id);
  }

  /**
   * Retrieves the ElowenSection that contains a given span.
   * @param spanId The ID of the span.
   * @returns The ElowenSection if found, otherwise undefined.
   */
  getSectionForSpan(spanId: string): ElowenSection | undefined {
    return this.spanToSectionMap.get(spanId);
  }

  /**
   * Retrieves the parent section of a given section.
   * @param sectionId The ID of the section.
   * @returns The parent ElowenSection if it exists, otherwise undefined.
   */
  getParentSection(sectionId: string): ElowenSection | undefined {
    return this.sectionToParentMap.get(sectionId);
  }

  get spanIds() {
    return Array.from(this.spanMap.keys());
  }

  private initializeMaps(elowenDoc: ElowenDoc) {
    // Index spans in the abstract (may be missing if import model omitted it)
    elowenDoc.abstract?.contents?.forEach((content) => {
      this.addContentSpans(content);
    });

    // Index spans in sections
    (elowenDoc.sections ?? []).forEach((section) => {
      this.addSectionSpans(section);
    });

    // Index spans in references
    (elowenDoc.references ?? []).forEach((reference) => {
      if (reference?.span?.id) {
        this.spanMap.set(reference.span.id, reference.span);
      }
    });

    (elowenDoc.concepts ?? []).forEach((concept) => {
      this.conceptMap.set(concept.id, concept);
    });
  }

  private addSectionSpans(section: ElowenSection, parent?: ElowenSection) {
    if (parent) {
      this.sectionToParentMap.set(section.id, parent);
    }
    (section.contents ?? []).forEach((content) => {
      this.addContentSpans(content, section);
    });

    if (section.subSections) {
      section.subSections.forEach((subSection) => {
        this.addSectionSpans(subSection, section);
      });
    }
  }

  private addListContentSpans(listContent: ListContent, section?: ElowenSection) {
    if (listContent.listItems) {
      listContent.listItems.forEach((item) => {
        item.spans.forEach((span) => {
          this.spanMap.set(span.id, span);
          if (section) {
            this.spanToSectionMap.set(span.id, section);
          }
        });
        if (item.subListContent) {
          this.addListContentSpans(item.subListContent, section);
        }
      });
    }
  }

  private addContentSpans(content: ElowenContent, section?: ElowenSection) {
    if (content.textContent?.spans) {
      content.textContent.spans.forEach((span) => {
        this.spanMap.set(span.id, span);
        if (section) {
          this.spanToSectionMap.set(span.id, section);
        }
      });
    }
    if (content.listContent) {
      this.addListContentSpans(content.listContent, section);
    }
  }
}
