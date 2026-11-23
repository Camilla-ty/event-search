import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  isMatchingHeartbeatDue,
  isMatchingRunCurrent,
  isStaleMatchingClaim,
  MATCHING_HEARTBEAT_INTERVAL_MS,
  MATCHING_HEARTBEAT_ROW_INTERVAL,
  parseUtcTimestampMs,
  resolveMatchClaimFailure,
  shouldSkipMatchingBecauseAlreadyComplete,
  STALE_MATCHING_CLAIM_MS,
} from "./matchRunPolicy";

describe("parseUtcTimestampMs", () => {
  const expected = Date.parse("2026-11-18T09:02:57.709Z");

  it("reads zone-less database timestamps as UTC regardless of the server time zone", () => {
    assert.equal(parseUtcTimestampMs("2026-11-18T09:02:57.709"), expected);
    assert.equal(parseUtcTimestampMs("2026-11-18 09:02:57.709"), expected);
  });

  it("keeps explicit zones", () => {
    assert.equal(parseUtcTimestampMs("2026-11-18T09:02:57.709Z"), expected);
    assert.equal(parseUtcTimestampMs("2026-11-18T17:02:57.709+08:00"), expected);
  });

  it("accepts microsecond precision", () => {
    assert.equal(parseUtcTimestampMs("2026-11-18 09:02:57.709123"), expected);
  });

  it("returns NaN for unparseable input", () => {
    assert.ok(Number.isNaN(parseUtcTimestampMs("not a timestamp")));
  });
});

describe("isStaleMatchingClaim", () => {
  const renewedAt = "2026-11-18T09:00:00.000";
  const renewedAtMs = Date.parse("2026-11-18T09:00:00.000Z");

  it("is not stale one millisecond before the threshold", () => {
    assert.equal(
      isStaleMatchingClaim(
        { processing_phase: "matching", updated_at: renewedAt },
        renewedAtMs + STALE_MATCHING_CLAIM_MS - 1,
      ),
      false,
    );
  });

  it("is stale at the threshold", () => {
    assert.equal(
      isStaleMatchingClaim(
        { processing_phase: "matching", updated_at: renewedAt },
        renewedAtMs + STALE_MATCHING_CLAIM_MS,
      ),
      true,
    );
  });

  it("is never stale for other phases, missing, or unparseable timestamps", () => {
    const later = renewedAtMs + 24 * 60 * 60 * 1000;
    assert.equal(isStaleMatchingClaim({ processing_phase: null, updated_at: renewedAt }, later), false);
    assert.equal(
      isStaleMatchingClaim({ processing_phase: "importing_to_draft", updated_at: renewedAt }, later),
      false,
    );
    assert.equal(isStaleMatchingClaim({ processing_phase: "matching", updated_at: null }, later), false);
    assert.equal(isStaleMatchingClaim({ processing_phase: "matching", updated_at: "garbage" }, later), false);
  });

  it("keeps the threshold well above the heartbeat interval and the 300s route limit", () => {
    assert.ok(STALE_MATCHING_CLAIM_MS >= 2 * 300 * 1000);
    assert.ok(STALE_MATCHING_CLAIM_MS >= 10 * MATCHING_HEARTBEAT_INTERVAL_MS);
  });
});

describe("isMatchingHeartbeatDue", () => {
  it("is due after the row interval or the time interval, whichever comes first", () => {
    assert.equal(isMatchingHeartbeatDue(MATCHING_HEARTBEAT_ROW_INTERVAL - 1, 0), false);
    assert.equal(isMatchingHeartbeatDue(MATCHING_HEARTBEAT_ROW_INTERVAL, 0), true);
    assert.equal(isMatchingHeartbeatDue(0, MATCHING_HEARTBEAT_INTERVAL_MS - 1), false);
    assert.equal(isMatchingHeartbeatDue(0, MATCHING_HEARTBEAT_INTERVAL_MS), true);
  });
});

describe("isMatchingRunCurrent", () => {
  it("is current when matching_run is the newest relevant log", () => {
    assert.equal(isMatchingRunCurrent("matching_run"), true);
  });

  it("is stale when column mapping or validation was logged after matching", () => {
    assert.equal(isMatchingRunCurrent("column_mapping_saved"), false);
    assert.equal(isMatchingRunCurrent("validation_run"), false);
  });

  it("is not current when no relevant log exists", () => {
    assert.equal(isMatchingRunCurrent(null), false);
  });
});

describe("shouldSkipMatchingBecauseAlreadyComplete", () => {
  it("skips when a matching_run exists and force is false", () => {
    assert.equal(shouldSkipMatchingBecauseAlreadyComplete(false, true), true);
  });

  it("does not skip when no matching_run exists", () => {
    assert.equal(shouldSkipMatchingBecauseAlreadyComplete(false, false), false);
  });

  it("does not skip when force is true even if a matching_run exists", () => {
    assert.equal(shouldSkipMatchingBecauseAlreadyComplete(true, true), false);
  });

  it("does not skip when force is true and no matching_run exists", () => {
    assert.equal(shouldSkipMatchingBecauseAlreadyComplete(true, false), false);
  });
});

describe("resolveMatchClaimFailure", () => {
  it("reports in-progress when processing_phase is matching", () => {
    assert.equal(resolveMatchClaimFailure("matching"), "in_progress");
  });

  it("reports could_not_start for any other phase", () => {
    assert.equal(resolveMatchClaimFailure(null), "could_not_start");
    assert.equal(resolveMatchClaimFailure("validating"), "could_not_start");
    assert.equal(resolveMatchClaimFailure("materializing_companies"), "could_not_start");
  });
});
