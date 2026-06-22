import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  isStaleImportToDraftClaim,
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
