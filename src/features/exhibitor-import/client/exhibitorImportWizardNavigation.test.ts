import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";

import {
  buildExhibitorImportWizardPathname,
  guardImportStep,
  parseGuardedImportStep,
  serializeImportStep,
} from "@/src/features/exhibitor-import/client/useExhibitorImportWizardStep";
import {
  pushHistoryUrl,
  readSearchParamsFromWindow,
  replaceHistoryUrl,
} from "@/src/lib/navigation/historyUrl";
import { buildPathWithSearchParams } from "@/src/lib/navigation/urlPath";
import { stepperIndex } from "@/src/features/exhibitor-import/client/resumeStep";

describe("guardImportStep", () => {
  it("blocks draft navigation while batch is still in review", () => {
    assert.equal(guardImportStep("review", "draft"), "review");
    assert.equal(guardImportStep("review", "publish"), "review");
  });

  it("allows publish only after batch status becomes draft", () => {
    assert.equal(guardImportStep("draft", "publish"), "publish");
    assert.equal(guardImportStep("draft", "review"), "draft");
  });
});

describe("URL synchronization helpers", () => {
  it("serializes and parses guarded step query params", () => {
    const params = serializeImportStep("validation");
    assert.equal(parseGuardedImportStep(params, "uploaded"), "validation");
    assert.equal(parseGuardedImportStep(params, "review"), "validation");
  });

  it("builds wizard pathname for history writes", () => {
    const pathname = buildExhibitorImportWizardPathname("batch-123");
    const href = buildPathWithSearchParams(pathname, serializeImportStep("review"));
    assert.equal(href, "/admin/exhibitor-imports/batch-123?step=review");
  });
});

describe("popstate restoration", () => {
  it("reads guarded step from window search params", () => {
    const originalWindow = globalThis.window;

    Object.defineProperty(globalThis, "window", {
      configurable: true,
      value: {
        location: { search: "?step=validation" },
      },
    });

    try {
      assert.equal(
        parseGuardedImportStep(readSearchParamsFromWindow(), "review"),
        "validation",
      );
      assert.equal(
        parseGuardedImportStep(readSearchParamsFromWindow(), "draft"),
        "draft",
      );
    } finally {
      Object.defineProperty(globalThis, "window", {
        configurable: true,
        value: originalWindow,
      });
    }
  });
});

describe("history API writers for wizard steps", () => {
  it("records pushState for forward step navigation", () => {
    const calls: Array<{ mode: "push" | "replace"; href: string }> = [];
    const original = globalThis.history;

    Object.defineProperty(globalThis, "history", {
      configurable: true,
      value: {
        pushState: (_state: unknown, _title: string, url: string | URL | null) => {
          calls.push({ mode: "push", href: String(url) });
        },
        replaceState: (_state: unknown, _title: string, url: string | URL | null) => {
          calls.push({ mode: "replace", href: String(url) });
        },
      },
    });

    try {
      pushHistoryUrl("/admin/exhibitor-imports/batch-1?step=validation");
      replaceHistoryUrl("/admin/exhibitor-imports/batch-1?step=mapping");

      assert.deepEqual(calls, [
        { mode: "push", href: "/admin/exhibitor-imports/batch-1?step=validation" },
        { mode: "replace", href: "/admin/exhibitor-imports/batch-1?step=mapping" },
      ]);
    } finally {
      Object.defineProperty(globalThis, "history", {
        configurable: true,
        value: original,
      });
    }
  });
});

describe("review to draft batch status transition", () => {
  it("requires draft status before publish step is allowed", () => {
    assert.equal(guardImportStep("review", "draft"), "review");
    assert.equal(guardImportStep("draft", "draft"), "draft");
  });
});

describe("upload to validation to review transition", () => {
  it("updates local status after validation so Review does not resolve back to Upload", () => {
    const validationStepSource = readFileSync(
      path.join(process.cwd(), "src/features/exhibitor-import/components/steps/ValidationStep.tsx"),
      "utf8",
    );
    const updateBatchIndex = validationStepSource.indexOf("updateBatch({");
    const reviewNavigationIndex = validationStepSource.indexOf('goToStep("review")');

    assert.ok(updateBatchIndex >= 0);
    assert.match(
      validationStepSource.slice(updateBatchIndex),
      /updateBatch\(\{\s*\.\.\.validationBatch,\s*status: "review",\s*processing_phase: null,\s*\}\)/,
    );
    assert.ok(updateBatchIndex < reviewNavigationIndex);

    const visitedSteps = [
      guardImportStep("uploaded", "upload"),
      guardImportStep("uploaded", "validation"),
      guardImportStep("review", "review"),
    ];

    assert.deepEqual(visitedSteps, ["upload", "validation", "review"]);
    assert.equal(stepperIndex(visitedSteps.at(-1)!), 2);
    assert.notEqual(stepperIndex(visitedSteps.at(-1)!), stepperIndex("upload"));
  });
});

describe("in-flow step navigation policy", () => {
  const stepFiles = [
    "src/features/exhibitor-import/components/steps/UploadStep.tsx",
    "src/features/exhibitor-import/components/steps/ColumnMappingStep.tsx",
    "src/features/exhibitor-import/components/steps/ValidationStep.tsx",
    "src/features/exhibitor-import/components/steps/ReviewQueueStep.tsx",
    "src/features/exhibitor-import/components/steps/DraftReviewStep.tsx",
    "src/features/exhibitor-import/components/steps/PublishStep.tsx",
  ];

  for (const relativePath of stepFiles) {
    it(`${relativePath} does not use router.push/replace for step navigation`, () => {
      const source = readFileSync(path.join(process.cwd(), relativePath), "utf8");
      assert.equal(source.includes("router.push(flowHref"), false);
      assert.equal(source.includes("router.replace(flowHref"), false);
      assert.equal(source.includes("router.push(`/admin/exhibitor-imports/"), false);
      assert.equal(source.includes("goToStep("), true);
    });
  }

  it("ColumnMappingStep advances to validation via goToStep after mapping save", () => {
    const source = readFileSync(
      path.join(process.cwd(), "src/features/exhibitor-import/components/steps/ColumnMappingStep.tsx"),
      "utf8",
    );
    assert.match(source, /updateBatch\(result\.batch\)/);
    assert.match(source, /goToStep\("validation"\)/);
    assert.equal(source.includes("router.push(flowHref"), false);
  });

  it("ReviewQueueStep opens draft via router navigation after finalize", () => {
    const source = readFileSync(
      path.join(process.cwd(), "src/features/exhibitor-import/components/steps/ReviewQueueStep.tsx"),
      "utf8",
    );
    assert.match(source, /openDraftStep\(\)/);
    assert.doesNotMatch(source, /goToStep\("draft"\)/);
  });
});

describe("cold-load redirect remains server-authoritative", () => {
  it("keeps resolveStepForBatch redirect in batch page loader", () => {
    const source = readFileSync(
      path.join(process.cwd(), "src/app/admin/exhibitor-imports/[batchId]/page.tsx"),
      "utf8",
    );
    assert.match(source, /resolveStepForBatch\(status, requestedStep\)/);
    assert.match(source, /redirect\(`\/admin\/exhibitor-imports\/\$\{batchId\}\?step=\$\{step\}`\)/);
  });
});
