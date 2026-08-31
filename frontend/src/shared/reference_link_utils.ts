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

/** Kind of external destination for a bibliography entry. */
export type ReferenceLinkKind = "url" | "doi" | "arxiv" | "scholar";

export interface ReferenceExternalLink {
  url: string;
  kind: ReferenceLinkKind;
}

const HTTP_URL_RE = /https?:\/\/[^\s<>"')\]]+/i;
const DOI_URL_RE = /(?:https?:\/\/)?(?:dx\.)?doi\.org\/(10\.\S+)/i;
const DOI_PREFIX_RE = /\bdoi:\s*(10\.\S+)/i;
const ARXIV_URL_RE =
  /(?:https?:\/\/)?(?:www\.)?arxiv\.org\/(?:abs|pdf|html)\/(\d{4}\.\d{4,5})(?:v\d+)?/i;
const ARXIV_ID_RE = /\barxiv:\s*(\d{4}\.\d{4,5})(?:v\d+)?/i;
const QUOTED_TITLE_RE = /[“"]([^“”"]{8,200})[”"]/;

function stripTrailingPunctuation(value: string): string {
  return value.replace(/[.,;:)\]]+$/g, "");
}

/**
 * Builds an external URL for a reference citation string.
 * Prefer explicit URL / DOI / arXiv; otherwise fall back to Google Scholar.
 */
export function getReferenceExternalLink(
  text: string | undefined | null
): ReferenceExternalLink | null {
  const raw = (text ?? "").trim();
  if (!raw) return null;

  const doiUrl = DOI_URL_RE.exec(raw);
  if (doiUrl?.[1]) {
    return {
      kind: "doi",
      url: `https://doi.org/${stripTrailingPunctuation(doiUrl[1])}`,
    };
  }

  const doiPrefix = DOI_PREFIX_RE.exec(raw);
  if (doiPrefix?.[1]) {
    return {
      kind: "doi",
      url: `https://doi.org/${stripTrailingPunctuation(doiPrefix[1])}`,
    };
  }

  const arxivUrl = ARXIV_URL_RE.exec(raw);
  if (arxivUrl?.[1]) {
    return {
      kind: "arxiv",
      url: `https://arxiv.org/abs/${arxivUrl[1]}`,
    };
  }

  const arxivId = ARXIV_ID_RE.exec(raw);
  if (arxivId?.[1]) {
    return {
      kind: "arxiv",
      url: `https://arxiv.org/abs/${arxivId[1]}`,
    };
  }

  const http = HTTP_URL_RE.exec(raw);
  if (http?.[0]) {
    return {
      kind: "url",
      url: stripTrailingPunctuation(http[0]),
    };
  }

  const title = QUOTED_TITLE_RE.exec(raw)?.[1]?.trim();
  const query = title || raw.replace(/^\s*\[\d+\]\s*/, "").slice(0, 180);
  if (!query) return null;

  return {
    kind: "scholar",
    url: `https://scholar.google.com/scholar?q=${encodeURIComponent(query)}`,
  };
}
