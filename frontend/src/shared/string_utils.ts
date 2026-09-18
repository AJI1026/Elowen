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

// Utility functions for processing strings

// Matches "arxiv.org/{some number of letters...}/####.#####
// [a-zA-Z]+: greedily matches letters bewteen 1 and unlimited times
// (\d{4}\.\d{5}): capturing group for id in format '####.#####' where # is a digit
// (?!\d): negative lookahead that checks the next character is NOT a digit
const ARXIV_CAPTURE_REGEX = /arxiv\.org\/[a-zA-Z]+\/(\d{4}\.\d{5})(?!\d)/;

/**
 * Extracts an arXiv ID from a URL or string.
 *
 * Handles various formats like:
 * - https://arxiv.org/pdf/1511.02799
 * - https://arxiv.org/abs/1511.02799
 * - https://arxiv.org/pdf/1511.02799.pdf
 * - https://arxiv.org/pdf/1511.02799v3
 * - arxiv.org/pdf/1511.02799
 *
 * @param url The string to parse.
 * @returns The arXiv ID (e.g., "1511.02799") or null if not found.
 */
export function extractArxivId(url: string): string | null {
  const match = ARXIV_CAPTURE_REGEX.exec(url);
  if (!match) return null;

  const id = match[1]; // First capturing group
  if (!id) return null;

  return id;
}

/**
 * Parses a string of the form "key: value" into a key and value.
 */
export function parseColonKeyValue(originalString: string): {
  key: string;
  value: string;
} {
  const split = originalString.split(":");
  const key = split[0].trim();
  const value = split.slice(1).join(":").trim();
  return { key, value };
}

const LATEX_TYPED_REF_PREFIX: Record<string, string> = {
  fig: "Fig.",
  figure: "Fig.",
  eq: "Eq.",
  eqn: "Eq.",
  equation: "Eq.",
  tab: "Table",
  table: "Table",
  sec: "Sec.",
  section: "Sec.",
};

function humanizeLatexRefLabel(label: string): string {
  const trimmed = label.trim();
  const colon = trimmed.lastIndexOf(":");
  return colon >= 0 ? trimmed.slice(colon + 1).trim() : trimmed;
}

function fallbackLatexRefText(label: string): string {
  const raw = label.trim();
  const colon = raw.indexOf(":");
  const key = colon >= 0 ? raw.slice(0, colon).toLowerCase() : "";
  const name = humanizeLatexRefLabel(raw);
  const prefix = LATEX_TYPED_REF_PREFIX[key];
  return prefix ? `${prefix} ${name}` : name;
}

const HTML_BR_TAG_PATTERN = /<br\s*\/?>/gi;

/** Converts `<br>` / `<br/>` from stored answer text into newline characters. */
export function normalizeHtmlLineBreaks(text: string): string {
  if (!text || !text.includes("<")) return text;
  return text.replace(HTML_BR_TAG_PATTERN, "\n");
}

export function sanitizeUnresolvedLatex(text: string): string {
  if (!text) return text;
  if (
    !text.includes("\\ref") &&
    !text.includes("\\eqref") &&
    !text.includes("\\cref") &&
    !text.includes("\\Cref") &&
    !text.includes("\\autoref") &&
    !text.includes("~")
  ) {
    return text;
  }

  const prefixed =
    /(Fig(?:ure)?\.?|Tab(?:le)?\.?|Eq(?:n|uation)?\.?|Sec(?:tion)?\.?)\s*~?\s*\\(?:eqref|[Cc]ref\*?|autoref|ref\*?)\s*\{([^}]+)\}/g;
  const bare = /\\(?:eqref|[Cc]ref\*?|autoref|ref\*?)\s*\{([^}]+)\}/g;

  let out = text.replace(
    prefixed,
    (_match, prefix: string, label: string) =>
      `${prefix} ${humanizeLatexRefLabel(label)}`
  );
  out = out.replace(bare, (_match, label: string) => fallbackLatexRefText(label));
  return out.replace(/(\S)~(\S)/g, "$1 $2");
}
