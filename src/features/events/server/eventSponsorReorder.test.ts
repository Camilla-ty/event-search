import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  computeMoveOrderedLinkIds,
  validateTierReorderLinkIds,
} from "./eventSponsorReorder";

describe("validateTierReorderLinkIds", () => {
  const siblingIds = ["a", "b", "c"];

  it("accepts a complete permutation", () => {
    const result = validateTierReorderLinkIds(["b", "a", "c"], siblingIds);
    assert.equal(result.ok, true);
  });

  it("rejects an empty ordered list", () => {
    const result = validateTierReorderLinkIds([], siblingIds);
    assert.equal(result.ok, false);
    if (!result.ok) {
      assert.match(result.error, /must not be empty/);
    }
  });

  it("rejects a partial ordered list", () => {
    const result = validateTierReorderLinkIds(["a", "b"], siblingIds);
    assert.equal(result.ok, false);
    if (!result.ok) {
      assert.match(result.error, /every sponsor in this tier/);
    }
  });

  it("rejects IDs outside the tier", () => {
    const result = validateTierReorderLinkIds(["a", "b", "outside"], siblingIds);
    assert.equal(result.ok, false);
    if (!result.ok) {
      assert.match(result.error, /outside this tier/);
    }
  });

  it("rejects duplicate IDs", () => {
    const result = validateTierReorderLinkIds(["a", "a", "c"], siblingIds);
    assert.equal(result.ok, false);
    if (!result.ok) {
      assert.match(result.error, /duplicates/);
    }
  });
});

describe("computeMoveOrderedLinkIds", () => {
  const orderedIds = ["one", "two", "three"];

  it("moves a sponsor up within the tier", () => {
    assert.deepEqual(computeMoveOrderedLinkIds(orderedIds, "two", "up"), [
      "two",
      "one",
      "three",
    ]);
  });

  it("moves a sponsor down within the tier", () => {
    assert.deepEqual(computeMoveOrderedLinkIds(orderedIds, "two", "down"), [
      "one",
      "three",
      "two",
    ]);
  });

  it("returns null at the top boundary", () => {
    assert.equal(computeMoveOrderedLinkIds(orderedIds, "one", "up"), null);
  });

  it("returns null at the bottom boundary", () => {
    assert.equal(computeMoveOrderedLinkIds(orderedIds, "three", "down"), null);
  });

  it("returns null when the link is not in the tier", () => {
    assert.equal(computeMoveOrderedLinkIds(orderedIds, "missing", "up"), null);
  });
});
