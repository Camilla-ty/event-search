import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  applyEditionsListFilterChange,
  buildEditionsListParamsKey,
  deriveEditionsListFilter,
  shouldApplyEditionsListFetchResult,
} from "@/src/features/events/client/editionsListCollectionState";
import {
  buildEditionsListSearchParams,
  parseEditionsListParams,
  parseMissingFlag,
} from "@/src/features/events/server/editionsListParams";

describe("parseMissingFlag", () => {
  it("falls back to false for invalid missing flag values", () => {
    assert.equal(parseMissingFlag(undefined), false);
    assert.equal(parseMissingFlag("maybe"), false);
    assert.equal(parseMissingFlag("0"), false);
    assert.equal(parseMissingFlag("1"), true);
  });
});

describe("parseEditionsListParams", () => {
  it("round-trips missing filter params", () => {
    const parsed = parseEditionsListParams(
      new URLSearchParams("missingWebsite=1&missingDates=1&missingCity=1"),
    );
    assert.deepEqual(parsed, {
      missingWebsite: true,
      missingDates: true,
      missingCity: true,
    });

    const serialized = buildEditionsListSearchParams(parsed);
    assert.equal(
      serialized.toString(),
      "missingWebsite=1&missingDates=1&missingCity=1",
    );
    assert.deepEqual(parseEditionsListParams(serialized), parsed);
  });

  it("omits false flags from serialized params", () => {
    const serialized = buildEditionsListSearchParams({
      missingWebsite: false,
      missingDates: false,
      missingCity: false,
    });
    assert.equal(serialized.toString(), "");
  });
});

describe("editions list collection state", () => {
  it("applies exclusive filter changes", () => {
    const fromWebsite = applyEditionsListFilterChange(
      { missingWebsite: true, missingDates: false, missingCity: false },
      "missingDates",
    );
    assert.deepEqual(fromWebsite, {
      missingWebsite: false,
      missingDates: true,
      missingCity: false,
    });

    const all = applyEditionsListFilterChange(
      { missingWebsite: true, missingDates: false, missingCity: false },
      "all",
    );
    assert.deepEqual(all, {
      missingWebsite: false,
      missingDates: false,
      missingCity: false,
    });
  });

  it("derives active filter from params with website first", () => {
    assert.equal(
      deriveEditionsListFilter({
        missingWebsite: true,
        missingDates: true,
        missingCity: true,
      }),
      "missingWebsite",
    );
    assert.equal(
      deriveEditionsListFilter({
        missingWebsite: false,
        missingDates: true,
        missingCity: false,
      }),
      "missingDates",
    );
    assert.equal(
      deriveEditionsListFilter({
        missingWebsite: false,
        missingDates: false,
        missingCity: true,
      }),
      "missingCity",
    );
    assert.equal(
      deriveEditionsListFilter({
        missingWebsite: false,
        missingDates: false,
        missingCity: false,
      }),
      "all",
    );
  });

  it("builds stable params keys", () => {
    assert.equal(
      buildEditionsListParamsKey({
        missingWebsite: true,
        missingDates: false,
        missingCity: false,
      }),
      buildEditionsListParamsKey({
        missingWebsite: true,
        missingDates: false,
        missingCity: false,
      }),
    );
    assert.notEqual(
      buildEditionsListParamsKey({
        missingWebsite: true,
        missingDates: false,
        missingCity: false,
      }),
      buildEditionsListParamsKey({
        missingWebsite: false,
        missingDates: true,
        missingCity: false,
      }),
    );
  });

  it("ignores stale fetch results", () => {
    assert.equal(shouldApplyEditionsListFetchResult(1, 2), false);
    assert.equal(shouldApplyEditionsListFetchResult(2, 2), true);
  });
});
