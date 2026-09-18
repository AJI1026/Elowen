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

import { fixture, html } from "@open-wc/testing";
import { expect } from "@esm-bundle/chai";

import "./elowen_span";
import { ElowenSpanViz } from "./elowen_span";
import { Highlight, InnerTagName, ElowenSpan } from "../../shared/elowen_doc";
import { HighlightManager } from "../../shared/highlight_manager";

describe("elowen-span", () => {
  it("renders a simple span", async () => {
    const span: ElowenSpan = {
      id: "s1",
      text: "hello world",
      innerTags: [],
    };

    const el = await fixture<ElowenSpanViz>(
      html`<elowen-span .span=${span}></elowen-span>`
    );
    const spanElement = el.querySelector(`#${span.id}`);
    expect(spanElement?.textContent?.trim()).to.equal("hello world");
  });

  it("renders br tags and newlines as line breaks", async () => {
    const span: ElowenSpan = {
      id: "s-br",
      text: "公式如下：<br/>\nC=a+b\n结束",
      innerTags: [],
    };

    const el = await fixture<ElowenSpanViz>(
      html`<elowen-span .span=${span}></elowen-span>`
    );

    expect(el.querySelectorAll("br").length).to.equal(3);
    expect(el.textContent).to.include("公式如下：");
    expect(el.textContent).to.include("C=a+b");
    expect(el.textContent).not.to.include("<br");
  });

  it("renders leftover LaTeX figure refs as readable text", async () => {
    const span: ElowenSpan = {
      id: "s1",
      text: "As shown in Fig.~\\ref{fig:teaser}, our method is faster.",
      innerTags: [],
    };

    const el = await fixture<ElowenSpanViz>(
      html`<elowen-span .span=${span}></elowen-span>`
    );
    const spanElement = el.querySelector(`#${span.id}`);
    expect(spanElement?.textContent?.trim()).to.equal(
      "As shown in Fig. teaser, our method is faster."
    );
  });

  it("renders a span with bold text", async () => {
    const span: ElowenSpan = {
      id: "s1",
      text: "hello bold world",
      innerTags: [
        {
          tagName: InnerTagName.BOLD,
          position: { startIndex: 6, endIndex: 10 },
          metadata: {},
        },
      ],
    };

    const el = await fixture<ElowenSpanViz>(
      html`<elowen-span .span=${span}></elowen-span>`
    );
    const boldEls = el.querySelectorAll("span.b");
    expect(boldEls.length).to.equal(4);
    const expectedTextContents = ["b", "o", "l", "d"];
    expectedTextContents.forEach((expectedContent, index) => {
      expect(boldEls[index]).to.exist;
      expect(boldEls[index]!.textContent).to.equal(expectedContent);
    });
  });

  it("renders a span with a link", async () => {
    const span: ElowenSpan = {
      id: "s1",
      text: "a link to google",
      innerTags: [
        {
          tagName: InnerTagName.A,
          position: { startIndex: 2, endIndex: 6 },
          metadata: { href: "https://www.google.com" },
        },
      ],
    };

    const el = await fixture<ElowenSpanViz>(
      html`<elowen-span .span=${span}></elowen-span>`
    );
    const linkEls = el.querySelectorAll("a");
    const expectedTextContents = ["l", "i", "n", "k"];
    expectedTextContents.forEach((expectedContent, index) => {
      const linkEl = linkEls[index];
      expect(linkEl).to.exist;
      expect(linkEl!.textContent).to.equal(expectedContent);
      expect(linkEl!.href).to.equal("https://www.google.com/");
    });
  });

  it("renders a span with a highlight", async () => {
    const span: ElowenSpan = {
      id: "s1",
      text: "some highlighted text",
      innerTags: [],
    };
    const highlights: Highlight[] = [
      {
        color: "yellow",
        spanId: "s1",
        position: { startIndex: 5, endIndex: 16 },
      },
    ];

    const el = await fixture<ElowenSpanViz>(
      html`<elowen-span .span=${span} .highlights=${highlights}></elowen-span>`
    );
    const highlightedEls = el.querySelectorAll("span.yellow");
    expect(highlightedEls.length).to.equal(11); // 'highlighted'.length

    const spanElement = el.querySelector(`#${span.id}`);
    expect(spanElement?.textContent?.trim()).to.equal("some highlighted text");
    expect(highlightedEls[0].textContent).to.equal("h");
    expect(highlightedEls[10].textContent).to.equal("d");
  });

  it("renders a span with an equation", async () => {
    const span: ElowenSpan = {
      id: "s2",
      text: "An equation: E=mc^2",
      innerTags: [
        {
          tagName: InnerTagName.MATH,
          position: { startIndex: 13, endIndex: 19 },
          metadata: {},
        },
      ],
    };

    const el = await fixture<ElowenSpanViz>(
      html`<elowen-span .span=${span}></elowen-span>`
    );

    const spanElement = el.querySelector(`#${span.id}`);

    // Check that the text outside the equation is still there
    expect(spanElement?.textContent?.trim()).to.include("An equation:");

    // Check for the KaTeX rendered element
    const katexEl = el.querySelector(".katex");
    expect(katexEl).to.exist;

    // Check for specific KaTeX rendered content if possible
    const miE = katexEl!.querySelector(".mord.mathnormal");
    expect(miE).to.exist;
    expect(miE!.textContent).to.equal("E");
  });

  it("renders a span with an l-ref reference", async () => {
    const span: ElowenSpan = {
      id: "s2",
      text: "Sentence",
      innerTags: [
        {
          tagName: InnerTagName.REFERENCE,
          position: { startIndex: 8, endIndex: 8 },
          metadata: { id: "ref1, ref2" },
        },
      ],
    };

    const el = await fixture<ElowenSpanViz>(
      html`<elowen-span
        .span=${span}
        .references=${[
          { id: "ref1", span: { id: "ref-s1", text: "", innerTags: [] } },
          { id: "ref2", span: { id: "ref-s2", text: "", innerTags: [] } },
        ]}
      ></elowen-span>`
    );

    expect(el.textContent).to.include("Sentence12");
  });

  it("renders a span with an s-ref reference as a numerical index", async () => {
    const span: ElowenSpan = {
      id: "s2",
      text: "Sentence",
      innerTags: [
        {
          tagName: InnerTagName.SPAN_REFERENCE,
          position: { startIndex: 8, endIndex: 8 },
          metadata: { id: "sref1" },
        },
        {
          tagName: InnerTagName.SPAN_REFERENCE,
          position: { startIndex: 8, endIndex: 8 },
          metadata: { id: "sref2" },
        },
      ],
    };

    const el = await fixture<ElowenSpanViz>(
      html`<elowen-span
        .span=${span}
        .referencedSpans=${[
          { id: "sref1", innerTags: [], text: "ref text 1" },
          { id: "sref2", innerTags: [], text: "ref text 2" },
        ]}
      ></elowen-span>`
    );

    expect(el.textContent).to.include("Sentence12");
  });

  it("renders a span with nested bold and italic tags", async () => {
    const span: ElowenSpan = {
      id: "s1",
      text: "This is bold and italic text.",
      innerTags: [
        {
          tagName: InnerTagName.BOLD,
          position: { startIndex: 8, endIndex: 24 },
          metadata: {},
          children: [
            {
              tagName: InnerTagName.ITALIC,
              position: { startIndex: 9, endIndex: 15 }, // "italic" relative to "bold and italic"
              metadata: {},
            },
          ],
        },
      ],
    };

    const el = await fixture<ElowenSpanViz>(
      html`<elowen-span .span=${span}></elowen-span>`
    );

    const boldEls = el.querySelectorAll("span.b");
    expect(boldEls.length).to.equal(16); // "bold and italic".length

    const italicEls = el.querySelectorAll("span.i");
    expect(italicEls.length).to.equal(6); // "italic".length

    const boldAndItalicEls = el.querySelectorAll("span.b.i");
    expect(boldAndItalicEls.length).to.equal(6);

    const spanElement = el.querySelector(`#${span.id}`);
    expect(spanElement?.textContent?.trim()).to.equal(
      "This is bold and italic text."
    );
    expect(boldAndItalicEls[0].textContent).to.equal("i");
    expect(boldAndItalicEls[5].textContent).to.equal("c");
  });
});
