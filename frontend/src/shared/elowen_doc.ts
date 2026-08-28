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

import { Bytes } from "firebase/firestore";

// Kept in sync with: functions/shared/elowen_doc.py
export interface Position {
  startIndex: number;
  endIndex: number;
}

// Kept in sync with Color classes in elowen_span.scss
export const HIGHLIGHT_COLORS = [
  "cyan",
  "green",
  "green-light",
  "yellow",
  "orange",
  "pink",
  "purple",
  "blue",
  "gray",
] as const;
export type HighlightColor = (typeof HIGHLIGHT_COLORS)[number];

export declare interface HighlightMetadata {
  [key: string]: any;
}

export interface Highlight {
  color: HighlightColor;
  spanId: string;
  position?: Position; // Highlights the entire span if the position is undefined.
  metadata?: HighlightMetadata;
}

export interface Citation {
  spanId: string;
  position: Position;
}

export interface CitedContent {
  text: string;
  citations: Citation[];
}

export interface Label {
  id: string;
  label: string;
}

export interface ElowenSummary {
  id: string;
  summary: ElowenSpan;
  /** Why the author included this paragraph (optional, newer imports). */
  purpose?: ElowenSpan;
}

export interface ElowenSummaries {
  sectionSummaries: ElowenSummary[];
  contentSummaries: ElowenSummary[];
  spanSummaries: ElowenSummary[];
  abstractExcerptSpanId?: string;
}

export interface Heading {
  headingLevel: number;
  text: string;
}

export interface ConceptContent {
  label: string;
  value: string;
}

export interface ElowenConcept {
  id: string;
  name: string;
  type?: string;
  contents: ConceptContent[];
  inTextCitations: Label[];
}

// TODO(ellenj): Refactor import pipeline to bring in hierarchical headings
export interface ElowenSection {
  id: string;
  heading: Heading; // TODO(ellenj): Consider removing headingLevel
  contents: ElowenContent[];
  subSections?: ElowenSection[];
}

export interface TextContent {
  tagName: string;
  spans: ElowenSpan[];
}

export interface ImageContent {
  storagePath: string;
  latexPath: string;
  caption: ElowenSpan | null | undefined;
  altText: string;
  width: number;
  height: number;
}

export interface FigureContent {
  images: ImageContent[];
  caption: ElowenSpan | null | undefined;
}

// Note: this currently only exists in the front-end type definitions.
// (The backend will directly write the bytes to storage and does not need this type.)
export interface ElowenImage {
  storagePath: string;
  bytes: Bytes;
}

export interface HtmlFigureContent {
  html: string;
  caption: ElowenSpan | null | undefined;
}

// TODO(ellenj): Refactor import pipeline to bring in hierarchical list items
export interface ListContent {
  listItems: ListItem[];
  isOrdered: boolean;
}

export interface ListItem {
  spans: ElowenSpan[];
  subListContent?: ListContent;
}

export interface ElowenContent {
  id: string;
  // Allowing this to be null to simplify conversion from backend.
  textContent: TextContent | undefined | null;
  imageContent: ImageContent | undefined | null;
  figureContent: FigureContent | undefined | null;
  htmlFigureContent: HtmlFigureContent | undefined | null;
  listContent: ListContent | undefined | null;
}

// TODO(ellenj): Remove file_id from elowen_doc.py
export interface ElowenSpan {
  id: string;
  text: string;
  innerTags: InnerTag[];
}

// TODO(ellenj): Update elowen_doc.py to match.
export enum InnerTagName {
  BOLD = "b", // Bold - Handled by elowen_span.scss class
  ITALIC = "i", // Italic - Handled by elowen_span.scss class
  STRONG = "strong", // Strong - Handled by elowen_span.scss class
  EM = "em", // em tag - Handled by elowen_span.scss class
  UNDERLINE = "u", // Underline - Handled by elowen_span.scss class
  MATH = "math", // Renders as Latex
  MATH_DISPLAY = "math_display", // Renders as Latex display equation
  REFERENCE = "ref", // Renders as a linked citation
  SPAN_REFERENCE = "spanref",
  CONCEPT = "concept",
  A = "a",
  CODE = "code",
  FOOTNOTE = "footnote",
}

export declare interface InnerTagMetadata {
  [key: string]: string;
}

export interface InnerTag {
  tagName: InnerTagName;
  position: Position;
  metadata: InnerTagMetadata;
  children?: InnerTag[];
}

export interface ElowenReference {
  id: string;
  span: ElowenSpan;
}

export interface ElowenFootnote {
  id: string;
  span: ElowenSpan;
}

export interface ElowenAbstract {
  contents: ElowenContent[];
}

// Kept in sync with: functions/shared/types.py
export interface FeaturedImage {
  imageStoragePath: string;
}

export interface MetadataCollectionItem {
  metadata: ArxivMetadata;
  featuredImage?: FeaturedImage;
}

export interface ArxivMetadata {
  paperId: string;
  version: string;
  authors: string[];
  title: string;
  summary: string;
  updatedTimestamp: string;
  publishedTimestamp: string;
}

export enum LoadingStatus {
  UNSET = "UNSET",
  // Importing paper into ElowenDoc
  WAITING = "WAITING",
  // Loading summaries after paper has been imported
  SUMMARIZING = "SUMMARIZING",
  SUCCESS = "SUCCESS",
  ERROR_DOCUMENT_LOAD = "ERROR_DOCUMENT_LOAD",
  ERROR_DOCUMENT_LOAD_INVALID_RESPONSE = "ERROR_DOCUMENT_LOAD_INVALID_RESPONSE",
  ERROR_DOCUMENT_LOAD_QUOTA_EXCEEDED = "ERROR_DOCUMENT_LOAD_QUOTA_EXCEEDED",
  ERROR_SUMMARIZING = "ERROR_SUMMARIZING",
  ERROR_SUMMARIZING_INVALID_RESPONSE = "ERROR_SUMMARIZING_INVALID_RESPONSE",
  ERROR_SUMMARIZING_QUOTA_EXCEEDED = "ERROR_SUMMARIZING_QUOTA_EXCEEDED",
  TIMEOUT = "TIMEOUT",
}

export const LOADING_STATUS_ERROR_STATES = [
  LoadingStatus.ERROR_DOCUMENT_LOAD,
  LoadingStatus.ERROR_DOCUMENT_LOAD_INVALID_RESPONSE,
  LoadingStatus.ERROR_DOCUMENT_LOAD_QUOTA_EXCEEDED,
  LoadingStatus.ERROR_SUMMARIZING,
  LoadingStatus.ERROR_SUMMARIZING_QUOTA_EXCEEDED,
  LoadingStatus.ERROR_SUMMARIZING_INVALID_RESPONSE,
];

export interface ElowenDoc {
  markdown: string;
  abstract?: ElowenAbstract | null;
  sections: ElowenSection[];
  concepts: ElowenConcept[];
  summaries?: ElowenSummaries;
  metadata?: ArxivMetadata;
  loadingStatus: string;
  loadingError?: string;
  references: ElowenReference[];
  footnotes?: ElowenFootnote[];
}
