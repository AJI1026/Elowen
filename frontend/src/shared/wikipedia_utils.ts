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

export interface WikipediaSummary {
  title: string;
  extract: string;
  pageUrl: string;
  lang: "zh" | "en";
}

interface WikiRestSummaryResponse {
  title?: string;
  extract?: string;
  type?: string;
  content_urls?: {
    desktop?: { page?: string };
  };
}

/** Skip Wikipedia for long passages / pure math that won't have an encyclopedia page. */
export function isLikelyWikipediaLookupTerm(term: string): boolean {
  const cleaned = term.trim().replace(/\s+/g, " ");
  if (!cleaned) return false;
  if (cleaned.length > 80) return false;
  if ((cleaned.match(/\n/g) || []).length > 2) return false;

  // Formula / operator-heavy text is a poor encyclopedia lookup.
  if (/[∑∫√∞≈≤≥≠±×÷∂∇]/.test(cleaned)) return false;
  if ((cleaned.match(/[_^=${}\\]/g) || []).length >= 2) return false;

  const lettersOrDigits = cleaned.replace(/[^\p{L}\p{N}]/gu, "");
  if (lettersOrDigits.length < 2) return false;

  const compact = cleaned.replace(/\s/g, "");
  if (lettersOrDigits.length / compact.length < 0.45) {
    return false;
  }
  return true;
}

function wikiHost(lang: "zh" | "en"): string {
  return lang === "zh" ? "zh.wikipedia.org" : "en.wikipedia.org";
}

function wikiSearchUrl(lang: "zh" | "en", query: string): string {
  return `https://${wikiHost(lang)}/wiki/Special:Search?search=${encodeURIComponent(
    query
  )}`;
}

/** Generate title candidates from a highlight (full phrase, without parens, acronym). */
export function wikipediaTermCandidates(term: string): string[] {
  const cleaned = term.trim().replace(/\s+/g, " ");
  if (!cleaned) return [];

  const candidates: string[] = [cleaned];
  const withoutTrailingParen = cleaned.replace(/\s*\([^)]*\)\s*$/u, "").trim();
  if (withoutTrailingParen && withoutTrailingParen !== cleaned) {
    candidates.push(withoutTrailingParen);
  }
  const acronym = cleaned.match(/\(([A-Za-z][A-Za-z0-9+./-]{1,16})\)$/);
  if (acronym?.[1]) {
    candidates.push(acronym[1]);
  }
  // Deduplicate while preserving order
  return [...new Set(candidates)];
}

async function fetchSummaryForTitle(
  lang: "zh" | "en",
  title: string
): Promise<WikipediaSummary | null> {
  const url = `https://${wikiHost(lang)}/api/rest_v1/page/summary/${encodeURIComponent(
    title.trim()
  )}`;
  try {
    const response = await fetch(url, {
      headers: { Accept: "application/json" },
    });
    if (!response.ok) return null;
    const data = (await response.json()) as WikiRestSummaryResponse;
    if (!data.extract || data.type === "disambiguation") return null;
    return {
      title: data.title || title,
      extract: data.extract,
      pageUrl: data.content_urls?.desktop?.page || wikiSearchUrl(lang, title),
      lang,
    };
  } catch {
    return null;
  }
}

/** MediaWiki opensearch → best matching page title. */
async function searchBestTitle(
  lang: "zh" | "en",
  query: string
): Promise<string | null> {
  const url =
    `https://${wikiHost(lang)}/w/api.php` +
    `?action=opensearch&search=${encodeURIComponent(query.trim())}` +
    `&limit=1&namespace=0&format=json&origin=*`;
  try {
    const response = await fetch(url);
    if (!response.ok) return null;
    const data = (await response.json()) as unknown;
    if (!Array.isArray(data) || data.length < 2) return null;
    const titles = data[1];
    if (!Array.isArray(titles) || titles.length === 0) return null;
    const title = titles[0];
    return typeof title === "string" && title.trim() ? title.trim() : null;
  } catch {
    return null;
  }
}

async function fetchSummaryForLang(
  lang: "zh" | "en",
  term: string
): Promise<WikipediaSummary | null> {
  for (const candidate of wikipediaTermCandidates(term)) {
    const direct = await fetchSummaryForTitle(lang, candidate);
    if (direct) return direct;

    const searched = await searchBestTitle(lang, candidate);
    if (searched && searched.toLowerCase() !== candidate.toLowerCase()) {
      const viaSearch = await fetchSummaryForTitle(lang, searched);
      if (viaSearch) return viaSearch;
    }
  }
  return null;
}

/**
 * Best-effort Wikipedia summary for a concept/term.
 * Prefers the requested language, then falls back to the other.
 */
export async function fetchWikipediaSummary(
  term: string,
  preferredLang: "zh" | "en" = "zh"
): Promise<WikipediaSummary | null> {
  const cleaned = term.trim();
  if (!cleaned || !isLikelyWikipediaLookupTerm(cleaned)) return null;

  const order: Array<"zh" | "en"> =
    preferredLang === "zh" ? ["zh", "en"] : ["en", "zh"];

  for (const lang of order) {
    const summary = await fetchSummaryForLang(lang, cleaned);
    if (summary) return summary;
  }
  return null;
}

export function getWikipediaSearchUrl(
  term: string,
  lang: "zh" | "en" = "zh"
): string {
  return wikiSearchUrl(lang, term);
}
