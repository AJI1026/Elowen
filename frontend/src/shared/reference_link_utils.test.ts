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
import { getReferenceExternalLink } from "./reference_link_utils";

describe("getReferenceExternalLink", () => {
  it("prefers DOI urls", () => {
    const link = getReferenceExternalLink(
      '[1] Example. doi: 10.1000/xyz123. More text.'
    );
    expect(link?.kind).to.equal("doi");
    expect(link?.url).to.equal("https://doi.org/10.1000/xyz123");
  });

  it("detects arXiv ids", () => {
    const link = getReferenceExternalLink(
      "[2] Author. Title. arXiv:1511.02799, 2015."
    );
    expect(link?.kind).to.equal("arxiv");
    expect(link?.url).to.equal("https://arxiv.org/abs/1511.02799");
  });

  it("detects bare https urls", () => {
    const link = getReferenceExternalLink(
      "See https://example.com/paper.pdf for details."
    );
    expect(link?.kind).to.equal("url");
    expect(link?.url).to.equal("https://example.com/paper.pdf");
  });

  it("falls back to Google Scholar with quoted title", () => {
    const link = getReferenceExternalLink(
      '[1] A. Author, "NeRF: Representing scenes as neural radiance fields," in ECCV, 2020.'
    );
    expect(link?.kind).to.equal("scholar");
    expect(link?.url).to.contain("scholar.google.com");
    expect(link?.url).to.contain(encodeURIComponent("NeRF: Representing scenes as neural radiance fields"));
  });
});
