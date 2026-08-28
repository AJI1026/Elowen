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

/** App name. */
export const APP_NAME = "Elowen";

/** Firebase constants. */
export const FIREBASE_LOCAL_HOST_PORT_FIRESTORE = 8080;
export const FIREBASE_LOCAL_HOST_PORT_STORAGE = 9199;
export const FIREBASE_LOCAL_HOST_PORT_AUTH = 9099;
export const FIREBASE_LOCAL_HOST_PORT_FUNCTIONS = 5001;

export const VIEWPORT_SMALL_MAX_WIDTH = 600;
/** @deprecated Use VIEWPORT_SMALL_MAX_WIDTH. Kept for compatibility. */
export const VIEWPORT_SMALL_MAX_HEIGHT = VIEWPORT_SMALL_MAX_WIDTH;

export const MAX_IMPORT_URL_LENGTH = 100;
export const MAX_QUERY_INPUT_LENGTH = 1000;

/** Sidebar tabs. */
export const SIDEBAR_TABS = {
  ANSWERS: "Ask",
  ANNOTATIONS: "Notes",
  TOC: "Outline",
  CONCEPTS: "Concepts",
};

export const INITIAL_SIDEBAR_TAB = SIDEBAR_TABS.ANSWERS;

export const HIGHLIGHT_METADATA_ANSWER_KEY = "answer";
export const HIGHLIGHT_METADATA_ANNOTATION_KEY = "annotation";

export const CITATION_CLASSNAME = "citation-marker";
export const FOOTNOTE_CLASSNAME = "footnote-marker";

/** Brand mark SVG used as favicon and in-app logo. */
export const LOGO_ASSET_PATH = "favicon.svg";
/** Brand blue matching the favicon accent. */
export const LOGO_BRAND_COLOR = "#4E8FF8";

/** Bundled static tutorial images (copied into dist/assets by webpack). */
export const TUTORIAL_QUESTION_IMAGE_PATH = "assets/questions_tutorial.png";
export const TUTORIAL_IMAGE_QUESTION_IMAGE_PATH =
  "assets/questions_image_tutorial.png";

/** Resolve a static asset URL, respecting optional URL_PREFIX. */
export function staticAssetUrl(relativePath: string): string {
  const prefix = String(process.env.URL_PREFIX ?? "/");
  const base = prefix.endsWith("/") ? prefix : `${prefix}/`;
  const path = relativePath.replace(/^\//, "");
  return `${base}${path}`;
}

export const INPUT_DEBOUNCE_MS = 100;

export const ELOWEN_CONCEPT_SPAN_ID_PREFIX = "concept-content";

// Keep in sync with constants.py
export const PERSONAL_SUMMARY_QUERY_NAME = "Summarize this paper";
export const CONCEPT_CONTENT_LABEL_DEFINITION = "definition";
export const CONCEPT_CONTENT_LABEL_RELEVANCE = "relevance";

// Keep in sync with elowen_span.scss
export const SPAN_BLINK_ANIMATION_CLASS = "span-blink";
