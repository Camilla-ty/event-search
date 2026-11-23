import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  assertNoActiveProcessingPhase,
  assertNotMatching,
  IMPORT_IN_PROGRESS_REVIEW_MESSAGE,
  isStaleImportProcessingPhaseClaim,
  isStaleImportToDraftClaim,
  isStaleMaterializingCompaniesClaim,
  MAPPING_IN_PROGRESS_REVIEW_MESSAGE,
  MATCHING_IN_PROGRESS_MUTATION_MESSAGE,
  STALE_IMPORT_TO_DRAFT_MS,
  VALIDATION_IN_PROGRESS_REVIEW_MESSAGE,
} from "./batchGuards";
import { SponsorImportHttpError } from "./errors";

describe("assertNotMatching", () => {
  it("rejects with 409 while processing_phase is matching", () => {
    assert.throws(
      () => assertNotMatching({ processing_phase: "matching" }),
      (error: unknown) => {
        assert.ok(error instanceof SponsorImportHttpError);
        assert.equal(error.status, 409);
        assert.equal(error.message, MATCHING_IN_PROGRESS_MUTATION_MESSAGE);
        return true;
      },
    );
  });

  it("allows every other phase", () => {
    for (const phase of [null, "validating", "materializing_companies", "importing_to_draft"]) {
      assert.doesNotThrow(() => assertNotMatching({ processing_phase: phase }));
    }
  });
});

describe("assertNoActiveProcessingPhase", () => {
  const blocking: Array<[phase: string, message: string]> = [
    ["matching", MATCHING_IN_PROGRESS_MUTATION_MESSAGE],
    ["parsing", MAPPING_IN_PROGRESS_REVIEW_MESSAGE],
    ["validating", VALIDATION_IN_PROGRESS_REVIEW_MESSAGE],
    ["materializing_companies", IMPORT_IN_PROGRESS_REVIEW_MESSAGE],
    ["importing_to_draft", IMPORT_IN_PROGRESS_REVIEW_MESSAGE],
  ];

  for (const [phase, message] of blocking) {
    it(`rejects with 409 while processing_phase is ${phase}`, () => {
      assert.throws(
        () => assertNoActiveProcessingPhase({ processing_phase: phase }),
        (error: unknown) => {
          assert.ok(error instanceof SponsorImportHttpError, "expected a SponsorImportHttpError");
          assert.equal(error.status, 409);
          assert.equal(error.message, message);
          assert.deepEqual(error.details, { processing_phase: phase });
          return true;
        },
      );
    });
  }

  it("allows an idle batch", () => {
    assert.doesNotThrow(() => assertNoActiveProcessingPhase({ processing_phase: null }));
  });
});

describe("isStaleImportProcessingPhaseClaim and matching", () => {
  it("never auto-clears a matching claim from the materialize/import recovery path", () => {
    assert.equal(
      isStaleImportProcessingPhaseClaim(
        { processing_phase: "matching", status: "review", updated_at: "2026-01-01T00:00:00.000Z" },
        Date.parse("2026-11-18T00:00:00.000Z"),
      ),
      false,
    );
  });
});

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

  it("allows a full 300s chunk with margin before a claim is stale", () => {
    assert.equal(STALE_IMPORT_TO_DRAFT_MS, 10 * 60 * 1000);
    for (const ageMs of [5 * 60 * 1000, 300_000 + 60_000]) {
      assert.equal(
        isStaleImportProcessingPhaseClaim(
          {
            processing_phase: "materializing_companies",
            status: "review",
            updated_at: new Date(now - ageMs).toISOString(),
          },
          now,
        ),
        false,
        `a claim refreshed ${ageMs}ms ago must not be stale`,
      );
    }
  });

  it("returns false for an unparseable updated_at", () => {
    assert.equal(
      isStaleImportProcessingPhaseClaim(
        { processing_phase: "importing_to_draft", status: "review", updated_at: "not a timestamp" },
        now,
      ),
      false,
    );
  });
});

describe("isStaleImportProcessingPhaseClaim with zone-less database timestamps", () => {
  /** `timestamp without time zone` text as PostgREST returns it (UTC, no zone suffix). */
  const dbTimestamp = (ms: number) => new Date(ms).toISOString().replace("Z", "");
  const now = Date.parse("2026-06-22T16:00:00.000Z");

  function withTimeZone(timeZone: string, run: () => void) {
    const previous = process.env.TZ;
    process.env.TZ = timeZone;
    try {
      run();
    } finally {
      if (previous === undefined) delete process.env.TZ;
      else process.env.TZ = previous;
    }
  }

  for (const timeZone of ["UTC", "Asia/Singapore"]) {
    it(`judges claims by their UTC age under TZ=${timeZone}`, () => {
      withTimeZone(timeZone, () => {
        const localParseOffsetMs = Date.parse(dbTimestamp(now)) - now;
        if (timeZone === "Asia/Singapore") {
          assert.equal(localParseOffsetMs, -8 * 60 * 60 * 1000, "the TZ switch must take effect for this test to mean anything");
        }

        for (const phase of ["materializing_companies", "importing_to_draft"]) {
          assert.equal(
            isStaleImportProcessingPhaseClaim(
              { processing_phase: phase, status: "review", updated_at: dbTimestamp(now - 60_000) },
              now,
            ),
            false,
            `an active ${phase} claim must not be stale under TZ=${timeZone}`,
          );
          assert.equal(
            isStaleImportProcessingPhaseClaim(
              { processing_phase: phase, status: "review", updated_at: dbTimestamp(now - STALE_IMPORT_TO_DRAFT_MS) },
              now,
            ),
            true,
            `an abandoned ${phase} claim must be stale under TZ=${timeZone}`,
          );
        }
      });
    });
  }
});
