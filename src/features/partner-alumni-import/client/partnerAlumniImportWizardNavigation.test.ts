import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";

import { importFlowBasePath } from "@/src/features/partner-alumni-import/client/resumeStep";
import {
  guardPartnerAlumniImportStep,
  parseGuardedPartnerAlumniImportStep,
  serializePartnerAlumniImportStep,
} from "@/src/features/partner-alumni-import/client/usePartnerAlumniImportWizardStep";
import {
  pushHistoryUrl,
  readSearchParamsFromWindow,
  replaceHistoryUrl,
} from "@/src/lib/navigation/historyUrl";
import { buildPathWithSearchParams } from "@/src/lib/navigation/urlPath";

const scope = { seriesId: "series-1", versionId: "version-1" };

describe("guardPartnerAlumniImportStep", () => {
  it("blocks summary navigation while batch is still in review", () => {
    assert.equal(guardPartnerAlumniImportStep("review", "summary"), "review");
  });

  it("allows summary after import completes", () => {
    assert.equal(guardPartnerAlumniImportStep("imported", "summary"), "summary");
  });

  it("allows review only after validation promotes batch status", () => {
    assert.equal(guardPartnerAlumniImportStep("uploaded", "review"), "mapping");
    assert.equal(guardPartnerAlumniImportStep("review", "review"), "review");
  });
});

describe("URL synchronization", () => {
  it("serializes and parses guarded step query params", () => {
    const params = serializePartnerAlumniImportStep("validation");
    assert.equal(parseGuardedPartnerAlumniImportStep(params, "uploaded"), "validation");
    assert.equal(parseGuardedPartnerAlumniImportStep(params, "review"), "validation");
  });

  it("builds scoped wizard pathname for history writes", () => {
    const pathname = importFlowBasePath(scope, "batch-123");
    const href = buildPathWithSearchParams(pathname, serializePartnerAlumniImportStep("review"));
    assert.equal(
      href,
      "/admin/events/series/series-1/partner-alumni/versions/version-1/import/batch-123?step=review",
    );
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
        parseGuardedPartnerAlumniImportStep(readSearchParamsFromWindow(), "review"),
        "validation",
      );
      assert.equal(
        parseGuardedPartnerAlumniImportStep(readSearchParamsFromWindow(), "imported"),
        "summary",
      );
    } finally {
      Object.defineProperty(globalThis, "window", {
        configurable: true,
        value: originalWindow,
      });
    }
  });
});

describe("upload to mapping replace behavior", () => {
  it("uses replaceState for upload shim transitions", () => {
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

    const pathname = importFlowBasePath(scope, "batch-1");
    const href = buildPathWithSearchParams(pathname, serializePartnerAlumniImportStep("mapping"));

    try {
      replaceHistoryUrl(href);
      pushHistoryUrl(
        buildPathWithSearchParams(pathname, serializePartnerAlumniImportStep("validation")),
      );

      assert.equal(calls[0]?.mode, "replace");
      assert.match(calls[0]?.href ?? "", /step=mapping/);
      assert.equal(calls[1]?.mode, "push");
      assert.match(calls[1]?.href ?? "", /step=validation/);
    } finally {
      Object.defineProperty(globalThis, "history", {
        configurable: true,
        value: original,
      });
    }
  });

  it("UploadStep requests mapping with replace history", () => {
    const source = readFileSync(
      path.join(
        process.cwd(),
        "src/features/partner-alumni-import/components/steps/UploadStep.tsx",
      ),
      "utf8",
    );
    assert.match(source, /goToStep\("mapping", \{ history: "replace" \}\)/);
  });
});

describe("local batch status synchronization", () => {
  it("ValidationStep marks review status after validation succeeds", () => {
    const source = readFileSync(
      path.join(
        process.cwd(),
        "src/features/partner-alumni-import/components/steps/ValidationStep.tsx",
      ),
      "utf8",
    );
    assert.match(source, /markValidationComplete\(\)/);
    assert.match(source, /goToStep\("review"\)/);
  });

  it("ReviewQueueStep marks import complete before summary", () => {
    const source = readFileSync(
      path.join(
        process.cwd(),
        "src/features/partner-alumni-import/components/steps/ReviewQueueStep.tsx",
      ),
      "utf8",
    );
    assert.match(source, /markImportComplete\(\)/);
    assert.match(source, /goToStep\("summary"\)/);
    assert.match(source, /updateBatch\(review\.batch\)/);
  });

  it("ColumnMappingStep updates batch from saveColumnMapping response", () => {
    const source = readFileSync(
      path.join(
        process.cwd(),
        "src/features/partner-alumni-import/components/steps/ColumnMappingStep.tsx",
      ),
      "utf8",
    );
    assert.match(source, /updateBatch\(result\.batch\)/);
    assert.match(source, /goToStep\("validation"\)/);
  });
});

describe("in-flow step navigation policy", () => {
  const stepFiles = [
    "src/features/partner-alumni-import/components/steps/UploadStep.tsx",
    "src/features/partner-alumni-import/components/steps/ColumnMappingStep.tsx",
    "src/features/partner-alumni-import/components/steps/ValidationStep.tsx",
    "src/features/partner-alumni-import/components/steps/ReviewQueueStep.tsx",
    "src/features/partner-alumni-import/components/steps/ImportSummaryStep.tsx",
  ];

  for (const relativePath of stepFiles) {
    it(`${relativePath} does not use router.push/replace for step navigation`, () => {
      const source = readFileSync(path.join(process.cwd(), relativePath), "utf8");
      assert.equal(source.includes("router.push(flowHref"), false);
      assert.equal(source.includes("router.replace(flowHref"), false);
      assert.equal(source.includes("router.push(`/admin/events/series/"), false);
    });
  }
});

describe("cold-load redirect remains server-authoritative", () => {
  it("keeps resolveStepForBatch redirect in batch page loader", () => {
    const source = readFileSync(
      path.join(
        process.cwd(),
        "src/app/admin/events/series/[id]/partner-alumni/versions/[versionId]/import/[batchId]/page.tsx",
      ),
      "utf8",
    );
    assert.match(source, /resolveStepForBatch\(status, requestedStep\)/);
    assert.match(source, /redirect\(`\$\{basePath\}\?step=\$\{step\}`\)/);
  });
});

describe("intentional cross-route router usage remains", () => {
  it("NewImportForm still uses router.push to enter a new batch", () => {
    const source = readFileSync(
      path.join(
        process.cwd(),
        "src/features/partner-alumni-import/components/NewImportForm.tsx",
      ),
      "utf8",
    );
    assert.match(source, /router\.push\(flowHref/);
  });

  it("PartnerAlumniImportFlow still uses router.push on discard", () => {
    const source = readFileSync(
      path.join(
        process.cwd(),
        "src/features/partner-alumni-import/components/PartnerAlumniImportFlow.tsx",
      ),
      "utf8",
    );
    assert.match(source, /onDiscarded=\{\(\) => router\.push\(exitHref\)\}/);
  });
});
