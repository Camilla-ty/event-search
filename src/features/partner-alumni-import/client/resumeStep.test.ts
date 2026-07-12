import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  defaultStepForBatchStatus,
  parseImportStep,
  resolveStepForBatch,
} from "@/src/features/partner-alumni-import/client/resumeStep";
import type { ImportStep } from "@/src/features/partner-alumni-import/client/types";
import type { PartnerAlumniImportBatchStatus } from "@/src/features/partner-alumni-import/types";

describe("parseImportStep", () => {
  it("parses known partner alumni step query values", () => {
    assert.equal(parseImportStep("mapping"), "mapping");
    assert.equal(parseImportStep("validation"), "validation");
    assert.equal(parseImportStep("review"), "review");
    assert.equal(parseImportStep("summary"), "summary");
  });

  it("returns null for sponsor-only step values", () => {
    assert.equal(parseImportStep("draft"), null);
    assert.equal(parseImportStep("publish"), null);
  });
});

describe("defaultStepForBatchStatus", () => {
  it("maps partner alumni batch statuses to resume steps", () => {
    assert.equal(defaultStepForBatchStatus("uploaded"), "mapping");
    assert.equal(defaultStepForBatchStatus("review"), "review");
    assert.equal(defaultStepForBatchStatus("imported"), "summary");
    assert.equal(defaultStepForBatchStatus("discarded"), "summary");
  });
});

describe("resolveStepForBatch", () => {
  const cases: Array<{
    status: PartnerAlumniImportBatchStatus;
    requested: ImportStep | null;
    expected: ImportStep;
  }> = [
    { status: "uploaded", requested: "mapping", expected: "mapping" },
    { status: "uploaded", requested: "validation", expected: "validation" },
    { status: "uploaded", requested: "review", expected: "mapping" },
    { status: "uploaded", requested: "summary", expected: "mapping" },
    { status: "uploaded", requested: null, expected: "mapping" },
    { status: "review", requested: "validation", expected: "validation" },
    { status: "review", requested: "mapping", expected: "mapping" },
    { status: "review", requested: "review", expected: "review" },
    { status: "review", requested: "summary", expected: "review" },
    { status: "review", requested: null, expected: "review" },
    { status: "imported", requested: "review", expected: "summary" },
    { status: "discarded", requested: "mapping", expected: "summary" },
  ];

  for (const { status, requested, expected } of cases) {
    it(`status=${status} requested=${String(requested)} -> ${expected}`, () => {
      assert.equal(resolveStepForBatch(status, requested), expected);
    });
  }
});
