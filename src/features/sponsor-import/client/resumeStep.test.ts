import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  defaultStepForBatchStatus,
  parseImportStep,
  resolveStepForBatch,
} from "@/src/features/sponsor-import/client/resumeStep";
import type { ImportStep } from "@/src/features/sponsor-import/client/types";
import type { SponsorImportBatchStatus } from "@/src/features/sponsor-import/types";

describe("parseImportStep", () => {
  it("parses known step query values", () => {
    assert.equal(parseImportStep("mapping"), "mapping");
    assert.equal(parseImportStep("validation"), "validation");
    assert.equal(parseImportStep("review"), "review");
    assert.equal(parseImportStep("draft"), "draft");
    assert.equal(parseImportStep("publish"), "publish");
  });

  it("returns null for unknown values", () => {
    assert.equal(parseImportStep("summary"), null);
    assert.equal(parseImportStep(null), null);
  });
});

describe("defaultStepForBatchStatus", () => {
  it("maps batch statuses to resume steps", () => {
    assert.equal(defaultStepForBatchStatus("uploaded"), "mapping");
    assert.equal(defaultStepForBatchStatus("review"), "review");
    assert.equal(defaultStepForBatchStatus("draft"), "draft");
    assert.equal(defaultStepForBatchStatus("published"), "publish");
    assert.equal(defaultStepForBatchStatus("discarded"), "publish");
  });
});

describe("resolveStepForBatch", () => {
  const cases: Array<{
    status: SponsorImportBatchStatus;
    requested: ImportStep | null;
    expected: ImportStep;
  }> = [
    { status: "uploaded", requested: "mapping", expected: "mapping" },
    { status: "uploaded", requested: "validation", expected: "validation" },
    { status: "uploaded", requested: "review", expected: "mapping" },
    { status: "uploaded", requested: "draft", expected: "mapping" },
    { status: "uploaded", requested: "publish", expected: "mapping" },
    { status: "uploaded", requested: null, expected: "mapping" },
    { status: "review", requested: "validation", expected: "validation" },
    { status: "review", requested: "mapping", expected: "mapping" },
    { status: "review", requested: "review", expected: "review" },
    { status: "review", requested: "draft", expected: "review" },
    { status: "review", requested: "publish", expected: "review" },
    { status: "review", requested: null, expected: "review" },
    { status: "draft", requested: "draft", expected: "draft" },
    { status: "draft", requested: "publish", expected: "publish" },
    { status: "draft", requested: "review", expected: "draft" },
    { status: "draft", requested: "validation", expected: "draft" },
    { status: "published", requested: "review", expected: "publish" },
    { status: "discarded", requested: "draft", expected: "publish" },
  ];

  for (const { status, requested, expected } of cases) {
    it(`status=${status} requested=${String(requested)} -> ${expected}`, () => {
      assert.equal(resolveStepForBatch(status, requested), expected);
    });
  }
});
