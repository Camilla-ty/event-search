import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  isStaleImportProcessingPhaseClaim,
  isStaleImportToDraftClaim,
  isStaleMaterializingCompaniesClaim,
  STALE_IMPORT_TO_DRAFT_MS,
} from "./batchGuards";

describe("isStaleImportToDraftClaim", () => {
  const now = Date.parse("2026-06-22T16:00:00.000Z");

  it("returns false when phase is null", () => {
    assert.equal(
      isStaleImportToDraftClaim(
        { processing_phase: null, status: "review", updated_at: "2026-06-22T15:00:00.000Z" },
        now,
      ),
      false,
    );
  });

  it("returns false when batch is not in review", () => {
    assert.equal(
      isStaleImportToDraftClaim(
        {
          processing_phase: "importing_to_draft",
          status: "draft",
          updated_at: "2026-06-22T15:00:00.000Z",
        },
        now,
      ),
      false,
    );
  });

  it("returns false for a recent importing_to_draft claim", () => {
    assert.equal(
      isStaleImportToDraftClaim(
        {
          processing_phase: "importing_to_draft",
          status: "review",
          updated_at: new Date(now - STALE_IMPORT_TO_DRAFT_MS + 60_000).toISOString(),
        },
        now,
      ),
      false,
    );
  });

  it("returns true for an old importing_to_draft claim", () => {
    assert.equal(
      isStaleImportToDraftClaim(
        {
          processing_phase: "importing_to_draft",
          status: "review",
          updated_at: new Date(now - STALE_IMPORT_TO_DRAFT_MS - 1).toISOString(),
        },
        now,
      ),
      true,
    );
  });

  it("returns true when updated_at is missing", () => {
    assert.equal(
      isStaleImportToDraftClaim(
        { processing_phase: "importing_to_draft", status: "review", updated_at: null },
        now,
      ),
      true,
    );
  });
});

describe("isStaleMaterializingCompaniesClaim", () => {
  const now = Date.parse("2026-06-22T16:00:00.000Z");

  it("returns false when phase is null", () => {
    assert.equal(
      isStaleMaterializingCompaniesClaim(
        { processing_phase: null, status: "review", updated_at: "2026-06-22T15:00:00.000Z" },
        now,
      ),
      false,
    );
  });

  it("returns true for an old materializing_companies claim", () => {
    assert.equal(
      isStaleMaterializingCompaniesClaim(
        {
          processing_phase: "materializing_companies",
          status: "review",
          updated_at: new Date(now - STALE_IMPORT_TO_DRAFT_MS - 1).toISOString(),
        },
        now,
      ),
      true,
    );
  });

  it("returns false for a recent materializing_companies claim", () => {
    assert.equal(
      isStaleMaterializingCompaniesClaim(
        {
          processing_phase: "materializing_companies",
          status: "review",
          updated_at: new Date(now - STALE_IMPORT_TO_DRAFT_MS + 60_000).toISOString(),
        },
        now,
      ),
      false,
    );
  });
});

describe("isStaleImportProcessingPhaseClaim", () => {
  const now = Date.parse("2026-06-22T16:00:00.000Z");

  it("returns false for unrelated phases", () => {
    assert.equal(
      isStaleImportProcessingPhaseClaim(
        { processing_phase: "publishing", status: "review", updated_at: null },
        now,
      ),
      false,
    );
  });

  it("returns true for stale materializing_companies", () => {
    assert.equal(
      isStaleImportProcessingPhaseClaim(
        {
          processing_phase: "materializing_companies",
          status: "review",
          updated_at: new Date(now - STALE_IMPORT_TO_DRAFT_MS - 1).toISOString(),
        },
        now,
      ),
      true,
    );
  });
});
