import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";

import {
  buildImportDraftStepHref,
  shouldRedirectReviewToDraft,
  shouldShowImportToDraftButton,
  shouldSkipImportToDraftMaterialization,
} from "@/src/features/sponsor-import/client/importDraftNavigation";
import { resolveStepForBatch } from "@/src/features/sponsor-import/client/resumeStep";

const BATCH_ID = "72749a60-a592-4d77-b7e8-7d702cb6a022";

describe("importDraftNavigation", () => {
  it("builds the draft wizard href", () => {
    assert.equal(
      buildImportDraftStepHref(BATCH_ID),
      `/admin/sponsor-imports/${BATCH_ID}?step=draft`,
    );
  });

  it("redirects review to draft when batch status is draft", () => {
    assert.equal(shouldRedirectReviewToDraft("draft", "review"), true);
    assert.equal(shouldRedirectReviewToDraft("review", "review"), false);
    assert.equal(shouldRedirectReviewToDraft("draft", "draft"), false);
  });

  it("skips materialization when batch is already draft", () => {
    assert.equal(shouldSkipImportToDraftMaterialization("draft"), true);
    assert.equal(shouldSkipImportToDraftMaterialization("review"), false);
  });

  it("shows import button only while batch is in review", () => {
    assert.equal(shouldShowImportToDraftButton("review"), true);
    assert.equal(shouldShowImportToDraftButton("draft"), false);
  });

  it("cold-load review query redirects to draft for draft batches", () => {
    assert.equal(resolveStepForBatch("draft", "review"), "draft");
  });
});

describe("review to draft client navigation policy", () => {
  it("ReviewQueueStep opens draft via router.replace after successful finalize", () => {
    const source = readFileSync(
      path.join(process.cwd(), "src/features/sponsor-import/components/steps/ReviewQueueStep.tsx"),
      "utf8",
    );
    assert.match(source, /openDraftStep\(\)/);
    assert.doesNotMatch(source, /goToStep\("draft"\)/);
    assert.doesNotMatch(source, /markImportToDraftComplete\(\)/);
  });

  it("ReviewQueueStep skips materialization when batch is already draft", () => {
    const source = readFileSync(
      path.join(process.cwd(), "src/features/sponsor-import/components/steps/ReviewQueueStep.tsx"),
      "utf8",
    );
    assert.match(source, /shouldSkipImportToDraftMaterialization\(batch\.status\)/);
    assert.match(source, /openDraftStep\(\)/);
  });

  it("SponsorImportFlow navigates with router.replace and hides review for draft batches", () => {
    const source = readFileSync(
      path.join(process.cwd(), "src/features/sponsor-import/components/SponsorImportFlow.tsx"),
      "utf8",
    );
    assert.match(source, /router\.replace\(flowHref\(localBatch\.id, "draft"\)\)/);
    assert.match(source, /localBatch\.status !== "draft"/);
    assert.match(source, /OpenDraftFallback/);
  });
});

describe("materialize endpoints after draft completion", () => {
  it("returns completed company materialization instead of 409 when batch is draft", () => {
    const source = readFileSync(
      path.join(process.cwd(), "src/features/sponsor-import/server/sponsorImportAdmin.ts"),
      "utf8",
    );
    assert.match(
      source,
      /if \(batch\.status === "draft"\) \{\s*return buildCompletedCompanyMaterializationResult\(batchId\);/,
    );
  });

  it("returns completed draft-link materialization instead of 409 when batch is draft", () => {
    const source = readFileSync(
      path.join(process.cwd(), "src/features/sponsor-import/server/sponsorImportAdmin.ts"),
      "utf8",
    );
    assert.match(
      source,
      /if \(batch\.status === "draft"\) \{\s*return buildCompletedDraftLinksMaterializationResult\(batchId\);/,
    );
  });

  it("keeps finalize idempotent for draft batches", () => {
    const source = readFileSync(
      path.join(process.cwd(), "src/features/sponsor-import/server/sponsorImportAdmin.ts"),
      "utf8",
    );
    assert.match(source, /if \(batch\.status === "draft"\) \{\s*return resolveIdempotentImportToDraftResult\(batchId\);/);
  });
});

describe("duplicate safety during materialization", () => {
  it("skips rows that already have resolved_company_id", () => {
    const source = readFileSync(
      path.join(process.cwd(), "src/features/sponsor-import/server/materializeCompanies.ts"),
      "utf8",
    );
    assert.match(source, /resolved_company_id/);
  });

  it("materializes draft links only for rows missing draft_link_id", () => {
    const source = readFileSync(
      path.join(process.cwd(), "src/features/sponsor-import/server/materializeDraft.ts"),
      "utf8",
    );
    assert.match(source, /draft_link_id IS NULL|draft_link_id", null|is\("draft_link_id", null\)/);
  });
});
