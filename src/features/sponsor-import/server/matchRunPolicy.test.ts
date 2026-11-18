import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  isMatchingRunCurrent,
  resolveMatchClaimFailure,
  shouldSkipMatchingBecauseAlreadyComplete,
} from "./matchRunPolicy";

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
