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
import * as sinon from "sinon";

import { HistoryService } from "./history.service";
import { ElowenAnswer } from "../shared/api";
import { PaperData } from "../shared/types_local_storage";
import { ArxivMetadata } from "../shared/elowen_doc";
import * as httpApiModule from "../shared/http_api";

describe("HistoryService", () => {
  let historyService: HistoryService;
  let sandbox: sinon.SinonSandbox;

  const mockMetadata: ArxivMetadata = {
    paperId: "doc1",
    title: "Paper 1",
    authors: [],
    summary: "",
    updatedTimestamp: "",
    publishedTimestamp: "",
    version: "1",
  };

  const mockPaper1: PaperData = {
    metadata: mockMetadata,
    history: [],
    status: "complete",
    addedTimestamp: Date.now(),
  };
  const mockPaper2: PaperData = {
    metadata: { ...mockMetadata, paperId: "doc2", title: "Paper 2" },
    history: [],
    status: "complete",
    addedTimestamp: Date.now(),
  };
  const mockAnswer: ElowenAnswer = {
    id: "answer1",
    request: { query: "test query" },
    responseContent: [],
    timestamp: Date.now(),
  };

  beforeEach(() => {
    sandbox = sinon.createSandbox();
    sandbox.stub(httpApiModule.httpApi, "getLibrary").resolves([]);
    sandbox.stub(httpApiModule.httpApi, "putLibraryPaper").resolves(mockPaper1);
    sandbox.stub(httpApiModule.httpApi, "deleteLibraryPaper").resolves({
      status: "ok",
    });
    sandbox.stub(httpApiModule.httpApi, "clearLibrary").resolves({
      status: "ok",
    });
    historyService = new HistoryService();
  });

  afterEach(() => {
    sandbox.restore();
  });

  it("should be created", () => {
    expect(historyService).to.exist;
  });

  describe("Paper Lifecycle", () => {
    it("should initialize and load papers from the API", async () => {
      (httpApiModule.httpApi.getLibrary as sinon.SinonStub).resolves([
        mockPaper1,
      ]);

      await historyService.initialize();

      expect(historyService.paperMetadata.get("doc1")).to.deep.equal(
        mockPaper1.metadata
      );
      expect(historyService.getPaperHistory()).to.deep.include(mockPaper1);
    });

    it("should add a paper with 'loading' status", () => {
      const metadata: ArxivMetadata = {
        ...mockMetadata,
        title: "Loading Paper",
      };
      historyService.addLoadingPaper("doc1", metadata);

      expect(historyService.paperMetadata.has("doc1")).to.be.true;
      expect(historyService.getPaperData("doc1")?.status).to.equal("loading");
      expect(
        (httpApiModule.httpApi.putLibraryPaper as sinon.SinonStub).called
      ).to.be.true;
    });

    it("should update a loading paper to complete", () => {
      historyService.addLoadingPaper("doc1", mockMetadata);
      historyService.addPaper("doc1", mockMetadata);

      expect(historyService.getPaperData("doc1")?.status).to.equal("complete");
    });

    it("should add a new complete paper", () => {
      historyService.addPaper("doc1", mockMetadata);

      expect(historyService.paperMetadata.get("doc1")).to.deep.equal(
        mockMetadata
      );
      expect(historyService.getPaperData("doc1")?.status).to.equal("complete");
    });

    it("should return paper history from memory", () => {
      historyService.paperDataMap.set("doc1", mockPaper1);
      historyService.paperDataMap.set("doc2", mockPaper2);

      const papers = historyService.getPaperHistory();
      expect(papers).to.have.lengthOf(2);
    });

    it("should delete a paper", () => {
      historyService.paperMetadata.set("doc1", mockPaper1.metadata);
      historyService.answers.set("doc1", []);
      historyService.personalSummaries.set("doc1", mockAnswer);
      historyService.paperDataMap.set("doc1", mockPaper1);

      historyService.deletePaper("doc1");

      expect(historyService.paperMetadata.has("doc1")).to.be.false;
      expect(historyService.answers.has("doc1")).to.be.false;
      expect(historyService.personalSummaries.has("doc1")).to.be.false;
      expect(
        (httpApiModule.httpApi.deleteLibraryPaper as sinon.SinonStub).calledWith(
          "doc1"
        )
      ).to.be.true;
    });

    it("should clear answers when deleting a paper", () => {
      historyService.paperDataMap.set("doc1", mockPaper1);
      historyService.addAnswer("doc1", mockAnswer);
      expect(historyService.getAnswers("doc1")).to.deep.equal([mockAnswer]);

      historyService.deletePaper("doc1");

      expect(historyService.getAnswers("doc1")).to.deep.equal([]);
    });

    it("should clear all history", () => {
      historyService.paperDataMap.set("doc1", mockPaper1);
      historyService.paperMetadata.set("doc1", mockPaper1.metadata);

      historyService.clearAllHistory();

      expect(historyService.paperMetadata.size).to.equal(0);
      expect(historyService.answers.size).to.equal(0);
      expect(historyService.personalSummaries.size).to.equal(0);
      expect(
        (httpApiModule.httpApi.clearLibrary as sinon.SinonStub).called
      ).to.be.true;
    });
  });

  describe("Answers", () => {
    it("should load answers from hydrated papers", async () => {
      (httpApiModule.httpApi.getLibrary as sinon.SinonStub).resolves([
        { ...mockPaper1, history: [mockAnswer] },
      ]);
      await historyService.initialize();

      expect(historyService.getAnswers("doc1")).to.deep.equal([mockAnswer]);
    });

    it("should add an answer", () => {
      historyService.paperDataMap.set("doc1", mockPaper1);
      historyService.addAnswer("doc1", mockAnswer);

      expect(historyService.getAnswers("doc1")).to.deep.equal([mockAnswer]);
    });

    it("should remove an answer", () => {
      historyService.paperDataMap.set("doc1", mockPaper1);
      historyService.addAnswer("doc1", mockAnswer);
      historyService.removeAnswer("doc1", mockAnswer.id);

      expect(historyService.getAnswers("doc1")).to.deep.equal([]);
    });
  });

  describe("Personal Summaries", () => {
    it("should load personal summaries from hydrated papers", async () => {
      (httpApiModule.httpApi.getLibrary as sinon.SinonStub).resolves([
        { ...mockPaper1, personalSummary: mockAnswer },
      ]);
      await historyService.initialize();

      expect(historyService.personalSummaries.get("doc1")).to.deep.equal(
        mockAnswer
      );
    });

    it("should add a personal summary", () => {
      historyService.paperDataMap.set("doc1", mockPaper1);
      historyService.addPersonalSummary("doc1", mockAnswer);

      expect(historyService.personalSummaries.get("doc1")).to.deep.equal(
        mockAnswer
      );
    });
  });

  describe("Temporary Answers", () => {
    it("should add a temporary answer", () => {
      historyService.addTemporaryAnswer(mockAnswer);
      expect(historyService.temporaryAnswers).to.deep.include(mockAnswer);
    });

    it("should get temporary answers", () => {
      historyService.temporaryAnswers = [mockAnswer];
      const tempAnswers = historyService.getTemporaryAnswers();
      expect(tempAnswers).to.deep.equal([mockAnswer]);
    });

    it("should remove a temporary answer", () => {
      const answer2 = { ...mockAnswer, id: "answer2" };
      historyService.temporaryAnswers = [mockAnswer, answer2];
      historyService.removeTemporaryAnswer("answer1");
      expect(historyService.temporaryAnswers).to.have.lengthOf(1);
      expect(historyService.temporaryAnswers[0].id).to.equal("answer2");
    });

    it("should clear temporary answers", () => {
      historyService.temporaryAnswers = [mockAnswer];
      historyService.clearTemporaryAnswers();
      expect(historyService.temporaryAnswers).to.be.empty;
    });
  });
});
