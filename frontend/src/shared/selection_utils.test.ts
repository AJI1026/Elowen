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

import { expect } from "@esm-bundle/chai";
import { fixture, html } from "@open-wc/testing";
import { CITATION_CLASSNAME, FOOTNOTE_CLASSNAME } from "./constants";

import { getSelectionInfo, getWordAtCharacterElement, getWordCharElements, normalizeSelectionText, looksLikeFragmentedClipboardText } from "./selection_utils";
import "./elowen_doc";

describe("normalizeSelectionText", () => {
  it("collapses KaTeX token newlines into horizontal math-like text", () => {
    const raw = [
      "C",
      "opacity",
      "(",
      "t",
      ")",
      "=",
      "{",
      "g",
      "∈",
      "G",
      "|",
      "o",
      "g",
      "<",
      "Q",
      "τ",
      "(",
      "o",
      ")",
      "}",
    ].join("\n");
    const normalized = normalizeSelectionText(raw);
    expect(normalized).to.equal("C opacity(t)={g∈G|og<Qτ(o)}");
    expect(normalized.includes("\n")).to.be.false;
  });

  it("joins ordinary paragraph newlines with spaces", () => {
    const normalized = normalizeSelectionText(
      "First sentence continues here.\nSecond sentence follows."
    );
    expect(normalized).to.equal(
      "First sentence continues here. Second sentence follows."
    );
  });

  it("detects fragmented clipboard text from KaTeX tokens", () => {
    const raw = ["C", "=", "c", "b", "g", "+", "Σ", "i"].join("\n");
    expect(looksLikeFragmentedClipboardText(raw)).to.equal(true);
    expect(
      looksLikeFragmentedClipboardText("line one\nline two is long enough")
    ).to.equal(false);
  });
});

class MockElowenSpan extends HTMLElement {}
customElements.define("elowen-span", MockElowenSpan);

class ParentWithShadow extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: "open" });
  }
}
customElements.define("parent-with-shadow", ParentWithShadow);

/**
 * Test helper to create the DOM structure expected by getSelectionInfo.
 * It mimics the output of `renderElowenSpan` where each character is in its own
 * span.
 * @param text The text content for the elowen-span.
 * @returns A span element containing character-spans.
 */
function createCharacterSpans(text: string): HTMLSpanElement {
  const outerSpan = document.createElement("span");
  outerSpan.className = "outer-span";
  for (const char of text) {
    const charSpan = document.createElement("span");
    charSpan.textContent = char;
    outerSpan.appendChild(charSpan);
  }
  return outerSpan;
}

/**
 * Test helper to create the DOM structure with inline elements like citations.
 * @param text The text content for the elowen-span.
 * @param inlinePositions An object where keys are indices to insert an inline
 * element and values are the elements themselves.
 * @returns A span element containing character-spans and inline elements.
 */
function createCharacterSpansWithInlines(
  text: string,
  inlinePositions: { [index: number]: HTMLElement }
): HTMLSpanElement {
  const outerSpan = document.createElement("span");
  outerSpan.className = "outer-span";
  let textIndex = 0;
  for (const char of text) {
    if (inlinePositions[textIndex]) {
      outerSpan.appendChild(inlinePositions[textIndex]);
    }
    const charSpan = document.createElement("span");
    charSpan.textContent = char;
    outerSpan.appendChild(charSpan);
    textIndex++;
  }
  // Handle insertion at the very end
  if (inlinePositions[textIndex]) {
    outerSpan.appendChild(inlinePositions[textIndex]);
  }
  return outerSpan;
}

describe("getSelectionInfo", () => {
  it("should return selection info for a partial selection within a single elowen-span", async () => {
    // 1. Create a fixture with our mock <elowen-span> element.
    const el = await fixture(html` <parent-with-shadow></parent-with-shadow> `);
    const elowenSpan = document.createElement("elowen-span");
    elowenSpan.id = "test-span-1";
    const textContent = "This is some test text.";
    const characterSpans = createCharacterSpans(textContent);
    elowenSpan.appendChild(characterSpans);

    el.shadowRoot!.appendChild(elowenSpan);
    const charSpans = characterSpans.querySelectorAll("span");
    const startNode = charSpans[5].firstChild!; // "i" in "is"
    const endNode = charSpans[11].firstChild!; // "e" in "some"

    // Programmatically create a text selection
    const selection = window.getSelection()!;
    const range = document.createRange();
    range.setStart(startNode, 0);
    range.setEnd(endNode, 1);
    selection.removeAllRanges();
    selection.addRange(range);

    const selectionInfo = getSelectionInfo(window.getSelection()!);

    expect(selectionInfo).to.not.be.null;
    expect(selectionInfo!.selectedText).to.equal("is some");
    expect(selectionInfo!.highlightSelection).to.deep.equal([
      { spanId: "test-span-1", position: { startIndex: 5, endIndex: 12 } },
    ]);
  });

  it("should correctly calculate offset with inline citation and footnote tags", async () => {
    const el = await fixture(html` <parent-with-shadow></parent-with-shadow> `);
    const elowenSpan = document.createElement("elowen-span");
    elowenSpan.id = "test-span-inline";
    const textContent = "Some text.";

    // Create mock inline elements
    const citation = document.createElement("span");
    citation.className = CITATION_CLASSNAME;
    citation.textContent = "[1]";

    const footnote = document.createElement("sup");
    footnote.className = FOOTNOTE_CLASSNAME;
    footnote.textContent = "2";

    // "[1]S<sup>2</sup>ome text."
    const characterSpans = createCharacterSpansWithInlines(textContent, {
      0: citation,
      1: footnote,
    });
    elowenSpan.appendChild(characterSpans);
    el.shadowRoot!.appendChild(elowenSpan);

    const startNode = characterSpans.children[7].firstChild!; // 1st "t" in "text"
    const endNode = characterSpans.children[10].firstChild!; // 2nd "t" in "text"

    const selection = window.getSelection()!;
    const range = document.createRange();
    range.setStart(startNode, 0);
    range.setEnd(endNode, 1);
    selection.removeAllRanges();
    selection.addRange(range);

    const selectionInfo = getSelectionInfo(selection);

    expect(selectionInfo).to.not.be.null;
    expect(selectionInfo!.selectedText).to.equal("text");
    expect(selectionInfo!.highlightSelection).to.deep.equal([
      {
        spanId: "test-span-inline",
        position: { startIndex: 5, endIndex: 9 },
      },
    ]);
  });

  it("should return null if selection is empty", async () => {
    const el = await fixture(html`<parent-with-shadow></parent-with-shadow>`);
    const selection = window.getSelection()!;
    selection.removeAllRanges(); // Ensure it's empty
    const selectionInfo = getSelectionInfo(selection);
    expect(selectionInfo).to.be.null;
  });

  it("should return null if getComposedRanges returns an empty array", async () => {
    const el = await fixture(html`<parent-with-shadow></parent-with-shadow>`);
    const selection = window.getSelection()!;
    selection.removeAllRanges();

    // @ts-ignore - Mocking getComposedRanges for this specific test case
    selection.getComposedRanges = () => [];

    const selectionInfo = getSelectionInfo(selection);
    expect(selectionInfo).to.be.null;
  });

  it("should return selection info for a selection spanning multiple elowen-spans", async () => {
    const el = await fixture(html`<parent-with-shadow></parent-with-shadow>`);

    // ElowenSpan 1
    const elowenSpan1 = document.createElement("elowen-span");
    elowenSpan1.id = "test-span-1";
    const text1 = "First part. ";
    elowenSpan1.appendChild(createCharacterSpans(text1));

    // ElowenSpan 2
    const elowenSpan2 = document.createElement("elowen-span");
    elowenSpan2.id = "test-span-2";
    const text2 = "Second part. ";
    elowenSpan2.appendChild(createCharacterSpans(text2));

    // ElowenSpan 3
    const elowenSpan3 = document.createElement("elowen-span");
    elowenSpan3.id = "test-span-3";
    const text3 = "Third part.";
    elowenSpan3.appendChild(createCharacterSpans(text3));

    el.shadowRoot!.appendChild(elowenSpan1);
    el.shadowRoot!.appendChild(elowenSpan2);
    el.shadowRoot!.appendChild(elowenSpan3);

    const charSpans1 = elowenSpan1.querySelectorAll("span > span");
    const charSpans3 = elowenSpan3.querySelectorAll("span > span");

    const startNode = charSpans1[6].firstChild!; // "p" in "part. "
    const endNode = charSpans3[4].firstChild!; // "d" in "Third"

    const selection = window.getSelection()!;
    const range = document.createRange();
    range.setStart(startNode, 0);
    range.setEnd(endNode, 1);
    selection.removeAllRanges();
    selection.addRange(range);

    // @ts-ignore - Mocking getComposedRanges for this specific test case
    selection.getComposedRanges = () => [range];

    const selectionInfo = getSelectionInfo(selection);

    expect(selectionInfo).to.not.be.null;
    expect(selectionInfo!.selectedText).to.equal("part. Second part. Third");
    expect(selectionInfo!.highlightSelection).to.deep.equal([
      { spanId: "test-span-1", position: { startIndex: 6, endIndex: 13 } },
      { spanId: "test-span-2", position: { startIndex: 0, endIndex: 14 } },
      { spanId: "test-span-3", position: { startIndex: 0, endIndex: 5 } },
    ]);
  });
});

describe("getWordAtCharacterElement", () => {
  it("expands a clicked latin character to the full word", async () => {
    const elowenSpan = document.createElement("elowen-span");
    elowenSpan.id = "word-span";
    const renderer = createCharacterSpans("Hello world");
    renderer.className = "elowen-span-renderer-element";
    elowenSpan.appendChild(renderer);
    document.body.appendChild(elowenSpan);

    const chars = renderer.querySelectorAll("span");
    const eChar = chars[1] as HTMLElement; // "e" in Hello
    const info = getWordAtCharacterElement(eChar);

    expect(info).to.not.be.null;
    expect(info!.selectedText).to.equal("Hello");
    expect(info!.highlightSelection).to.deep.equal([
      { spanId: "word-span", position: { startIndex: 0, endIndex: 5 } },
    ]);

    elowenSpan.remove();
  });

  it("returns null for whitespace", async () => {
    const elowenSpan = document.createElement("elowen-span");
    elowenSpan.id = "space-span";
    const renderer = createCharacterSpans("ab cd");
    renderer.className = "elowen-span-renderer-element";
    elowenSpan.appendChild(renderer);
    document.body.appendChild(elowenSpan);

    const space = renderer.children[2] as HTMLElement;
    expect(getWordAtCharacterElement(space)).to.be.null;

    elowenSpan.remove();
  });

  it("returns the character spans of the hovered word", async () => {
    const elowenSpan = document.createElement("elowen-span");
    elowenSpan.id = "hover-span";
    const renderer = createCharacterSpans("Hello world");
    renderer.className = "elowen-span-renderer-element";
    elowenSpan.appendChild(renderer);
    document.body.appendChild(elowenSpan);

    const chars = Array.from(renderer.children) as HTMLElement[];
    const elements = getWordCharElements(chars[1]); // "e" in Hello

    expect(elements).to.deep.equal(chars.slice(0, 5));
    expect(elements.map((el) => el.textContent).join("")).to.equal("Hello");
    expect(getWordCharElements(chars[5])).to.deep.equal([]); // space

    elowenSpan.remove();
  });
});
