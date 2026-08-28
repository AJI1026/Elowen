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

import { expect } from "chai";
import {
  isLikelyWikipediaLookupTerm,
  wikipediaTermCandidates,
} from "./wikipedia_utils";

describe("wikipedia_utils", () => {
  describe("isLikelyWikipediaLookupTerm", () => {
    it("accepts short technical terms", () => {
      expect(isLikelyWikipediaLookupTerm("Order Independent Transparency")).to
        .be.true;
      expect(isLikelyWikipediaLookupTerm("高斯溅射")).to.be.true;
    });

    it("rejects long passages and math debris", () => {
      expect(
        isLikelyWikipediaLookupTerm(
          "This is a very long sentence that is clearly not a single encyclopedia lookup term and should be skipped."
        )
      ).to.be.false;
      expect(isLikelyWikipediaLookupTerm("∑ α_i w(d_i)")).to.be.false;
      expect(isLikelyWikipediaLookupTerm("")).to.be.false;
    });
  });

  describe("wikipediaTermCandidates", () => {
    it("includes phrase without parenthetical and acronym", () => {
      expect(
        wikipediaTermCandidates("Order Independent Transparency (OIT)")
      ).to.deep.equal([
        "Order Independent Transparency (OIT)",
        "Order Independent Transparency",
        "OIT",
      ]);
    });
  });
});
